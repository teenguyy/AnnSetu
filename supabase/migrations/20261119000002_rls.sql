-- Row Level Security: helpers, grants, policies.
-- Supabase grants ALL on new public tables to anon/authenticated by default; we revoke and
-- re-grant only what each role may touch. Protected columns (status, qty_reserved,
-- verification fields, role) are never client-writable; they change only through functions.

-- ───────────────────────── helper functions ─────────────────────────
-- security definer so policies can look across tables without recursion; search_path pinned.
create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin');
$$;

create or replace function private.my_org_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select id from public.organizations where owner_id = (select auth.uid());
$$;

create or replace function private.my_rep_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select id from public.representatives where user_id = (select auth.uid()) and status = 'active';
$$;

create or replace function private.my_rep_org_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select org_id from public.representatives where user_id = (select auth.uid()) and status = 'active';
$$;

-- true when the caller owns an approved organisation, or is an active rep of an approved NGO
create or replace function private.is_verified_member()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organizations o
    where o.status = 'approved'
      and (o.owner_id = (select auth.uid())
           or o.id in (select r.org_id from public.representatives r
                       where r.user_id = (select auth.uid()) and r.status = 'active')));
$$;

create or replace function private.is_approved_receiver()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.organizations
                 where owner_id = (select auth.uid()) and kind = 'ngo' and status = 'approved');
$$;

-- donor owner, receiver owner or assigned rep of the request
create or replace function private.is_request_party(p_request uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.food_requests r
    join public.food_listings l on l.id = r.listing_id
    left join public.representatives rep on rep.id = r.rep_id
    where r.id = p_request
      and ((select auth.uid()) in (
             (select owner_id from public.organizations where id = l.donor_org_id),
             (select owner_id from public.organizations where id = r.receiver_org_id))
           or rep.user_id = (select auth.uid())));
$$;

-- receiver owner or assigned rep of any request on the listing
create or replace function private.is_listing_requester(p_listing uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.food_requests r
    left join public.representatives rep on rep.id = r.rep_id
    where r.listing_id = p_listing
      and (r.receiver_org_id in (select id from public.organizations where owner_id = (select auth.uid()))
           or rep.user_id = (select auth.uid())));
$$;

create or replace function private.request_is_reported(p_request uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.reports where request_id = p_request);
$$;

