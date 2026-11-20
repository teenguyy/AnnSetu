# ANNSETU MOBILE APP: prompt for ChatGPT Plus (Codex)

> **How to use**
> 1. In ChatGPT, open **Codex** and connect the GitHub repo `teenguyy/AnnSetu`.
> 2. Create a new branch for the app (e.g. `mobile-app`). Tell Codex the website code is on branch `website-v2-features` and it may read it for reference.
> 3. Paste everything below the line as the task.
> 4. Do NOT paste any secret into the chat. The app only needs the public Supabase URL + publishable key (already in `supabase-config.js`) and the website API base URL `https://annsetu-inky.vercel.app/api`.

---

You are a senior mobile engineer. Build the **AnnSetu Android app** (iOS-ready) that is a native companion to the live website **https://annsetu-inky.vercel.app**. It must use the **same Supabase project, the same tables, the same RPC functions and the same FastAPI endpoints** as the website, so a user can sign in on either and see the same data. Do not create a new backend or a new database. Do not change the database schema unless a step below says so, and then only with a new additive SQL file.

AnnSetu connects surplus food from **donors** (restaurants, hotels, canteens, caterers, event organisers, community kitchens) with **verified receivers** (NGOs, shelters, community kitchens, local community groups). Receivers send their **own representatives** to collect the food; AnnSetu never delivers. **Admins** verify organisations. Tagline: *Good food deserves a second journey.* Logo tagline: *CONNECT · SHARE · NOURISH*.

## 1. Stack (fixed)
- **Expo (latest SDK) + React Native + TypeScript (strict)**, Expo Router, EAS Build.
- `@supabase/supabase-js` v2 with `expo-secure-store` for the session; `react-native-url-polyfill`.
- **Maps (free, no card, no key)**: `@maplibre/maplibre-react-native` (or `react-native-maps` with an OpenStreetMap `UrlTile`) showing OpenStreetMap tiles with the required "© OpenStreetMap contributors" attribution. Routing + ETA: OSRM `https://router.project-osrm.org/route/v1/driving/{lng},{lat};{lng},{lat}?overview=full&geometries=geojson`. Reverse geocoding: Nominatim `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=..&lon=..` (send a descriptive User-Agent, max 1 request/second). Keep these URLs in one config file so they can be swapped for a self-hosted or free-tier provider later. Do NOT use Google Maps APIs (they need a billing card).
- Location: `expo-location` (foreground + background with `expo-task-manager` during an active trip only).
- Push: `expo-notifications` (see §9).
- Images/files: `expo-image-picker`, `expo-document-picker`.
- Data fetching: TanStack Query. Forms: react-hook-form + zod.
- Tests: Jest + React Native Testing Library; Maestro flows for E2E.

## 2. Connection details
- `SUPABASE_URL = https://wwnkyukqiibbzqqbfsxp.supabase.co`
- `SUPABASE_PUBLISHABLE_KEY` = copy from `supabase-config.js` in the website branch (it is public by design).
- `API_BASE = https://annsetu-inky.vercel.app/api` (FastAPI). Send `Authorization: Bearer <supabase access_token>` on every API call.
- Put these in `app.config.ts` `extra`, read through `expo-constants`.
- **Never** embed a service-role key or any secret. All permissions are enforced by Row Level Security and RPCs.

## 3. Roles and routing (same as the website)
`profiles.role` is one of `donor`, `ngo` (shown as **Receiver**), `rep` (**Representative**), `admin`.
After sign-in:
1. Call `rpc('link_my_rep')` (ignore errors). If it returns `{ linked: true }`, the role is `rep`.
2. Route by role: donor → Donor tabs, ngo → Receiver tabs, rep → Representative tabs, admin → Admin tabs.

## 4. Authentication
- Email + password sign-up with role choice **Donor / Receiver / Representative** (`options.data = { role, full_name }`), sign-in, forgot password (`resetPasswordForEmail`), persistent session.
- Google, Apple and Microsoft (`azure`) OAuth through Supabase with deep link `annsetu://auth-callback`. If a provider returns "provider is not enabled", show: "<Name> sign-in isn’t switched on yet. Use email for now."
- New OAuth users pick Donor/Receiver/Representative, then call `rpc('set_my_role', { p_role })`.
- Different sign-up animations: Donor (food crate gliding onto a bridge, butter tones), Receiver/Representative (open hands receiving, ocean tones), one shared sign-in animation (bridge wave drawing). Respect reduced motion.
- **Sign-out always asks for confirmation.**

