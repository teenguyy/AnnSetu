# AnnSetu — website (v1, as deployed on Vercel)

*Good food deserves a second journey.*

AnnSetu connects surplus food from **donors** (restaurants, hotels, canteens, event organisers, community kitchens) with **verified NGOs**, whose own representatives collect it. An **admin** verifies every organisation before it can take part.

- **Live site:** https://annsetu-inky.vercel.app
- **This branch:** `website-vercel-v1` holds the exact files of that production deployment, plus the React source, SQL and tests.
- **Backend:** Supabase (Postgres + Auth + Storage + Realtime). There is no custom server. All rules are enforced in the database with Row Level Security (RLS) and `security definer` RPC functions.

> The repo's default branch (`claude/fullstack-dev-environment-laazgt`) is a **different, newer full-stack rebuild** (FastAPI + a new schema). It is **not** compatible with this website. Don't merge the two branches.

---

## 1. Tech stack

| Layer | What |
|---|---|
| Pages | 5 static HTML files: `index.html`, `signin.html`, `donor.html`, `receiver.html`, `admin.html` |
| UI | React 19 (no framework, no router), plain CSS with design tokens |
| Animation | GSAP 3 (homepage), Motion (`motion/react`) for dashboards, CSS/SVG |
| Icons | `react-icons` (Feather `fi`, Font Awesome 6 `fa6`) |
| Bundler | esbuild: ESM output, code-split into `assets/js/` |
| Data | `@supabase/supabase-js` v2, loaded as a UMD script from a CDN in each HTML page (`window.supabase`) |
| Hosting | Vercel as a static site (`vercel.json`) |
| Tests | Playwright end-to-end tests against an in-memory Supabase mock |

There is **no TypeScript, no Next.js and no Tailwind** in this project. Keep it that way unless you are doing a deliberate migration.

---

## 2. Quick start

Requirements: Node 18+ and npm.

```bash
npm install
```

```bash
npm run build
```

```bash
npm run serve
```

Open http://localhost:8080. Don't open the HTML files with `file://`, because ES modules and auth redirects need a real URL.

The local site talks to the **live Supabase project** configured in `supabase-config.js`. Anything you do while signed in (sign up, listings, approvals) writes **real production data**. To use your own project instead, see section 6.

### Rebuild after every source change

`assets/js/` is the **built output** that the HTML pages load. Vercel runs `npm run build` on deploy, but locally you must rebuild before you reload:

```bash
npm run build
```

`build.sh` does the same thing after deleting `assets/js/` first, which removes stale chunks.

---

## 3. Project structure

```
index.html            Homepage (loads assets/js/home.js)
signin.html           Sign in / register / forgot + reset password
donor.html            Donor dashboard     ┐
receiver.html         Receiver (NGO) dash ├ all load assets/js/main.js, which picks the page by data-page
admin.html            Admin console       ┘
supabase-config.js    window.ANNSETU_SUPABASE_URL + window.ANNSETU_SUPABASE_PUBLISHABLE_KEY
vercel.json           Build command, output dir ".", security headers
build.sh              Clean rebuild of assets/js/

src/
  home.jsx            Homepage entry: nav, search overlay, sections
  home/Hero.jsx       Hero (headline, CTA buttons, animated artwork)
  home/Sections.jsx   Story, mission, journey, discovery, impact, stories, join/contact, FAQ, footer
  main.jsx            Entry for signin / donor / receiver / admin (reads <html data-page>)
  SignIn.jsx          Auth screens; register with role choice (Donor / Receiver)
  Donor.jsx           Listings, incoming requests, OTP handover, impact, badges
  Receiver.jsx        Discover food, request tray, pickups + OTP, representatives, needs
  Admin.jsx           Verification queue, documents, orgs, listings, reports, inbox, content, audit log
  discover.jsx        Food discovery board (search, filter, sort, drag-to-request)
  shared.jsx          Profile form, documents upload, messages, reports, shared panels
  shell.jsx           Dashboard layout: sidebar, top bar, theme toggle, notifications bell
  ui.jsx              Small UI kit: Btn, Field, Modal, Toast, Avatar, Empty, Tag, ...
  brand.jsx           Logo / monogram SVG components
  lib.js              Supabase client (db), routes, formatting helpers, constants
  data.js             Data-loading helpers used by the dashboards
  anim.js             GSAP helpers (useGsap, reduced-motion checks)
  cursor.js           Custom crosshair cursor (fine pointers only)

assets/
  annsetu.css         Design tokens + base components (buttons, forms, tags, tables, cursor)
  home.css            Homepage styles
  app.css             Sign-in + dashboard styles
  js/                 BUILT output (home.js, main.js, chunks/) — generated, don't hand-edit
  brand/              Logo SVGs, favicon, apple-touch-icon

sql/                  Database scripts (see section 5)
test/
  run-tests.js        Playwright E2E suite
  mock-supabase.js    localStorage-backed fake of supabase-js used by the tests
```

