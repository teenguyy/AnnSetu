# AnnSetu: setup guide

*Good food deserves a second journey.* AnnSetu connects surplus food from donors (restaurants, hotels, canteens) with verified NGOs whose own representatives collect it.

## What is in this folder
| Path | What it is |
|---|---|
| `index.html` | Cinematic homepage (React): hero, story, mission, journey, live food discovery, experiences, live impact, stories, join + contact, footer |
| `signin.html` | Sign in, create account (role choice), Google, forgot / reset password |
| `donor.html`, `receiver.html`, `admin.html` | The three dashboards |
| `supabase-config.js` | Project URL + **publishable** key (safe in the browser) |
| `assets/annsetu.css` | Design system: tokens, type, buttons, forms, tags, cursor, discovery board, tables |
| `assets/home.css`, `assets/app.css` | Homepage / sign-in + dashboard styles |
| `assets/js/` | Built JavaScript (ES modules, code-split: the homepage doesn't load dashboard code) |
| `assets/brand/` | Logo set: full logo, reverse, monochrome, monogram, monochrome monogram, favicon, apple-touch icon |
| `src/` | React source (`npm install && npm run build` to rebuild) |
| `sql/` | Database scripts |
| `test/` | Playwright end-to-end tests against an in-memory Supabase mock |

## Run locally
```bash
npm install
npm run build
npx --yes serve -l 8080 .
```
Open http://localhost:8080. Do not open the files with `file://`: ES modules and sign-in redirects need a real URL.

Tests (use the pre-installed Chromium/Playwright; no real database is touched):
```bash
npm run build && npm test
```

## 1. Database (Supabase SQL Editor). Run in this order, once
1. `sql/annsetu_schema.sql`
2. `sql/annsetu_schema_part2.sql`
3. `sql/annsetu_schema_part3_fixes.sql`
4. `sql/annsetu_schema_part4_auth_role.sql`
5. *(optional)* `sql/annsetu_schema_part5_public_preview.sql`: lets signed-out visitors **see** a privacy-safe preview of live listings on the homepage (title, quantity, deadline, donor name, never addresses or phones). Without it, signed-out visitors see a "live listings are for verified receivers" panel. Requesting food always needs a signed-in, verified NGO.

Try them on a **test project first**.

## 2. Supabase settings
- **Authentication → URL Configuration:** Site URL = your deployed site; add `https://YOUR-SITE/signin.html` and `https://YOUR-SITE/` to Redirect URLs.
- **Authentication → Providers:** enable Email; configure Google separately.
- **Realtime:** `notifications`, `food_requests`, `food_listings`, `rep_locations`, `messages`.
- Optional: `pg_cron` → `select public.expire_listings()` every 10 minutes.

## 3. Deploy
Any static host (Vercel, Netlify, Cloudflare Pages). Run `npm run build` first (or commit `assets/js/`), then upload the folder. On Vercel: framework "Other", build command `npm run build`, output directory `.`.

## 4. First admin
Create a normal account → copy its UUID from Supabase → run `sql/make_first_admin.sql` → sign in again.

## How the flow works
Sign up → organisation profile → upload documents → admin approves a document, then the organisation → donor lists food → verified NGO finds it (search, filter, sort, **drag it into the request tray** or press "Add to request") → `create_request` → donor accepts (quantity reserved) → NGO sees a 4-digit OTP → donor enters it at handover → pickup completed, badges and certificates awarded → anyone can verify a certificate serial in the homepage footer.

## Design system (quick reference)
- Colours: Deep Ocean `#164B70`, Ocean Blue `#287FA6`, Sky `#82C5DF`, Light Blue `#A8D9E9`, Sunshine `#FFE28A`, Butter `#F5D98B`, Deep Ink `#102F46`, Coral `#E87968`. No green, no gold, no plain white.
- Type: Fraunces (headlines), Space Grotesk (labels, buttons, nav), DM Sans (body), Syne (big numbers), Caveat (rare annotations).
- Cursor: crosshair + connection nodes on fine pointers only; hidden over text fields; drag/drop states; off on touch; no easing or trail with reduced motion.
- Animation: GSAP + ScrollTrigger (homepage), Motion (dashboard transitions, nav indicators, discovery filtering), CSS/SVG for the rest. Everything respects `prefers-reduced-motion`.

## Security notes
- Only the publishable key is in the browser. **Never** put a `service_role` / secret key in these files.
- All permissions are enforced by the database (RLS + RPC functions), not by the page. The redesign calls exactly the same tables and RPCs as before.

## Known limits
- No email/SMS beyond Supabase Auth emails.
- Live location needs HTTPS and location permission.
- Photos/logos: JPG, PNG, WebP. Documents: PDF, JPG, PNG up to 5 MB.
