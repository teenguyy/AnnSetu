# AnnSetu handoff: state as of 2026-11-19

Read this first, then `docs/MASTER_PROMPT.md` (the full product spec) and `docs/ARCHITECTURE.md`.
Work branch: `claude/fullstack-dev-environment-laazgt` (currently the repo's default branch; `main` does not exist yet).

## 1. What AnnSetu is
Food-redistribution platform: verified **donors** list surplus food; verified **receivers** (NGOs, shelters,
community groups) request it and send their own **representatives** to collect; **admins** moderate.
AnnSetu does not deliver. Spec phases are in `docs/MASTER_PROMPT.md` §21.

## 2. Phase status
| # | Phase | Status |
|---|---|---|
| 1 | Architecture, data model | ✅ `docs/ARCHITECTURE.md` |
| 2 | Database, RLS, functions, storage, SQL tests | ✅ 94 SQL assertions passing |
| 3 | FastAPI core | ✅ 13 pytest integration tests, ruff clean (not deployed) |
| 4 | Design system | ✅ |
| 5 | Landing page + public pages | ✅ |
| 6 | Auth, OAuth wiring, profile wizard, no-certificate path, sign-out confirm | ✅ e2e journey passed against live Supabase |
| 7 | Full dashboard shell (collapsible sidebar) + donor/receiver/admin features | ⏭ **next** (only minimal pages exist) |
| 8–16 | Discovery+requests UI, representatives, chat/notifications, reports/audit UI, leaderboards+certificates, feedback, AI review + chatbot, testing/load/a11y/docs, Android | ⬜ not started (DB functions for many already exist) |

## 3. Repository layout
```
supabase/  migrations/ (schema owner), seed.sql, tests/ (SQL tests + Supabase shim), config.toml
backend/   FastAPI (uv): app/api/routes.py, app/core/{auth,db,ratelimit,errors,config}.py, app/jobs/worker.py,
           app/services/email.py, tests/, Dockerfile, scripts/create_admin.py
web/       Next.js 16 App Router (pnpm): app/, components/{brand,landing,site,auth,onboarding,dashboard,ui,cursor},
           lib/{supabase,auth,landing-data,public-rpc,utils}.ts, proxy.ts, vercel.json, scripts/export-brand.cjs
e2e/       auth-journey.cjs (Playwright script; needs test accounts + DONOR_PW/ADMIN_PW)
docs/      MASTER_PROMPT, ARCHITECTURE, UPGRADE_FROM_V1, CREDITS, HANDOFF (this), reference/ images
```

## 4. Key design decisions (keep them)
- **Schema is owned by `supabase/migrations`** (plain SQL). FastAPI maps tables but never migrates them.
- **Business rules live in `security definer` SQL functions** with `search_path = ''` and explicit caller
  checks (create_request, respond_request, cancel_request, reassign_representative, get_pickup_otp,
  confirm_pickup, update_rep_status[_by_token], issue_rep_access_token, update_rep_location, withdraw_listing,
  expire_listings, admin_* functions, rebuild_landing_snapshot, verify_certificate, public_listings_preview,
  discover_listings, complete_my_profile, set_my_role, my_organization). Admin functions call
  `private.require_admin()` and write `audit_log` via `private.audit()` (actor name/email snapshot).
- **RLS helpers are in the non-exposed `private` schema** (`private.is_admin()`, `my_org_id()`, `is_request_party()`…)
  to avoid policy recursion. Policies wrap `auth.uid()` as `(select auth.uid())`.
- **Column-level grants**: clients can never write status, qty_reserved/collected, verification fields or role.
- **FastAPI runs each request as the user**: `set local role authenticated` + `request.jwt.claims` in the same
  transaction (`app/core/db.py:user_tx`), so RLS and `auth.uid()` apply to the API too. JWT verified with HS256
  secret or the project JWKS (`app/core/auth.py`). Errors: P0001→400 (message shown), P0002→404, 42501→403.
- **Notifications**: `private.notify()` inserts in-app rows and queues `jobs(kind='email')`; the worker sends via
  Resend/SMTP or marks the job failed "No email provider configured" (never fakes success).
- **Honesty rules**: impact counts only OTP-confirmed pickups; meals = portions + kg ÷ 0.42 (labelled est.);
  CO₂ = kg × factor from `app_settings.co2_factor` (FAO 2013, 2.5). Never invent numbers or testimonials.
- **Next.js 16 specifics**: `cacheComponents: true` → no `export const revalidate`; use `"use cache"` +
  `cacheLife`/`cacheTag` (see `lib/landing-data.ts`). Never read the clock (`Date.now()`/`new Date()`) during
  prerender: in client components read it in effects; in server components that use the Supabase session
  call `await connection()` first and wrap in `<Suspense>`. `middleware.ts` is now `proxy.ts`.
  Bundled docs: `web/node_modules/next/dist/docs/`.
- **Design**: "Ocean & Sunshine" tokens in `web/app/globals.css` (Tailwind v4 `@theme`, `dark:` keyed to
  `html[data-theme]`). Fonts Fraunces / Space Grotesk / DM Sans / Syne / Caveat. Bold pill buttons
  (`components/ui/button.tsx`). All illustrations are original SVG (see `docs/CREDITS.md`).

## 5. Live infrastructure
- **Supabase project** `wwnkyukqiibbzqqbfsxp` (ap-southeast-1, Postgres 17). All 8 repo migrations applied
  (via the Supabase MCP; migration history in the dashboard has names: preserve_legacy, schema, rls, functions,
  storage_realtime_cron, import_legacy, tidy_grants, onboarding_helpers). Seed data applied. pg_cron jobs:
  `annsetu-expire-listings` (*/10) and `annsetu-landing-snapshot` (weekly).
  - The project held **AnnSetu v1 with real users**; v1 tables are preserved in schema `legacy` and their
    rows were imported (see `docs/UPGRADE_FROM_V1.md`). Real data: 5 users (1 admin), 3 organisations
    (none approved, all must complete the new wizard). **Do not drop `legacy` without the owner's approval.**
  - Auth: email + password with confirmation ON. Google/Apple/Microsoft NOT configured (buttons show disabled).
  - New migrations must be applied both to the repo and the project; run SQL tests locally first.
- **Vercel project** `annsetu` (team hi-3811). Production URL `https://annsetu-inky.vercel.app` still serves the
  **old v1 static site**. Latest v2 preview: `annsetu-d51bmgfzz-hi-3811.vercel.app` (Ready).
  **Promotion to production is pending the owner's explicit OK.** Env vars set (Production + Preview):
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publishable key), `NEXT_PUBLIC_SITE_URL`.
- **FastAPI is not deployed.** Until it is (`NEXT_PUBLIC_API_URL` unset), the contact form says it isn't
  connected and the search overlay can't search listings.

