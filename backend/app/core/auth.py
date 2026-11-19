"""Supabase JWT verification.

Supports both Supabase signing modes:
- legacy shared secret (HS256) when ``SUPABASE_JWT_SECRET`` is set;
- asymmetric signing keys (RS256/ES256) fetched from the project's JWKS endpoint otherwise.
"""

from dataclasses import dataclass
from typing import Annotated, Any

import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import get_settings

_bearer = HTTPBearer(auto_error=False)
_jwks_client: jwt.PyJWKClient | None = None


@dataclass(frozen=True)
class Principal:
    user_id: str
    email: str | None
    claims: dict[str, Any]


def _jwks() -> jwt.PyJWKClient:
    global _jwks_client
    s = get_settings()
    if not s.supabase_url:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Authentication is not configured")
    if _jwks_client is None:
        _jwks_client = jwt.PyJWKClient(f"{s.supabase_url}/auth/v1/.well-known/jwks.json", cache_keys=True)
    return _jwks_client


def decode_token(token: str) -> dict[str, Any]:
    s = get_settings()
    options = {"require": ["exp", "sub"]}
    try:
        if s.supabase_jwt_secret:
            return jwt.decode(token, s.supabase_jwt_secret, algorithms=["HS256"],
                              audience=s.jwt_audience, options=options)
        key = _jwks().get_signing_key_from_jwt(token)
        return jwt.decode(token, key.key, algorithms=["RS256", "ES256"], audience=s.jwt_audience, options=options)
    except jwt.PyJWTError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired session") from exc


async def current_principal(
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> Principal:
    if creds is None or creds.scheme.lower() != "bearer":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sign in required")
    claims = decode_token(creds.credentials)
    if claims.get("role") != "authenticated":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not allowed")
    return Principal(user_id=claims["sub"], email=claims.get("email"), claims=claims)


async def optional_principal(
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> Principal | None:
    if creds is None:
        return None
    return await current_principal(creds)


def client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


CurrentUser = Annotated[Principal, Depends(current_principal)]
OptionalUser = Annotated[Principal | None, Depends(optional_principal)]
