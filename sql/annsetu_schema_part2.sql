-- =====================================================================
-- AnnSetu: Supabase schema PART 2
-- Run AFTER annsetu_schema.sql (part 1), on the same project.
-- NOT tested against a live project. Try it on a test project first.
--
-- What this adds / fixes
--  BUG FIXES  : representative delete blocked by old requests; confirm_pickup
--               could pass if the OTP row was missing; document inserts could
--               set their own status; stale OTPs left after cancel/expire.
--  NEW        : audit log, suspend/unsuspend, admin withdraw listing,
--               per-document review, admin alerts on new registrations,
--               live pickup location, badges + certificates + leaderboard,
--               listing photos + org logos, PostGIS nearby search,
--               reports/complaints, per-request messaging,
--               contact form, testimonials, FAQ, public impact numbers.
-- =====================================================================

create extension if not exists postgis with schema extensions;
set search_path = public, extensions;

-- =====================================================================
-- 1. BUG FIXES
-- =====================================================================

-- 1a. Representative can now be deleted even if old requests exist.
--     The request keeps a snapshot of the rep's name and phone.
alter table public.food_requests add column rep_name  text;
alter table public.food_requests add column rep_phone text;
update public.food_requests r set rep_name = p.name, rep_phone = p.phone
  from public.representatives p where p.id = r.rep_id;
alter table public.food_requests alter column rep_id drop not null;
alter table public.food_requests drop constraint food_requests_rep_id_fkey;
alter table public.food_requests add constraint food_requests_rep_id_fkey
  foreign key (rep_id) references public.representatives(id) on delete set null;

-- 1b. Verification documents: clients may only set org_id, path, doc_type.
alter table public.verification_documents add column doc_type text not null default 'other';
alter table public.verification_documents add column status text not null default 'pending'
  check (status in ('pending','approved','rejected'));
alter table public.verification_documents add column reviewer_note text;
alter table public.verification_documents add column reviewed_at timestamptz;
revoke insert on public.verification_documents from authenticated;
grant insert (org_id, path, doc_type) on public.verification_documents to authenticated;

-- =====================================================================
-- 2. SUSPENSION + COORDINATES + PHOTOS ON ORGANISATIONS / LISTINGS
-- =====================================================================
alter table public.organizations add column suspended        boolean not null default false;
alter table public.organizations add column suspended_reason text;
alter table public.organizations add column suspended_at     timestamptz;
alter table public.organizations add column logo_path        text;
alter table public.organizations add column geo geography(Point, 4326);
alter table public.organizations add constraint org_lat_range check (lat between -90 and 90);
alter table public.organizations add constraint org_lng_range check (lng between -180 and 180);
create index org_geo_idx on public.organizations using gist (geo);

alter table public.food_listings add column photo_path text;

grant insert (logo_path) on public.organizations to authenticated;
grant update (logo_path) on public.organizations to authenticated;
grant insert (photo_path) on public.food_listings to authenticated;
grant update (photo_path) on public.food_listings to authenticated;

create function public.set_org_geo() returns trigger
language plpgsql set search_path = public, extensions as $$
begin
  if new.lat is not null and new.lng is not null then
    new.geo := st_setsrid(st_makepoint(new.lng, new.lat), 4326)::geography;
  else new.geo := null; end if;
  return new;
end $$;
create trigger org_geo_trg before insert or update of lat, lng on public.organizations
  for each row execute function public.set_org_geo();
update public.organizations set lat = lat where lat is not null;   -- backfill

-- A suspended organisation is no longer "approved" for any action.
create or replace function public.my_org_approved(p_kind text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from organizations where owner_id = auth.uid()
                 and kind = p_kind and verification = 'approved' and not suspended) $$;
create or replace function public.i_am_approved() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from organizations where owner_id = auth.uid()
                 and verification = 'approved' and not suspended) $$;

-- =====================================================================
-- 3. NEW TABLES
-- =====================================================================
create table public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  admin_id    uuid references public.profiles(id) on delete set null,
  action      text not null,
  target_table text,
  target_id   uuid,
  details     jsonb not null default '{}',
  created_at  timestamptz not null default now()
);
create index on public.audit_log (created_at desc);

create table public.rep_locations (        -- exists only during an accepted pickup
  request_id uuid primary key references public.food_requests(id) on delete cascade,
  lat        numeric(9,6) not null check (lat between -90 and 90),
  lng        numeric(9,6) not null check (lng between -180 and 180),
  accuracy_m numeric,
  updated_at timestamptz not null default now()
);

