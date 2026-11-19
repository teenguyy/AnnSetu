-- =====================================================================
-- AnnSetu PART 7 (website): representatives, pickup tracking, public
-- leaderboard with admin curation, report actions, AI reviews, chatbot
-- log, weekly landing snapshot, scale indexes.
-- Run AFTER parts 1-6. Additive and safe to re-run.
-- =====================================================================
set search_path = public, extensions;

-- ---------------------------------------------------------------------
-- 1. REPRESENTATIVE ACCOUNTS
--    An NGO adds a representative with an email. When that person signs up
--    (role "rep") or signs in, link_my_rep() links the account. A rep sees
--    only the pickups assigned to them.
-- ---------------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('donor','ngo','admin','rep'));

alter table public.representatives add column if not exists email text;
alter table public.representatives add column if not exists user_id uuid references public.profiles(id) on delete set null;
alter table public.representatives add column if not exists active boolean not null default true;
alter table public.representatives add column if not exists created_at timestamptz not null default now();
create unique index if not exists reps_user_once on public.representatives (user_id) where user_id is not null and active;
create index if not exists reps_email_idx on public.representatives (lower(email));
grant insert (email), update (email, active) on public.representatives to authenticated;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'reps_email_fmt') then
    alter table public.representatives add constraint reps_email_fmt
      check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');
  end if;
