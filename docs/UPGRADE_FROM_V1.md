# Upgrade from AnnSetu v1 (applied 2026-11-19)

The Supabase project already held the first AnnSetu schema with real users. It was upgraded in place:

1. `20261119000000_preserve_legacy.sql` moved every v1 table and view, data intact, into the private
   `legacy` schema (not exposed through the API) and dropped the v1 functions, triggers and storage
   policies. The project's `rls_auto_enable` event trigger was kept.
2. `20261119000001`–`20261119000004` created the v2 schema, RLS, functions, storage and schedules.
3. `20261119000005_import_legacy.sql` copied the v1 rows into v2:
   - profiles (roles kept), organisations (types normalised, verification/suspension mapped,
     location kept; invalid phone numbers left empty for re-entry), notifications (read state kept),
     audit log (now with the admin's name and email), contact messages, FAQs (owner FAQs first, plus
     four new ones for v2 features).
   - Not imported because they were empty: listings, requests, OTPs, documents, representatives,
     badges, certificates, reports, reviews, messages.
4. `20261119000006_tidy_grants.sql` removed API execute rights from `rls_auto_enable`.
5. Reference data from `seed.sql` (badges, sourced facts, settings) and the first landing snapshot.

The upgrade was rehearsed locally on a reproduction of the v1 schema before it ran on the project.

## What existing users will notice
- Imported organisations must complete the new profile wizard (hours, pickup windows, city, pincode…)
  before verification; previously rejected organisations can fix and resubmit.
- One v1 FAQ, "Are donations tax-deductible?", is the owner's text: review it for accuracy.

## Removing the backup
`legacy` stays until the owner confirms the import. To remove it later (irreversible):
`drop schema legacy cascade;`