create table public.badge_definitions (
  code       text primary key,
  applies_to text not null check (applies_to in ('donor','ngo')),
  name       text not null,
  metric     text not null check (metric in ('donations','units','partners')),
  threshold  int  not null check (threshold > 0)
);
create table public.org_badges (
  org_id    uuid not null references public.organizations(id) on delete cascade,
  badge_code text not null references public.badge_definitions(code) on delete cascade,
  earned_at timestamptz not null default now(),
  primary key (org_id, badge_code)
);
create table public.certificates (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  badge_code text not null references public.badge_definitions(code),
  title      text not null,
  serial     text not null unique
             default 'AS-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
  issued_at  timestamptz not null default now(),
  unique (org_id, badge_code)
);

create table public.reports (
  id           uuid primary key default gen_random_uuid(),
  reporter_org uuid not null references public.organizations(id) on delete cascade,
  reported_org uuid not null references public.organizations(id) on delete cascade,
  request_id   uuid references public.food_requests(id) on delete set null,
  reason       text not null check (reason in ('unsafe_food','no_show','misconduct','fake_organisation','other')),
  details      text check (char_length(details) <= 1000),
  status       text not null default 'open' check (status in ('open','reviewing','resolved','dismissed')),
  admin_note   text,
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz,
  check (reporter_org <> reported_org)
);
create unique index one_open_report on public.reports (reporter_org, reported_org, reason)
  where status in ('open','reviewing');

create table public.messages (
  id         uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.food_requests(id) on delete cascade,
  sender_id  uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index on public.messages (request_id, created_at);

create table public.contact_messages (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 2 and 80),
  email      text not null check (char_length(email) <= 120),
  subject    text check (char_length(subject) <= 120),
  message    text not null check (char_length(message) between 10 and 2000),
  status     text not null default 'new' check (status in ('new','read','replied')),
  created_at timestamptz not null default now()
);
create table public.testimonials (
  id          uuid primary key default gen_random_uuid(),
  author_name text not null,
  author_role text,
  quote       text not null check (char_length(quote) <= 400),
  published   boolean not null default false,
  created_at  timestamptz not null default now()
);
create table public.faqs (
  id         uuid primary key default gen_random_uuid(),
  question   text not null,
  answer     text not null,
  sort_order int  not null default 0,
  published  boolean not null default true
);

-- =====================================================================
-- 4. INTERNAL HELPERS (not callable from the browser)
-- =====================================================================
create function public.log_audit(p_action text, p_table text, p_target uuid, p_details jsonb default '{}')
returns void language sql security definer set search_path = public as $$
  insert into audit_log (admin_id, action, target_table, target_id, details)
  values (auth.uid(), p_action, p_table, p_target, p_details) $$;

create function public.notify_admins(p_title text, p_body text) returns void
language sql security definer set search_path = public as $$
  insert into notifications (user_id, title, body)
  select id, p_title, p_body from profiles where role = 'admin' $$;

