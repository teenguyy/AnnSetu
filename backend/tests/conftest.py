"""Integration fixtures: a fresh database built from supabase/migrations, real SQL functions and
RLS, and locally signed HS256 tokens standing in for Supabase Auth."""

import os
import subprocess
import time
import uuid
from pathlib import Path

TEST_DB = "annsetu_api_test"
JWT_SECRET = "test-secret-that-is-long-enough-for-hs256-0123456789"
os.environ.update({
    "DATABASE_URL": f"postgresql+asyncpg://postgres:postgres@localhost:5432/{TEST_DB}",
    "SUPABASE_JWT_SECRET": JWT_SECRET,
    "ENV": "test",
    "PUBLIC_SITE_URL": "https://annsetu.test",
    "RESEND_API_KEY": "",
    "SMTP_HOST": "",
    "GEMINI_API_KEY": "",
    "REDIS_URL": "",
})

import httpx  # noqa: E402
import jwt  # noqa: E402
import pytest  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app.core import ratelimit  # noqa: E402
from app.core.db import dispose_engine, system_tx  # noqa: E402
from app.main import app  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]


@pytest.fixture(scope="session", autouse=True)
def database() -> None:
    subprocess.run(
        [str(ROOT / "supabase/tests/run.sh"), "--schema-only"],
        check=True, capture_output=True, env={**os.environ, "TEST_DB": TEST_DB},
    )


@pytest.fixture(autouse=True)
async def _reset() -> None:
    ratelimit.reset_memory()
    yield
    await dispose_engine()


def token(user_id: str, role: str = "authenticated", **extra: object) -> str:
    claims = {"sub": user_id, "role": role, "aud": "authenticated", "exp": int(time.time()) + 3600, **extra}
    return jwt.encode(claims, JWT_SECRET, algorithm="HS256")


def auth(user_id: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token(user_id)}"}


@pytest.fixture
async def client() -> httpx.AsyncClient:
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as c:
        yield c


async def sql(query: str, **params: object) -> object:
    async with system_tx() as conn:
        result = await conn.execute(text(query), params)
        return result.scalar() if result.returns_rows else None


async def new_user(role: str | None = None, name: str = "Test User") -> str:
    email = f"{uuid.uuid4().hex[:10]}@test.in"
    return str(await sql("select tests.create_user(:e, :r, :n)", e=email, r=role, n=name))


async def new_org(owner: str, kind: str, *, approved: bool = True, name: str | None = None,
                  lng: float = 73.8567, lat: float = 18.5204) -> str:
    org_type = "restaurant" if kind == "donor" else "ngo"
    org = await sql(
        "insert into public.organizations (owner_id, kind, org_type, name, city, location, status, verified_at) "
        "values (:o, cast(:k as public.org_kind), :t, :n, 'Pune', "
        "extensions.st_setsrid(extensions.st_makepoint(:lng, :lat), 4326)::extensions.geography, "
        "cast(:s as public.org_status), case when :a then now() end) returning id",
        o=owner, k=kind, t=org_type, n=name or f"{kind} {uuid.uuid4().hex[:6]}", lng=lng, lat=lat,
        s="approved" if approved else "pending", a=approved,
    )
    return str(org)


async def new_listing(donor_org: str, qty: int = 50, title: str = "Veg thali") -> str:
    return str(await sql(
        "insert into public.food_listings (donor_org_id, title, category, qty_total, unit, pickup_by, diet) "
        "values (:o, :t, 'cooked_meals', :q, 'portions', now() + interval '3 hours', 'veg') returning id",
        o=donor_org, t=title, q=qty,
    ))


async def new_rep(org: str, user_id: str | None = None, email: str | None = None) -> str:
    return str(await sql(
        "insert into public.representatives (org_id, user_id, name, phone, email) "
        "values (:o, :u, 'Ravi Kumar', '+91 90000 11111', :e) returning id", o=org, u=user_id, e=email,
    ))
