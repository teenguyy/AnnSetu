import json
from datetime import date

import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.verify import run_checks, score, similarity

SB = "https://sb.test"
ADMIN, USER = "admin-token", "user-token"
ORG = {"id": "11111111-1111-1111-1111-111111111111", "name": "Hotel Sunrise", "kind": "donor",
       "org_type": "Hotel", "address": "12 MG Road, Pune"}
DOC = {"id": "22222222-2222-2222-2222-222222222222", "org_id": ORG["id"], "path": "u1/fssai.pdf", "doc_type": "fssai"}

GOOD = {"document_type": "fssai_licence", "organisation_name": "Hotel Sunrise Pvt Ltd", "registration_number": "12345678901234",
        "issuing_authority": "FSSAI", "address": "12, M.G. Road, Pune", "issue_date": "2024-04-01",
        "expiry_date": "2030-03-31", "legible": True, "red_flags": []}


def make(gemini_json=None, gemini_text="Hello from AnnSetu.", gemini_status=200, ai=True):
    calls = {"saved": None, "gemini": []}

    def handler(req: httpx.Request) -> httpx.Response:
        url, auth = str(req.url), req.headers.get("authorization", "")
        if url.startswith("https://ai.test"):
            body = json.loads(req.content)
            calls["gemini"].append(body)
            if gemini_status != 200:
                return httpx.Response(gemini_status, json={"error": "x"})
            content = json.dumps(gemini_json) if body.get("response_format") else gemini_text
            return httpx.Response(200, json={"choices": [{"message": {"content": content}}]})
        tok = auth.removeprefix("Bearer ")
        if url.endswith("/auth/v1/user"):
            if tok in (ADMIN, USER):
                return httpx.Response(200, json={"id": "admin-id" if tok == ADMIN else "user-id"})
            return httpx.Response(401, json={"msg": "bad jwt"})
        if url.endswith("/rpc/is_admin"):
            return httpx.Response(200, json=tok == ADMIN)
        if "/rest/v1/verification_documents" in url:
            return httpx.Response(200, json=[DOC] if DOC["id"] in url else [])
        if "/rest/v1/organizations" in url:
            if "owner_id=eq.user-id" in url:
                return httpx.Response(200, json=[{"name": "Ward 12 Group", "kind": "ngo", "org_type": "Community group",
                                                  "verification": "pending", "suspended": False, "no_certificate": True}])
            if "no_certificate" in url:
                return httpx.Response(200, json=[{**ORG, "kind": "ngo", "about": "We feed elders", "area_served": "Ward 12",
                                                  "no_certificate": True, "no_certificate_note": "Since 2021",
                                                  "created_at": "2026-11-01"}])
            return httpx.Response(200, json=[ORG])
        if "/rest/v1/profiles" in url:
            return httpx.Response(200, json=[{"role": "ngo", "full_name": "G"}])
        if "/rest/v1/faqs" in url:
            return httpx.Response(200, json=[{"question": "Who can donate?", "answer": "Restaurants and more."}])
        if "/storage/v1/object/authenticated/verification-docs/" in url:
            return httpx.Response(200, content=b"%PDF-1.4 test", headers={"content-type": "application/pdf"})
        if url.endswith("/rpc/admin_document_numbers"):
            return httpx.Response(200, json=[{"org_id": "other", "number": "99999999999999"}])
        if url.endswith("/rpc/save_document_review"):
            calls["saved"] = json.loads(req.content)
            return httpx.Response(200, json="33333333-3333-3333-3333-333333333333")
        return httpx.Response(404, json={"message": f"unexpected {url}"})

    s = Settings(supabase_url=SB, supabase_anon_key="anon", gemini_api_key="k" if ai else "",
                 gemini_base_url="https://ai.test", allowed_origins="http://localhost:8080")
    app = create_app(s)
    client = TestClient(app)
    client.__enter__()
    app.state.http = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    return client, calls


def test_health():
    c, _ = make()
    assert c.get("/health").json()["ai"] is True


def test_review_requires_admin():
    c, _ = make(GOOD)
    assert c.post("/ai/review-document", json={"document_id": DOC["id"]}).status_code == 401
    r = c.post("/ai/review-document", json={"document_id": DOC["id"]}, headers={"Authorization": f"Bearer {USER}"})
    assert r.status_code == 403
    r = c.post("/ai/review-document", json={"document_id": DOC["id"]}, headers={"Authorization": "Bearer nope"})
    assert r.status_code == 401


