# ANNSETU: MASTER BUILD PROMPT v2 (full-stack development environment)

> **How to use:** start a new, empty session in a full-stack environment (Claude Code with a terminal). Attach these three reference images if you can: **(1)** the landing-page reference, **(2)** the "A-bridge" logo, **(3)** the "Five stops" journey screenshot. Then paste everything below the line.
> The images are also described in words in §3–§4, so the build still works if an image fails to upload.
> **What you provide (never paste secrets into the chat; use the environment's secret/credential settings or put them in `.env` files yourself):**
> 1. **Supabase project URL** and **publishable (anon) key**: safe for the browser.
> 2. **Supabase service-role key**, **JWT secret** and **database connection string** (Supavisor pooler URL with password): backend only, secret.
> 3. **Gemini API key**: backend only, secret.
> 4. Network access from the session to `*.supabase.co`, `generativelanguage.googleapis.com` and your email provider. Allow these hosts in the environment settings if they're blocked.
>
> Until these are provided, build and test everything against a **local Supabase stack** (Docker) and switch to the real project afterwards with the owner's approval. Other provider keys (§18) are optional; those features are built, documented and switched off until you add the keys.

---

You are a senior full-stack engineer, backend architect, UI/UX designer, motion designer, security engineer and QA lead, working in a full-stack development environment with a terminal.

Build **AnnSetu** from scratch: a premium, production-ready **food-redistribution platform** that connects surplus-food **donors** (restaurants, hotels, canteens, caterers, event organisers, food businesses, community kitchens) with verified **receivers** (NGOs, shelters, orphanages, old-age homes, community kitchens, local community groups). Receivers send their own **representatives** to collect food. **Admins** moderate. **Observers** (public visitors) can explore.

- Tagline: **"Good food deserves a second journey."**
- Supporting line: *Connecting surplus food with the people who need it. One meaningful connection at a time.*
- Logo tagline: **CONNECT · SHARE · NOURISH**

Rules for the whole build:
- Work in the phases in §21 and verify each phase before moving on.
- Never fabricate data, statistics, testimonials or successful actions.
- Every button, form and link must be wired to real functionality, with no dead UI.
- AnnSetu coordinates pickups. It does **not** run a delivery fleet; receivers' own representatives collect.
- Report test results honestly.

---

## 1. STACK (fixed)

| Layer | Choice |
|---|---|
| Web frontend | **Next.js (App Router) + React + TypeScript (strict)**, Tailwind CSS, shadcn/ui restyled to the AnnSetu design system, Lucide icons, **Motion (Framer Motion)** for UI transitions, **GSAP** for landing timelines and hand animations, **Lottie** (`lottie-react`) optional for small looping icons, TanStack Query, React Hook Form + Zod, Leaflet + OpenStreetMap for maps |
| Backend API | **Python 3.12 + FastAPI**, Pydantic v2, SQLAlchemy 2.0 (async) + Alembic, managed with `uv`; background worker for jobs |
| Database | **Supabase PostgreSQL** (Postgres 17) with Row Level Security on every client-exposed table, **PostGIS** (distance), **pgvector** (chatbot retrieval), **pg_cron** (schedules) |
| Auth | **Supabase Auth**: email + password (confirmation), password reset, **Google, Apple, Microsoft (Azure)** OAuth, persistent sessions, role-based redirects |
| Storage | Supabase Storage (§10.4) |
| Realtime | Supabase Realtime: chat, notifications, requests, listings, pickup tracking |
| AI | **Google Gemini**, called **only from FastAPI**, model set by env `GEMINI_MODEL` |
| Email / SMS | Provider adapters (Resend or SMTP for email; SMS optional) with templated messages |
| Cache / rate limits | Redis |
| Routing for directions | OSRM (public demo or self-hosted) through FastAPI for in-app routes; deep links to Google Maps / Apple Maps / OSM for turn-by-turn |
| Deploy | Web on Vercel, FastAPI in Docker on Render/Railway, Supabase managed; preview deploys first |
| Testing | Playwright, pytest + HTTPX, Vitest, Ruff, `tsc --noEmit`, k6 |

**Who talks to what:**
- The browser talks to Supabase directly only for operations that RLS fully protects.
- Anything with business rules, AI, email, scoring, routing, admin power or multi-table transactions goes through **FastAPI** or **security-definer Postgres functions**.
- FastAPI verifies the Supabase JWT on every protected request and authorises per resource.
- The service-role key and the Gemini key never reach the browser.

---

## 2. SCALE: ~10,000 PEOPLE

Targets, which must be **proven with a k6 load test** and reported:
- **10,000 registered users**
- **~1,500 concurrent authenticated users**
- **10,000 concurrent landing-page visitors**
- p95 API latency < 300 ms (AI calls excluded), 0 % errors

How to meet them:
- **Landing page:** static/ISR, CDN-cached; live numbers come from the cached `landing_snapshot` (§4.6), not from per-request queries.
- **FastAPI:**
  - async SQLAlchemy through **Supavisor (transaction mode)**
  - multiple Uvicorn workers
  - cursor pagination on every list
  - gzip and ETags
  - timeouts and structured logs with request IDs
  - health checks; Sentry-ready (optional DSN)
- **Database:**
  - indexes on every foreign key and every filter column
  - partial index on active listings
  - GiST index for PostGIS, ivfflat/hnsw index for pgvector
  - `EXPLAIN ANALYZE` the hot queries
- **AI work runs as queued jobs**, never blocking a request.
- **Realtime subscriptions** are filtered per user, conversation or pickup.
- **Rate limits** on auth, chat, chatbot, uploads, feedback, contact, magic links and representative status updates.

---

## 3. BRAND IDENTITY

### 3.1 Logo (use the attached "A-bridge" logo)
- **Concept:** a tall, bold, slightly italic serif-style **"A"** in Deep Ocean `#164B70`, standing like a **cable-stayed bridge pylon**:
  - the two legs have small horizontal feet (serifs) at the base
  - fine straight **cable-stay lines** in Ocean Blue `#287FA6` fan out from the apex down to the deck on both sides
- **The deck:** a smooth **wave** in Ocean Blue `#287FA6` sweeping left to right through the A, replacing the crossbar. It reads as a bridge deck, a river and a journey.
- **The node:** where the wave crosses the right leg sits a **Sunshine Yellow `#FFE28A` circle with a Deep Ink `#102F46` outline**: the "food" travelling the bridge.
- Background is transparent; the reference shows it on a very light blue.
- **Recreate it as clean, original SVG:**
  - full logo: mark + **"AnnSetu"** wordmark in a refined serif (Fraunces), with "Ann" in cream/ink and "Setu" in sunshine on dark backgrounds
  - under the wordmark, the small-caps tagline **CONNECT · SHARE · NOURISH** in Space Grotesk
  - a subtle gold-free sunshine swoosh/arc with a tiny four-point sparkle above the wordmark, as in the landing reference
- **Variants to deliver:** full, reverse (on dark), monochrome, mark-only, favicon (mark on a Deep Ink rounded square), apple-touch PNG, OG image, Android adaptive icon.
- **Motion:** on page load the wave draws in, then the yellow node slides along it and settles (≈1.2 s; static with reduced motion).

### 3.2 Palette: "Ocean & Sunshine"
- **Colours:**
  - Deep Ocean `#164B70`, Ocean Blue `#287FA6`, Sky Blue `#82C5DF`, Light Blue `#A8D9E9`
  - Sunshine Yellow `#FFE28A`, Butter Yellow `#F5D98B`
  - Deep Ink `#102F46`, Coral Accent `#E87968`
  - Cream text `#F4ECD8` (for headings on dark)
- **Usage:** blue dominates and sunshine is the recognisable accent.
- **Never:** green as a primary colour, gold or metallic effects, shiny gradients, heavy glassmorphism, a childish look, or plain white backgrounds.

### 3.3 Light theme (dashboards)
- bg `#D6ECF4`, bg-2 `#C4E2EE`
- surface `#E8F4F9`, surface-2 `#F2F9FC`
- line `rgba(16,47,70,.15)`
- text `#102F46`, muted `#3A5C74` (AA contrast)

### 3.4 Dark theme (comfortable for the eyes)
- bg `#0F1A24`, bg-2 `#14222E`
- surface `#182A38`, surface-2 `#1E3344`
- line `rgba(168,217,233,.12)`
- text `#DCE8EF` (never pure white), muted `#93AAB8`
- accent softened sunshine `#F2D88C`, used sparingly
- focus/links `#8CC8DE`, coral `#E8907F`
- Soft shadows, no large yellow areas, AA contrast.
- Follows the system preference; the user's toggle is remembered.

### 3.5 Shape language
- **Smooth and premium; avoid sharp corners:**
  - cards: radius 20–28 px
  - inputs: 14 px
  - pills for primary actions
- **Organic curved section dividers** (waves and arches echoing the logo).
- A subtle **oxidised-paper / risograph grain** texture on hero collage panels, story sections and certificates.
- Botanical leaf silhouettes and soft clouds as decoration, as in the reference.
- Generous whitespace.

### 3.6 Typography
- **Fraunces:** large editorial headlines (opsz 144; italic for emphasis words such as *second journey*).
- **Space Grotesk:** labels, navigation, buttons, numbers.
- **DM Sans:** body text.
- **Syne:** oversized statistics.
- **Caveat:** handwritten annotations (e.g. "The AnnSetu Journey", "Together we can end food waste.").
- Load all fonts with `next/font`.

### 3.7 Buttons (must be bold and obvious)
- **Primary:** Sunshine `#FFE28A` fill, Deep Ink text
  - Space Grotesk 600, 16–17 px, min height 52 px, horizontal padding 28 px, pill shape
  - visible 2 px Deep Ink inner/outer ring on dark backgrounds, soft yellow glow on hover
  - trailing arrow that slides on hover
- **Secondary:** solid Deep Ink or Ocean fill with cream text, **or** a 2 px cream outline with cream text at full opacity on dark surfaces. Never a faint hairline outline.
- **Contrast:** at least 4.5:1 text contrast and at least 3:1 against the background behind the button. Never put a button on a busy photo without a backing plate.
- **States:** focus ring 3 px; clear hover, pressed and disabled states.
- **Size:** hero buttons are the largest buttons on the page and readable at arm's length on mobile.

---

## 4. LANDING PAGE (match the attached reference: similar, not identical)

### 4.1 Reference description (the first photo)
**Background:** a deep navy/ink canvas with layered **ocean-blue and butter-yellow curved shapes**, soft clouds, botanical leaf silhouettes and a faint grain.

**Header:**
- **Left:** the logo with the sunshine swoosh, sparkle, "AnnSetu" and CONNECT · SHARE · NOURISH.
- **Centre:** navigation links **Home** (active, with sunshine underline), **Explore Food**, **Donate**, **About**, **Impact**, **Contact**.
- **Right:** a search icon and a pill **Sign In** button.

**Left column:**
- small-caps sunshine kicker **"A BETTER TOMORROW, TOGETHER"** with a thin line
- giant cream Fraunces headline **"Good food deserves a"** with *"second journey."* in italic sunshine
- the supporting line
- two buttons: **Donate Surplus →** (sunshine pill) and **Explore Food ✦** (secondary)

**Centre:**
- a **hand reaching down from the top, holding a red apple**, and an **open hand reaching up from below** (with a thread bracelet), almost touching: a giving moment
- the hands are a duotone/halftone collage treatment
- a **sparkle star** and a **dotted curved path** arc from the sparkle towards the apple

**Right:**
- a **collage photo panel** of a community food-distribution scene (a vehicle marked "FOOD FOR ALL", volunteers, buildings), cut into curved shapes and framed by yellow/blue organic forms and leaves
- a Caveat annotation **"Together we can end food waste."** with a hand-drawn arrow

**Bottom band:**
- a **butter-yellow wave band** containing the handwritten title **"The AnnSetu Journey"** with a curly arrow
- four round icon steps joined by arrows: **Donor (Shares food) → NGO (Receives food) → Representative (Collects food) → Community (Gets food)**
- AnnSetu has no transport fleet, so the third step is the receiver's **representative**, not "Transport"

**Bottom right:** an **"Our Impact ✦"** pill over a dark rounded card with three big numbers and labels, e.g. Meals Saved · NGOs · Kg CO₂ Prevented. **These must be real values from `landing_snapshot`**; estimates are labelled "est." with the method in a tooltip.

**Bottom left:** a mouse icon and "Scroll to explore".

### 4.2 Hero motion graphics (new)
**Hands (GSAP timeline, transforms only, ~6 s loop, gentle):**
- The **top hand** eases down 8–12 px and slightly rotates as if offering.
- The **apple** gently bobs and turns a few degrees, with a soft highlight shimmer.
- The **bottom hand** rises 6–10 px and its fingers open slightly. Use a small separate fingers layer or SVG morph, or subtle scale on the fingers group.
- The two hands **almost meet and pause**, and a tiny sparkle pops between them, then they settle back.

**Entrance:**
- The hands slide in from top and bottom with a mask reveal.
- The headline reveals word by word, then the buttons stagger in.

**Ambient background (low cost):**
- curved shapes drift a few pixels on long loops
- clouds parallax slowly
- leaves sway 1–2°
- the sparkle twinkles
- the dotted path draws and a small dot travels along it towards the apple
- grain stays static

**Collage panel:**
- slow Ken Burns zoom (≤3 %)
- the annotation arrow draws on

**Journey band:** the steps light up in sequence on a slow loop, with arrows filling.

**Impact card:** numbers count up once when visible.

**Assets:**
- Hands, apple and food scene must be **original illustrations** or **properly licensed photos** (Unsplash/Pexels with licence recorded in `CREDITS.md`) given the duotone collage treatment. No AI-generated look-alikes of real people.
- Export the hands as separate layered SVG/PNG pieces so they can animate.

**Reduced motion:** everything is static and fully visible. Pause animations when the tab is hidden.

### 4.3 Landing section order (keep all)
1. **Hero** (as above; the first viewport stays spacious and uncluttered).
2. **The paradox: food waste vs hunger.** Sourced facts from the admin-curated `facts` table, each with its source name and "last verified" date. Verify before seeding:
   - UNEP Food Waste Index Report 2024: 1.05 billion tonnes of food wasted in 2022
   - FAO SOFI 2024: about 733 million people faced hunger in 2023
   - UNEP 2024: about 55 kg per person per year wasted in Indian homes
   - Include a "waste · hunger" outlined marquee.
3. **Mission: "A bridge, not a delivery fleet."**
   - Etymology: अन्न *Ann* (food, grain) + सेतु *Setu* (bridge), with the logo animating.
   - Pillars: **Verified · Accountable · Local**.
4. **"Five stops from surplus to served"** (dark ink section, sunshine route; see the third reference image). **Auto-playing, with no scroll-pinning or scroll-scrubbing:**
   - When the section scrolls into view, the curved route draws itself.
   - A **travelling food marker** moves along it. The marker is **a steaming hot-food bowl/thali icon** (sunshine bowl, coral food, tiny animated steam wisps), **not a square or diamond**; it tilts slightly to follow the curve.
   - Nodes light up in order: **Donor → AnnSetu → NGO → Collection → Community.** Each shows its description in a card beneath.
   - Then pause, then loop gently.
   - Provide **pause/play** and keyboard-accessible step dots. Reduced motion shows everything static. Mobile uses a vertical route.
   - Step texts:
     - Donor lists surplus with quantity, safety notes and pickup deadline.
     - AnnSetu shows it only to verified, active receivers, nearest first.
     - The NGO requests a quantity and assigns a representative; the donor accepts and the food is reserved.
     - The representative collects; the donor confirms with a 4-digit code.
     - Meals reach people; impact, badges and certificates are recorded automatically.
5. **Live food discovery:**
   - **Controls:** search, category filters, sort (pickup soonest / most available / newest / nearest).
   - **Cards:** photo or category placeholder, available/total quantity, category, deadline and time left, donor organisation, distance, veg/non-veg and allergen tags, and a status (Available / Ending soon / Only N left / Fully reserved).
   - **Requesting:** drag-and-drop into a request tray, with an "Add to request" button alternative. Requests go through `create_request` with per-item success or error shown; never fake success.
   - **Signed-out visitors:** a privacy-safe preview through `public_listings_preview` (title, quantity, deadline, donor name only).
   - **Donors and admins:** an explanatory panel.
6. **Donor and receiver experiences:** curved split panels ("give" / "receive") with step lists and register CTAs.
7. **Real impact:** counters from `landing_snapshot`, estimates labelled with their method, and an honest empty state when there is no data.
8. **Community stories:** admin-published testimonials only.
9. **About the AnnSetu app:**
   - Features of the Android app, phone mockups with real screenshots, a "Get it on Google Play" badge and/or direct APK download, a QR code, and a "coming soon" state controlled by an admin setting.
   - Also available at the `/app` page and in the main navigation under About.
10. **Join AnnSetu:** role cards; contact form (to the admin inbox); FAQ accordion (admin-managed).
11. **Footer** (not a table):
    - a curved, rounded footer panel with grouped columns: **Platform** (Explore food, Donate, Impact, Leaderboard), **Get involved** (Join as donor, Join as receiver, Representatives, Get the app), **Trust & support** (About, FAQ, Contact, Privacy, Terms)
    - comfortable spacing and hover underlines
    - the certificate-verification field (`verify_certificate`)
    - social/contact icons, a soft giant wordmark, and the copyright line

**Navigation behaviour:** transparent over the hero, solid with blur on scroll, animated active indicator, mobile full-screen sheet, skip link.

### 4.4 Other public pages
About, How it works, Explore Food (full discovery page), Donate (donor onboarding info), Impact (charts + leaderboards), Leaderboard, Get the app, Contact, FAQ, Privacy, Terms, Certificate verification, 404/500 states, all in the same design.

### 4.5 Search
The header search opens a command-style overlay: search listings (as allowed), pages and FAQs, with keyboard navigation.

### 4.6 Weekly-refreshing landing data
- A scheduled job runs **every 7 days**; admins can also run it on demand.
- It rebuilds `landing_snapshot`:
  - meals (estimated, with method), kg redistributed, CO₂ estimate (configurable factor with cited source, labelled "est.")
  - completed pickups, verified donors, verified receivers, cities/areas served
  - top movers
- Facts rotate from the curated `facts` table, with source URL and verification date; admins can edit them.
- Show **"Updated &lt;date&gt;"** on the section.
- Never show unsourced or invented numbers.

---

## 5. MOTION, CURSOR AND PREMIUM POLISH

**Global:**
- Calm, smooth motion using transforms and opacity only.
- Clean up GSAP contexts, listeners and subscriptions.
- Pause off-screen animations.
- Full `prefers-reduced-motion` support.

**Dashboard ambience** (admin, donor, receiver and representative panels):
- very subtle animated background: slow-drifting blurred ocean/sunshine blobs and a faint wave line at 3–6 % opacity behind content
- gentle card entrance stagger
- skeleton shimmer
- count-up stats
- smooth tab and page transitions
- a sliding active-nav pill
- success micro-animations: a check draw on approve, a little steam puff when food is listed, a confetti burst in brand colours when a pickup completes
- Ambience never reduces readability and is disabled with reduced motion.

**Custom cursor** (desktop fine pointers only; cleaner hover):
- **Default:** a small centre dot with four thin crosshair arms, slight easing, and a very fine fading trail.
- **On buttons, links and icons:** smoothly morphs into a **soft ring** that scales around the target, with a gentle magnetic pull of 2–4 px and a 200–250 ms ease-out. No popping nodes, jitter or rotation.
- **Text fields:** the native I-beam.
- **Drag:** a chevron in the direction of travel; a valid drop target turns the ring sunshine.
- **Colour:** adapts to dark and light surfaces.
- **Off:** on touch and coarse pointers; no trail with reduced motion.

**Buttons:** an arrow slides on hover, colours ease, and a pressed state shows.

---

## 6. ROLES

| Role | Who | Entry |
|---|---|---|
| Observer | Public visitor | Landing, public pages, chatbot |
| Donor | Food businesses, kitchens | Donor dashboard |
| Receiver | NGOs, shelters, community groups | Receiver dashboard |
| **Representative** | Person collecting food for a receiver | **Representative dashboard** (account) or secure magic link (no account) |
| Admin | AnnSetu team | Admin console |

---

## 7. AUTHENTICATION AND ONBOARDING

### 7.1 Providers
- Email + password (with confirmation email).
- Forgot password with a reset page.
- **Google, Apple and Microsoft** OAuth through Supabase.
- Sessions persist.
- Role-based redirects after sign-in.
- New OAuth users choose Donor or Receiver before the redirect. The role locks once an organisation exists (`set_my_role`).
- Representatives join only through an NGO invitation (§9.3).
- The admin role is granted only by a first-admin script or an existing admin.

### 7.2 Animations
- **Create account as Donor:** its own animation, e.g. a food crate or plate gliding onto the bridge deck, in warm butter tones.
- **Create account as Receiver:** a different animation, e.g. open hands and community figures receiving on the far bank, in ocean tones.
- **Sign in (everyone):** one shared animation, with the logo's wave drawing and the yellow node crossing.
- Animations never hide or delay the form, and respect reduced motion.

### 7.3 Compulsory profile completion
After the first login, a **profile wizard** must be finished before the dashboard opens. Everything except documents is mandatory:
- **Organisation:** name, type, contact person, phone (validated, OTP-ready), email, full address, city, state, pincode
- **Location:** a map pin, or "use my location"
- **About:** with a minimum length
- **Hours:** operating hours and pickup windows
- **Optional:** logo; for donors, an FSSAI number field
- **Receivers:** area served and approximate beneficiaries per day

Documents are a later step. Listing and requesting stay locked until the organisation is verified.

### 7.4 No-certificate path
Who can use it: receivers of type **NGO, local community group or community kitchen**, and donors of type community kitchen.

They can:
- tick **"We don't have a registration certificate"**
- explain who they serve, since when, and give references
- optionally upload supporting proof (photos, letters, ID)
- request manual admin review

Show: ***"Your request will be reviewed within 3–5 business days."***

Admins get a separate queue for these, with the AI summary (§12) and an SLA timer.

### 7.5 Sign-out
Always ask for confirmation.

---

## 8. DASHBOARD SHELL (all roles)

**Sidebar:**
- beautiful and minimal: icons + labels, **no numbering**, grouped sections, a soft rounded active pill that slides between items
- organisation card at the bottom
- **Collapsible** like modern web apps: expanded with labels ⇄ compact icon rail with tooltips, remembered per user
- On mobile it becomes an off-canvas drawer with a scrim; Escape closes it.

**Top bar:**
- page title and breadcrumbs, global search, theme toggle
- notification bell with a live badge
- chatbot button
- avatar menu: profile, settings, help, sign out with confirmation

**Everywhere:**
- polished tables: sticky headers, sort, filter, pagination, stacked rows on mobile
- status chips; skeleton, empty, error and success states; toasts; modals with a focus trap
- the ambience from §5
- Functionality and readability come before decoration.

---

## 9. FEATURES BY ROLE (nothing may be dropped)

### 9.1 Donor
- **Overview:**
  - greeting
  - stats: active listings, pending requests, completed donations, units donated, estimated meals
  - getting-started checklist
  - **community needs** published by verified receivers
  - recent activity
- **Profile:** organisation details, logo, location.
- **Verification documents:** upload, status, delete while not approved, AI review status.
- **Listings:**
  - create, filter (all / active / reserved / expired / completed / withdrawn), withdraw while nothing is reserved, duplicate as a template
- **Create listing:**
  - **food photos:** camera on mobile or gallery, up to 3, JPG/PNG/WebP ≤ 2 MB each, resized client-side
  - title, category, quantity, unit (portions/kg/packs), prepared at, pickup by
  - safety and storage notes, veg/non-veg, allergens
  - pickup instructions (gate, contact person)
- **Requests received:** accept or reject. Accepting reserves the quantity and issues an OTP.
- **Pickups:**
  - **tracking timeline**, representative ETA, and a live map with the **hot-food marker**
  - representative name, phone and photo
  - OTP confirmation, with 5 attempts and expiry
- **History.**
- **Impact:** charts, badges, certificates, leaderboard position.
- **Notifications.**
- **Messaging.**
- **Reports.**
- **Feedback.**

### 9.2 Receiver (NGO)
- **Overview:** stats for pending, pickups to collect, units received and open needs; checklist.
- **Discover:** the same board as the landing page, plus a radius choice of 5/15/30/50 km by location.
- **Request:** choose quantity and **assign a representative**.
- **Requests:** view and cancel pending ones.
- **Pickups:** OTP display, tracking, reassigning the representative.
- **Representatives page:** a **full list of the NGO's representatives**:
  - name, phone, email, photo
  - status: invited / active / inactive
  - assigned and completed pickups
  - last active
  - actions: invite, resend invite, deactivate, remove
- **Needs:** publish, mark fulfilled, delete.
- **Impact.**
- **Notifications.**
- **Messaging.**
- **Reports.**
- **Feedback.**

### 9.3 Representative
- **Invitation:** the NGO enters name, phone and email, and an email/SMS invite is sent. The representative creates a login or signs in with Google/Microsoft/Apple. Their account is **linked to that NGO**; they can belong to only one active NGO.
- **Without an account:** each assigned pickup also produces a **secure magic link** (hashed token, single-pickup scope, expires 2 h after the pickup deadline, rate-limited).
- **Representative dashboard (mobile-first):**
  - **Today's pickups list** with time windows and status.
  - **Pickup detail page with everything needed to reach the location:**
    - donor name and full address, **map with the route** from the current location (OSRM through FastAPI)
    - distance and **estimated travel time**
    - **"Open in Google Maps / Apple Maps / OSM"** buttons for turn-by-turn navigation
    - pickup window and countdown
    - gate or contact instructions, landmark, contact person
    - food details: item, quantity, unit, photos, safety notes, packaging tips
    - **the OTP to show the donor**
  - **Status buttons:** Start trip / On the way (sets ETA) → Arrived → Collected (after the donor confirms the OTP) → Delivered to community (optional).
  - Each status change sends **automatic in-app + email (and optional SMS) notifications to both the donor and the NGO**, e.g. "Ravi is on the way, ETA 6:40 PM".
  - **Live location sharing** with consent, only during an active pickup, with a stop button; the data is deleted when the pickup ends.
  - **Contact the donor:** call, WhatsApp link and in-app chat.
  - A **"Running late"** quick message updates the ETA.
  - A checklist: containers, bags, ID.
  - Their own history and completed-pickup count.
- **Limits:** representatives cannot create requests, see other NGOs' data or change NGO settings.

### 9.4 Admin
- **Overview:**
  - awaiting verification, verified organisations, active listings, completed pickups, units redistributed, open reports, unresolved feedback, new inbox messages, active representatives today
  - trend charts
- **Verification:**
  - documents: approve, or reject with a note
  - organisations: approve, or reject with a **required** note
  - **the AI summary panel (§12)**
  - the no-certificate queue with its 3–5-business-day SLA
- **Organisations:** filters (donors / NGOs / pending / approved / rejected / suspended), search, suspend or reinstate with a reason, view representatives.
- **Listings:** filter; withdraw with a reason.
- **Requests and pickups:** a table with timeline and tracking (read-only).
- **Reports:** take action:
  - start review; resolve with a note; resolve and suspend; dismiss
  - warn the organisation; withdraw the related listing; deactivate a representative
  - the reporter is notified each time
- **Inbox:** contact messages; mark read or replied; reply by email.
- **Content:** FAQs, testimonials, landing facts, app section settings.
- **Announcements:** to everyone, donors, receivers or representatives.
- **Leaderboard management** (§9.6).
- **Certificates** (milestones, reissue, revoke).
- **Feedback management** (§9.8).
- **Audit log** (§9.9).
- **Settings:** run the weekly snapshot now, configure the CO₂ factor, set the leaderboard percentile.

### 9.5 Messaging (must work on the website)
- One chat per request, between the donor, the NGO and the assigned representative.
- Realtime, with unread badges, read receipts and length limits.
- Image attachments up to 2 MB.
- The other party is notified of each message.
- Admins can read a chat only when a report references that request.

### 9.6 Leaderboard
- **Public leaderboards** for **donors** and **receivers**, visible to everyone, including observers.
- **Columns:** rank, organisation, city, units donated or received, completed pickups, partners, estimated meals.
- Shows the **top 20–30 %** of active, verified organisations; the percentile is configurable (default 25 %).
- Time windows: this month, this year, all time.
- **Admins can adjust it manually:** pin/feature, hide, or adjust a rank, always with a mandatory reason. Every change is audited and labelled "curated" in admin views.

### 9.7 Certificates and badges
**Milestone certificates for both donors and receivers**, for example:
- 1st, 10th, 50th, 100th and 500th pickup
- 100 / 500 / 1,000 / 5,000 / 10,000 units
- 10 and 25 partners
- 1 year active

**Representatives** get appreciation badges.

Certificates are **beautiful PDFs** (oxidised-paper style, logo, serial, QR code linking to public verification) plus an on-screen version, with share links and progress bars towards the next milestone.

### 9.8 Feedback and support
**For users:**
- categories: **General feedback, Bug report, Feature request, Account issue, Donation issue, Pickup issue, Other**
- 1–5 stars; subject (3–120 characters) and details (10–2,000)
- optional screenshot (private, ≤ 3 MB)
- a list of their own feedback with status (Open / In review / Resolved / Closed) and admin replies
- a notification when an admin replies
- a limit of 10 submissions per hour

**For admins:**
- filter by category and status, with an "unresolved" view and a count of open complaints
- sender details: name, role, organisation, platform, version
- a screenshot viewer using signed URLs
- reply and change status through an audited function that notifies the user

### 9.9 Audit log
Every admin action records:
- **who did it:** actor id, name and email (snapshot), and role
- **what:** action, target table, target id, target display name, before/after diff, reason or note
- **context:** IP hash and timestamp

The page shows ***When · Admin · Action · Target · Note***, with filters by admin, action and date, plus CSV export. A separate activity log covers non-admin sensitive actions: accept/reject, OTP confirmation, cancellations and representative status changes.

### 9.10 Notifications
- Stored in Postgres with read/unread, a realtime bell and a notification centre.
- **Email** for important events: new request; accepted or rejected; representative assigned; on the way / ETA / arrived / collected; a new-message digest; verification decisions; report outcomes; feedback replies; announcements; milestone certificates.
- Users choose per category whether they get each in-app and/or by email.
- Web push optional.

### 9.11 Impact analytics and data honesty
- Impact counts only **OTP-confirmed pickups**.
- **Estimates are labelled, with the method shown:**
  - meals = portions + kg ÷ 0.42 (WRAP 420 g meal equivalent); packs are not converted
  - CO₂ = kg × a configurable, cited factor
- **Charts:** pickups per week, units by category, donations over time, top partners.

### 9.12 AI chatbot (all roles)
A floating, collapsible assistant on every page, role-aware:
- **Observers:** what AnnSetu is, how to join, food safety, FAQs, the app.
- **Donors / receivers / representatives:**
  - how-to guidance
  - answers about **their own data** through FastAPI, using their JWT ("Which requests are pending?", "When is my representative arriving?", "Directions to today's pickup")
  - never other organisations' private data
- **Admins:** "How many verifications are pending?", "Summarise open reports", "Which no-certificate requests are close to the 5-day SLA?"

How it works:
- Gemini with retrieval over FAQs, help docs and policies (pgvector), plus function calls to safe, RLS-respecting read endpoints.
- No destructive actions; it gives deep links instead.
- Rate-limited, with logged conversations (users can opt out) and escalation to the feedback form.
- A disclaimer explains that answers may be imperfect.

---

## 10. DATA MODEL AND SECURITY

### 10.1 Tables (all with RLS)
- **People and organisations:** profiles (role donor / ngo / representative / admin), organizations (+ wizard fields, beneficiaries, hours, no-certificate request + explanation + review_due_at)
- **Verification:** verification_documents, document_ai_reviews
- **Representatives:** representatives (+ user_id, email, photo, status, invited_at), rep_invitations, rep_access_tokens (hashed), rep_locations
- **Food and pickups:** food_listings (+ photos[], diet, allergens, pickup_instructions), food_requests (+ rep_id, timeline_status, eta), pickup_events, pickup_otps, requirements
- **Communication:** notifications, notification_preferences, messages (+ attachment_path), announcements
- **Trust:** reviews, reports (+ actions), audit_log (+ actor snapshot, diff), activity_log
- **Recognition:** badge_definitions, org_badges, certificates, leaderboard_overrides
- **Landing and content:** landing_snapshot, facts, contact_messages, testimonials, faqs, app_settings
- **Support:** feedback, device_tokens
- **Chatbot:** chatbot_conversations, chatbot_messages, kb_documents (vector)
- **System:** jobs

### 10.2 Business rules (enforced in the database or backend, never only in the UI)
- Only verified, non-suspended organisations can list (donors) or request (receivers).
- **`create_request`:**
  - the representative must belong to the NGO
  - the listing must be active and unexpired, and the donor not suspended
  - 1 ≤ quantity ≤ available
  - one pending request per receiver per listing
  - snapshots the representative's name and phone
- **`respond_request`:** listing owner only. Accepting reserves the quantity atomically and issues a 4-digit OTP valid until the pickup deadline + 2 h.
- **`cancel_request`:** releases the reserved quantity and deletes the OTP.
- **`confirm_pickup`:**
  - listing owner only; maximum 5 attempts, plus expiry
  - completes the request
  - completes the listing when it is fully collected
  - awards badges and certificates to both sides
- **Expiry job:** every 10 minutes, releases quantities on expired listings.
- **Representative status updates:** only the assigned representative (account or magic link) during an accepted pickup.
- **Visibility:**
  - the OTP is visible only to the NGO and its assigned representative
  - live location is visible only to the donor, the NGO, the representative and admins, and is deleted when the pickup ends
- **Suspension:** withdraws open listings and releases open requests.
- **Admin functions:** check `is_admin()` and are always audited.
- **Column-level grants:** clients can never write status, qty_reserved, verification or role.

### 10.3 Security checklist
- JWT verification plus per-resource authorisation in FastAPI.
- Pydantic validation everywhere; parameterised queries.
- CORS allowlist.
- Rate limits.
- Security headers: CSP, HSTS, frame denial, nosniff, referrer policy.
- Hashed tokens.
- No stack traces sent to clients.
- Secrets only in env vars; commit `.env.example`, never `.env`.
- Server-side checks on upload type and size; signed URLs for private files.
- Privacy page; account export and deletion.
- OTP brute-force protection.
- Magic-link replay protection.

### 10.4 Storage buckets
| Bucket | Access | Limit |
|---|---|---|
| listing-photos | public read | 2 MB |
| org-logos | public read | 1 MB |
| rep-photos | public read | 1 MB |
| verification-docs | private | 5 MB, PDF/JPG/PNG |
| feedback-screenshots | private | 3 MB |
| chat-attachments | private | 2 MB |
| certificates | private (generated PDFs) | |
| app-assets | public (screenshots, APK) | |

---

## 11. RESPONSIVENESS AND ACCESSIBILITY
- Deliberate layouts at **1440, 1280, 768, 390 and 360 px**, with no horizontal overflow.
- On mobile, the hero hands stack above the text and shrink, and the collage becomes a curved card below.
- Touch targets ≥ 44 px; drag-and-drop always has an alternative; modals fit the screen.
- Semantic HTML, labels, visible focus, full keyboard navigation, screen-reader names for icon buttons.
- WCAG AA contrast in both themes; reduced-motion mode.

---

## 12. AI DOCUMENT EXTRACTION, VERIFICATION AND ADMIN SUMMARY (backend only)

When a document is uploaded (FSSAI licence, NGO registration, 12A/80G, trust deed, society registration, NGO Darpan proof, authorised-person ID) or a no-certificate request is submitted, FastAPI queues a job that:

1. **Fetches** the private file with the service role, server-side only.
2. **Extracts** with **Gemini** (PDF/image input), using a strict JSON schema: document type, organisation/licensee name, registration or licence number (FSSAI = 14 digits), issuing authority, address, issue date, expiry date, licence category or kind of business, signatory, and visible red flags.
3. **Verifies deterministically in Python:**
   - fuzzy match of name and address against the profile
   - number format
   - dates (expired, or issued in the future)
   - document type vs organisation type
   - duplicate numbers across organisations
   - legibility
   - an optional registry-lookup adapter, off by default
4. **Summarises for the admin:**
   - 3–5 plain sentences
   - an extracted-fields table
   - a pass/warn/fail checklist
   - a **confidence score from 0 to 100**
   - a recommendation (Looks valid / Needs a closer look / Likely invalid)
   - **never auto-approves**
5. **Stores** the result in `document_ai_reviews` (model, prompt version, raw JSON, timestamps), shown next to the document along with an organisation-level summary.

For no-certificate requests, it summarises the explanation and proof and lists what to check manually.

Failures retry with backoff and then show "AI review unavailable". Only the minimum data is sent, and the flow is documented in the privacy page.

---

## 13. EXISTING FEATURES TO KEEP (from the original AnnSetu)
- **Accounts:** email registration and login, Google login, password reset, persistent sessions, role redirects.
- **Donor:** profile, documents, listings, create listing, requests, accept/reject, pickups, OTP, impact, badges, certificates, notifications, messaging.
- **Receiver:** discovery, requests, cancellation, representatives, pickups, OTP display, location sharing, requirements, impact, badges, certificates, notifications, messaging.
- **Admin:** organisation verification, document approval, organisation management, listings, requests, reports, inbox, FAQs and testimonials, audit log.
- **Public:** certificate verification, impact numbers, leaderboard, contact form.
- **Also:** reports between organisations, dark mode, drag-and-drop discovery, custom cursor.

---

## 14. ANDROID APP (phase after the website)
A Flutter app that shares the same Supabase project and FastAPI:
- splash, onboarding, and all auth providers with deep links (`annsetu://login-callback`)
- role-based bottom navigation, **including the representative role with turn-by-turn deep links**
- every donor, receiver, representative and admin feature
- secure session storage (Android Keystore), live location with consent, OpenStreetMap
- FCM push using `device_tokens`
- feedback with screenshots, charts, light and dark themes
- a signed APK and AAB

The website's **About the app** section and `/app` page link to it.

---

## 15. TESTING (must actually run and pass; report honestly)
- **SQL/RLS tests** for every policy and function, per role, including anon and representative.
- **pytest + HTTPX** for every endpoint: authentication, per-resource authorisation, validation, AI jobs (Gemini mocked), chatbot tools, email and SMS (mocked), routing (mocked), rate limits, magic links.
- **Playwright E2E** (desktop and 390 px):
  - **Landing:** hero hand animation present and static under reduced motion; bold visible buttons; auto-playing journey with the food marker and its pause button; discovery locked/preview states; impact; app section; footer; certificate check; search overlay.
  - **Accounts:** role-specific sign-up animations; OAuth buttons; compulsory wizard; no-certificate flow showing the 3–5-day message.
  - **Admin verification:** document upload produces an AI summary for the admin; approvals and rejections show the **admin's name** in the audit log.
  - **Pickup flow:**
    - a listing with photos, then discovery, drag-and-drop and the button alternative
    - request, then accept
    - NGO invites a representative, who logs in, sees the route and directions, sets the ETA, goes on the way and arrives; both parties get notifications and emails
    - wrong OTP then right OTP; pickup completed; certificates issued to both sides
  - **Everything else:**
    - realtime chat in both directions
    - notifications
    - feedback round trip
    - admin report actions
    - leaderboard percentile with a manual override
    - announcements
    - sign-out confirmation
    - collapsible sidebar
    - dark mode
    - cursor hover ring
    - no console errors and no overflow at any width
- **Vitest**, **Ruff**, **tsc --noEmit**, a production build.
- A **k6** load test against the §2 targets.
- **Lighthouse ≥ 90** on the landing page.

---

## 16. PROJECT STRUCTURE
```
annsetu/
  web/        Next.js (app/, components/, features/, lib/, styles/, public/brand/, public/landing/ layered hand + collage assets)
  backend/    FastAPI (app/api, app/core, app/models, app/schemas, app/services/{ai,email,sms,routing,certificates}, app/jobs, tests/), Alembic, Dockerfile
  supabase/   RLS, functions, storage policies, seed (badges, FAQs, facts with sources; no fake stats), SQL tests
  mobile/     Flutter app (phase after the website)
  e2e/        Playwright tests, k6 scripts
  docs/       ARCHITECTURE, SETUP, DEPLOYMENT, SECURITY, ADMIN_GUIDE, REPRESENTATIVE_GUIDE, TESTING_REPORT, CREDITS
  .env.example files (web, backend)
```

## 17. LOCAL DEVELOPMENT
- **Docker Compose:** Postgres with PostGIS and pgvector, Redis, and a local Supabase stack (Supabase CLI or documented GoTrue + PostgREST + Storage + Realtime).
- **Ports:** FastAPI on :8000, Next.js on :3000.
- **One command** to start everything; one to run all tests.
- **Seeds:**
  - `seed.sql`: only badges, FAQs, sourced facts and an admin you name
  - `seed_demo.sql`: clearly marked DEMO data for hackathon presentations

## 18. KEYS THE OWNER PROVIDES (everything wired; disabled until set)
- **Required:** `GEMINI_API_KEY` (AI review + chatbot).
- **Supabase:** URL, publishable key, service-role key (backend only), JWT secret.
- **OAuth:** Google, Apple (needs an Apple Developer account) and Microsoft (Azure app) client IDs and secrets, configured in Supabase.
- **Email:** Resend or SMTP key.
- **Optional:** SMS provider, FCM service account, Sentry DSN, Redis URL, OSRM URL.

## 19. DEPLOYMENT
- Preview deploys first. **Never deploy to production or write to a production database without the owner's explicit approval.**
- Vercel (web), Render/Railway (FastAPI in Docker), Supabase.
- **pg_cron jobs:**
  - listing expiry every 10 minutes
  - landing snapshot weekly
  - no-certificate SLA reminders
  - message digests
- DEPLOYMENT.md covers OAuth redirect URLs, the Supabase URL configuration and domain setup.

## 20. FINAL DELIVERABLES
- Complete source (web, backend, SQL, mobile in its phase)
- Logo and landing assets with `CREDITS.md`
- Migrations
- Test and load-test results
- Setup, deployment, admin and representative guides
- A list of remaining limitations
- A 3-minute hackathon demo script

## 21. PHASES (in order; verify each)
1. Architecture, data model, plan.
2. Database, RLS, functions, storage, SQL tests.
3. FastAPI core: JWT, endpoints, rate limits, jobs, tests.
4. Design system: logo (A-bridge), fonts, themes, bold buttons, cursor, ambience.
5. Landing page matching the reference: animated hands, collage, journey band, impact card, weekly snapshot, app section, footer.
6. Auth with role-specific animations, OAuth, profile wizard, no-certificate path, sign-out confirmation.
7. Dashboard shell (collapsible sidebar without numbers) and donor/receiver/admin features.
8. Discovery, drag-and-drop, requests, OTP.
9. Representatives: invitations, dashboard, directions and route, status, live location, automatic emails and contact; tracking for donor and NGO; the auto-playing journey with the hot-food marker.
10. Realtime chat and notifications (email included).
11. Reports with admin actions; audit log with actor names; activity log.
12. Leaderboards (percentile + manual overrides) and milestone certificates for both sides.
13. Feedback system and admin management.
14. AI document extraction, verification and summaries; AI chatbot.
15. Full testing, load testing, accessibility, performance, docs, preview deploy.
16. (Optional) Android app.

Do not claim anything works unless it has been tested. If something cannot be built (a missing key or a provider limitation), say so clearly and leave it wired but disabled.
