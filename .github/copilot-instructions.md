# Copilot instructions for AnnSetu

Before any task, read `docs/HANDOFF.md` (current state, live infrastructure, next steps), then the relevant
section of `docs/MASTER_PROMPT.md` (product spec) and `docs/ARCHITECTURE.md`.

## Stack
- `web/`: Next.js 16 App Router, TypeScript strict, Tailwind v4, pnpm. **Cache Components is on**: no
  `export const revalidate`; use `"use cache"` + `cacheLife`/`cacheTag`. Never read the clock during prerender
  (client: inside effects; server pages using the Supabase session: `await connection()` + `<Suspense>`).
  `proxy.ts` replaces `middleware.ts`. Check `web/node_modules/next/dist/docs/` for unfamiliar APIs.
- `backend/`: FastAPI + Pydantic v2 + async SQLAlchemy (uv). Each request runs as the user
  (`app/core/db.py:user_tx`) so RLS applies.
- `supabase/`: owns the schema. Business rules live in security-definer SQL functions in `migrations/`.

## Rules
- Schema changes: new file in `supabase/migrations/` + assertions in `supabase/tests/`; run `supabase/tests/run.sh`.
- Admin actions go through `private.require_admin()` and `private.audit()`.
- Clients never write status, quantities, verification fields or roles (column grants enforce this).
- Use the design tokens in `web/app/globals.css` and `components/ui/button.tsx`; respect reduced motion;
  accessible labels, focus states, 44 px touch targets, no horizontal overflow at 390 px.
- No fake data, statistics or testimonials; no dead buttons or links.
- Never commit secrets (`.env*` is ignored). Never deploy to production or write to the live Supabase
  project without the owner's explicit approval.
- Done means: SQL tests, `uv run ruff check . && uv run pytest`, `pnpm exec tsc --noEmit`, `pnpm lint`,
  `pnpm build` all pass, and pages are checked in a browser for console errors.
