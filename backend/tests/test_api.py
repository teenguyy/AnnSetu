from datetime import UTC, datetime, timedelta

from sqlalchemy import text

from app.core.db import service_tx
from app.jobs import worker
from tests.conftest import auth, new_listing, new_org, new_rep, new_user, sql, token


async def _pickup_world() -> dict[str, str]:
    donor, ngo = await new_user("donor", "Dev Donor"), await new_user("ngo", "Nina NGO")
    donor_org, ngo_org = await new_org(donor, "donor"), await new_org(ngo, "ngo", lng=73.86, lat=18.53)
    rep_user = await new_user(None, "Ravi Rep")
    await sql("update public.profiles set role = 'representative' where id = :u", u=rep_user)
    rep = await new_rep(ngo_org, rep_user, "ravi@test.in")
    listing = await new_listing(donor_org)
    return {"donor": donor, "ngo": ngo, "donor_org": donor_org, "ngo_org": ngo_org,
            "rep": rep, "rep_user": rep_user, "listing": listing}


# ───────────────────────── platform ─────────────────────────
async def test_health_and_security_headers(client):
    r = await client.get("/health")
    assert r.status_code == 200
    assert r.headers["x-content-type-options"] == "nosniff"
    assert r.headers["x-frame-options"] == "DENY"
    assert "frame-ancestors 'none'" in r.headers["content-security-policy"]
    assert len(r.headers["x-request-id"]) >= 16
    assert (await client.get("/health/ready")).json() == {"status": "ready"}


async def test_auth_required_and_token_checks(client):
    assert (await client.get("/v1/me")).status_code == 401
    bad = {"Authorization": "Bearer not-a-jwt"}
    assert (await client.get("/v1/me", headers=bad)).status_code == 401
    anon = {"Authorization": f"Bearer {token('00000000-0000-0000-0000-000000000000', role='anon')}"}
    assert (await client.get("/v1/me", headers=anon)).status_code == 403


async def test_me_and_role_choice(client):
    user = await new_user(None, "Sam")
    r = await client.get("/v1/me", headers=auth(user))
    assert r.status_code == 200 and r.json()["profile"]["role"] is None
    assert (await client.post("/v1/me/role", json={"role": "admin"}, headers=auth(user))).status_code == 422
    assert (await client.post("/v1/me/role", json={"role": "ngo"}, headers=auth(user))).status_code == 200
    assert (await client.get("/v1/me", headers=auth(user))).json()["profile"]["role"] == "ngo"


async def test_complete_profile_reports_missing_fields(client):
    user = await new_user("donor")
    await sql("insert into public.organizations (owner_id, kind, org_type, name) values (:u, 'donor', 'hotel', 'Hotel Test')",
              u=user)
    r = await client.post("/v1/me/complete-profile", headers=auth(user))
    assert r.status_code == 400
    assert r.json()["detail"].startswith("Please complete: contact person")


# ───────────────────────── pickup lifecycle ─────────────────────────
async def test_full_pickup_lifecycle(client):
    w = await _pickup_world()
    body = {"listing_id": w["listing"], "qty": 20, "rep_id": w["rep"], "note": "Evening"}
    r = await client.post("/v1/requests", json=body, headers=auth(w["ngo"]))
    assert r.status_code == 201, r.text
    req = r.json()["id"]

    # receiver cannot accept its own request; donor can
    assert (await client.post(f"/v1/requests/{req}/respond", json={"accept": True}, headers=auth(w["ngo"]))).status_code == 404
    assert (await client.post(f"/v1/requests/{req}/respond", json={"accept": True}, headers=auth(w["donor"]))).status_code == 200

    otp = (await client.get(f"/v1/requests/{req}/otp", headers=auth(w["ngo"]))).json()["code"]
    assert otp and len(otp) == 4
    assert (await client.get(f"/v1/requests/{req}/otp", headers=auth(w["donor"]))).status_code == 404

    eta = (datetime.now(UTC) + timedelta(minutes=20)).isoformat()
    r = await client.post(f"/v1/rep/pickups/{req}/status", json={"status": "on_the_way", "eta": eta},
                          headers=auth(w["rep_user"]))
    assert r.status_code == 200, r.text
    r = await client.post(f"/v1/rep/pickups/{req}/location", json={"lat": 18.52, "lng": 73.85},
                          headers=auth(w["rep_user"]))
    assert r.status_code == 200

    wrong = "0000" if otp != "0000" else "1111"
    r = await client.post(f"/v1/requests/{req}/confirm", json={"code": wrong}, headers=auth(w["donor"]))
    assert r.json() == {"ok": False, "reason": "wrong_code", "attempts_left": 4}
    r = await client.post(f"/v1/requests/{req}/confirm", json={"code": otp}, headers=auth(w["donor"]))
    assert r.json()["ok"] is True
    assert await sql("select status::text from public.food_requests where id = :r", r=req) == "completed"
    assert await sql("select count(*) from public.certificates where org_id in (:a, :b)",
                     a=w["donor_org"], b=w["ngo_org"]) == 2