Key constants live in `src/lib.js`:
- `ROUTES = { donor: 'donor.html', ngo: 'receiver.html', admin: 'admin.html' }`
- `CATEGORIES`, `DONOR_TYPES`, `NGO_TYPES`, `DOC_TYPES`
- theme in `localStorage['annsetu_theme']` (`light` / `dark`)

---

## 4. How the product works

**Roles** (`profiles.role`): `donor`, `ngo` (shown as "Receiver" in the UI), `admin`.

1. **Sign up** on `signin.html` and choose Donor or Receiver. A trigger on `auth.users` creates the `profiles` row.
2. **Create an organisation profile** (`organizations`): name, type, phone, address, coordinates and "about".
3. **Upload verification documents** to the private `verification-docs` bucket. This adds rows to `verification_documents`.
4. **Admin** approves a document (`review_document`), then the organisation (`review_org`). Approval requires at least one approved document. Rejection requires a note. Every admin action is written to `audit_log`.
5. **Donor posts a listing** (`food_listings`): title, category, quantity + unit, prepared time, "pickup by" deadline, safety notes and an optional photo.
6. **Verified NGO discovers food** with `nearby_listings` (PostGIS distance search). They drag a card into the request tray or press "Add to request", pick one of their **representatives**, and call `create_request`.
7. **Donor accepts or rejects** with `respond_request`. Accepting reserves the quantity and generates a **4-digit OTP** that only the NGO can see (`pickup_otps`).
8. **During pickup** the NGO can share live location (`update_location` writes to `rep_locations`, Realtime).
9. **At handover** the donor enters the OTP (`confirm_pickup`). The request is completed and **badges and certificates** are awarded automatically (`org_badges`, `certificates`).
10. **Anyone** can verify a certificate serial in the homepage footer (`verify_certificate`).

Also included:
- per-request messages
- reports/complaints, with admin resolve and optional suspend
- admin suspend/unsuspend and listing withdrawal
- contact form, testimonials and FAQ, managed by the admin
- a leaderboard
- notifications (Realtime)
- dark mode
- `prefers-reduced-motion` support

### RPCs the frontend calls

| RPC | Who | Purpose |
|---|---|---|
| `set_my_role(p_role)` | new user | Pick donor/ngo (e.g. after Google sign-in) before an org exists |
| `create_request(p_listing, p_qty, p_rep)` | verified NGO | Request food |
| `respond_request(p_request, p_accept)` | donor | Accept/reject; accept creates the OTP |
| `cancel_request(p_request)` | NGO | Cancel pending/accepted request |
| `confirm_pickup(p_request, p_otp)` | donor | Complete handover (5 wrong attempts lock it) |
| `update_location(p_request, p_lat, p_lng, p_acc)` | NGO | Live pickup location |
| `nearby_listings(p_lat, p_lng, p_radius_km, p_category)` | verified NGO | Discovery search |
| `public_listings_preview(p_limit)` | anyone | Privacy-safe homepage preview |
| `public_impact()` | anyone | Real totals for the homepage |
| `get_leaderboard(p_kind, p_limit)` | signed in | Top donors / NGOs |
| `verify_certificate(p_serial)` | anyone | Certificate check |
| `review_document`, `review_org`, `suspend_org`, `admin_withdraw_listing`, `resolve_report` | admin | Moderation (all audited) |

### Tables

`profiles`, `organizations`, `verification_documents`, `representatives`, `food_listings`, `food_requests`, `pickup_otps`, `requirements`, `notifications`, `reviews`, `audit_log`, `rep_locations`, `badge_definitions`, `org_badges`, `certificates`, `reports`, `messages`, `contact_messages`, `testimonials`, `faqs`. There are also two views: `donor_impact` and `ngo_impact`.

Storage buckets:
- `verification-docs`: private; each user writes only to their own folder (`<auth.uid()>/...`)
- `listing-photos` and `org-logos`: public read, own-folder write

---

## 5. Database setup (new Supabase project)

Run these in the **Supabase SQL Editor**, in order, once:

1. `sql/annsetu_schema.sql`: core tables, RLS, core RPCs
2. `sql/annsetu_schema_part2.sql`: audit, suspension, PostGIS, badges/certificates, reports, messages, content, storage, realtime, seed badges + FAQs
3. `sql/annsetu_schema_part3_fixes.sql`: fixes how expiry and withdrawal release reserved quantity
4. `sql/annsetu_schema_part4_auth_role.sql`: `set_my_role`
5. `sql/annsetu_schema_part5_public_preview.sql`: public homepage preview
6. `sql/annsetu_schema_part6_otp_fix.sql`: makes `respond_request` find `gen_random_bytes` (pgcrypto lives in the `extensions` schema)

Then:
- **First admin:** sign up normally, copy your user UUID from Authentication → Users, and run `sql/make_first_admin.sql` with it. Then sign in again.
- **Expiry job (optional):** `select cron.schedule('expire-listings','*/10 * * * *','select public.expire_listings()');`

### Current state of the live project (`wwnkyukqiibbzqqbfsxp`)

Parts 1–6 are applied in the `public` schema, and the website runs on it. The newer rebuild's tables and functions were moved into a separate **`v2`** schema (with its saved cron jobs and storage policies in `v2._saved_cron` / `v2._saved_storage_policies`). **Don't drop or edit `v2`.** It belongs to the other branch.

