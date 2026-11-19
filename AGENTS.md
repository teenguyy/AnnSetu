# AGENTS.md — instructions for Codex and other coding agents

Read `README.md` first. It documents the stack, structure, database contract and workflow.

Essentials:
- Static React 19 + esbuild site with a Supabase backend. Edit `src/` and `assets/*.css`. Never hand-edit `assets/js/` (it's built output).
- Build: `npm run build`. Test: `npm install --no-save playwright && npx playwright install chromium && npm run build && npm test`. All tests must pass before you commit.
- `supabase-config.js` points at the LIVE project. Don't sign up, post or approve anything against it while testing; use the test suite (mocked Supabase) instead.
- Never write to the live database, change its schema, or deploy to Vercel production without the owner's explicit approval. Schema changes go in a new additive `sql/annsetu_schema_partN_*.sql` file.
- Don't touch or drop the `v2` schema in Supabase (it belongs to the other branch's rebuild).
- No secrets in the repo (only the publishable key). No fake data in shipped UI. Don't remove existing features.
- Respect `prefers-reduced-motion`, keyboard access and WCAG AA contrast in any UI change.
