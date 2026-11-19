-- Copy v1 rows (preserved in schema `legacy`) into the new tables. No-op without `legacy`.
-- Imported: profiles, organizations, notifications, audit log, contact messages, FAQs.
-- Not imported (empty in v1 at upgrade time; still kept in `legacy` for review): listings,
-- requests, OTPs, documents, representatives, badges, certificates, reports, reviews, messages.

do $$
declare
  v_old bigint;
  v_new bigint;
begin
  if to_regclass('legacy.organizations') is null then
    raise notice 'No legacy schema; nothing to import';
    return;
  end if;

  -- profiles (auth users already exist)
  insert into public.profiles (id, role, full_name, created_at)
  select p.id,
         case when p.role in ('donor', 'ngo', 'representative', 'admin') then p.role::public.user_role end,
         left(p.full_name, 120), p.created_at
  from legacy.profiles p
  where exists (select 1 from auth.users u where u.id = p.id)
  on conflict (id) do update set role = excluded.role, full_name = excluded.full_name;

  -- organizations: normalise types, map verification/suspension, keep location
  insert into public.organizations (
    id, owner_id, kind, org_type, status, name, phone, address, about, area_served, location,
    logo_path, rejection_note, suspended_reason, verified_at, created_at)
  select o.id, o.owner_id, o.kind::public.org_kind,
         case
           when o.kind = 'donor' and n.t in ('restaurant', 'hotel', 'canteen', 'caterer', 'event_organiser', 'food_business', 'community_kitchen') then n.t
           when o.kind = 'ngo' and n.t in ('ngo', 'shelter', 'orphanage', 'old_age_home', 'community_kitchen', 'community_group') then n.t
           when o.kind = 'donor' then 'food_business'
           else 'ngo'
         end,
         (case when o.suspended then 'suspended'
               when o.verification in ('approved', 'rejected') then o.verification
               else 'pending' end)::public.org_status,
         left(o.name, 160),
         case when o.phone ~ '^\+?[0-9 ]{7,20}$' then o.phone end,
         left(o.address, 400), left(o.about, 2000), left(o.area_served, 300),
         coalesce(o.geo::extensions.geography,
                  case when o.lat is not null and o.lng is not null then
                    extensions.st_setsrid(extensions.st_makepoint(o.lng::float8, o.lat::float8), 4326)::extensions.geography end),
         o.logo_path, o.verification_note, o.suspended_reason,
         case when o.verification = 'approved' then o.created_at end,
         o.created_at
  from legacy.organizations o
  cross join lateral (select lower(regexp_replace(trim(o.org_type), '[\s-]+', '_', 'g')) as t) n
  where o.kind in ('donor', 'ngo')
    and exists (select 1 from public.profiles p where p.id = o.owner_id)
  on conflict (id) do nothing;

  insert into public.notifications (user_id, category, title, body, read_at, created_at)
  select n.user_id, 'general', n.title, n.body, case when n.read then n.created_at end, n.created_at
  from legacy.notifications n
  where exists (select 1 from public.profiles p where p.id = n.user_id);

  insert into public.audit_log (actor_id, actor_name, actor_email, actor_role, action, target_table, target_id,
                                target_label, diff, note, created_at)
  select a.admin_id, p.full_name, u.email, 'admin', a.action, a.target_table, a.target_id::text,
         o.name, a.details, a.details ->> 'note', a.created_at
  from legacy.audit_log a
  left join public.profiles p on p.id = a.admin_id
  left join auth.users u on u.id = a.admin_id
  left join public.organizations o on o.id = a.target_id;

  insert into public.contact_messages (name, email, subject, body, status, created_at)
  select left(c.name, 120), c.email,
         case when char_length(trim(coalesce(c.subject, ''))) >= 3 then left(trim(c.subject), 160)
              else left(trim('Contact: ' || coalesce(c.subject, '(no subject)')), 160) end,
         left(c.message, 4000), case when c.status in ('new', 'read', 'replied') then c.status else 'new' end, c.created_at
  from legacy.contact_messages c
  where char_length(c.message) >= 10;

  -- owner-written FAQs first; AnnSetu v2 adds FAQs for features v1 did not have
  insert into public.faqs (question, answer, category, published, sort)
  select f.question, f.answer, 'general', f.published, f.sort_order * 10 from legacy.faqs f;
  insert into public.faqs (question, answer, category, sort)
  select q, a, c, s from (values
    ('We do not have a registration certificate. Can we join?',
     'Yes, if you are an NGO, a local community group or a community kitchen. Explain who you serve and add references; an admin reviews your request within 3–5 business days.', 'receivers', 900),
    ('How is a pickup confirmed?',
     'When the donor accepts a request, the receiver gets a 4-digit code. The representative shows it to the donor, who enters it to confirm the collection.', 'pickups', 910),
    ('How do you calculate meals and CO₂?',
     'Only OTP-confirmed pickups count. Meals are estimated as portions plus kilograms ÷ 0.42 (WRAP''s 420 g meal equivalent); packs are not converted. CO₂ is kilograms × a cited emissions factor. Estimates are always labelled "est.".', 'impact', 920),
    ('Is my data private?',
     'Contact details and documents are visible only to verified partners in a pickup and to AnnSetu admins. See the privacy page for details.', 'general', 930)
  ) as v(q, a, c, s)
  where not exists (select 1 from public.faqs where question = v.q);

  -- report what moved
  select count(*) into v_old from legacy.organizations;
  select count(*) into v_new from public.organizations;
  raise notice 'organizations: % legacy → % imported', v_old, v_new;
  select count(*) into v_old from legacy.profiles;
  select count(*) into v_new from public.profiles;
  raise notice 'profiles: % legacy → % imported', v_old, v_new;
end $$;
