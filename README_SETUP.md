# AnnSetu: setup guide

## What is in this folder
| File | What it is |
|---|---|
| `index.html` | Landing page (live impact numbers once you have data) |
| `signin.html` | Sign in, create account, forgot / reset password, Google |
| `donor.html`, `receiver.html`, `admin.html` | The three dashboards |
| `supabase-config.js` | Your project URL + **publishable** key (safe in the browser) |
| `assets/app.js`, `assets/app.css` | The built React app and styles (already built, no build step needed) |
| `src/` | React source code (`npm install && npm run build` to rebuild) |
| `sql/` | Database scripts, run in the order below |

## 1. Database (Supabase, SQL Editor). Run in this order, once
1. `sql/annsetu_schema.sql`
2. `sql/annsetu_schema_part2.sql`
3. `sql/annsetu_schema_part3_fixes.sql`
4. `sql/annsetu_schema_part4_auth_role.sql`  (lets Google sign-ups choose Donor or Receiver)

Try them on a **test project first**. They were reviewed but never run against a live database.

## 2. Supabase settings
- **Authentication → URL Configuration:** set *Site URL* to your deployed site and add `https://YOUR-SITE/signin.html` and `https://YOUR-SITE/` to *Redirect URLs*. Password-reset and email-confirmation links need this.
- **Authentication → Providers:** enable *Email*. For Google, configure the Google provider separately (client ID and secret from Google Cloud).
- **Database → Replication / Realtime:** the SQL already adds the tables; check `notifications`, `food_requests`, `food_listings`, `rep_locations`, `messages` are listed.
- Storage buckets (`verification-docs`, `listing-photos`, `org-logos`) are created by the SQL.
- Optional: enable `pg_cron` and schedule `select public.expire_listings()` every 10 minutes so old listings expire on their own (command is at the bottom of part 2 / part 3).

## 3. Deploy
Upload this whole folder to any static host (Netlify, Vercel, Cloudflare Pages, GitHub Pages). Open `index.html`.
Do not open the files with `file://`: sign-in redirects need a real URL.

## 4. Your first admin
1. Create a normal account on the sign-in page.
2. Supabase → Authentication → Users → copy that user's UUID.
3. Run `sql/make_first_admin.sql` with your UUID.
4. Sign in again. You'll land on the admin console.

## How the flow works
Donor/Receiver sign up → create organisation profile → upload documents → **admin approves a document, then the organisation** → donor lists food → verified NGO requests → donor accepts (quantity reserved) → NGO sees a 4-digit OTP → donor enters the OTP at handover → pickup completed, badges and certificates are awarded.

## Security notes
- Only the publishable key is in the browser. **Never** put a `service_role` / secret key in these files.
- All permissions are enforced by the database (Row Level Security + RPC functions), not by the page.
- Google sign-in users choose their role on the Create account tab before pressing the Google button; otherwise they start as Donor.

## Known limits
- No email/SMS sending beyond Supabase Auth emails (needs Edge Functions + a provider).
- Live location needs HTTPS and the phone's location permission.
- Photos/logos: JPG, PNG, WebP. Documents: PDF, JPG, PNG up to 5 MB.
