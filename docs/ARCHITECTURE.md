# AnnSetu architecture

AnnSetu coordinates surplus-food pickups between verified **donors** and verified **receivers** (NGOs, shelters, community groups). Receivers send their own **representatives** to collect. **Admins** moderate. **Observers** browse. AnnSetu does not run a delivery fleet.

## 1. System overview

```
Browser (Next.js, Vercel)
  ├── Supabase JS ──► Supabase Auth / PostgREST / Realtime / Storage   (only RLS-protected operations)
  └── fetch(JWT) ───► FastAPI (Docker on Render/Railway)
                        ├── async SQLAlchemy ──► Supavisor (transaction mode) ──► Postgres 17
                        ├── Redis (rate limits, cache, job queue)
                        ├── Gemini (document review, chatbot)        server-side only
                        ├── Email / SMS adapters (Resend | SMTP | SMS)
                        └── OSRM (routes)
Postgres: PostGIS (distance), pgvector (chatbot retrieval), pg_cron (schedules)
```

**Who talks to what**

| Operation | Path | Why |
|---|---|---|
| Read own profile, notifications, messages; public listings preview | Supabase client + RLS | Fully protected by row policies |
| Create / respond / cancel request, confirm pickup, rep status | `security definer` SQL functions (called via FastAPI or RPC) | Multi-row transactions and invariants |
| Admin actions | SQL functions guarded by `is_admin()`, always audited | Single enforcement point |
| AI review, chatbot, email, routing, scoring, certificates | FastAPI only | Secrets stay server-side |

The browser never sees the service-role key, the JWT secret or the Gemini key.

## 2. Roles and identity

| Role | Stored as | Created by |
|---|---|---|
| observer | no account | — |
| donor | `profiles.role = 'donor'` | sign-up, `set_my_role` |
| ngo (receiver) | `profiles.role = 'ngo'` | sign-up, `set_my_role` |
| representative | `profiles.role = 'representative'` + `representatives.user_id` | accepting an NGO invitation |
| admin | `profiles.role = 'admin'` | first-admin script or another admin |

A role locks once the user owns an organisation. A representative belongs to at most one active NGO. Representatives without an account act through a **magic link**: a random token whose SHA-256 hash is stored in `rep_access_tokens`, scoped to one request and expiring 2 h after the pickup deadline.

## 3. Data model

All tables live in `public`, have RLS enabled, and are indexed on every foreign key and filter column.

**People and organisations**
- `profiles` (id = auth.users.id, role, full_name, phone, avatar_path, theme, created_at)
- `organizations` (owner_id, kind donor|ngo, org_type, status pending|approved|rejected|suspended, name, contact_person, phone, email, address, city, state, pincode, `location geography(Point)`, about, operating_hours jsonb, pickup_windows jsonb, logo_path, fssai_number, area_served, beneficiaries_per_day, profile_completed_at, no_certificate, no_cert_explanation, no_cert_references, review_due_at, rejection_note, suspended_reason)

**Verification**
- `verification_documents` (org_id, doc_type, storage_path, status pending|approved|rejected, admin_note)
- `document_ai_reviews` (document_id or org_id, model, prompt_version, extracted jsonb, checks jsonb, confidence 0–100, recommendation, summary, raw jsonb, status)

**Representatives**
- `representatives` (org_id, user_id?, name, phone, email, photo_path, status invited|active|inactive, invited_at, last_active_at)
- `rep_invitations` (rep_id, token_hash, expires_at, accepted_at)
- `rep_access_tokens` (request_id, rep_id, token_hash, expires_at, revoked_at)
- `rep_locations` (request_id, rep_id, `point geography`, recorded_at) — deleted when the pickup ends

**Food and pickups**
- `food_listings` (donor_org_id, title, category, qty_total, qty_reserved, qty_collected, unit portions|kg|packs, prepared_at, pickup_by, photos text[], diet veg|non_veg|mixed, allergens text[], safety_notes, pickup_instructions, status active|reserved|completed|expired|withdrawn, location)
- `food_requests` (listing_id, receiver_org_id, rep_id, qty, status pending|accepted|rejected|cancelled|completed|expired, timeline_status assigned|on_the_way|arrived|collected|delivered, eta, rep_name/rep_phone snapshot, responded_at, completed_at)
- `pickup_otps` (request_id, code_hash, expires_at, attempts) — plain code is only readable through `get_pickup_otp` by the NGO and its assigned representative
- `pickup_events` (request_id, actor, event, data, created_at) — the tracking timeline
- `requirements` (org_id, title, category, qty, unit, needed_by, status open|fulfilled)

**Communication**: `notifications`, `notification_preferences`, `messages` (request_id, sender, body ≤ 2000, attachment_path, read_by), `announcements`