async def test_rule_violations_map_to_clear_errors(client):
    w = await _pickup_world()
    r = await client.post("/v1/requests", json={"listing_id": w["listing"], "qty": 999, "rep_id": w["rep"]},
                          headers=auth(w["ngo"]))
    assert r.status_code == 400 and "between 1 and" in r.json()["detail"]
    r = await client.post(f"/v1/admin/orgs/{w['ngo_org']}/review", json={"approve": True}, headers=auth(w["donor"]))
    assert r.status_code == 403 and r.json()["detail"] == "Admin access required"


async def test_validation_errors(client):
    w = await _pickup_world()
    bad_code = await client.post(f"/v1/requests/{w['listing']}/confirm", json={"code": "12ab"}, headers=auth(w["donor"]))
    assert bad_code.status_code == 422
    extra = await client.post("/v1/requests", json={"listing_id": w["listing"], "qty": 1, "rep_id": w["rep"],
                                                    "status": "completed"}, headers=auth(w["ngo"]))
    assert extra.status_code == 422
    naive = await client.post(f"/v1/rep/pickups/{w['listing']}/status",
                              json={"status": "on_the_way", "eta": "2030-01-01T10:00:00"}, headers=auth(w["rep_user"]))
    assert naive.status_code == 422


async def test_discovery_pagination_and_public_preview(client):
    w = await _pickup_world()
    await new_listing(w["donor_org"], title="Bread")
    r = await client.get("/v1/listings/discover?limit=1&radius_km=15", headers=auth(w["ngo"]))
    page = r.json()
    assert r.status_code == 200 and len(page["items"]) == 1 and page["next_cursor"]
    assert page["items"][0]["distance_km"] is not None
    r2 = await client.get(f"/v1/listings/discover?limit=1&radius_km=15&cursor={page['next_cursor']}",
                          headers=auth(w["ngo"]))
    assert r2.json()["items"][0]["id"] != page["items"][0]["id"]
    assert (await client.get("/v1/listings/discover?cursor=garbage", headers=auth(w["ngo"]))).status_code == 422
    preview = (await client.get("/v1/listings/preview")).json()
    assert preview and set(preview[0]) == {"id", "title", "category", "qty_available", "unit", "pickup_by",
                                           "donor_name", "city"}


async def test_magic_link_status(client):
    w = await _pickup_world()
    req = (await client.post("/v1/requests", json={"listing_id": w["listing"], "qty": 5, "rep_id": w["rep"]},
                             headers=auth(w["ngo"]))).json()["id"]
    await client.post(f"/v1/requests/{req}/respond", json={"accept": True}, headers=auth(w["donor"]))
    async with service_tx() as conn:
        tok = (await conn.execute(text("select public.issue_rep_access_token(:r)"), {"r": req})).scalar()
    assert (await client.post(f"/v1/rep/link/{tok}/status", json={"status": "arrived"})).status_code == 200
    assert await sql("select timeline_status::text from public.food_requests where id = :r", r=req) == "arrived"
    expired = await client.post("/v1/rep/link/" + "a" * 64 + "/status", json={"status": "arrived"})
    assert expired.status_code == 403 and expired.json()["detail"] == "This link has expired"
    assert (await client.get("/v1/listings/discover?radius_km=7", headers=auth(w["ngo"]))).status_code == 422


# ───────────────────────── public endpoints ─────────────────────────
async def test_contact_form_and_rate_limit(client):
    msg = {"name": "Priya", "email": "priya@example.com", "subject": "Volunteering",
           "body": "How can our college group help with pickups?"}
    for _ in range(5):
        assert (await client.post("/v1/contact", json=msg)).status_code == 201
    r = await client.post("/v1/contact", json=msg)
    assert r.status_code == 429 and r.headers["retry-after"] == "3600"
    assert await sql("select count(*) from public.contact_messages where email = 'priya@example.com'") == 5


async def test_certificate_lookup(client):
    assert (await client.get("/v1/certificates/AS-2026-NOPE")).status_code == 404


# ───────────────────────── worker ─────────────────────────
async def test_worker_marks_email_failed_when_no_provider():
    user = await new_user("donor")
    await sql("insert into public.jobs (kind, payload) values ('email', jsonb_build_object('user_id', cast(:u as text), "
              "'title', 'Hello', 'body', 'Test'))", u=user)
    await worker.run_once(100)
    assert await sql("select count(*) from public.jobs where kind = 'email' and status = 'queued'") == 0
    last = await sql("select last_error from public.jobs where kind = 'email' order by id desc limit 1")
    assert last == "No email provider configured"


async def test_worker_issues_magic_link_and_skips_unknown_kinds():
    w = await _pickup_world()
    await sql("insert into public.jobs (kind) values ('not_a_handler')")
    await sql(
        "insert into public.food_requests (listing_id, receiver_org_id, rep_id, qty, status) "
        "values (:l, :o, :r, 5, 'accepted')", l=w["listing"], o=w["ngo_org"], r=w["rep"])
    rid = str(await sql("select id from public.food_requests where listing_id = :l", l=w["listing"]))
    await sql("insert into public.jobs (kind, payload) values ('rep_magic_link', jsonb_build_object('request_id', cast(:r as text)))",
              r=rid)
    await worker.run_once(100)
    assert await sql("select count(*) from public.rep_access_tokens where request_id = :r", r=rid) == 1
    assert await sql("select status::text from public.jobs where kind = 'not_a_handler'") == "queued"
