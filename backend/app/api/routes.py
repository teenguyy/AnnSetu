"""HTTP API. Each endpoint delegates its rules to a SQL function running as the caller."""

from typing import Annotated, Any, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Request
from sqlalchemy import text

from app import schemas as s
from app.api.deps import decode_cursor, encode_cursor, ip_hash
from app.core.auth import CurrentUser
from app.core.db import anon_tx, service_tx, user_tx
from app.core.ratelimit import rate_limit

router = APIRouter(prefix="/v1")


async def _call(user: CurrentUser, request: Request, sql: str, params: dict[str, Any]) -> Any:
    async with user_tx(user.claims, ip_hash(request)) as conn:
        return (await conn.execute(text(sql), params)).scalar()


# ───────────────────────── account ─────────────────────────
@router.get("/me")
async def me(user: CurrentUser, request: Request) -> dict[str, Any]:
    async with user_tx(user.claims, ip_hash(request)) as conn:
        profile = (await conn.execute(text(
            "select id, role, full_name, phone, avatar_path from public.profiles where id = auth.uid()"
        ))).mappings().first()
        org = (await conn.execute(text(
            "select id, kind, org_type, name, status, profile_completed_at, no_certificate, review_due_at, "
            "rejection_note, suspended_reason from public.organizations where owner_id = auth.uid()"
        ))).mappings().first()
        rep = (await conn.execute(text(
            "select r.id, r.org_id, o.name as org_name from public.representatives r "
            "join public.organizations o on o.id = r.org_id where r.user_id = auth.uid() and r.status = 'active'"
        ))).mappings().first()
    if profile is None:
        raise HTTPException(404, "Profile not found")
    return {"profile": dict(profile), "organization": dict(org) if org else None,
            "representative": dict(rep) if rep else None}


@router.post("/me/role", response_model=s.OkOut)
async def set_role(body: s.RoleIn, user: CurrentUser, request: Request) -> s.OkOut:
    await _call(user, request, "select public.set_my_role(:r)", {"r": body.role})
    return s.OkOut()


@router.post("/me/complete-profile", response_model=s.OkOut)
async def complete_profile(user: CurrentUser, request: Request) -> s.OkOut:
    await _call(user, request, "select public.complete_my_profile()", {})
    return s.OkOut()


# ───────────────────────── listings ─────────────────────────
@router.get("/listings/preview", response_model=list[s.PreviewItem])
async def listings_preview(limit: Annotated[int, Query(ge=1, le=24)] = 12) -> list[s.PreviewItem]:
    async with anon_tx() as conn:
        rows = (await conn.execute(text("select * from public.public_listings_preview(:l)"), {"l": limit})).mappings()
        return [s.PreviewItem(**r) for r in rows]


@router.get("/listings/discover", response_model=s.Page[s.ListingCard])
async def discover(
    user: CurrentUser,
    request: Request,
    radius_km: Annotated[int | None, Query(description="One of 5, 15, 30, 50")] = 30,
    category: str | None = None,
    q: Annotated[str | None, Query(max_length=80)] = None,
    sort: Literal["pickup_soonest", "most_available", "newest", "nearest"] = "pickup_soonest",
    limit: Annotated[int, Query(ge=1, le=50)] = 24,
    cursor: str | None = None,
) -> s.Page[s.ListingCard]:
    if radius_km not in (None, 5, 15, 30, 50):
        raise HTTPException(422, "radius_km must be 5, 15, 30 or 50")
    offset = decode_cursor(cursor)
    async with user_tx(user.claims, ip_hash(request)) as conn:
        rows = (await conn.execute(
            text("select * from public.discover_listings(:r, :c, :q, :s, :l, :o)"),
            {"r": radius_km, "c": category, "q": q, "s": sort, "l": limit + 1, "o": offset},
        )).mappings().all()
    items = [s.ListingCard(**r) for r in rows[:limit]]
    return s.Page(items=items, next_cursor=encode_cursor(offset + limit) if len(rows) > limit else None)