### Supabase dashboard settings

- **Authentication → URL Configuration:** Site URL = `https://annsetu-inky.vercel.app`. Redirect URLs include `https://annsetu-inky.vercel.app/signin.html` and `http://localhost:8080/signin.html`.
- **Authentication → Providers → Email:** enabled. With Supabase's built-in email sender, only about **2 emails per hour** go out, so sign-ups fail with `429 email rate limit exceeded`. Either turn **"Confirm email" off**, or add your own SMTP (Resend / Brevo) under Authentication → Emails → SMTP Settings and raise the limit under Rate Limits.
- **Google sign-in:** currently **not enabled** (`provider is not enabled`). Configure it under Providers → Google before you show the Google button in a demo.

---

## 6. Configuration

`supabase-config.js` is the only config file:

```js
window.ANNSETU_SUPABASE_URL = 'https://<project-ref>.supabase.co';
window.ANNSETU_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_...';
```

- The **publishable** key is designed to be public. RLS protects the data.
- **Never** put a `service_role` / `sb_secret_...` key, or any other secret, in this repo or in any file the browser loads.
- To develop against a separate test project, point these two values at it and run the SQL in section 5 there. Don't commit that change if `main`/Vercel should keep using the live project.

There are no build-time environment variables, and none need to be set on Vercel.

---

## 7. Tests

The suite drives the real built pages in Chromium. It swaps `supabase-js` for `test/mock-supabase.js`, so **no real database is touched**.

```bash
npm install --no-save playwright
```

```bash
npx playwright install chromium
```

```bash
npm run build && npm test
```

- Output lists `✓` / `✗ FAIL` lines. Screenshots go to `$SHOTS` (default: your temp dir, `annsetu-shots/`).
- The suite covers the homepage, sign-in/register, the donor, receiver and admin flows, the OTP handover, moderation, guards, mobile, touch and reduced motion.
- When you add a feature that calls a new table or RPC, add matching behaviour to `test/mock-supabase.js`, or the tests will fail.
- `.vercelignore` keeps `test/` out of deployments.

---

## 8. Deploy (Vercel)

The Vercel project is `annsetu`, with production at https://annsetu-inky.vercel.app.

- Framework preset: **Other**. Install `npm install`. Build `npm run build`. Output directory `.`.
- `vercel.json` adds `X-Content-Type-Options`, `Referrer-Policy` and `X-Frame-Options` headers.
- **Deploy a preview first**, check it, then promote:

```bash
npx vercel deploy
```

```bash
npx vercel deploy --prod
```

---

## 9. Design system (quick reference)

- **Colours:** Deep Ocean `#164B70`, Ocean Blue `#287FA6`, Sky `#82C5DF`, Light Blue `#A8D9E9`, Sunshine `#FFE28A`, Butter `#F5D98B`, Deep Ink `#102F46`, Coral `#E87968`. Tokens are CSS variables at the top of `assets/annsetu.css`. Dark theme overrides live under `[data-theme="dark"]`.
- **Type:** Fraunces (headlines), Space Grotesk (labels, buttons, nav), DM Sans (body), Syne (big numbers), Caveat (rare handwritten notes). Fonts load from Google Fonts.
- **Motion:** GSAP on the homepage, Motion in the dashboards. Always respect `prefers-reduced-motion`, and pause loops when they're off-screen.
- **Cursor:** custom crosshair only on `(hover: hover) and (pointer: fine)`. The native cursor stays in text fields and on touch devices.
- **Accessibility:** semantic HTML, labelled fields, visible focus, keyboard navigation, a skip link and WCAG AA contrast.

---

## 10. Rules for contributors and AI agents (Codex, Claude, Copilot)

1. **Don't change the database contract by accident.** The frontend relies on the exact tables, columns and RPC signatures in section 4. Any schema change goes in a **new** `sql/annsetu_schema_partN_*.sql` file: additive, safe to re-run, and tested on a test project first.
2. **Never write to the live Supabase project, or deploy to production, without the owner's explicit OK.**
3. **No fake data** in shipped code: no invented stats, testimonials or listings. Empty states say so honestly.
4. **Keep every existing feature working.** Run `npm run build && npm test` before every commit.
5. **Edit `src/`, never `assets/js/`.** Rebuild instead.
6. **Secrets never go in the repo.** Only the publishable key belongs in `supabase-config.js`.
7. Keep the stack as is (React + esbuild + plain CSS). Don't add libraries unless they're clearly needed.

---

## 11. Known limits / ideas for later

- Email depends on Supabase Auth's sender (rate-limited, see section 5). There's no SMS.
- Live location needs HTTPS and the browser's location permission.
- Uploads: photos/logos in JPG/PNG/WebP (≤2 MB listing photo, ≤1 MB logo). Documents in PDF/JPG/PNG up to 5 MB.
- Planned on the other branch: AI document verification, chatbot, representative logins with routes and ETA, leaderboard with admin override, more sign-in providers, and automated emails.