-- donor of a request currently assigned to this rep (lets donors see the rep's photo and phone)
create or replace function private.is_donor_for_rep(p_rep uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.food_requests r
    join public.food_listings l on l.id = r.listing_id
    join public.organizations o on o.id = l.donor_org_id
    where r.rep_id = p_rep and r.status in ('accepted', 'completed') and o.owner_id = (select auth.uid()));
$$;

create or replace function private.rep_has_open_pickup(p_rep uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.food_requests where rep_id = p_rep and status in ('pending', 'accepted'));
$$;

create or replace function private.my_role()
returns public.user_role language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = (select auth.uid());
$$;

revoke all on all functions in schema private from public;
grant execute on all functions in schema private to anon, authenticated, service_role;

-- ───────────────────────── baseline grants ─────────────────────────
alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.verification_documents enable row level security;
alter table public.document_ai_reviews enable row level security;
alter table public.representatives enable row level security;
alter table public.rep_invitations enable row level security;
alter table public.food_listings enable row level security;
alter table public.food_requests enable row level security;
alter table public.pickup_otps enable row level security;
alter table public.rep_access_tokens enable row level security;
alter table public.pickup_events enable row level security;
alter table public.rep_locations enable row level security;
alter table public.requirements enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.messages enable row level security;
alter table public.message_reads enable row level security;
alter table public.announcements enable row level security;
alter table public.reviews enable row level security;
alter table public.reports enable row level security;
alter table public.report_actions enable row level security;
alter table public.audit_log enable row level security;
alter table public.activity_log enable row level security;
alter table public.badge_definitions enable row level security;
alter table public.org_badges enable row level security;
alter table public.rep_badges enable row level security;
alter table public.certificates enable row level security;
alter table public.leaderboard_overrides enable row level security;
alter table public.landing_snapshot enable row level security;
alter table public.facts enable row level security;
alter table public.contact_messages enable row level security;
alter table public.testimonials enable row level security;
alter table public.faqs enable row level security;
alter table public.app_settings enable row level security;
alter table public.feedback enable row level security;
alter table public.device_tokens enable row level security;
alter table public.chatbot_conversations enable row level security;
alter table public.chatbot_messages enable row level security;
alter table public.kb_documents enable row level security;
alter table public.jobs enable row level security;

-- start from nothing, then grant precisely
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- public (anon + authenticated) read-only content
grant select on public.badge_definitions, public.org_badges, public.landing_snapshot,
  public.facts, public.testimonials, public.faqs, public.app_settings to anon, authenticated;

-- authenticated reads (RLS filters rows)
grant select on public.profiles, public.organizations, public.verification_documents,
  public.document_ai_reviews, public.representatives, public.food_listings, public.food_requests,
  public.pickup_events, public.rep_locations, public.requirements, public.notifications,
  public.notification_preferences, public.messages, public.message_reads, public.announcements,
  public.reviews, public.reports, public.report_actions, public.audit_log, public.activity_log,
  public.rep_badges, public.certificates, public.leaderboard_overrides, public.contact_messages,
  public.feedback, public.device_tokens to authenticated;

-- column-scoped writes
grant update (full_name, phone, avatar_path) on public.profiles to authenticated;

grant insert (owner_id, kind, org_type, name, contact_person, phone, email, address, city, state, pincode,
  location, about, operating_hours, pickup_windows, logo_path, fssai_number, area_served,
  beneficiaries_per_day, no_certificate, no_cert_explanation, no_cert_references)
  on public.organizations to authenticated;
grant update (org_type, name, contact_person, phone, email, address, city, state, pincode, location, about,
  operating_hours, pickup_windows, logo_path, fssai_number, area_served, beneficiaries_per_day,
  no_certificate, no_cert_explanation, no_cert_references)
  on public.organizations to authenticated;

grant insert (org_id, doc_type, storage_path) on public.verification_documents to authenticated;
grant delete on public.verification_documents to authenticated;

grant insert (org_id, name, phone, email, photo_path) on public.representatives to authenticated;
grant update (name, phone, email, photo_path) on public.representatives to authenticated;
grant delete on public.representatives to authenticated;

grant insert (donor_org_id, title, category, qty_total, unit, prepared_at, pickup_by, photos, diet,
  allergens, safety_notes, pickup_instructions) on public.food_listings to authenticated;
grant update (title, photos, allergens, safety_notes, pickup_instructions) on public.food_listings to authenticated;

grant insert (org_id, title, category, qty, unit, needed_by, notes) on public.requirements to authenticated;
grant update (title, category, qty, unit, needed_by, notes, status) on public.requirements to authenticated;
grant delete on public.requirements to authenticated;

grant update (read_at) on public.notifications to authenticated;
grant delete on public.notifications to authenticated;
grant insert, update, delete on public.notification_preferences to authenticated;

grant insert (request_id, sender_id, body, attachment_path) on public.messages to authenticated;
grant insert (request_id, user_id, last_read_message_id), update (last_read_message_id, read_at)
  on public.message_reads to authenticated;

grant insert (reporter_id, target_org_id, request_id, listing_id, rep_id, reason, details) on public.reports to authenticated;

grant insert (user_id, category, rating, subject, details, screenshot_path, platform, app_version) on public.feedback to authenticated;

grant insert, delete on public.device_tokens to authenticated;

-- admin-managed content (RLS restricts these writes to admins)
grant insert, update, delete on public.facts, public.testimonials, public.faqs to authenticated;
grant update (value, is_public) on public.app_settings to authenticated;
grant update (status) on public.contact_messages to authenticated;
grant select on public.testimonials, public.faqs, public.facts to authenticated;

-- ───────────────────────── policies ─────────────────────────
-- profiles
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.is_admin()));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- organizations
create policy organizations_select on public.organizations for select to authenticated
  using (owner_id = (select auth.uid())
         or (select private.is_admin())
         or (status = 'approved' and (select private.is_verified_member()))
         or id = (select private.my_rep_org_id()));