## 5. Data contract (use exactly these)
**Tables** (read/write only as RLS allows): `profiles`, `organizations`, `verification_documents`, `representatives`, `food_listings`, `food_requests`, `pickup_otps`, `requirements`, `notifications`, `reviews`, `audit_log`, `rep_locations`, `badge_definitions`, `org_badges`, `certificates`, `reports`, `messages`, `contact_messages`, `testimonials`, `faqs`, `document_reviews`, `leaderboard_overrides`, `app_settings`, `landing_snapshots`.

Important columns:
- `organizations`: `owner_id, kind ('donor'|'ngo'), org_type, name, phone, address, about, area_served, lat, lng, verification ('pending'|'approved'|'rejected'), verification_note, suspended, logo_path, no_certificate, no_certificate_note, no_certificate_requested_at`
- `food_listings`: `donor_org_id, title, category, quantity, unit ('portions'|'kg'|'packs'), qty_reserved, prepared_at, pickup_by, safety_notes, photo_path, status`
- `food_requests`: `listing_id, ngo_org_id, rep_id, rep_name, rep_phone, quantity, status ('pending'|'accepted'|'rejected'|'cancelled'|'completed'), trip_status ('assigned'|'on_the_way'|'arrived'|'collected'|'delivered'), eta, trip_started_at, arrived_at, collected_at, delivered_at, trip_updated_at`
- `representatives`: `org_id, name, phone, email, user_id, active`

**RPCs**:
`create_request(p_listing, p_qty, p_rep)`, `respond_request(p_request, p_accept)`, `cancel_request(p_request)`, `confirm_pickup(p_request, p_otp)`, `set_trip_status(p_request, p_status, p_eta)` (`on_the_way` | `arrived` | `delivered`), `update_location(p_request, p_lat, p_lng, p_acc)`, `rep_my_pickups()`, `link_my_rep()`, `set_my_role(p_role)`, `nearby_listings(p_lat, p_lng, p_radius_km, p_category)`, `public_listings_preview(p_limit)`, `public_impact()`, `latest_landing()`, `public_leaderboard(p_kind)`, `verify_certificate(p_serial)`.
Admin: `review_document(p_doc, p_status, p_note)`, `review_org(p_org, p_approve, p_note)`, `suspend_org(p_org, p_suspend, p_reason)`, `admin_withdraw_listing(p_listing, p_reason)`, `resolve_report(p_report, p_status, p_note, p_suspend)`, `admin_warn_org(p_report, p_message)`, `admin_set_leaderboard(p_org, p_action, p_reason, p_boost)`, `admin_set_setting(p_key, p_value)`, `admin_refresh_landing()`.

**Storage buckets**: `verification-docs` (private, path `<auth.uid()>/<org_id>/<file>`), `listing-photos` and `org-logos` (public, path starts with `<auth.uid()>/`).

**Realtime**: subscribe to `notifications`, `food_requests`, `rep_locations`, `messages` (filter by the relevant id).

**FastAPI** (`API_BASE`):
- `POST /chat` `{ messages: [{role, content}] }` → `{ reply }` (works signed-out too)
- `POST /ai/auto-review` `{ document_id }`: call right after a document upload (fire and forget)
- `POST /ai/review-document` `{ document_id }` (admin) and `POST /ai/review-no-cert` `{ org_id }` (admin)
- `GET /config` → `{ ai }` (website use)

## 6. Screens and features (nothing may be dropped)
**Everyone**
- Onboarding (3 slides) → Sign in / Create account.
- **Compulsory profile completion** before anything else unlocks (documents can come later): name, type, phone (≥7 digits), address (≥8 chars), about (≥20 chars), location pin (Use my location, reverse-geocoded address), area served (receivers).
- **No certificate path** for types NGO / Community group / Community kitchen: tick "We don’t have a registration certificate", write who you serve and since when (30–1000 chars), save to `organizations.no_certificate(_note)`. Show: **"Your request will be reviewed within 3–5 business days."**
- Documents: upload PDF/JPG/PNG ≤5 MB to `verification-docs`, insert `verification_documents { org_id, path, doc_type }`, then call `POST /ai/auto-review`.
- Notifications inbox (realtime) + push.
- Messages: one chat thread per request between donor, NGO and representative (`messages`), realtime, with unread badges.
- Assistant (chatbot): instant answers for common questions (donating, no certificate, OTP, tracking, representatives, verification, safety, badges), clean bullet formatting, otherwise `POST /chat`.
- Public leaderboard (top % by units, `public_leaderboard`), impact numbers (`public_impact` + `latest_landing` weekly snapshot), certificate verification.
- Light/dark theme (comfortable dark: bg `#0F1A24`, surface `#182A38`, text `#DCE8EF`, accent `#F2D88C`).

