"""AnnSetu backend (FastAPI).

Endpoints
  GET  /health
  POST /ai/review-document   admin: read a verification document with Gemini, check it, save a summary
  POST /ai/review-no-cert    admin: summarise a "no certificate" request
  POST /chat                 everyone: role-aware assistant (signed-out visitors included)

Security: the backend holds NO Supabase secret. Callers send their Supabase access token;
the backend uses it for every read/write, so Row Level Security and the admin checks inside
the RPCs apply exactly as in the browser.
"""
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from typing import Annotated

import httpx
from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from .chatbot import system_prompt
from .config import Settings, get_settings
from .gemini import AIUnavailable, Gemini, parse_json
from .supa import Supa, SupabaseError
from .verify import EXTRACT_PROMPT, NO_CERT_PROMPT, run_checks, score, summarise

ALLOWED_MIME = {"application/pdf", "image/jpeg", "image/png", "image/webp"}


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.http = httpx.AsyncClient(timeout=30)
    yield
    await app.state.http.aclose()


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    app = FastAPI(title="AnnSetu API", version="1.0.0", lifespan=lifespan)
    app.state.settings = settings
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.origins,
        allow_methods=["GET", "POST"],
        allow_headers=["Authorization", "Content-Type"],
        max_age=600,
    )

    # ---- simple per-IP rate limit (fine for one instance; use Redis when scaling out) ----
    hits: dict[str, deque] = defaultdict(deque)
    limits = {"/chat": (20, 60), "/ai/review-document": (30, 60), "/ai/review-no-cert": (30, 60), "/ai/auto-review": (10, 60)}

    @app.middleware("http")
    async def rate_limit(request: Request, call_next):
        lim = limits.get(request.url.path)
        if lim and request.method == "POST":
            key = f"{request.url.path}|{request.headers.get('x-forwarded-for', request.client.host if request.client else '-')}"
            now, q = time.monotonic(), hits[key]
            while q and now - q[0] > lim[1]:
                q.popleft()
            if len(q) >= lim[0]:
                return JSONResponse({"detail": "Too many requests. Please wait a minute."}, status_code=429)
            q.append(now)
        try:
            resp = await call_next(request)
        except Exception:  # noqa: BLE001 - never leak stack traces to clients
            return JSONResponse({"detail": "Something went wrong. Please try again."}, status_code=500)
        resp.headers["X-Content-Type-Options"] = "nosniff"
        return resp

    def http(request: Request) -> httpx.AsyncClient:
        # Created lazily as well, because a mounted/serverless app may not run the lifespan hook.
        st = app.state
        if getattr(st, "http", None) is None or st.http.is_closed:
            st.http = httpx.AsyncClient(timeout=30)
        return st.http

    def token_of(authorization: str | None) -> str | None:
        if authorization and authorization.lower().startswith("bearer "):
            t = authorization[7:].strip()
            return t or None
        return None

    async def require_admin(request: Request, authorization: str | None = Header(default=None)) -> Supa:
        tok = token_of(authorization)
        if not tok:
            raise HTTPException(401, "Sign in as an admin.")
        sb = Supa(settings, http(request), tok)
        try:
            await sb.user()
            is_admin = await sb.rpc("is_admin")
        except SupabaseError:
            raise HTTPException(401, "Your session has expired. Sign in again.")
        if is_admin is not True:
            raise HTTPException(403, "Admins only.")
        return sb

    AdminDep = Annotated[Supa, Depends(require_admin)]

    @app.exception_handler(AIUnavailable)
    async def ai_down(_: Request, exc: AIUnavailable):
        return JSONResponse({"detail": f"AI is unavailable right now: {exc}"}, status_code=503)

    @app.exception_handler(SupabaseError)
    async def sb_err(_: Request, exc: SupabaseError):
        code = exc.status if exc.status in (400, 401, 403, 404) else 502
        return JSONResponse({"detail": exc.message}, status_code=code)

    @app.get("/health")
    async def health():
        return {"ok": True, "ai": settings.ai_enabled, "model": settings.gemini_model if settings.ai_enabled else None}

    # ------------------------------------------------------------------ AI document review
    class DocIn(BaseModel):
        document_id: str = Field(pattern=r"^[0-9a-fA-F-]{36}$")

    async def analyse(sb: Supa, request: Request, document_id: str, others: list[dict]):
        """Reads the document with the caller's own access (RLS), extracts with Gemini and runs the checks."""
        docs = await sb.select("verification_documents", f"id=eq.{document_id}&select=id,org_id,path,doc_type")
        if not docs:
            raise HTTPException(404, "Document not found.")
        doc = docs[0]
        orgs = await sb.select("organizations", f"id=eq.{doc['org_id']}&select=id,name,kind,org_type,address")
        if not orgs:
            raise HTTPException(404, "Organisation not found.")
        org = orgs[0]
        data, mime = await sb.download("verification-docs", doc["path"])
        if mime not in ALLOWED_MIME:
            low = doc["path"].lower()
            mime = ("application/pdf" if low.endswith(".pdf") else "image/png" if low.endswith(".png")
                    else "image/webp" if low.endswith(".webp") else "image/jpeg")
        if len(data) > settings.max_document_bytes:
            raise HTTPException(413, "Document is larger than 5 MB.")
        g = Gemini(settings, http(request))
        ex = await g.extract_json(EXTRACT_PROMPT + f"\n\nThe uploader labelled it: {doc.get('doc_type')}.", data, mime)
        checks = run_checks(ex, org, others)
        conf, rec = score(checks)
        summary = summarise(ex, org, checks, conf, rec)
        gen = ex.get("genuine_assessment") if ex.get("genuine_assessment") in (
            "likely_genuine", "uncertain", "likely_fake") else None
        return doc, org, ex, checks, conf, rec, summary, gen

    @app.post("/ai/auto-review")
    async def auto_review(body: DocIn, request: Request, authorization: str | None = Header(default=None)):
        """Called by the uploader's browser right after an upload: the summary is ready before an admin looks."""
        tok = token_of(authorization)
        if not tok:
            raise HTTPException(401, "Sign in first.")
        if not settings.ai_review_secret:
            raise HTTPException(503, "Automatic AI review is not configured.")
        sb = Supa(settings, http(request), tok)
        try:
            await sb.user()
        except SupabaseError:
            raise HTTPException(401, "Your session has expired. Sign in again.")
        # duplicates across organisations are checked inside the database function
        doc, _org, ex, checks, conf, rec, summary, gen = await analyse(sb, request, body.document_id, [])
        review_id = await sb.rpc("save_document_review_auto", {
            "p_secret": settings.ai_review_secret, "p_doc": doc["id"], "p_summary": summary, "p_extracted": ex,
            "p_checks": checks, "p_confidence": conf, "p_recommendation": rec, "p_genuine": gen,
            "p_model": settings.gemini_model,
        })
        return {"id": review_id, "recommendation": rec}

    @app.get("/config")
    async def public_config():
        # Google Maps JS keys are browser keys by design; restrict them to your domains in Google Cloud.
        return {"maps_key": settings.google_maps_api_key or None, "ai": settings.ai_enabled}

    @app.post("/ai/review-document")
    async def review_document(body: DocIn, request: Request, sb: AdminDep):
        others = await sb.rpc("admin_document_numbers") or []
        doc, org, ex, checks, conf, rec, summary, gen = await analyse(sb, request, body.document_id, others)
        if gen:
            ex = {**ex, "genuine": gen}
        review_id = await sb.rpc("save_document_review", {
            "p_org": org["id"], "p_doc": doc["id"], "p_kind": "document", "p_summary": summary,
            "p_extracted": ex, "p_checks": checks, "p_confidence": conf, "p_recommendation": rec,
            "p_model": settings.gemini_model,
        })
        return {"id": review_id, "summary": summary, "extracted": ex, "checks": checks,
                "confidence": conf, "recommendation": rec, "genuine": gen}

    class OrgIn(BaseModel):
        org_id: str = Field(pattern=r"^[0-9a-fA-F-]{36}$")

    @app.post("/ai/review-no-cert")
    async def review_no_cert(body: OrgIn, request: Request, sb: AdminDep):
        orgs = await sb.select("organizations", f"id=eq.{body.org_id}&select=id,name,kind,org_type,address,about,"
                                                 "area_served,phone,no_certificate,no_certificate_note,created_at")
        if not orgs:
            raise HTTPException(404, "Organisation not found.")
        org = orgs[0]
        if not org.get("no_certificate"):
            raise HTTPException(400, "This organisation has not asked for review without a certificate.")
        profile = "\n".join(f"{k}: {org.get(k)}" for k in
                            ("name", "org_type", "address", "area_served", "about", "no_certificate_note", "created_at"))
        g = Gemini(settings, http(request))
        out = await g.extract_json(NO_CERT_PROMPT + profile)
        conf = max(0, min(100, int(out.get("confidence") or 0)))
        rec = "needs_review" if conf >= 40 else "likely_invalid"
        checks = ([{"check": "Verify", "result": "warn", "detail": str(x)} for x in (out.get("to_verify") or [])[:6]]
                  + [{"check": "Concern", "result": "fail", "detail": str(x)} for x in (out.get("concerns") or [])[:4]])
        summary = str(out.get("summary") or "No summary.")[:1500] + " Manual verification is required."
        review_id = await sb.rpc("save_document_review", {
            "p_org": org["id"], "p_doc": None, "p_kind": "no_certificate", "p_summary": summary,
            "p_extracted": {"claims": out.get("claims") or []}, "p_checks": checks, "p_confidence": conf,
            "p_recommendation": rec, "p_model": settings.gemini_model,
        })
        return {"id": review_id, "summary": summary, "checks": checks, "confidence": conf, "recommendation": rec}

    # ------------------------------------------------------------------ Chatbot
    class Msg(BaseModel):
        role: str = Field(pattern="^(user|assistant)$")
        content: str = Field(min_length=1, max_length=1500)

    class ChatIn(BaseModel):
        messages: list[Msg] = Field(min_length=1, max_length=16)

    @app.post("/chat")
    async def chat(body: ChatIn, request: Request, authorization: str | None = Header(default=None)):
        if body.messages[-1].role != "user":
            raise HTTPException(400, "The last message must be from the user.")
        tok = token_of(authorization)
        anon = Supa(settings, http(request))
        role, me = "observer", None
        if tok:
            sb = Supa(settings, http(request), tok)
            try:
                u = await sb.user()
                prof = await sb.select("profiles", f"id=eq.{u['id']}&select=role,full_name")
                role = (prof[0]["role"] if prof else "donor") or "donor"
                org = await sb.select("organizations", f"owner_id=eq.{u['id']}&select=name,kind,org_type,verification,"
                                                       "suspended,no_certificate")
                if org:
                    o = org[0]
                    me = (f"Organisation: {o['name']} ({o['org_type']}), verification: {o['verification']}"
                          + (", SUSPENDED" if o.get("suspended") else "")
                          + (", asked for review without certificate" if o.get("no_certificate") else ""))
                elif role == "rep":
                    me = "Representative account."
                else:
                    me = "No organisation profile yet: they must complete the profile first."
            except SupabaseError:
                role, me = "observer", None
        try:
            faqs = await anon.select("faqs", "published=eq.true&select=question,answer&order=sort_order")
        except SupabaseError:
            faqs = []
        msgs = [{"role": "system", "content": system_prompt(role, faqs, me)}]
        msgs += [{"role": m.role, "content": m.content} for m in body.messages[-12:]]
        reply = await Gemini(settings, http(request)).chat(msgs, temperature=0.3)
        return {"reply": reply.strip()[:4000], "role": role}

    return app


app = create_app()

__all__ = ["app", "create_app", "parse_json"]
