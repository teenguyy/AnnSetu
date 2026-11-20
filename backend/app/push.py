"""Push notifications through Firebase Cloud Messaging (HTTP v1).

The database calls POST /push/send (via pg_net) whenever a notification row is created. It proves it is
the database with a secret whose SHA-256 is stored in PUSH_SECRET_SHA256; the secret itself lives only in
the database's private schema. The Firebase service-account JSON lives only in FCM_SERVICE_ACCOUNT.
"""
import asyncio
import hashlib
import hmac
import json
import time

import httpx

SCOPE = "https://www.googleapis.com/auth/firebase.messaging"
_token: dict = {"value": None, "exp": 0.0}


def secret_ok(given: str | None, expected_sha256: str) -> bool:
    if not given or not expected_sha256:
        return False
    return hmac.compare_digest(hashlib.sha256(given.encode()).hexdigest(), expected_sha256.strip().lower())


def _fresh_token(info: dict) -> tuple[str, float]:
    # imported lazily so the rest of the API never depends on google-auth
    from google.auth.transport.requests import Request
    from google.oauth2 import service_account

    creds = service_account.Credentials.from_service_account_info(info, scopes=[SCOPE])
    creds.refresh(Request())
    exp = creds.expiry.timestamp() if creds.expiry else time.time() + 3000
    return creds.token, exp


async def access_token(sa_json: str) -> tuple[str, str]:
    info = json.loads(sa_json)
    if not _token["value"] or _token["exp"] - time.time() < 120:
        tok, exp = await asyncio.to_thread(_fresh_token, info)
        _token.update(value=tok, exp=exp)
    return _token["value"], info["project_id"]


async def send(client: httpx.AsyncClient, sa_json: str, tokens: list[str], title: str, body: str | None,
               link: str | None = None, token_fn=access_token) -> dict:
    bearer, project = await token_fn(sa_json)
    sent, failed = 0, []
    for t in tokens:
        msg = {
            "message": {
                "token": t,
                "notification": {"title": title[:120], "body": (body or "")[:240]},
                "data": {"link": link or "", "title": title[:120]},
                "android": {"priority": "high", "notification": {"channel_id": "annsetu_updates", "sound": "default"}},
            }
        }
        r = await client.post(f"https://fcm.googleapis.com/v1/projects/{project}/messages:send",
                              headers={"Authorization": f"Bearer {bearer}"}, json=msg, timeout=15)
        if r.status_code == 200:
            sent += 1
        else:
            failed.append({"token": t[:12] + "…", "status": r.status_code})
    return {"sent": sent, "failed": failed}