**Donor**: dashboard stats; add listing (title, category, quantity, unit, prepared at, pickup by, safety notes, **photo**); my listings (withdraw); incoming requests (accept/reject); **Pickups** with live tracking (§7) and OTP entry to confirm handover; impact, badges, certificates; report a problem.

**Receiver (NGO)**: discover nearby food (`nearby_listings`, list + map), request with a chosen representative; my requests (cancel); **Pickups** with the OTP to show and live tracking; **Representatives list** (name, phone, email, linked status, pickups done; add/remove); needs/requirements; impact.

**Representative**: My pickups (`rep_my_pickups`): donor name, address, phone, food details, photo, pickup-by countdown, **OTP**, **Directions** (open the phone's maps app with a `geo:` / `google.navigation:` intent, which is free, to the donor, then to the NGO after collection); step buttons **Start trip → I’ve reached the donor → (donor confirms OTP = collected) → Delivered to NGO**; call donor, call NGO, message; history.

**Admin**: verification queue (no-certificate requests first, with due date = 5 business days), each document shows the **AI verdict chip** (AI verified / check manually / AI flagged) from `document_reviews`, an **AI overview** sheet (summary, extracted fields, checks with official links, genuineness), **Verify manually** / **Reject** buttons; organisations (approve, reject with note, suspend; after a rejection hide approve/reject and show "Reconsider"); listings; requests; reports (start review, warn, resolve, resolve + suspend, dismiss); leaderboard curation (pin/hide/clear with reason, top-% setting, refresh landing numbers); audit log showing **which admin** did what.

## 7. Live tracking (delivery-app style)
- Steps with times: Pickup confirmed → On the way → Reached donor → Food collected (set automatically by `confirm_pickup`) → Delivered.
- Representative: when they tap **Start trip**, start foreground + background location (expo-location + task manager, Android foreground-service notification "Sharing your location with the donor and NGO"); send `update_location` at most every 4 s; continue after collection (second leg to the NGO); stop on **Delivered** or cancel. Ask permissions only at Start trip, with a clear reason.
- Donor and NGO: OpenStreetMap map with donor pin (D), NGO pin (N), representative marker gliding smoothly to each new point (subscribe to `rep_locations` realtime + poll every 8 s as fallback), route polyline and live ETA from OSRM (rate-limited: every 45 s or after 250 m; fall back to straight line at ~22 km/h), "Live · updated Xs ago", buttons **Call representative / Call donor / Call NGO** (`tel:`) and **Message**.

## 8. Design system (match the website)
- Palette "Ocean & Sunshine": Deep Ocean `#164B70`, Ocean `#287FA6`, Sky `#82C5DF`, Light Blue `#A8D9E9`, Sunshine `#FFE28A`, Butter `#F5D98B`, Deep Ink `#102F46`, Coral `#E87968`. No green, no gold.
- Fonts: Fraunces (headings and impact numbers: soft, humane serif), Space Grotesk (labels, buttons), DM Sans (body).
- Rounded cards (18–26 px radius), bold pill buttons, gentle motion (Reanimated), respect reduced motion, 48 px touch targets, WCAG AA.
- Logo: the A-bridge mark + "AnnSetu" wordmark, used once per screen.

## 9. Push notifications (one additive SQL file)
Create `sql/annsetu_schema_part10_device_tokens.sql`: table `device_tokens(user_id uuid references profiles, token text unique, platform text, updated_at)` with RLS (owner can insert/update/delete own rows). Register the Expo push token after sign-in. Delivery of pushes can be added later through a FastAPI endpoint; until then rely on realtime + in-app notifications. Do not apply SQL to production yourself: leave it for the owner to review.

## 10. Quality bar
- TypeScript strict, ESLint, no `any` in app code, small components, feature folders (`app/`, `features/donor`, `features/receiver`, `features/rep`, `features/admin`, `lib/`).
- Every button wired to real functionality; honest empty/loading/error states; no invented numbers.
- Offline: cache last data; queue location updates while offline.
- Tests: unit tests for helpers and hooks; component tests for forms; Maestro E2E for sign-up → profile → listing → request → accept → start trip → OTP → delivered.
- Build: `eas build -p android --profile preview` (APK) and `--profile production` (AAB). Document every step in `mobile/README.md`.

## 11. Deliverables
1. The Expo app in `mobile/` on the new branch, building without errors.
2. `mobile/README.md`: setup, config, running, testing, building the APK/AAB.
3. A short report: what works, what was tested, and anything still blocked (e.g. OAuth providers not enabled in Supabase).
