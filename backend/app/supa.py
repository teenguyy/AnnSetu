"""Thin Supabase client that always acts AS THE CALLER (their access token).

The backend never holds a service-role key: every read and write goes through
Row Level Security and the same security-definer RPCs the website uses, so the
backend can never see or change more than the signed-in user could.
"""
from typing import Any
from urllib.parse import quote

import httpx

from .config import Settings


class SupabaseError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


class Supa:
    def __init__(self, settings: Settings, client: httpx.AsyncClient, token: str | None = None):
        self.s = settings
        self.c = client
        self.token = token

    def _headers(self) -> dict[str, str]:
        h = {"apikey": self.s.supabase_anon_key, "Content-Type": "application/json"}
        h["Authorization"] = f"Bearer {self.token or self.s.supabase_anon_key}"
        return h

    async def _check(self, r: httpx.Response) -> Any:
        if r.status_code >= 400:
            try:
                msg = r.json().get("message") or r.json().get("msg") or r.text
            except ValueError:
                msg = r.text
            raise SupabaseError(r.status_code, str(msg)[:300])
        if not r.content:
            return None
        ctype = r.headers.get("content-type", "")
        return r.json() if "json" in ctype else r.content

    async def user(self) -> dict:
        r = await self.c.get(f"{self.s.supabase_url}/auth/v1/user", headers=self._headers())
        return await self._check(r)

    async def rpc(self, fn: str, args: dict | None = None) -> Any:
        r = await self.c.post(f"{self.s.supabase_url}/rest/v1/rpc/{fn}", headers=self._headers(), json=args or {})
        return await self._check(r)

    async def select(self, table: str, query: str) -> list[dict]:
        r = await self.c.get(f"{self.s.supabase_url}/rest/v1/{table}?{query}", headers=self._headers())
        return await self._check(r)

    async def download(self, bucket: str, path: str) -> tuple[bytes, str]:
        url = f"{self.s.supabase_url}/storage/v1/object/authenticated/{bucket}/{quote(path)}"
        r = await self.c.get(url, headers=self._headers())
        data = await self._check(r)
        return data, r.headers.get("content-type", "application/octet-stream").split(";")[0]
