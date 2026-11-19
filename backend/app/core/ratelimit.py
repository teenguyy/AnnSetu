"""Fixed-window rate limits. Redis when REDIS_URL is set (shared across workers); otherwise an
in-process fallback suitable for development and single-worker deployments only."""

import hashlib
import time
from collections import defaultdict

from fastapi import HTTPException, Request, status
from redis.asyncio import Redis

from app.core.auth import client_ip, decode_token
from app.core.config import get_settings

_redis: Redis | None = None
_memory: dict[str, tuple[int, float]] = defaultdict(lambda: (0, 0.0))


def _client() -> Redis | None:
    global _redis
    url = get_settings().redis_url
    if url and _redis is None:
        _redis = Redis.from_url(url)
    return _redis


async def hit(key: str, limit: int, window_s: int) -> bool:
    """Count one hit; return True if the caller is still within the limit."""
    r = _client()
    if r is not None:
        bucket = f"rl:{key}:{int(time.time() // window_s)}"
        count = await r.incr(bucket)
        if count == 1:
            await r.expire(bucket, window_s)
        return count <= limit
    count, started = _memory[key]
    now = time.monotonic()
    if now - started >= window_s:
        count, started = 0, now
    count += 1
    _memory[key] = (count, started)
    return count <= limit


def reset_memory() -> None:
    _memory.clear()


def _identity(request: Request) -> str:
    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        try:
            return "u:" + decode_token(auth[7:])["sub"]
        except HTTPException:
            pass
    ip = client_ip(request)
    return "ip:" + hashlib.sha256(f"{get_settings().ip_hash_salt}:{ip}".encode()).hexdigest()[:24]


def rate_limit(name: str, limit: int, window_s: int):
    """FastAPI dependency: ``Depends(rate_limit("chat", 30, 60))``."""

    async def dependency(request: Request) -> None:
        if not await hit(f"{name}:{_identity(request)}", limit, window_s):
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS,
                "Too many requests. Please wait a moment and try again.",
                headers={"Retry-After": str(window_s)},
            )

    return dependency
