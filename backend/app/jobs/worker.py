"""Background job worker. Claims queued jobs with FOR UPDATE SKIP LOCKED (safe with several
workers), retries with exponential backoff, and only claims kinds it has handlers for.

Run: ``uv run python -m app.jobs.worker``
"""

import asyncio
import logging
from collections.abc import Awaitable, Callable
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection

from app.core.config import get_settings
from app.core.db import service_tx, system_tx
from app.services import email as mailer

log = logging.getLogger("annsetu.worker")
MAX_ATTEMPTS = 5

Handler = Callable[[dict[str, Any]], Awaitable[None]]
HANDLERS: dict[str, Handler] = {}


def handles(kind: str) -> Callable[[Handler], Handler]:
    def register(fn: Handler) -> Handler:
        HANDLERS[kind] = fn
        return fn

    return register


class PermanentError(RuntimeError):
    """Do not retry (e.g. the provider is not configured)."""


@handles("email")
async def send_notification_email(payload: dict[str, Any]) -> None:
    async with system_tx() as conn:
        to = (await conn.execute(text("select email from auth.users where id = :u"),
                                 {"u": payload["user_id"]})).scalar()
    if not to:
        return
    mail = mailer.render(payload["title"], payload.get("body"), payload.get("link"))
    mail.to = to
    try:
        await mailer.send(mail)
    except mailer.EmailDisabledError as exc:
        raise PermanentError(str(exc)) from exc


@handles("rep_magic_link")
async def send_rep_magic_link(payload: dict[str, Any]) -> None:
    async with service_tx() as conn:
        token = (await conn.execute(text("select public.issue_rep_access_token(:r)"),
                                    {"r": payload["request_id"]})).scalar()
        info = (await conn.execute(text(
            "select rep.email, rep.name, l.title, l.pickup_by, o.name as donor, o.address "
            "from public.food_requests r join public.representatives rep on rep.id = r.rep_id "
            "join public.food_listings l on l.id = r.listing_id join public.organizations o on o.id = l.donor_org_id "
            "where r.id = :r"), {"r": payload["request_id"]})).mappings().first()
    if not info or not info["email"]:
        return  # the NGO shares the link from its dashboard instead (SMS adapter optional)
    mail = mailer.render(
        f"Pickup for {info['donor']}",
        f"Hi {info['name']}, you're collecting \"{info['title']}\" from {info['donor']}, {info['address']}. "
        "This private link shows directions and the code to show the donor. It works only for this pickup.",
        f"/r/{token}",
    )
    mail.to = info["email"]
    try:
        await mailer.send(mail)
    except mailer.EmailDisabledError as exc:
        raise PermanentError(str(exc)) from exc


async def _mark_ai_unavailable(conn: AsyncConnection, document_id: str) -> None:
    await conn.execute(text(
        "update public.document_ai_reviews set status = 'unavailable', error = 'AI review is not configured', "
        "completed_at = now() where document_id = :d"), {"d": document_id})


@handles("ai_document_review")
async def ai_document_review(payload: dict[str, Any]) -> None:
    if not get_settings().gemini_api_key:
        async with service_tx() as conn:
            await _mark_ai_unavailable(conn, payload["document_id"])
        raise PermanentError("GEMINI_API_KEY not set")
    raise PermanentError("AI review is implemented in phase 14")


async def claim(batch: int = 10) -> list[dict[str, Any]]:
    async with service_tx() as conn:
        rows = (await conn.execute(text(
            "update public.jobs set status = 'running', attempts = attempts + 1 "
            "where id in (select id from public.jobs where status = 'queued' and run_after <= now() "
            "  and kind = any(:kinds) order by run_after limit :n for update skip locked) "
            "returning id, kind, payload, attempts"), {"kinds": list(HANDLERS), "n": batch})).mappings().all()
    return [dict(r) for r in rows]


async def finish(job_id: int, error: str | None, attempts: int, permanent: bool = False) -> None:
    async with service_tx() as conn:
        if error is None:
            await conn.execute(text("update public.jobs set status = 'done', last_error = null where id = :i"),
                               {"i": job_id})
        elif permanent or attempts >= MAX_ATTEMPTS:
            await conn.execute(text("update public.jobs set status = 'failed', last_error = :e where id = :i"),
                               {"i": job_id, "e": error[:500]})
        else:
            await conn.execute(text(
                "update public.jobs set status = 'queued', last_error = :e, "
                "run_after = now() + make_interval(secs => :d) where id = :i"),
                {"i": job_id, "e": error[:500], "d": 30 * 2 ** attempts})


async def run_once(batch: int = 10) -> int:
    jobs = await claim(batch)
    for job in jobs:
        try:
            await HANDLERS[job["kind"]](job["payload"])
            await finish(job["id"], None, job["attempts"])
        except PermanentError as exc:
            await finish(job["id"], str(exc), job["attempts"], permanent=True)
        except Exception as exc:
            log.exception("job failed", extra={"job_id": job["id"], "kind": job["kind"]})
            await finish(job["id"], repr(exc), job["attempts"])
    return len(jobs)


async def main(poll_s: float = 2.0) -> None:
    logging.basicConfig(level=logging.INFO)
    while True:
        if await run_once() == 0:
            await asyncio.sleep(poll_s)


if __name__ == "__main__":
    asyncio.run(main())
