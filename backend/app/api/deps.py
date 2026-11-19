import base64
import hashlib

from fastapi import HTTPException, Request

from app.core.auth import client_ip
from app.core.config import get_settings


def ip_hash(request: Request) -> str:
    salted = f"{get_settings().ip_hash_salt}:{client_ip(request)}"
    return hashlib.sha256(salted.encode()).hexdigest()[:32]


def encode_cursor(offset: int) -> str:
    return base64.urlsafe_b64encode(f"o:{offset}".encode()).decode()


def decode_cursor(cursor: str | None) -> int:
    if not cursor:
        return 0
    try:
        kind, value = base64.urlsafe_b64decode(cursor.encode()).decode().split(":", 1)
        offset = int(value)
        if kind != "o" or offset < 0 or offset > 10_000:
            raise ValueError
        return offset
    except (ValueError, UnicodeDecodeError) as exc:
        raise HTTPException(422, "Invalid cursor") from exc