create policy organizations_insert on public.organizations for insert to authenticated
  with check (owner_id = (select auth.uid())
              and kind::text = (select private.my_role())::text);
create policy organizations_update on public.organizations for update to authenticated
  using (owner_id = (select auth.uid()) and status <> 'suspended')
  with check (owner_id = (select auth.uid()));

-- verification documents
create policy vdocs_select on public.verification_documents for select to authenticated
  using (org_id = (select private.my_org_id()) or (select private.is_admin()));
create policy vdocs_insert on public.verification_documents for insert to authenticated
  with check (org_id = (select private.my_org_id())
              and storage_path like ((select private.my_org_id())::text || '/%'));
create policy vdocs_delete on public.verification_documents for delete to authenticated
  using (org_id = (select private.my_org_id()) and status <> 'approved');

create policy ai_reviews_select on public.document_ai_reviews for select to authenticated
  using (org_id = (select private.my_org_id()) or (select private.is_admin()));

-- representatives
create policy reps_select on public.representatives for select to authenticated
  using (org_id = (select private.my_org_id())
         or user_id = (select auth.uid())
         or (select private.is_admin())
         or (select private.is_donor_for_rep(id)));
create policy reps_insert on public.representatives for insert to authenticated
  with check (org_id = (select private.my_org_id())
              and exists (select 1 from public.organizations o where o.id = org_id and o.kind = 'ngo'));
create policy reps_update on public.representatives for update to authenticated
  using (org_id = (select private.my_org_id()))
  with check (org_id = (select private.my_org_id()));
create policy reps_delete on public.representatives for delete to authenticated
  using (org_id = (select private.my_org_id()) and not (select private.rep_has_open_pickup(id)));

-- food listings
create policy listings_select on public.food_listings for select to authenticated
  using (donor_org_id = (select private.my_org_id())
         or (select private.is_admin())
         or ((select private.is_approved_receiver()) and status = 'active' and pickup_by > now())
         or (select private.is_listing_requester(id)));
create policy listings_insert on public.food_listings for insert to authenticated
  with check (donor_org_id = (select private.my_org_id())
              and exists (select 1 from public.organizations o
                          where o.id = donor_org_id and o.kind = 'donor' and o.status = 'approved'));
create policy listings_update on public.food_listings for update to authenticated
  using (donor_org_id = (select private.my_org_id()) and status in ('active', 'reserved'))
  with check (donor_org_id = (select private.my_org_id()));

-- food requests and their satellites (writes only through functions)
create policy requests_select on public.food_requests for select to authenticated
  using ((select private.is_request_party(id)) or (select private.is_admin()));
create policy pickup_events_select on public.pickup_events for select to authenticated
  using ((select private.is_request_party(request_id)) or (select private.is_admin()));
create policy rep_locations_select on public.rep_locations for select to authenticated
  using ((select private.is_request_party(request_id)) or (select private.is_admin()));
-- pickup_otps, rep_access_tokens, rep_invitations: no client policies at all (service role / functions only)

-- requirements (community needs)
create policy requirements_select on public.requirements for select to authenticated
  using (org_id = (select private.my_org_id())
         or (select private.is_admin())
         or (status = 'open' and (select private.is_verified_member())));
create policy requirements_insert on public.requirements for insert to authenticated
  with check (org_id = (select private.my_org_id())
              and exists (select 1 from public.organizations o
                          where o.id = org_id and o.kind = 'ngo' and o.status = 'approved'));