def test_review_valid_document_saves_summary():
    c, calls = make(GOOD)
    r = c.post("/ai/review-document", json={"document_id": DOC["id"]}, headers={"Authorization": f"Bearer {ADMIN}"})
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["recommendation"] == "looks_valid" and out["confidence"] >= 80
    assert "12345678901234" in out["summary"] and "admin makes the final decision" in out["summary"]
    assert calls["saved"]["p_org"] == ORG["id"] and calls["saved"]["p_doc"] == DOC["id"]
    sent = calls["gemini"][0]["messages"][0]["content"]
    assert sent[1]["image_url"]["url"].startswith("data:application/pdf;base64,")


def test_review_flags_bad_document():
    bad = {**GOOD, "organisation_name": "Totally Different Caterers", "registration_number": "99999999999999",
           "expiry_date": "2020-01-01"}
    c, _ = make(bad)
    out = c.post("/ai/review-document", json={"document_id": DOC["id"]},
                 headers={"Authorization": f"Bearer {ADMIN}"}).json()
    assert out["recommendation"] == "likely_invalid"
    fails = {x["check"] for x in out["checks"] if x["result"] == "fail"}
    assert {"Name matches profile", "Expiry", "Duplicate number"} <= fails


def test_review_unknown_document_404():
    c, _ = make(GOOD)
    r = c.post("/ai/review-document", json={"document_id": "44444444-4444-4444-4444-444444444444"},
               headers={"Authorization": f"Bearer {ADMIN}"})
    assert r.status_code == 404


def test_ai_down_returns_503_not_500():
    c, _ = make(GOOD, gemini_status=500)
    r = c.post("/ai/review-document", json={"document_id": DOC["id"]}, headers={"Authorization": f"Bearer {ADMIN}"})
    assert r.status_code == 503 and "AI is unavailable" in r.json()["detail"]


def test_ai_not_configured():
    c, _ = make(GOOD, ai=False)
    r = c.post("/ai/review-document", json={"document_id": DOC["id"]}, headers={"Authorization": f"Bearer {ADMIN}"})
    assert r.status_code == 503


def test_no_cert_summary():
    c, calls = make({"summary": "Residents group feeding 40 elders.", "claims": ["since 2021"],
                     "to_verify": ["Call ward office"], "concerns": [], "confidence": 70})
    r = c.post("/ai/review-no-cert", json={"org_id": ORG["id"]}, headers={"Authorization": f"Bearer {ADMIN}"})
    assert r.status_code == 200, r.text
    assert r.json()["recommendation"] == "needs_review"
    assert calls["saved"]["p_kind"] == "no_certificate" and calls["saved"]["p_doc"] is None


def test_chat_observer_and_signed_in():
    c, calls = make(gemini_text="Restaurants and hotels can donate.")
    r = c.post("/chat", json={"messages": [{"role": "user", "content": "Who can donate?"}]})
    assert r.status_code == 200 and r.json()["role"] == "observer" and "donate" in r.json()["reply"]
    system = calls["gemini"][0]["messages"][0]["content"]
    assert "Who can donate?" in system and "3-5 business days" in system
    r = c.post("/chat", json={"messages": [{"role": "user", "content": "Status?"}]},
               headers={"Authorization": f"Bearer {USER}"})
    assert r.json()["role"] == "ngo"
    assert "Ward 12 Group" in calls["gemini"][1]["messages"][0]["content"]


def test_chat_validation_and_rate_limit():
    c, _ = make()
    assert c.post("/chat", json={"messages": []}).status_code == 422
    assert c.post("/chat", json={"messages": [{"role": "system", "content": "x"}]}).status_code == 422
    codes = [c.post("/chat", json={"messages": [{"role": "user", "content": "hi"}]}).status_code for _ in range(22)]
    assert 429 in codes


def test_cors_allowlist():
    c, _ = make()
    ok = c.options("/chat", headers={"Origin": "http://localhost:8080", "Access-Control-Request-Method": "POST"})
    assert ok.headers.get("access-control-allow-origin") == "http://localhost:8080"
    bad = c.options("/chat", headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "POST"})
    assert "access-control-allow-origin" not in bad.headers


@pytest.mark.parametrize("a,b,ok", [("Hotel Sunrise Pvt Ltd", "Hotel Sunrise", True), ("ABC Foods", "Ward 12 Group", False)])
def test_similarity(a, b, ok):
    assert (similarity(a, b) >= 0.8) == ok


def test_checks_fssai_format_and_future_issue():
    ex = {**GOOD, "registration_number": "1234", "issue_date": "2099-01-01"}
    checks = run_checks(ex, ORG, [], today=date(2026, 11, 20))
    res = {c["check"]: c["result"] for c in checks}
    assert res["FSSAI number format"] == "fail" and res["Issue date"] == "fail"
    assert score(checks)[1] == "likely_invalid"


def test_red_flags_never_look_valid():
    checks = run_checks({**GOOD, "red_flags": ["not an official certificate"]}, ORG, [], today=date(2026, 11, 20))
    conf, rec = score(checks)
    assert rec == "needs_review" and conf < 80