-- cancels one request and frees its reserved quantity
create function public._release_request(p_req uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r food_requests;
begin
  select * into r from food_requests where id = p_req for update;
  if not found then return; end if;
  if r.status = 'accepted' then
    update food_listings set qty_reserved = greatest(qty_reserved - r.quantity, 0),
           status = case when status = 'reserved' then 'active' else status end
     where id = r.listing_id;
  end if;
  update food_requests set status = 'cancelled' where id = p_req and status in ('pending','accepted');
end $$;

-- withdraws a listing and cancels every open request on it
create function public._withdraw_listing(p_listing uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select id, ngo_org_id from food_requests
            where listing_id = p_listing and status in ('pending','accepted') loop
    update food_requests set status = 'cancelled' where id = r.id;
    perform notify_org(r.ngo_org_id, 'Request cancelled', coalesce(p_reason, 'The listing was withdrawn.'));
  end loop;
  update food_listings set status = 'withdrawn' where id = p_listing and status in ('active','reserved');
end $$;

create function public.award_badges(p_org uuid) returns void
language plpgsql security definer set search_path = public as $$
declare k text; m record; b record;
begin
  select kind into k from organizations where id = p_org;
  select count(*)::int as d, coalesce(sum(r.quantity), 0)::int as u,
         count(distinct case when l.donor_org_id = p_org then r.ngo_org_id else l.donor_org_id end)::int as p
    into m
    from food_requests r join food_listings l on l.id = r.listing_id
   where r.status = 'completed' and (l.donor_org_id = p_org or r.ngo_org_id = p_org);
  for b in select * from badge_definitions where applies_to = k loop
    if (b.metric = 'donations' and m.d >= b.threshold)
    or (b.metric = 'units'     and m.u >= b.threshold)
    or (b.metric = 'partners'  and m.p >= b.threshold) then
      insert into org_badges (org_id, badge_code) values (p_org, b.code) on conflict do nothing;
      if found then
        insert into certificates (org_id, badge_code, title) values (p_org, b.code, b.name) on conflict do nothing;
        perform notify_org(p_org, 'New badge earned', b.name);
      end if;
    end if;
  end loop;
end $$;

create function public.is_party_of_request(p_req uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from food_requests r join food_listings l on l.id = r.listing_id
                 join organizations o on o.id in (r.ngo_org_id, l.donor_org_id)
                 where r.id = p_req and o.owner_id = auth.uid()) $$;

-- =====================================================================
-- 5. TRIGGERS
-- =====================================================================
-- 5a. New organisation -> alert every admin
create function public.trg_org_registered() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform notify_admins('New registration', new.name || ' (' || new.kind || ') is awaiting verification');
  return new;
end $$;
create trigger org_registered after insert on public.organizations
  for each row execute function public.trg_org_registered();

-- 5b. New report -> alert every admin
create function public.trg_report_filed() returns trigger
language plpgsql security definer set search_path = public as $$
begin perform notify_admins('New report filed', 'Reason: ' || new.reason); return new; end $$;
create trigger report_filed after insert on public.reports
  for each row execute function public.trg_report_filed();

-- 5c. Request status changes: block suspended donors, clean up, award badges
create function public.trg_request_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status and new.status in ('accepted','completed') and exists
     (select 1 from food_listings l join organizations o on o.id = l.donor_org_id
       where l.id = new.listing_id and o.suspended) then
    raise exception 'This donor account is suspended';
  end if;
  return new;
end $$;
create trigger request_guard before update of status on public.food_requests
  for each row execute function public.trg_request_guard();

create function public.trg_request_changed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    if new.status in ('completed','cancelled','rejected') then
      delete from rep_locations where request_id = new.id;
      delete from pickup_otps   where request_id = new.id;
    end if;
    if new.status = 'completed' then
      perform award_badges((select donor_org_id from food_listings where id = new.listing_id));
      perform award_badges(new.ngo_org_id);
    end if;
  end if;
  return null;
end $$;
create trigger request_changed after update of status on public.food_requests
  for each row execute function public.trg_request_changed();

-- 5d. New message -> notify the other side
create function public.trg_message_sent() returns trigger
language plpgsql security definer set search_path = public as $$
declare r food_requests; l food_listings; ngo_owner uuid; donor_owner uuid;
begin
  select * into r from food_requests where id = new.request_id;
  select * into l from food_listings where id = r.listing_id;
  select owner_id into ngo_owner   from organizations where id = r.ngo_org_id;
  select owner_id into donor_owner from organizations where id = l.donor_org_id;
  insert into notifications (user_id, title, body)
  values (case when new.sender_id = ngo_owner then donor_owner else ngo_owner end,
          'New message', left(new.body, 80));
  return new;
end $$;
create trigger message_sent after insert on public.messages
  for each row execute function public.trg_message_sent();

-- =====================================================================
-- 6. FIXED / REPLACED RPCs (same names as part 1)
-- =====================================================================
-- create_request: snapshots the rep, refuses suspended donors/NGOs
create or replace function public.create_request(p_listing uuid, p_qty int, p_rep uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_org uuid; l food_listings; v_id uuid; v_rn text; v_rp text;
begin
  select id into v_org from organizations
   where owner_id = auth.uid() and kind = 'ngo' and verification = 'approved' and not suspended;
  if v_org is null then raise exception 'Only verified, active NGOs can request food'; end if;
  select name, phone into v_rn, v_rp from representatives where id = p_rep and org_id = v_org;
  if not found then raise exception 'Choose one of your own representatives'; end if;
  select * into l from food_listings where id = p_listing for update;
  if not found or l.status <> 'active' or l.pickup_by <= now() then
    raise exception 'This listing is no longer available'; end if;
  if exists (select 1 from organizations where id = l.donor_org_id and suspended) then
    raise exception 'This donor is not accepting requests'; end if;
  if p_qty < 1 or p_qty > l.quantity - l.qty_reserved then
    raise exception 'Quantity exceeds what is available'; end if;
  insert into food_requests (listing_id, ngo_org_id, rep_id, rep_name, rep_phone, quantity)
  values (p_listing, v_org, p_rep, v_rn, v_rp, p_qty) returning id into v_id;
  perform notify_org(l.donor_org_id, 'New food request', p_qty || ' ' || l.unit || ' of ' || l.title);
  return v_id;
end $$;

-- cancel_request: reuses the shared release logic
create or replace function public.cancel_request(p_request uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r food_requests;
begin
  select * into r from food_requests where id = p_request;
  if not found or not exists (select 1 from organizations where id = r.ngo_org_id and owner_id = auth.uid()) then
    raise exception 'Not your request'; end if;
  if r.status not in ('pending','accepted') then raise exception 'Cannot cancel this request'; end if;
  perform _release_request(p_request);
  perform notify_org((select donor_org_id from food_listings where id = r.listing_id),
                     'Request cancelled', 'An NGO cancelled its request.');
end $$;

-- confirm_pickup: FIX, a missing OTP row now raises instead of passing
create or replace function public.confirm_pickup(p_request uuid, p_otp text) returns boolean
language plpgsql security definer set search_path = public as $$
declare r food_requests; l food_listings; o pickup_otps;
begin
  select * into r from food_requests where id = p_request for update;
  if not found then raise exception 'Request not found'; end if;
  select * into l from food_listings where id = r.listing_id for update;
  if not exists (select 1 from organizations where id = l.donor_org_id and owner_id = auth.uid()) then
    raise exception 'Not your listing'; end if;
  if r.status <> 'accepted' then raise exception 'Request is not awaiting pickup'; end if;
  select * into o from pickup_otps where request_id = r.id for update;
  if not found then raise exception 'No active OTP for this request'; end if;
  if o.attempts >= 5 or o.expires_at < now() then raise exception 'OTP locked or expired'; end if;
  if o.otp <> p_otp then
    update pickup_otps set attempts = attempts + 1 where request_id = r.id;
    return false;
  end if;
  update food_requests set status = 'completed', completed_at = now() where id = r.id;
  if l.qty_reserved = l.quantity and not exists
     (select 1 from food_requests where listing_id = l.id and status = 'accepted') then
    update food_listings set status = 'completed' where id = l.id;
  end if;
  perform notify_org(r.ngo_org_id, 'Pickup confirmed', 'Collection of ' || l.title || ' is complete.');
  return true;
end $$;

-- review_org: needs one approved document to approve, and a note to reject; audited
create or replace function public.review_org(p_org uuid, p_approve boolean, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  if p_approve and not exists (select 1 from verification_documents where org_id = p_org and status = 'approved') then
    raise exception 'Approve at least one verification document first'; end if;
  if not p_approve and coalesce(trim(p_note), '') = '' then
    raise exception 'A note is required when rejecting'; end if;
  update organizations set verification = case when p_approve then 'approved' else 'rejected' end,
         verification_note = p_note where id = p_org;
  perform log_audit(case when p_approve then 'org_approved' else 'org_rejected' end,
                    'organizations', p_org, jsonb_build_object('note', p_note));
  perform notify_org(p_org, case when p_approve then 'Organisation verified' else 'Verification rejected' end,
                     coalesce(p_note, ''));
end $$;

-- =====================================================================
-- 7. NEW RPCs
-- =====================================================================
create function public.review_document(p_doc uuid, p_status text, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare d verification_documents;
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  if p_status not in ('approved','rejected') then raise exception 'Invalid status'; end if;
  update verification_documents set status = p_status, reviewer_note = p_note, reviewed_at = now()
   where id = p_doc returning * into d;
  if not found then raise exception 'Document not found'; end if;
  perform log_audit('document_' || p_status, 'verification_documents', p_doc, jsonb_build_object('note', p_note));
  perform notify_org(d.org_id, 'Document ' || p_status, coalesce(p_note, d.doc_type));
end $$;

create function public.suspend_org(p_org uuid, p_suspend boolean, p_reason text default null) returns void
language plpgsql security definer set search_path = public as $$
declare x record;
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  if p_suspend and coalesce(trim(p_reason), '') = '' then raise exception 'A reason is required'; end if;
  update organizations set suspended = p_suspend,
         suspended_reason = case when p_suspend then p_reason end,
         suspended_at = case when p_suspend then now() end where id = p_org;
  if p_suspend then
    for x in select id from food_listings where donor_org_id = p_org and status in ('active','reserved') loop
      perform _withdraw_listing(x.id, 'The donor account was suspended.');
    end loop;
    for x in select id from food_requests where ngo_org_id = p_org and status in ('pending','accepted') loop
      perform _release_request(x.id);
    end loop;
  end if;
  perform log_audit(case when p_suspend then 'org_suspended' else 'org_unsuspended' end,
                    'organizations', p_org, jsonb_build_object('reason', p_reason));
  perform notify_org(p_org, case when p_suspend then 'Account suspended' else 'Account reinstated' end,
                     coalesce(p_reason, ''));
end $$;

create function public.admin_withdraw_listing(p_listing uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  perform _withdraw_listing(p_listing, p_reason);
  perform log_audit('listing_withdrawn', 'food_listings', p_listing, jsonb_build_object('reason', p_reason));
  perform notify_org((select donor_org_id from food_listings where id = p_listing),
                     'Listing withdrawn by admin', coalesce(p_reason, ''));
end $$;

create function public.resolve_report(p_report uuid, p_status text, p_note text, p_suspend boolean default false) returns void
language plpgsql security definer set search_path = public as $$
declare rp reports;
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  if p_status not in ('reviewing','resolved','dismissed') then raise exception 'Invalid status'; end if;
  update reports set status = p_status, admin_note = p_note,
         resolved_at = case when p_status in ('resolved','dismissed') then now() end
   where id = p_report returning * into rp;
  if not found then raise exception 'Report not found'; end if;
  if p_suspend then perform suspend_org(rp.reported_org, true, coalesce(p_note, 'Suspended after a report')); end if;
  perform log_audit('report_' || p_status, 'reports', p_report, jsonb_build_object('note', p_note, 'suspended', p_suspend));
  perform notify_org(rp.reporter_org, 'Your report was ' || p_status, coalesce(p_note, ''));
end $$;

-- Live location: NGO representative's phone calls this every few seconds
create function public.update_location(p_request uuid, p_lat numeric, p_lng numeric, p_acc numeric default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from food_requests r join organizations o on o.id = r.ngo_org_id
                  where r.id = p_request and r.status = 'accepted' and o.owner_id = auth.uid()) then
    raise exception 'Location sharing is only available during your accepted pickups'; end if;
  insert into rep_locations (request_id, lat, lng, accuracy_m) values (p_request, p_lat, p_lng, p_acc)
  on conflict (request_id) do update set lat = excluded.lat, lng = excluded.lng,
        accuracy_m = excluded.accuracy_m, updated_at = now()
   where rep_locations.updated_at < now() - interval '3 seconds';
end $$;

-- Nearby search (RLS applies: only verified, active NGOs see rows)
create function public.nearby_listings(p_lat double precision, p_lng double precision,
    p_radius_km double precision default 15, p_category text default null)
returns table (id uuid, title text, category text, quantity int, qty_reserved int, unit text,
               pickup_by timestamptz, safety_notes text, photo_path text,
               donor_org_id uuid, donor_name text, distance_km double precision)
language sql stable security invoker set search_path = public, extensions as $$
  select l.id, l.title, l.category, l.quantity, l.qty_reserved, l.unit, l.pickup_by, l.safety_notes,
         l.photo_path, o.id, o.name,
         st_distance(o.geo, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography) / 1000
    from food_listings l join organizations o on o.id = l.donor_org_id
   where l.status = 'active' and l.pickup_by > now() and l.qty_reserved < l.quantity
     and o.geo is not null and not o.suspended
     and (p_category is null or l.category = p_category)
     and st_dwithin(o.geo, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography, p_radius_km * 1000)
   order by 12 limit 100 $$;

create function public.get_leaderboard(p_kind text, p_limit int default 10)
returns table (org_id uuid, name text, donations int, units int)
language sql stable security definer set search_path = public as $$
  select o.id, o.name, count(r.id)::int, coalesce(sum(r.quantity), 0)::int
    from organizations o
    left join food_listings l on o.kind = 'donor' and l.donor_org_id = o.id
    join food_requests r on r.status = 'completed'
         and ((o.kind = 'donor' and r.listing_id = l.id) or (o.kind = 'ngo' and r.ngo_org_id = o.id))
   where o.kind = p_kind and o.verification = 'approved' and not o.suspended
   group by o.id, o.name order by 4 desc, 3 desc limit least(greatest(p_limit, 1), 50) $$;

-- Public landing-page numbers (real totals only)
create function public.public_impact() returns table (donations int, units int, donors int, ngos int)
language sql stable security definer set search_path = public as $$
  select (select count(*)::int from food_requests where status = 'completed'),
         (select coalesce(sum(quantity), 0)::int from food_requests where status = 'completed'),
         (select count(*)::int from organizations where kind = 'donor' and verification = 'approved' and not suspended),
         (select count(*)::int from organizations where kind = 'ngo'   and verification = 'approved' and not suspended) $$;

create function public.verify_certificate(p_serial text) returns table (org_name text, title text, issued_at timestamptz)
language sql stable security definer set search_path = public as $$
  select o.name, c.title, c.issued_at from certificates c join organizations o on o.id = c.org_id
   where c.serial = upper(trim(p_serial)) $$;

-- lock down every function: internal ones are not callable from the browser
revoke all on function public.log_audit(text,text,uuid,jsonb), public.notify_admins(text,text),
  public._release_request(uuid), public._withdraw_listing(uuid,text), public.award_badges(uuid),
  public.set_org_geo(), public.trg_org_registered(), public.trg_report_filed(),
  public.trg_request_guard(), public.trg_request_changed(), public.trg_message_sent()
  from public, anon, authenticated;
revoke all on function public.review_document(uuid,text,text), public.suspend_org(uuid,boolean,text),
  public.admin_withdraw_listing(uuid,text), public.resolve_report(uuid,text,text,boolean),
  public.update_location(uuid,numeric,numeric,numeric), public.nearby_listings(double precision,double precision,double precision,text),
  public.get_leaderboard(text,int), public.is_party_of_request(uuid), public.public_impact(), public.verify_certificate(text),
  public.create_request(uuid,int,uuid), public.cancel_request(uuid), public.confirm_pickup(uuid,text),
  public.review_org(uuid,boolean,text) from public, anon;
grant execute on function public.review_document(uuid,text,text), public.suspend_org(uuid,boolean,text),
  public.admin_withdraw_listing(uuid,text), public.resolve_report(uuid,text,text,boolean),
  public.update_location(uuid,numeric,numeric,numeric), public.nearby_listings(double precision,double precision,double precision,text),
  public.get_leaderboard(text,int), public.is_party_of_request(uuid),
  public.create_request(uuid,int,uuid), public.cancel_request(uuid), public.confirm_pickup(uuid,text),
  public.review_org(uuid,boolean,text) to authenticated;
grant execute on function public.public_impact(), public.verify_certificate(text) to anon, authenticated;

-- =====================================================================
-- 8. TABLE PRIVILEGES + ROW LEVEL SECURITY
-- =====================================================================
grant select on public.audit_log, public.rep_locations, public.badge_definitions,
  public.org_badges, public.certificates, public.reports, public.messages to authenticated;
grant insert (reporter_org, reported_org, request_id, reason, details) on public.reports to authenticated;
grant insert (request_id, body) on public.messages to authenticated;
grant insert (name, email, subject, message) on public.contact_messages to anon, authenticated;
grant select, update (status) on public.contact_messages to authenticated;
grant select on public.testimonials, public.faqs to anon, authenticated;
grant insert, update, delete on public.testimonials, public.faqs to authenticated;   -- admin only via RLS

alter table public.audit_log        enable row level security;
alter table public.rep_locations    enable row level security;
alter table public.badge_definitions enable row level security;
alter table public.org_badges       enable row level security;
alter table public.certificates     enable row level security;
alter table public.reports          enable row level security;
alter table public.messages         enable row level security;
alter table public.contact_messages enable row level security;
alter table public.testimonials     enable row level security;
alter table public.faqs             enable row level security;

create policy audit_read on public.audit_log for select to authenticated using (public.is_admin());

create policy loc_read on public.rep_locations for select to authenticated
  using (public.is_party_of_request(request_id) or public.is_admin());

create policy badgedef_read on public.badge_definitions for select to authenticated using (true);
create policy badges_read on public.org_badges for select to authenticated
  using (org_id = public.my_org_id() or public.is_admin() or public.i_am_approved());
create policy certs_read on public.certificates for select to authenticated
  using (org_id = public.my_org_id() or public.is_admin());

create policy reports_read on public.reports for select to authenticated
  using (reporter_org = public.my_org_id() or public.is_admin());
create policy reports_insert on public.reports for insert to authenticated
  with check (reporter_org = public.my_org_id() and reported_org <> public.my_org_id()
              and (request_id is null or public.is_party_of_request(request_id)));

create policy msgs_read on public.messages for select to authenticated
  using (public.is_party_of_request(request_id)
         or (public.is_admin() and exists (select 1 from public.reports rp where rp.request_id = messages.request_id)));
create policy msgs_insert on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and public.is_party_of_request(request_id)
              and exists (select 1 from public.food_requests r where r.id = request_id
                          and r.status in ('pending','accepted','completed')));

create policy contact_insert on public.contact_messages for insert to anon, authenticated
  with check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');
create policy contact_admin_read   on public.contact_messages for select to authenticated using (public.is_admin());
create policy contact_admin_update on public.contact_messages for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy testi_public on public.testimonials for select to anon, authenticated
  using (published or public.is_admin());
create policy testi_admin  on public.testimonials for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy faqs_public  on public.faqs for select to anon, authenticated
  using (published or public.is_admin());
create policy faqs_admin   on public.faqs for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- =====================================================================
-- 9. STORAGE: listing photos and organisation logos (public read, own-folder write)
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('listing-photos', 'listing-photos', true, 2097152, array['image/jpeg','image/png','image/webp']),
  ('org-logos',      'org-logos',      true, 1048576, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy photos_write on storage.objects for insert to authenticated
  with check (bucket_id in ('listing-photos','org-logos') and (storage.foldername(name))[1] = auth.uid()::text);
create policy photos_update on storage.objects for update to authenticated
  using (bucket_id in ('listing-photos','org-logos') and (storage.foldername(name))[1] = auth.uid()::text);
create policy photos_delete on storage.objects for delete to authenticated
  using (bucket_id in ('listing-photos','org-logos') and (storage.foldername(name))[1] = auth.uid()::text);

-- =====================================================================
-- 10. REALTIME
-- =====================================================================
alter publication supabase_realtime add table public.rep_locations, public.messages;

-- =====================================================================
-- 11. SEED DATA (settings only, no fake stats or testimonials)
-- =====================================================================
insert into public.badge_definitions (code, applies_to, name, metric, threshold) values
  ('first_donation',    'donor', 'First donation',         'donations', 1),
  ('regular_giver',     'donor', 'Regular giver',          'donations', 5),
  ('steady_supporter',  'donor', 'Steady supporter',       'donations', 25),
  ('hundred_units',     'donor', '100 units donated',      'units',     100),
  ('five_hundred_units','donor', '500 units donated',      'units',     500),
  ('ten_partners',      'donor', '10 NGOs served',         'partners',  10),
  ('first_pickup',      'ngo',   'First pickup',           'donations', 1),
  ('regular_receiver',  'ngo',   'Regular receiver',       'donations', 5),
  ('hundred_received',  'ngo',   '100 units received',     'units',     100),
  ('ten_donors',        'ngo',   '10 donors partnered',    'partners',  10);

insert into public.faqs (question, answer, sort_order) values
  ('Who can donate?', 'Restaurants, hotels, canteens, event organisers, food businesses and community kitchens with surplus edible food.', 1),
  ('Who can receive food?', 'Verified NGOs, shelters, community kitchens and eligible local community organisations.', 2),
  ('Does AnnSetu provide delivery?', 'No. NGOs send their own representatives to collect food from the donor.', 3),
  ('How is food safety handled?', 'Listings carry preparation and safe-until details, and expired food stays out of active discovery.', 4),
  ('How does verification work?', 'Organisations upload documents, which are checked and then approved by a human admin.', 5),
  ('How do donors earn certificates?', 'By completing confirmed donations; milestones unlock certificates and badges.', 6),
  ('Are donations tax-deductible?', 'That depends on local law and the receiving organisation''s status. Please consult a tax professional.', 7),
  ('How can NGOs request food?', 'Browse nearby listings, request a quantity, and coordinate pickup once the donor accepts.', 8);

-- Optional: schedule expiry every 10 min (enable pg_cron first)
-- select cron.schedule('expire-listings','*/10 * * * *','select public.expire_listings()');
