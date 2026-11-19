"""Database access.

Every user-facing query runs inside a transaction that adopts the caller's identity exactly as
Supabase's own API does: ``role authenticated`` plus the verified JWT claims. RLS policies and the
``auth.uid()`` checks inside the SQL business functions therefore apply to the API as well.
"""

import json
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection, AsyncEngine, create_async_engine

from app.core.config import get_settings

_engine: AsyncEngine | None = None


def get_engine() -> AsyncEngine:
    global _engine
    if _engine is None:
        s = get_settings()
        _engine = create_async_engine(
            s.database_url,
            pool_size=s.db_pool_size,
            max_overflow=s.db_max_overflow,
            pool_pre_ping=True,
            # Supavisor transaction mode cannot share prepared statements between clients.
            connect_args={"statement_cache_size": 0, "prepared_statement_cache_size": 0},
        )
    return _engine


async def dispose_engine() -> None:
    global _engine
    if _engine is not None:
        await _engine.dispose()
        _engine = None


@asynccontextmanager
async def user_tx(claims: dict[str, Any], ip_hash: str | None = None) -> AsyncIterator[AsyncConnection]:
    """Transaction running as the signed-in user (RLS enforced)."""
    async with get_engine().begin() as conn:
        await conn.execute(text("set local role authenticated"))
        await conn.execute(
            text("select set_config('request.jwt.claims', :c, true), set_config('request.headers', :h, true)"),
            {"c": json.dumps(claims), "h": json.dumps({"x-ip-hash": ip_hash or ""})},
        )
        yield conn


@asynccontextmanager
async def anon_tx() -> AsyncIterator[AsyncConnection]:
    """Transaction running as an anonymous visitor."""
    async with get_engine().begin() as conn:
        await conn.execute(text("set local role anon"))
        await conn.execute(text("select set_config('request.jwt.claims', '{\"role\":\"anon\"}', true)"))
        yield conn


@asynccontextmanager
async def system_tx() -> AsyncIterator[AsyncConnection]:
    """Connection-owner transaction for the job worker (needs auth.users for email lookups)."""
    async with get_engine().begin() as conn:
        yield conn


@asynccontextmanager
async def service_tx() -> AsyncIterator[AsyncConnection]:
    """Privileged transaction for background jobs and server-only operations. Use sparingly."""
    async with get_engine().begin() as conn:
        await conn.execute(text("set local role service_role"))
        await conn.execute(text("select set_config('request.jwt.claims', '{\"role\":\"service_role\"}', true)"))
        yield conn
