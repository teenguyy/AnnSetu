# AnnSetu
Food-redistribution platform: verified donors list surplus food, verified receivers (NGOs) request it and send representatives to collect; admins moderate. Type: full-stack (web + API + DB; Android later). Spec: `docs/MASTER_PROMPT.md`. Architecture: `docs/ARCHITECTURE.md`.
- Stack: Next.js App Router + TS strict + Tailwind + shadcn/ui + Motion + GSAP | FastAPI + Pydantic v2 + SQLAlchemy 2 async (uv) | Supabase Postgres 17 + PostGIS + pgvector + pg_cron, Auth, Storage, Realtime | Gemini (server-only) | Vercel + Render/Railway
- Layout: `web/` Next.js, `backend/` FastAPI, `supabase/` migrations + seeds + SQL tests, `e2e/` Playwright + k6, `mobile/` Flutter (later), `docs/`.
- Schema is owned by `supabase/migrations` (plain SQL). FastAPI maps tables but never migrates them.
- Business rules live in `security definer` SQL functions; admin functions check `is_admin()` and write `audit_log`.
- Commands: SQL tests `supabase/tests/run.sh` | backend `cd backend && uv run pytest && uv run ruff check` | web `cd web && pnpm lint && pnpm tsc --noEmit && pnpm test && pnpm build`.
- Env: see `web/.env.example`, `backend/.env.example`. Server-only: service-role key, JWT secret, DATABASE_URL, GEMINI_API_KEY, email/SMS keys.
- Design: "Ocean & Sunshine" palette (§3 of the spec); never green primary, gold, glossy gradients or plain white backgrounds. Bold pill buttons.
- Done = SQL tests, pytest, ruff, tsc, vitest, build pass; key journeys checked in a browser with a clean console; no dead UI or fake data or invented statistics.
- Do not: fake stats/testimonials, put secrets in the client, deploy to production or write to a production database without the owner's approval.