create policy requirements_update on public.requirements for update to authenticated
  using (org_id = (select private.my_org_id())) with check (org_id = (select private.my_org_id()));
create policy requirements_delete on public.requirements for delete to authenticated
  using (org_id = (select private.my_org_id()));

-- notifications
create policy notifications_select on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notifications_delete on public.notifications for delete to authenticated
  using (user_id = (select auth.uid()));
create policy notif_prefs_all on public.notification_preferences for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- messages
create policy messages_select on public.messages for select to authenticated
  using ((select private.is_request_party(request_id))
         or ((select private.is_admin()) and (select private.request_is_reported(request_id))));
create policy messages_insert on public.messages for insert to authenticated
  with check (sender_id = (select auth.uid()) and (select private.is_request_party(request_id)));
create policy message_reads_all on public.message_reads for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and (select private.is_request_party(request_id)));

-- announcements
create policy announcements_select on public.announcements for select to authenticated
  using (audience = 'all' or audience = (select private.my_role())::text or (select private.is_admin()));

-- reviews
create policy reviews_select on public.reviews for select to authenticated
  using ((select private.is_verified_member()) or (select private.is_admin()));

-- reports
create policy reports_select on public.reports for select to authenticated
  using (reporter_id = (select auth.uid()) or (select private.is_admin()));
create policy reports_insert on public.reports for insert to authenticated
  with check (reporter_id = (select auth.uid()));
create policy report_actions_select on public.report_actions for select to authenticated
  using ((select private.is_admin()));

-- logs
create policy audit_log_select on public.audit_log for select to authenticated using ((select private.is_admin()));
create policy activity_log_select on public.activity_log for select to authenticated using ((select private.is_admin()));

-- recognition
create policy badge_defs_select on public.badge_definitions for select to anon, authenticated using (true);
create policy org_badges_select on public.org_badges for select to anon, authenticated using (true);
create policy rep_badges_select on public.rep_badges for select to authenticated
  using ((select private.is_admin())
         or rep_id = (select private.my_rep_id())
         or rep_id in (select id from public.representatives where org_id = (select private.my_org_id())));
create policy certificates_select on public.certificates for select to authenticated
  using (org_id = (select private.my_org_id()) or (select private.is_admin()));
create policy lb_overrides_select on public.leaderboard_overrides for select to authenticated
  using ((select private.is_admin()));

-- landing & content
create policy landing_snapshot_select on public.landing_snapshot for select to anon, authenticated using (true);
create policy facts_select on public.facts for select to anon, authenticated
  using (active or (select private.is_admin()));
create policy facts_admin on public.facts for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy testimonials_select on public.testimonials for select to anon, authenticated
  using (published or (select private.is_admin()));
create policy testimonials_admin on public.testimonials for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy faqs_select on public.faqs for select to anon, authenticated
  using (published or (select private.is_admin()));
create policy faqs_admin on public.faqs for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy app_settings_select on public.app_settings for select to anon, authenticated
  using (is_public or (select private.is_admin()));
create policy app_settings_admin on public.app_settings for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy contact_select on public.contact_messages for select to authenticated using ((select private.is_admin()));
create policy contact_update on public.contact_messages for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- support
create policy feedback_select on public.feedback for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy feedback_insert on public.feedback for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy device_tokens_all on public.device_tokens for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
-- chatbot_*, kb_documents, jobs: service role only (no client policies)

-- ───────────────────────── org update guard ─────────────────────────
-- Identity fields lock after approval; only admins (through functions) may change them.
create or replace function private.guard_org_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.status = 'approved'
     and (new.name is distinct from old.name
          or new.org_type is distinct from old.org_type
          or new.fssai_number is distinct from old.fssai_number)
     and not private.is_admin()
     and current_user <> 'service_role' then
    raise exception 'Name, type and licence number are locked after verification. Contact support to change them.'
      using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger organizations_guard before update on public.organizations
  for each row execute function private.guard_org_update();