end $$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, role, full_name)
  values (new.id,
          case when new.raw_user_meta_data->>'role' in ('donor','ngo','rep')
               then new.raw_user_meta_data->>'role' else 'donor' end,
          coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'));
  return new;
end $$;

create or replace function public.set_my_role(p_role text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if p_role not in ('donor','ngo','rep') then raise exception 'Invalid role'; end if;
  if exists (select 1 from organizations where owner_id = auth.uid()) then
    raise exception 'Role can''t be changed after your organisation profile exists'; end if;
  update profiles set role = p_role where id = auth.uid() and role <> 'admin';
end $$;

create or replace function public.my_rep_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from representatives where user_id = auth.uid() and active limit 1 $$;

-- Links the signed-in rep account to the NGO invitation that uses its email.
create or replace function public.link_my_rep() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_email text; r representatives; o organizations;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select email into v_email from auth.users where id = auth.uid();
  select * into r from representatives where user_id = auth.uid() and active limit 1;
  if not found then
    select * into r from representatives
     where lower(email) = lower(v_email) and user_id is null and active
     order by created_at desc limit 1;
    if found then
      update representatives set user_id = auth.uid() where id = r.id;
      update profiles set role = 'rep' where id = auth.uid() and role <> 'admin'
         and not exists (select 1 from organizations where owner_id = auth.uid());
      perform notify_org(r.org_id, 'Representative joined', r.name || ' linked their AnnSetu account.');
    else
      return jsonb_build_object('linked', false);
    end if;
  end if;
  select * into o from organizations where id = r.org_id;
  return jsonb_build_object('linked', true, 'rep_id', r.id, 'name', r.name, 'org_name', o.name);
end $$;

-- ---------------------------------------------------------------------
-- 2. PICKUP TRACKING (status + ETA), visible to donor, NGO and rep
-- ---------------------------------------------------------------------
alter table public.food_requests add column if not exists trip_status text not null default 'assigned';
alter table public.food_requests add column if not exists eta timestamptz;
alter table public.food_requests add column if not exists trip_updated_at timestamptz;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'req_trip_status_chk') then
    alter table public.food_requests add constraint req_trip_status_chk
      check (trip_status in ('assigned','on_the_way','arrived','collected'));
  end if;
end $$;
create index if not exists food_requests_rep_idx on public.food_requests (rep_id);

-- party = NGO owner, donor owner, or the assigned representative
create or replace function public.is_party_of_request(p_req uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from food_requests r join food_listings l on l.id = r.listing_id
                 join organizations o on o.id in (r.ngo_org_id, l.donor_org_id)
                 where r.id = p_req and o.owner_id = auth.uid())
      or exists (select 1 from food_requests r join representatives p on p.id = r.rep_id
                 where r.id = p_req and p.user_id = auth.uid() and p.active) $$;

create or replace function public.is_rep_of_request(p_req uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from food_requests r join representatives p on p.id = r.rep_id
                 where r.id = p_req and p.user_id = auth.uid() and p.active) $$;

-- reps can read their own pickups and their own rep row
drop policy if exists requests_read_rep on public.food_requests;
create policy requests_read_rep on public.food_requests for select to authenticated
  using (public.is_rep_of_request(id));
drop policy if exists reps_self_read on public.representatives;
create policy reps_self_read on public.representatives for select to authenticated
  using (user_id = auth.uid());

-- Everything a representative needs to reach the pickup (one call)
create or replace function public.rep_my_pickups() returns table (
  request_id uuid, status text, trip_status text, eta timestamptz, quantity int,
  listing_title text, unit text, category text, pickup_by timestamptz, safety_notes text, photo_path text,
  donor_name text, donor_phone text, donor_address text, donor_lat numeric, donor_lng numeric,
  ngo_name text, ngo_phone text, otp text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select r.id, r.status, r.trip_status, r.eta, r.quantity,
         l.title, l.unit, l.category, l.pickup_by, l.safety_notes, l.photo_path,
         d.name, d.phone, d.address, d.lat, d.lng,
         n.name, n.phone,
         case when r.status = 'accepted' then (select otp from pickup_otps where request_id = r.id) end,
         r.created_at
    from food_requests r
    join representatives p on p.id = r.rep_id and p.user_id = auth.uid() and p.active
    join food_listings l on l.id = r.listing_id
    join organizations d on d.id = l.donor_org_id
    join organizations n on n.id = r.ngo_org_id
   where r.status in ('accepted','completed') and r.created_at > now() - interval '30 days'
   order by (r.status = 'accepted') desc, l.pickup_by asc $$;

-- Status + ETA updates by the rep (or the NGO owner); notifies both sides
create or replace function public.set_trip_status(p_request uuid, p_status text, p_eta timestamptz default null) returns void
language plpgsql security definer set search_path = public as $$
declare r food_requests; l food_listings; v_who text; v_msg text;
begin
  select * into r from food_requests where id = p_request for update;
  if not found then raise exception 'Request not found'; end if;
  if not (public.is_rep_of_request(p_request)
          or exists (select 1 from organizations where id = r.ngo_org_id and owner_id = auth.uid())) then
    raise exception 'Only the assigned representative or the NGO can update this pickup'; end if;
  if r.status <> 'accepted' then raise exception 'This pickup is not active'; end if;
  if p_status not in ('on_the_way','arrived','assigned') then raise exception 'Invalid status'; end if;
  if p_eta is not null and (p_eta < now() - interval '5 minutes' or p_eta > now() + interval '24 hours') then
    raise exception 'ETA must be within the next 24 hours'; end if;
  update food_requests set trip_status = p_status, eta = coalesce(p_eta, case when p_status = 'arrived' then now() else eta end),
         trip_updated_at = now() where id = p_request;
  select * into l from food_listings where id = r.listing_id;
  v_who := coalesce(r.rep_name, 'The representative');
  v_msg := case p_status
             when 'on_the_way' then v_who || ' is on the way for "' || l.title || '"' ||
                  coalesce(', ETA ' || to_char(coalesce(p_eta, r.eta) at time zone 'Asia/Kolkata', 'HH12:MI AM'), '')
             when 'arrived' then v_who || ' has arrived to collect "' || l.title || '"'
             else v_who || ' updated the pickup for "' || l.title || '"' end;
  perform notify_org(l.donor_org_id, 'Pickup update', v_msg);
  perform notify_org(r.ngo_org_id, 'Pickup update', v_msg);
end $$;

-- The rep may share live location for their own pickup
create or replace function public.update_location(p_request uuid, p_lat numeric, p_lng numeric, p_acc numeric default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_rep_of_request(p_request) or exists (
           select 1 from food_requests r join organizations o on o.id = r.ngo_org_id
            where r.id = p_request and o.owner_id = auth.uid())) then
    raise exception 'Location sharing is only available for your own pickups'; end if;
  if not exists (select 1 from food_requests where id = p_request and status = 'accepted') then
    raise exception 'Location sharing is only available during accepted pickups'; end if;
  insert into rep_locations (request_id, lat, lng, accuracy_m) values (p_request, p_lat, p_lng, p_acc)
  on conflict (request_id) do update set lat = excluded.lat, lng = excluded.lng,
        accuracy_m = excluded.accuracy_m, updated_at = now()
   where rep_locations.updated_at < now() - interval '3 seconds';
end $$;

-- messages: rep can read/post in their pickup thread (uses is_party_of_request)
-- message notification also reaches the rep's account
create or replace function public.trg_message_sent() returns trigger
language plpgsql security definer set search_path = public as $$
declare r food_requests; l food_listings; ngo_owner uuid; donor_owner uuid; rep_user uuid;
begin
  select * into r from food_requests where id = new.request_id;
  select * into l from food_listings where id = r.listing_id;
  select owner_id into ngo_owner   from organizations where id = r.ngo_org_id;
  select owner_id into donor_owner from organizations where id = l.donor_org_id;
  select user_id into rep_user from representatives where id = r.rep_id;
  insert into notifications (user_id, title, body)
  select u, 'New message', left(new.body, 80)
    from unnest(array[ngo_owner, donor_owner, rep_user]) u
   where u is not null and u <> new.sender_id;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 3. PUBLIC LEADERBOARD: top N% (default 25%), admin curation, visible to all
-- ---------------------------------------------------------------------
create table if not exists public.leaderboard_overrides (
  org_id     uuid primary key references public.organizations(id) on delete cascade,
  action     text not null check (action in ('pin','hide','boost')),
  boost      int  not null default 0 check (boost between -1000 and 1000),
  reason     text not null check (char_length(trim(reason)) >= 3),
  admin_id   uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.leaderboard_overrides enable row level security;
drop policy if exists lbo_admin on public.leaderboard_overrides;
create policy lbo_admin on public.leaderboard_overrides for select to authenticated using (public.is_admin());
grant select on public.leaderboard_overrides to authenticated;

create table if not exists public.app_settings (
  key text primary key, value jsonb not null, updated_at timestamptz not null default now());
alter table public.app_settings enable row level security;
drop policy if exists settings_admin on public.app_settings;
create policy settings_admin on public.app_settings for select to authenticated using (public.is_admin());
grant select on public.app_settings to authenticated;
insert into public.app_settings (key, value) values ('leaderboard_percent', '25') on conflict do nothing;

create or replace function public.public_leaderboard(p_kind text)
returns table (rank int, org_id uuid, name text, org_type text, pickups int, units int, curated boolean, pinned boolean)
language sql stable security definer set search_path = public as $$
  with pct as (select least(greatest(coalesce((select value::text::int from app_settings where key = 'leaderboard_percent'), 25), 5), 100) p),
  base as (
    select o.id, o.name, o.org_type,
           count(r.id)::int as pickups, coalesce(sum(r.quantity), 0)::int as units
      from organizations o
      join food_requests r on r.status = 'completed'
       and ((o.kind = 'ngo' and r.ngo_org_id = o.id)
         or (o.kind = 'donor' and r.listing_id in (select id from food_listings where donor_org_id = o.id)))
     where o.kind = p_kind and o.verification = 'approved' and not o.suspended
     group by o.id),
  scored as (
    select b.*, x.action, coalesce(x.boost, 0) as boost,
           b.units + coalesce(x.boost, 0) as score
      from base b left join leaderboard_overrides x on x.org_id = b.id
     where coalesce(x.action, '') <> 'hide'),
  ranked as (
    select s.*, row_number() over (order by (s.action = 'pin') desc nulls last, s.score desc, s.pickups desc, s.name) as rn,
           count(*) over () as total
      from scored s)
  select rn::int, id, name, org_type, pickups, units, action is not null, coalesce(action = 'pin', false)
    from ranked, pct
   where rn <= greatest(1, ceil(total * pct.p / 100.0)) or action = 'pin'
   order by rn $$;
grant execute on function public.public_leaderboard(text) to anon, authenticated;

create or replace function public.admin_set_leaderboard(p_org uuid, p_action text, p_reason text, p_boost int default 0) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  if p_action = 'clear' then
    delete from leaderboard_overrides where org_id = p_org;
  else
    if p_action not in ('pin','hide','boost') then raise exception 'Invalid action'; end if;
    if coalesce(char_length(trim(p_reason)), 0) < 3 then raise exception 'A reason is required'; end if;
    insert into leaderboard_overrides (org_id, action, boost, reason, admin_id)
    values (p_org, p_action, coalesce(p_boost, 0), trim(p_reason), auth.uid())
    on conflict (org_id) do update set action = excluded.action, boost = excluded.boost,
      reason = excluded.reason, admin_id = excluded.admin_id, updated_at = now();
  end if;
  perform log_audit('leaderboard_' || p_action, 'organizations', p_org,
                    jsonb_build_object('reason', p_reason, 'boost', p_boost));
end $$;

create or replace function public.admin_set_setting(p_key text, p_value jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  if p_key = 'leaderboard_percent' and not ((p_value::text)::int between 5 and 100) then
    raise exception 'Percent must be between 5 and 100'; end if;
  insert into app_settings (key, value) values (p_key, p_value)
  on conflict (key) do update set value = excluded.value, updated_at = now();
  perform log_audit('setting_changed', 'app_settings', null, jsonb_build_object('key', p_key, 'value', p_value));
end $$;
revoke all on function public.admin_set_leaderboard(uuid,text,text,int), public.admin_set_setting(text,jsonb) from public, anon;
grant execute on function public.admin_set_leaderboard(uuid,text,text,int), public.admin_set_setting(text,jsonb) to authenticated;

-- more milestones for both sides (certificates are issued by award_badges)
insert into public.badge_definitions (code, applies_to, name, metric, threshold) values
  ('ten_donations',     'donor', '10 donations',          'donations', 10),
  ('fifty_donations',   'donor', '50 donations',          'donations', 50),
  ('thousand_units',    'donor', '1,000 units donated',   'units',     1000),
  ('ten_pickups',       'ngo',   '10 pickups',            'donations', 10),
  ('fifty_pickups',     'ngo',   '50 pickups',            'donations', 50),
  ('five_hundred_recv', 'ngo',   '500 units received',    'units',     500)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------
-- 4. REPORT ACTIONS (warn the reported organisation)
-- ---------------------------------------------------------------------
create or replace function public.admin_warn_org(p_report uuid, p_message text) returns void
language plpgsql security definer set search_path = public as $$
declare rp reports;
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  if coalesce(char_length(trim(p_message)), 0) < 5 then raise exception 'Write the warning message'; end if;
  select * into rp from reports where id = p_report;
  if not found then raise exception 'Report not found'; end if;
  update reports set status = case when status = 'open' then 'reviewing' else status end where id = p_report;
  perform notify_org(rp.reported_org, 'Warning from AnnSetu admin', p_message);
  perform log_audit('report_warning', 'reports', p_report, jsonb_build_object('message', p_message));
end $$;
revoke all on function public.admin_warn_org(uuid,text) from public, anon;
grant execute on function public.admin_warn_org(uuid,text) to authenticated;

-- ---------------------------------------------------------------------
-- 5. AI DOCUMENT REVIEWS (written by the FastAPI backend on an admin's behalf)
-- ---------------------------------------------------------------------
create table if not exists public.document_reviews (
  id             uuid primary key default gen_random_uuid(),
  document_id    uuid references public.verification_documents(id) on delete cascade,
  org_id         uuid not null references public.organizations(id) on delete cascade,
  kind           text not null default 'document' check (kind in ('document','no_certificate')),
  summary        text not null,
  extracted      jsonb not null default '{}',
  checks         jsonb not null default '[]',
  confidence     int  check (confidence between 0 and 100),
  recommendation text check (recommendation in ('looks_valid','needs_review','likely_invalid')),
  model          text,
  created_by     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now()
);
create index if not exists document_reviews_org_idx on public.document_reviews (org_id, created_at desc);
create index if not exists document_reviews_doc_idx on public.document_reviews (document_id, created_at desc);
alter table public.document_reviews enable row level security;
drop policy if exists docrev_admin on public.document_reviews;
create policy docrev_admin on public.document_reviews for select to authenticated using (public.is_admin());
grant select on public.document_reviews to authenticated;

create or replace function public.save_document_review(p_org uuid, p_doc uuid, p_kind text, p_summary text,
  p_extracted jsonb, p_checks jsonb, p_confidence int, p_recommendation text, p_model text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  insert into document_reviews (document_id, org_id, kind, summary, extracted, checks, confidence, recommendation, model, created_by)
  values (p_doc, p_org, coalesce(p_kind, 'document'), left(p_summary, 4000), coalesce(p_extracted, '{}'),
          coalesce(p_checks, '[]'), p_confidence, p_recommendation, p_model, auth.uid())
  returning id into v_id;
  perform log_audit('ai_review', 'organizations', p_org, jsonb_build_object('document', p_doc, 'recommendation', p_recommendation));
  return v_id;
end $$;
revoke all on function public.save_document_review(uuid,uuid,text,text,jsonb,jsonb,int,text,text) from public, anon;
grant execute on function public.save_document_review(uuid,uuid,text,text,jsonb,jsonb,int,text,text) to authenticated;

-- admins need every organisation's documents' FSSAI number etc. for duplicate checks
create or replace function public.admin_document_numbers() returns table (org_id uuid, number text)
language sql stable security definer set search_path = public as $$
  select org_id, extracted->>'registration_number' from document_reviews
   where public.is_admin() and coalesce(extracted->>'registration_number', '') <> '' $$;
grant execute on function public.admin_document_numbers() to authenticated;

-- ---------------------------------------------------------------------
-- 6. WEEKLY LANDING SNAPSHOT (refreshed every 7 days by pg_cron)
-- ---------------------------------------------------------------------
create table if not exists public.landing_snapshots (
  id          uuid primary key default gen_random_uuid(),
  taken_at    timestamptz not null default now(),
  data        jsonb not null
);
alter table public.landing_snapshots enable row level security;
drop policy if exists snap_public on public.landing_snapshots;
create policy snap_public on public.landing_snapshots for select to anon, authenticated using (true);
grant select on public.landing_snapshots to anon, authenticated;

create or replace function public.rebuild_landing_snapshot() returns void
language sql security definer set search_path = public as $$
  insert into landing_snapshots (data)
  select jsonb_build_object(
    'pickups',      (select count(*) from food_requests where status = 'completed'),
    'units',        (select coalesce(sum(quantity), 0) from food_requests where status = 'completed'),
    'donors',       (select count(*) from organizations where kind = 'donor' and verification = 'approved' and not suspended),
    'ngos',         (select count(*) from organizations where kind = 'ngo' and verification = 'approved' and not suspended),
    'week_pickups', (select count(*) from food_requests where status = 'completed' and completed_at > now() - interval '7 days'),
    'week_units',   (select coalesce(sum(quantity), 0) from food_requests where status = 'completed' and completed_at > now() - interval '7 days'),
    'top_donor',    (select name from public_leaderboard('donor') limit 1),
    'top_ngo',      (select name from public_leaderboard('ngo') limit 1),
    'listings_week',(select count(*) from food_listings where created_at > now() - interval '7 days')) $$;
revoke all on function public.rebuild_landing_snapshot() from public, anon, authenticated;

create or replace function public.latest_landing() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce((select data || jsonb_build_object('taken_at', taken_at)
                     from landing_snapshots order by taken_at desc limit 1), '{}'::jsonb) $$;
grant execute on function public.latest_landing() to anon, authenticated;

create or replace function public.admin_refresh_landing() returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  perform rebuild_landing_snapshot();
  perform log_audit('landing_refreshed', 'landing_snapshots', null, '{}');
end $$;
revoke all on function public.admin_refresh_landing() from public, anon;
grant execute on function public.admin_refresh_landing() to authenticated;

do $$ begin
  if not exists (select 1 from cron.job where jobname = 'landing-weekly') then
    perform cron.schedule('landing-weekly', '17 3 * * 1', 'select public.rebuild_landing_snapshot()');
  end if;
end $$;
select public.rebuild_landing_snapshot() where not exists (select 1 from public.landing_snapshots);

-- ---------------------------------------------------------------------
-- 7. SCALE (~10k users): indexes on foreign keys and hot filters
-- ---------------------------------------------------------------------
create index if not exists vdocs_org_idx      on public.verification_documents (org_id);
create index if not exists reps_org_idx       on public.representatives (org_id);
create index if not exists req_status_idx     on public.food_requests (status, completed_at);
create index if not exists otps_ngo_idx       on public.pickup_otps (ngo_org_id);
create index if not exists needs_ngo_idx      on public.requirements (ngo_org_id);
create index if not exists reviews_req_idx    on public.reviews (request_id);
create index if not exists reports_rep_idx    on public.reports (reported_org);
create index if not exists reports_status_idx on public.reports (status, created_at desc);
create index if not exists certs_org_idx      on public.certificates (org_id);
create index if not exists orgs_kind_idx      on public.organizations (kind, verification);
create index if not exists listings_created   on public.food_listings (created_at desc);
create index if not exists audit_admin_idx    on public.audit_log (admin_id);
create index if not exists notes_unread_idx   on public.notifications (user_id) where not read;

alter publication supabase_realtime set table public.notifications, public.food_requests, public.rep_locations, public.messages;

-- function privileges (browsers may call only these)
revoke all on function public.link_my_rep(), public.my_rep_id(), public.rep_my_pickups(),
  public.set_trip_status(uuid,text,timestamptz), public.admin_document_numbers() from public, anon;
grant execute on function public.link_my_rep(), public.my_rep_id(), public.rep_my_pickups(),
  public.set_trip_status(uuid,text,timestamptz), public.admin_document_numbers() to authenticated;

-- helper functions: not callable by signed-out visitors
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.has_request_on(uuid), public.i_am_approved(), public.my_org_approved(text),
  public.my_org_id(), public.owns_listing(uuid), public.is_rep_of_request(uuid) from public, anon;
grant execute on function public.has_request_on(uuid), public.i_am_approved(), public.my_org_approved(text),
  public.my_org_id(), public.owns_listing(uuid), public.is_rep_of_request(uuid) to authenticated;