@router.post("/listings/{listing_id}/withdraw", response_model=s.OkOut)
async def withdraw_listing(listing_id: UUID, body: s.WithdrawIn, user: CurrentUser, request: Request) -> s.OkOut:
    await _call(user, request, "select public.withdraw_listing(:id, :r)", {"id": listing_id, "r": body.reason})
    return s.OkOut()


# ───────────────────────── requests & pickups ─────────────────────────
@router.post("/requests", response_model=s.IdOut, status_code=201,
             dependencies=[Depends(rate_limit("create_request", 30, 3600))])
async def create_request(body: s.CreateRequestIn, user: CurrentUser, request: Request) -> s.IdOut:
    rid = await _call(user, request, "select public.create_request(:l, :q, :r, :n)",
                      {"l": body.listing_id, "q": body.qty, "r": body.rep_id, "n": body.note})
    return s.IdOut(id=rid)


@router.post("/requests/{request_id}/respond", response_model=s.OkOut)
async def respond_request(request_id: UUID, body: s.RespondIn, user: CurrentUser, request: Request) -> s.OkOut:
    await _call(user, request, "select public.respond_request(:id, :a, :n)",
                {"id": request_id, "a": body.accept, "n": body.note})
    return s.OkOut()


@router.post("/requests/{request_id}/cancel", response_model=s.OkOut)
async def cancel_request(request_id: UUID, user: CurrentUser, request: Request) -> s.OkOut:
    await _call(user, request, "select public.cancel_request(:id)", {"id": request_id})
    return s.OkOut()


@router.post("/requests/{request_id}/reassign", response_model=s.OkOut)
async def reassign(request_id: UUID, body: s.ReassignIn, user: CurrentUser, request: Request) -> s.OkOut:
    await _call(user, request, "select public.reassign_representative(:id, :r)", {"id": request_id, "r": body.rep_id})
    return s.OkOut()


@router.get("/requests/{request_id}/otp", response_model=s.OtpOut)
async def get_otp(request_id: UUID, user: CurrentUser, request: Request) -> s.OtpOut:
    code = await _call(user, request, "select public.get_pickup_otp(:id)", {"id": request_id})
    return s.OtpOut(code=code)


@router.post("/requests/{request_id}/confirm", response_model=s.ConfirmOut,
             dependencies=[Depends(rate_limit("confirm_pickup", 20, 600))])
async def confirm_pickup(request_id: UUID, body: s.ConfirmIn, user: CurrentUser, request: Request) -> s.ConfirmOut:
    result = await _call(user, request, "select public.confirm_pickup(:id, :c)", {"id": request_id, "c": body.code})
    return s.ConfirmOut(**result)


# ───────────────────────── representatives ─────────────────────────
@router.post("/rep/pickups/{request_id}/status", response_model=s.OkOut,
             dependencies=[Depends(rate_limit("rep_status", 60, 600))])
async def rep_status(request_id: UUID, body: s.RepStatusIn, user: CurrentUser, request: Request) -> s.OkOut:
    await _call(user, request, "select public.update_rep_status(:id, cast(:st as public.timeline_status), :eta)",
                {"id": request_id, "st": body.status, "eta": body.eta})
    return s.OkOut()


@router.post("/rep/pickups/{request_id}/location", response_model=s.OkOut,
             dependencies=[Depends(rate_limit("rep_location", 120, 600))])
async def rep_location(request_id: UUID, body: s.LocationIn, user: CurrentUser, request: Request) -> s.OkOut:
    await _call(user, request, "select public.update_rep_location(:id, :lat, :lng, :acc)",
                {"id": request_id, "lat": body.lat, "lng": body.lng, "acc": body.accuracy_m})
    return s.OkOut()


@router.delete("/rep/pickups/{request_id}/location", response_model=s.OkOut)
async def rep_location_stop(request_id: UUID, user: CurrentUser, request: Request) -> s.OkOut:
    await _call(user, request, "select public.stop_rep_location(:id)", {"id": request_id})
    return s.OkOut()