## 6. Owner to-dos (cannot be done from code)
1. Approve promoting the v2 deployment to production (or promote in the Vercel dashboard).
2. Supabase → Authentication → URL Configuration: Site URL `https://annsetu-inky.vercel.app`; redirect URLs
   `https://annsetu-inky.vercel.app/**`, `http://localhost:3000/**`.
3. Supabase → Authentication → enable leaked-password protection; add Google/Apple/Azure client IDs.
4. Provide (as secrets, never in chat/repo): Supabase pooler `DATABASE_URL`, `GEMINI_API_KEY`, `RESEND_API_KEY`.
5. Review the v1 FAQ "Are donations tax-deductible?"; confirm the inactive fact (India ≈55 kg/person/yr)
   against the UNEP report before activating it.

## 7. How to run and test
```bash
# SQL (needs Postgres 16+ with postgis, pgvector, pgcrypto; root runs psql as postgres)
supabase/tests/run.sh                    # fresh DB, all migrations + seed + tests (94 assertions)
supabase/tests/run.sh --schema-only      # just build the schema (TEST_DB=name to choose)
# API
cd backend && uv run ruff check . && uv run pytest -q          # 13 tests, builds annsetu_api_test
# Web
cd web && pnpm install && pnpm exec tsc --noEmit && pnpm lint && pnpm build
pnpm dev                                  # needs web/.env.local (copy .env.example)
# In the Claude cloud sandbox only: NODE_USE_ENV_PROXY=1 pnpm dev  (Node fetch ignores the proxy otherwise)
# Vercel (CLI already authenticated where available)
cd web && vercel deploy            # preview; production only with owner approval
```

## 8. Next steps (Phase 7 onward), suggested order
1. **Dashboard shell** (`components/dashboard/`): collapsible sidebar (no numbering, sliding active pill,
   icon rail with tooltips, remembered state), top bar (breadcrumbs, search, theme toggle, realtime
   notification bell, chatbot button, avatar menu with sign-out confirm), mobile drawer. Replace `BasicShell`.
2. **Donor**: overview stats, documents upload (`verification-docs/<org_id>/…` + `verification_documents` row;
   trigger queues AI review), listings CRUD (photos to `listing-photos/<org_id>/…`, ≤3, client resize),
   requests accept/reject (`respond_request`), pickups with OTP confirm (`confirm_pickup`), history.
3. **Receiver**: discovery board (`discover_listings`, radius 5/15/30/50, drag-and-drop tray + button,
   per-item results from `create_request`), requests/cancel, pickups (OTP display via `get_pickup_otp`,
   reassign), representatives page (CRUD on `representatives`), needs (`requirements`).
4. **Admin**: verification queue (orgs + documents + no-certificate SLA queue, `admin_review_*`),
   organisations (suspend/reinstate), listings withdraw, inbox (`contact_messages`), content (FAQs,
   testimonials, facts, app settings), announcements, audit log page with filters + CSV.
5. Then phases 8–16 per the spec. Missing SQL still to write: leaderboard (`public_leaderboard(p_board,
   p_window)` is already called by `web/components/site/leaderboard-table.tsx`), report actions,
   feedback admin reply, rep invitations accept flow, announcements insert, reviews insert.
6. Deploy FastAPI (Render/Railway, Docker) + the job worker; set `NEXT_PUBLIC_API_URL`.

## 9. Testing conventions
- Every new SQL function gets assertions in `supabase/tests/` (helpers: `tests.create_user`, `tests.as_user`,
  `tests.ok`, `tests.throws`, `tests.count`; switch roles with `set role authenticated` / `reset role`).
- API tests use real DB + locally signed JWTs (`backend/tests/conftest.py`).
- UI: check pages in a browser for console errors and horizontal overflow at 1440 and 390 px; reduced motion
  must leave everything visible. Never claim something works without running it.
- Test accounts on the live project: only with owner approval, `@example.com`, deleted afterwards along
  with their side effects (notifications to real admins, queued jobs).