**Trust**: `reviews`, `reports` (+ `report_actions`), `audit_log` (actor snapshot, action, target, diff, note, ip_hash), `activity_log`

**Recognition**: `badge_definitions`, `org_badges`, `certificates` (serial, milestone, pdf_path, revoked), `leaderboard_overrides`

**Landing and content**: `landing_snapshot`, `facts` (source_name, source_url, verified_at), `contact_messages`, `testimonials`, `faqs`, `app_settings`

**Support**: `feedback`, `device_tokens`. **Chatbot**: `chatbot_conversations`, `chatbot_messages`, `kb_documents (embedding vector(768))`. **System**: `jobs`.

## 4. Business rules (enforced in SQL, not the UI)

- Only `approved`, non-suspended organisations can list (donors) or request (receivers).
- `create_request(listing, qty, rep)`: rep belongs to the NGO and is active; listing active and unexpired; donor not suspended; `1 ≤ qty ≤ available`; one pending request per receiver per listing; snapshots rep name and phone.
- `respond_request(request, accept, note)`: listing owner only. Accept locks the listing row, re-checks availability, increments `qty_reserved`, and issues a 4-digit OTP valid until `pickup_by + 2 h`.
- `cancel_request(request)`: NGO only, while pending or accepted; releases the reservation and deletes the OTP.
- `confirm_pickup(request, code)`: listing owner only; max 5 attempts, expiry enforced; completes the request, moves the quantity from reserved to collected, completes the listing when fully collected, awards badges and certificates to both sides.
- `expire_listings()` every 10 minutes: expires listings past `pickup_by`, releases their pending and accepted requests.
- `update_rep_status(...)`: only the assigned representative (account or magic link) during an accepted pickup; each change writes a `pickup_events` row and notifies donor and NGO.
- Suspension withdraws open listings and releases open requests.
- Column grants: clients can never write `status`, `qty_reserved`, `qty_collected`, verification fields or `role`.
- Admin functions check `is_admin()` and write `audit_log` with the actor's name and email snapshot.

## 5. Impact and honesty

- Impact counts only OTP-confirmed pickups.
- Meals (est.) = portions + kg ÷ 0.42 (WRAP 420 g meal equivalent); packs are not converted.
- CO₂ (est.) = kg × a configurable factor stored in `app_settings` with its source.
- `landing_snapshot` is rebuilt weekly by pg_cron (or on demand by an admin) and cached by the landing page; it never shows invented numbers.

## 6. Scale (~10,000 users)

Static/ISR landing with cached snapshot; async FastAPI with several Uvicorn workers through Supavisor; cursor pagination; gzip + ETag; Redis rate limits; AI work as queued jobs; realtime subscriptions filtered per user, conversation or pickup; partial index on active listings, GiST on locations, HNSW on embeddings. Proven with k6 (targets in the master prompt §2).

## 7. Repository layout

```
web/       Next.js App Router (TypeScript strict)
backend/   FastAPI + SQLAlchemy 2 async + Alembic-free (schema owned by supabase/migrations), uv
supabase/  migrations (schema, RLS, functions, storage), seed.sql, seed_demo.sql, tests/
mobile/    Flutter app (later phase)
e2e/       Playwright + k6
docs/      ARCHITECTURE, SETUP, DEPLOYMENT, SECURITY, guides, TESTING_REPORT, CREDITS
```

**Schema ownership.** Because the schema is Supabase-owned (auth, RLS, storage, realtime), it lives in `supabase/migrations` as plain SQL applied by the Supabase CLI. FastAPI maps these tables with SQLAlchemy models but does not migrate them; this avoids two tools fighting over one schema.

## 8. Local development

The full Supabase Docker stack is the target (`supabase start`). Where Docker images cannot be pulled, the SQL test harness (`supabase/tests/run.sh`) runs every migration and test against a plain Postgres 16+ with PostGIS, pgvector and pg_cron, using `supabase/tests/00_supabase_shim.sql` to emulate the `auth` schema, `auth.uid()`, `auth.jwt()` and the `anon` / `authenticated` / `service_role` roles.

## 9. Phase plan

1. Architecture (this document) · 2. Database, RLS, functions, storage, SQL tests · 3. FastAPI core · 4. Design system · 5. Landing page · 6. Auth + wizard · 7. Dashboards · 8. Discovery, requests, OTP · 9. Representatives, routing, tracking · 10. Chat + notifications · 11. Reports + audit · 12. Leaderboards + certificates · 13. Feedback · 14. AI review + chatbot · 15. Testing, load, a11y, docs, preview deploy · 16. Android app.

## 10. Sandbox note
In the Claude Code cloud sandbox, outbound HTTPS goes through a proxy that Node's built-in `fetch`
ignores by default. Run the web app there with `NODE_USE_ENV_PROXY=1 pnpm dev`. Vercel and normal
machines need nothing extra.
