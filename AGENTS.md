# AGENTS.md

Start with `docs/HANDOFF.md` (current state, live infrastructure, owner to-dos, next steps), then
`docs/MASTER_PROMPT.md` (product spec) and `docs/ARCHITECTURE.md`. `CLAUDE.md` holds the same project rules.

Rules that matter most:
- Schema changes only via new files in `supabase/migrations/` + tests in `supabase/tests/`; run `supabase/tests/run.sh`.
- Business rules belong in security-definer SQL functions with explicit caller checks; admin actions are audited.
- Never put secrets in the repo or the browser; `.env*` files are git-ignored (commit `.env.example` only).
- Never deploy to production or write to the production Supabase project without the owner's explicit approval.
- No fake data, statistics or testimonials; every button and form must do something real.
- Next.js 16 with Cache Components: read `web/node_modules/next/dist/docs/` before using unfamiliar APIs.
- Before calling work done: SQL tests, `uv run pytest` + `ruff`, `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm build`.