@router.post("/rep/link/{token}/status", response_model=s.OkOut,
             dependencies=[Depends(rate_limit("magic_link", 30, 600))])
async def rep_link_status(token: str, body: s.RepStatusIn) -> s.OkOut:
    if not 32 <= len(token) <= 128 or not token.isalnum():
        raise HTTPException(401, "This link has expired")
    async with service_tx() as conn:
        await conn.execute(
            text("select public.update_rep_status_by_token(:t, cast(:st as public.timeline_status), :eta)"),
            {"t": token, "st": body.status, "eta": body.eta},
        )
    return s.OkOut()


# ───────────────────────── admin ─────────────────────────
@router.post("/admin/orgs/{org_id}/review", response_model=s.OkOut)
async def admin_review_org(org_id: UUID, body: s.ReviewIn, user: CurrentUser, request: Request) -> s.OkOut:
    await _call(user, request, "select public.admin_review_org(:id, :a, :n)",
                {"id": org_id, "a": body.approve, "n": body.note})
    return s.OkOut()


@router.post("/admin/documents/{doc_id}/review", response_model=s.OkOut)
async def admin_review_document(doc_id: UUID, body: s.ReviewIn, user: CurrentUser, request: Request) -> s.OkOut:
    await _call(user, request, "select public.admin_review_document(:id, :a, :n)",
                {"id": doc_id, "a": body.approve, "n": body.note})
    return s.OkOut()


@router.post("/admin/orgs/{org_id}/suspend", response_model=s.OkOut)
async def admin_suspend(org_id: UUID, body: s.ReasonIn, user: CurrentUser, request: Request) -> s.OkOut:
    await _call(user, request, "select public.admin_suspend_org(:id, :r)", {"id": org_id, "r": body.reason})
    return s.OkOut()


@router.post("/admin/orgs/{org_id}/reinstate", response_model=s.OkOut)
async def admin_reinstate(org_id: UUID, body: s.ReasonIn, user: CurrentUser, request: Request) -> s.OkOut:
    await _call(user, request, "select public.admin_reinstate_org(:id, :r)", {"id": org_id, "r": body.reason})
    return s.OkOut()


@router.post("/admin/listings/{listing_id}/withdraw", response_model=s.OkOut)
async def admin_withdraw(listing_id: UUID, body: s.ReasonIn, user: CurrentUser, request: Request) -> s.OkOut:
    await _call(user, request, "select public.admin_withdraw_listing(:id, :r)", {"id": listing_id, "r": body.reason})
    return s.OkOut()


@router.post("/admin/landing-snapshot")
async def admin_snapshot(user: CurrentUser, request: Request) -> dict[str, Any]:
    return await _call(user, request, "select public.rebuild_landing_snapshot()", {})


# ───────────────────────── public ─────────────────────────
@router.post("/contact", response_model=s.OkOut, status_code=201,
             dependencies=[Depends(rate_limit("contact", 5, 3600))])
async def contact(body: s.ContactIn) -> s.OkOut:
    async with service_tx() as conn:
        await conn.execute(
            text("insert into public.contact_messages (name, email, subject, body) values (:n, :e, :s, :b)"),
            {"n": body.name, "e": str(body.email), "s": body.subject, "b": body.body},
        )
        await conn.execute(text(
            "select private.notify_admins('inbox', 'New contact message', :s, '/admin/inbox')"), {"s": body.subject})
    return s.OkOut()


@router.get("/certificates/{serial}", response_model=s.CertificateOut,
            dependencies=[Depends(rate_limit("verify_certificate", 60, 600))])
async def verify_certificate(serial: Annotated[str, Path(max_length=40)]) -> s.CertificateOut:
    async with anon_tx() as conn:
        result = await conn.execute(text("select * from public.verify_certificate(:s)"), {"s": serial})
        row = result.mappings().first()
    if row is None:
        raise HTTPException(404, "No certificate with that serial")
    return s.CertificateOut(**row)
