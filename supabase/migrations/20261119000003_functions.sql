-- Business rules as security-definer functions. Every function pins search_path = '' and
-- checks the caller explicitly. Errors use SQLSTATE P0001 with a user-readable message.

-- ───────────────────────── internal helpers ─────────────────────────
create or replace function private.add_business_days(p_from timestamptz, p_days integer)
returns timestamptz language plpgsql immutable set search_path = '' as $$
declare
  v timestamptz := p_from;
  n integer := 0;
begin
  while n < p_days loop
    v := v + interval '1 day';
    if extract(isodow from v) < 6 then n := n + 1; end if;
  end loop;
  return v;
end $$;

-- in-app notification (respecting preferences) + queued email job
create or replace function private.notify(
  p_user uuid, p_category text, p_title text, p_body text default null, p_link text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_in_app boolean := true;
  v_email boolean := true;
begin
  if p_user is null then return; end if;
  select coalesce(in_app, true), coalesce(email, true) into v_in_app, v_email
  from public.notification_preferences where user_id = p_user and category = p_category;
  v_in_app := coalesce(v_in_app, true);
  v_email := coalesce(v_email, true);
  if v_in_app then
    insert into public.notifications (user_id, category, title, body, link)
    values (p_user, p_category, p_title, p_body, p_link);
  end if;
  if v_email then
    insert into public.jobs (kind, payload)
    values ('email', jsonb_build_object('user_id', p_user, 'category', p_category,
                                        'title', p_title, 'body', p_body, 'link', p_link));
  end if;
end $$;

create or replace function private.notify_org(
  p_org uuid, p_category text, p_title text, p_body text default null, p_link text default null)
returns void language sql security definer set search_path = '' as $$
  select private.notify(o.owner_id, p_category, p_title, p_body, p_link)
  from public.organizations o where o.id = p_org;
$$;

create or replace function private.notify_admins(p_category text, p_title text, p_body text default null, p_link text default null)
returns void language sql security definer set search_path = '' as $$
  select private.notify(p.id, p_category, p_title, p_body, p_link)
  from public.profiles p where p.role = 'admin';
$$;

create or replace function private.audit(
  p_action text, p_table text, p_target_id text, p_target_label text,
  p_diff jsonb default null, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_name text; v_email text; v_role text;
begin
  select p.full_name, u.email, p.role::text into v_name, v_email, v_role
  from public.profiles p left join auth.users u on u.id = p.id
  where p.id = (select auth.uid());
  insert into public.audit_log (actor_id, actor_name, actor_email, actor_role, action,
                                target_table, target_id, target_label, diff, note, ip_hash)
  values ((select auth.uid()), v_name, v_email, v_role, p_action, p_table, p_target_id, p_target_label,
          p_diff, p_note, nullif(current_setting('request.headers', true)::jsonb ->> 'x-ip-hash', ''));
end $$;

create or replace function private.log_activity(
  p_action text, p_org uuid, p_table text, p_target_id text, p_data jsonb default null)
returns void language sql security definer set search_path = '' as $$
  insert into public.activity_log (actor_id, org_id, action, target_table, target_id, data)
  values ((select auth.uid()), p_org, p_action, p_table, p_target_id, p_data);
$$;

create or replace function private.require_admin()
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
end $$;

create or replace function private.random_otp()
returns text language sql volatile set search_path = '' as $$
  select lpad(((('x' || encode(extensions.gen_random_bytes(2), 'hex'))::bit(16)::integer) % 10000)::text, 4, '0');
$$;

create or replace function private.fmt_time(p_ts timestamptz)
returns text language sql stable set search_path = '' as $$
  select to_char(p_ts at time zone 'Asia/Kolkata', 'FMHH12:MI AM');
$$;

-- keep listing status consistent with its quantities and deadline
create or replace function private.refresh_listing_status(p_listing uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare l public.food_listings;
begin
  select * into l from public.food_listings where id = p_listing for update;
  if not found or l.status = 'withdrawn' then return; end if;
  if l.qty_collected >= l.qty_total then
    update public.food_listings set status = 'completed' where id = l.id;
  elsif l.pickup_by <= now() then
    update public.food_listings
      set status = case when l.qty_reserved > 0 then 'reserved'
                        when l.qty_collected > 0 then 'completed'
                        else 'expired' end::public.listing_status
      where id = l.id;
  elsif l.qty_total - l.qty_reserved - l.qty_collected <= 0 then
    update public.food_listings set status = 'reserved' where id = l.id;
  else
    update public.food_listings set status = 'active' where id = l.id;
  end if;
end $$;

-- end a pickup's live state: OTP, magic links, location
create or replace function private.close_pickup_state(p_request uuid)
returns void language sql security definer set search_path = '' as $$
  delete from public.pickup_otps where request_id = p_request;
  update public.rep_access_tokens set revoked_at = now() where request_id = p_request and revoked_at is null;
  delete from public.rep_locations where request_id = p_request;
$$;

-- release one open request (pending or accepted) with a final status
create or replace function private.release_request(p_request uuid, p_status public.request_status, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.food_requests;
begin
  select * into r from public.food_requests where id = p_request for update;
  if not found or r.status not in ('pending', 'accepted') then return; end if;
  if r.status = 'accepted' then
    update public.food_listings set qty_reserved = greatest(qty_reserved - r.qty, 0) where id = r.listing_id;
  end if;
  update public.food_requests set status = p_status, response_note = coalesce(p_note, response_note) where id = r.id;
  perform private.close_pickup_state(r.id);
  insert into public.pickup_events (request_id, actor_id, event, data)
  values (r.id, (select auth.uid()), p_status::text, jsonb_build_object('note', p_note));
  perform private.refresh_listing_status(r.listing_id);
end $$;

-- milestones: badges + certificates for an organisation
create or replace function private.award_milestones(p_org uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  o public.organizations;
  v_pickups numeric; v_units numeric; v_partners numeric; v_years numeric;
  b record;
begin
  select * into o from public.organizations where id = p_org;
  if not found then return; end if;
  if o.kind = 'donor' then
    select count(*), coalesce(sum(r.qty), 0), count(distinct r.receiver_org_id)
      into v_pickups, v_units, v_partners
    from public.food_requests r join public.food_listings l on l.id = r.listing_id
    where l.donor_org_id = p_org and r.status = 'completed';
  else
    select count(*), coalesce(sum(r.qty), 0), count(distinct l.donor_org_id)
      into v_pickups, v_units, v_partners
    from public.food_requests r join public.food_listings l on l.id = r.listing_id
    where r.receiver_org_id = p_org and r.status = 'completed';
  end if;
  v_years := coalesce(extract(epoch from now() - o.verified_at) / 31557600, 0);

  for b in
    select * from public.badge_definitions d
    where d.audience in (o.kind::text, 'both')
      and not exists (select 1 from public.org_badges ob where ob.org_id = p_org and ob.badge_code = d.code)
      and case d.metric when 'pickups' then v_pickups when 'units' then v_units
                        when 'partners' then v_partners else v_years end >= d.threshold
  loop
    insert into public.org_badges (org_id, badge_code) values (p_org, b.code);
    if b.issues_certificate then
      insert into public.certificates (serial, org_id, badge_code, org_name_snapshot)
      values ('AS-' || to_char(now(), 'YYYY') || '-' || upper(encode(extensions.gen_random_bytes(4), 'hex')),
              p_org, b.code, o.name);
      insert into public.jobs (kind, payload)
      values ('certificate_pdf', jsonb_build_object('org_id', p_org, 'badge_code', b.code));
    end if;
    perform private.notify(o.owner_id, 'certificate', 'New milestone: ' || b.name, b.description, '/dashboard/impact');
  end loop;
end $$;

create or replace function private.award_rep_badges(p_rep uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  select count(*) into v_count from public.food_requests where rep_id = p_rep and status = 'completed';
  insert into public.rep_badges (rep_id, badge_code)
  select p_rep, d.code from public.badge_definitions d
  where d.audience = 'representative' and d.metric = 'pickups' and v_count >= d.threshold
  on conflict do nothing;
end $$;

-- ───────────────────────── triggers ─────────────────────────
-- new auth user → profile (role from sign-up metadata when it is donor or ngo)
create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id,
          left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'), 120),
          case when new.raw_user_meta_data ->> 'role' in ('donor', 'ngo')
               then (new.raw_user_meta_data ->> 'role')::public.user_role end)
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- new listing: server-controlled fields
create or replace function private.prepare_listing()
returns trigger language plpgsql security definer set search_path = '' as $$
declare p text;
begin
  new.status := 'active';
  new.qty_reserved := 0;
  new.qty_collected := 0;
  new.withdrawn_reason := null;
  select location into new.location from public.organizations where id = new.donor_org_id;
  if new.pickup_by < now() + interval '15 minutes' then
    raise exception 'The pickup deadline must be at least 15 minutes from now' using errcode = 'P0001';
  end if;
  foreach p in array new.photos loop
    if p not like new.donor_org_id::text || '/%' then
      raise exception 'Invalid photo path' using errcode = 'P0001';
    end if;
  end loop;
  return new;
end $$;
create trigger food_listings_prepare before insert on public.food_listings
  for each row execute function private.prepare_listing();

-- new document → queued AI review
create or replace function private.queue_document_review()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.document_ai_reviews (document_id, org_id) values (new.id, new.org_id);
  insert into public.jobs (kind, payload) values ('ai_document_review', jsonb_build_object('document_id', new.id));
  return new;
end $$;
create trigger verification_documents_queue after insert on public.verification_documents
  for each row execute function private.queue_document_review();

-- ───────────────────────── account & onboarding ─────────────────────────
create or replace function public.set_my_role(p_role public.user_role)
returns void language plpgsql security definer set search_path = '' as $$
declare v_current public.user_role;
begin
  if (select auth.uid()) is null then raise exception 'Not signed in' using errcode = '42501'; end if;
  if p_role not in ('donor', 'ngo') then
    raise exception 'You can only choose Donor or Receiver' using errcode = 'P0001';
  end if;
  select role into v_current from public.profiles where id = (select auth.uid());
  if v_current in ('representative', 'admin') then
    raise exception 'This account''s role cannot be changed' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.organizations where owner_id = (select auth.uid())) then
    raise exception 'Your role is locked because your organisation already exists' using errcode = 'P0001';
  end if;
  update public.profiles set role = p_role where id = (select auth.uid());
end $$;

-- validates the compulsory profile wizard and submits the organisation for verification
create or replace function public.complete_my_profile()
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare o public.organizations; v_missing text[] := '{}';
begin
  select * into o from public.organizations where owner_id = (select auth.uid()) for update;
  if not found then raise exception 'Create your organisation first' using errcode = 'P0001'; end if;
  if coalesce(o.contact_person, '') = '' then v_missing := array_append(v_missing, 'contact person'::text); end if;
  if o.phone is null then v_missing := array_append(v_missing, 'phone'::text); end if;
  if o.email is null then v_missing := array_append(v_missing, 'email'::text); end if;
  if coalesce(o.address, '') = '' then v_missing := array_append(v_missing, 'address'::text); end if;
  if coalesce(o.city, '') = '' then v_missing := array_append(v_missing, 'city'::text); end if;
  if coalesce(o.state, '') = '' then v_missing := array_append(v_missing, 'state'::text); end if;
  if o.pincode is null then v_missing := array_append(v_missing, 'pincode'::text); end if;
  if o.location is null then v_missing := array_append(v_missing, 'map location'::text); end if;
  if char_length(coalesce(o.about, '')) < 40 then v_missing := array_append(v_missing, 'about (at least 40 characters)'::text); end if;
  if o.operating_hours = '{}'::jsonb then v_missing := array_append(v_missing, 'operating hours'::text); end if;
  if jsonb_array_length(o.pickup_windows) = 0 then v_missing := array_append(v_missing, 'pickup windows'::text); end if;
  if o.kind = 'ngo' and coalesce(o.area_served, '') = '' then v_missing := array_append(v_missing, 'area served'::text); end if;
  if o.kind = 'ngo' and o.beneficiaries_per_day is null then v_missing := array_append(v_missing, 'beneficiaries per day'::text); end if;
  if o.no_certificate and char_length(coalesce(o.no_cert_explanation, '')) < 50 then
    v_missing := array_append(v_missing, 'explanation (at least 50 characters)'::text);
  end if;
  if cardinality(v_missing) > 0 then
    raise exception 'Please complete: %', array_to_string(v_missing, ', ') using errcode = 'P0001';
  end if;

  update public.organizations
    set profile_completed_at = coalesce(profile_completed_at, now()),
        review_due_at = case when no_certificate then coalesce(review_due_at, private.add_business_days(now(), 5)) end,
        status = case when status = 'rejected' then 'pending'::public.org_status else status end
    where id = o.id;
  if o.no_certificate then
    insert into public.jobs (kind, payload) values ('ai_no_cert_summary', jsonb_build_object('org_id', o.id));
  end if;
  perform private.notify_admins('verification', 'New organisation awaiting verification', o.name, '/admin/verification');
  perform private.log_activity('profile_completed', o.id, 'organizations', o.id::text);
  return now();
end $$;

-- ───────────────────────── listings ─────────────────────────
create or replace function public.withdraw_listing(p_listing uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare l public.food_listings; r record;
begin
  select * into l from public.food_listings where id = p_listing for update;
  if not found or l.donor_org_id is distinct from private.my_org_id() then
    raise exception 'Listing not found' using errcode = 'P0002';
  end if;
  if l.status <> 'active' or l.qty_reserved > 0 then
    raise exception 'A listing can only be withdrawn while nothing is reserved' using errcode = 'P0001';
  end if;
  for r in select id, receiver_org_id from public.food_requests where listing_id = l.id and status = 'pending' loop
    perform private.release_request(r.id, 'rejected', 'The donor withdrew this listing');
    perform private.notify_org(r.receiver_org_id, 'request', 'Listing withdrawn', l.title, '/dashboard/requests');
  end loop;
  update public.food_listings set status = 'withdrawn', withdrawn_reason = left(p_reason, 300) where id = l.id;
  perform private.log_activity('listing_withdrawn', l.donor_org_id, 'food_listings', l.id::text);
end $$;

-- discovery for verified receivers: distance from the caller's organisation
create or replace function public.discover_listings(
  p_radius_km numeric default 30, p_category text default null, p_search text default null,
  p_sort text default 'pickup_soonest', p_limit integer default 24, p_offset integer default 0)
returns table (
  id uuid, title text, category text, qty_total numeric, qty_available numeric, unit public.food_unit,
  pickup_by timestamptz, prepared_at timestamptz, photos text[], diet public.diet_type, allergens text[],
  safety_notes text, donor_org_id uuid, donor_name text, donor_city text, distance_km numeric, created_at timestamptz)
language sql stable security invoker set search_path = '' as $$
  with me as (select location from public.organizations where owner_id = (select auth.uid()))
  select l.id, l.title, l.category, l.qty_total, l.qty_total - l.qty_reserved - l.qty_collected,
         l.unit, l.pickup_by, l.prepared_at, l.photos, l.diet, l.allergens, l.safety_notes,
         o.id, o.name, o.city,
         round((extensions.st_distance(l.location, me.location) / 1000)::numeric, 1),
         l.created_at
  from public.food_listings l
  join public.organizations o on o.id = l.donor_org_id
  cross join me
  where l.status = 'active' and l.pickup_by > now()
    and (p_category is null or l.category = p_category)
    and (p_search is null or l.title ilike '%' || p_search || '%' or o.name ilike '%' || p_search || '%')
    and (p_radius_km is null or me.location is null or l.location is null
         or extensions.st_dwithin(l.location, me.location, p_radius_km * 1000))
  order by
    case when p_sort = 'pickup_soonest' then l.pickup_by end asc,
    case when p_sort = 'most_available' then l.qty_total - l.qty_reserved - l.qty_collected end desc,
    case when p_sort = 'newest' then l.created_at end desc,
    case when p_sort = 'nearest' then extensions.st_distance(l.location, me.location) end asc,
    l.pickup_by asc
  limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0);
$$;

-- privacy-safe preview for signed-out visitors
create or replace function public.public_listings_preview(p_limit integer default 12)
returns table (id uuid, title text, category text, qty_available numeric, unit public.food_unit,
               pickup_by timestamptz, donor_name text, city text)
language sql stable security definer set search_path = '' as $$
  select l.id, l.title, l.category, l.qty_total - l.qty_reserved - l.qty_collected, l.unit,
         l.pickup_by, o.name, o.city
  from public.food_listings l join public.organizations o on o.id = l.donor_org_id
  where l.status = 'active' and l.pickup_by > now() and o.status = 'approved'
  order by l.pickup_by asc
  limit least(greatest(p_limit, 1), 24);
$$;

-- ───────────────────────── requests & pickups ─────────────────────────
create or replace function public.create_request(
  p_listing uuid, p_qty numeric, p_rep uuid, p_note text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_org public.organizations; l public.food_listings; v_rep public.representatives;
  v_donor public.organizations; v_available numeric; v_id uuid;
begin
  select * into v_org from public.organizations where owner_id = (select auth.uid());
  if not found or v_org.kind <> 'ngo' or v_org.status <> 'approved' then
    raise exception 'Only verified receiver organisations can request food' using errcode = '42501';
  end if;
  select * into l from public.food_listings where id = p_listing for update;
  if not found then raise exception 'Listing not found' using errcode = 'P0002'; end if;
  if l.status <> 'active' or l.pickup_by <= now() then
    raise exception 'This listing is no longer available' using errcode = 'P0001';
  end if;
  select * into v_donor from public.organizations where id = l.donor_org_id;
  if v_donor.status <> 'approved' then
    raise exception 'This donor is not currently active' using errcode = 'P0001';
  end if;
  select * into v_rep from public.representatives where id = p_rep;
  if not found or v_rep.org_id <> v_org.id or v_rep.status <> 'active' then
    raise exception 'Choose an active representative from your organisation' using errcode = 'P0001';
  end if;
  v_available := l.qty_total - l.qty_reserved - l.qty_collected;
  if p_qty is null or p_qty < 1 or p_qty > v_available then
    raise exception 'Quantity must be between 1 and % %', v_available, l.unit using errcode = 'P0001';
  end if;
  if exists (select 1 from public.food_requests
             where listing_id = l.id and receiver_org_id = v_org.id and status = 'pending') then
    raise exception 'You already have a pending request for this listing' using errcode = 'P0001';
  end if;

  insert into public.food_requests (listing_id, receiver_org_id, rep_id, qty, rep_name, rep_phone, note)
  values (l.id, v_org.id, v_rep.id, p_qty, v_rep.name, v_rep.phone, left(p_note, 500))
  returning id into v_id;
  insert into public.pickup_events (request_id, actor_id, event, data)
  values (v_id, (select auth.uid()), 'requested', jsonb_build_object('qty', p_qty));
  perform private.notify_org(l.donor_org_id, 'request', 'New request from ' || v_org.name,
    p_qty || ' ' || l.unit || ' of ' || l.title, '/dashboard/requests');
  perform private.log_activity('request_created', v_org.id, 'food_requests', v_id::text);
  return v_id;
end $$;

create or replace function public.respond_request(p_request uuid, p_accept boolean, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.food_requests; l public.food_listings; v_available numeric; v_rep_user uuid;
begin
  select * into r from public.food_requests where id = p_request for update;
  if not found then raise exception 'Request not found' using errcode = 'P0002'; end if;
  select * into l from public.food_listings where id = r.listing_id for update;
  if l.donor_org_id is distinct from private.my_org_id() then
    raise exception 'Request not found' using errcode = 'P0002';
  end if;
  if r.status <> 'pending' then
    raise exception 'This request has already been answered' using errcode = 'P0001';
  end if;
  select user_id into v_rep_user from public.representatives where id = r.rep_id;

  if p_accept then
    if l.status <> 'active' or l.pickup_by <= now() then
      raise exception 'This listing is no longer available' using errcode = 'P0001';
    end if;
    v_available := l.qty_total - l.qty_reserved - l.qty_collected;
    if r.qty > v_available then
      raise exception 'Only % % left; ask the receiver to request less', v_available, l.unit using errcode = 'P0001';
    end if;
    update public.food_listings set qty_reserved = qty_reserved + r.qty where id = l.id;
    update public.food_requests
      set status = 'accepted', responded_at = now(), response_note = left(p_note, 500)
      where id = r.id;
    insert into public.pickup_otps (request_id, code, expires_at)
    values (r.id, private.random_otp(), l.pickup_by + interval '2 hours');
    perform private.refresh_listing_status(l.id);
    insert into public.pickup_events (request_id, actor_id, event) values (r.id, (select auth.uid()), 'accepted');
    insert into public.jobs (kind, payload) values ('rep_magic_link', jsonb_build_object('request_id', r.id));
    perform private.notify_org(r.receiver_org_id, 'request', 'Request accepted',
      l.title || ': collect by ' || private.fmt_time(l.pickup_by), '/dashboard/pickups');
    perform private.notify(v_rep_user, 'pickup', 'New pickup assigned',
      l.title || ': collect by ' || private.fmt_time(l.pickup_by), '/rep');
  else
    update public.food_requests
      set status = 'rejected', responded_at = now(), response_note = left(p_note, 500)
      where id = r.id;
    insert into public.pickup_events (request_id, actor_id, event, data)
    values (r.id, (select auth.uid()), 'rejected', jsonb_build_object('note', p_note));
    perform private.notify_org(r.receiver_org_id, 'request', 'Request declined', l.title, '/dashboard/requests');
  end if;
  perform private.log_activity(case when p_accept then 'request_accepted' else 'request_rejected' end,
                               l.donor_org_id, 'food_requests', r.id::text);
end $$;

create or replace function public.cancel_request(p_request uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.food_requests; l public.food_listings;
begin
  select * into r from public.food_requests where id = p_request;
  if not found or r.receiver_org_id is distinct from private.my_org_id() then
    raise exception 'Request not found' using errcode = 'P0002';
  end if;
  if r.status not in ('pending', 'accepted') then
    raise exception 'Only pending or accepted requests can be cancelled' using errcode = 'P0001';
  end if;
  select * into l from public.food_listings where id = r.listing_id;
  perform private.release_request(r.id, 'cancelled', null);
  perform private.notify_org(l.donor_org_id, 'request', 'Request cancelled', l.title, '/dashboard/requests');
  perform private.log_activity('request_cancelled', r.receiver_org_id, 'food_requests', r.id::text);
end $$;

create or replace function public.reassign_representative(p_request uuid, p_rep uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.food_requests; v_rep public.representatives;
begin
  select * into r from public.food_requests where id = p_request for update;
  if not found or r.receiver_org_id is distinct from private.my_org_id() then
    raise exception 'Request not found' using errcode = 'P0002';
  end if;
  if r.status not in ('pending', 'accepted') then
    raise exception 'This pickup can no longer be reassigned' using errcode = 'P0001';
  end if;
  select * into v_rep from public.representatives where id = p_rep;
  if not found or v_rep.org_id <> r.receiver_org_id or v_rep.status <> 'active' then
    raise exception 'Choose an active representative from your organisation' using errcode = 'P0001';
  end if;
  update public.food_requests
    set rep_id = v_rep.id, rep_name = v_rep.name, rep_phone = v_rep.phone, timeline_status = 'assigned', eta = null
    where id = r.id;
  update public.rep_access_tokens set revoked_at = now() where request_id = r.id and revoked_at is null;
  delete from public.rep_locations where request_id = r.id;
  insert into public.pickup_events (request_id, actor_id, event, data)
  values (r.id, (select auth.uid()), 'rep_reassigned', jsonb_build_object('rep_name', v_rep.name));
  if r.status = 'accepted' then
    insert into public.jobs (kind, payload) values ('rep_magic_link', jsonb_build_object('request_id', r.id));
    perform private.notify(v_rep.user_id, 'pickup', 'New pickup assigned', null, '/rep');
  end if;
end $$;

-- the OTP is visible only to the receiver organisation and its assigned representative
create or replace function public.get_pickup_otp(p_request uuid)
returns text language plpgsql stable security definer set search_path = '' as $$
declare r public.food_requests; v_code text;
begin
  select * into r from public.food_requests where id = p_request;
  if not found or r.status <> 'accepted' then return null; end if;
  if r.receiver_org_id is distinct from private.my_org_id()
     and not exists (select 1 from public.representatives
                     where id = r.rep_id and user_id = (select auth.uid()) and status = 'active') then
    raise exception 'Request not found' using errcode = 'P0002';
  end if;
  select code into v_code from public.pickup_otps where request_id = r.id and expires_at > now();
  return v_code;
end $$;

-- donor confirms collection with the 4-digit code (5 attempts, expiry). Wrong codes return
-- instead of raising so the attempt counter is committed.
create or replace function public.confirm_pickup(p_request uuid, p_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r public.food_requests; l public.food_listings; v_otp public.pickup_otps;
begin
  select * into r from public.food_requests where id = p_request for update;
  if not found then raise exception 'Request not found' using errcode = 'P0002'; end if;
  select * into l from public.food_listings where id = r.listing_id for update;
  if l.donor_org_id is distinct from private.my_org_id() then
    raise exception 'Request not found' using errcode = 'P0002';
  end if;
  if r.status <> 'accepted' then
    raise exception 'This pickup is not awaiting collection' using errcode = 'P0001';
  end if;
  select * into v_otp from public.pickup_otps where request_id = r.id for update;
  if not found or v_otp.expires_at <= now() then
    return jsonb_build_object('ok', false, 'reason', 'expired', 'attempts_left', 0);
  end if;
  if v_otp.attempts >= 5 then
    return jsonb_build_object('ok', false, 'reason', 'locked', 'attempts_left', 0);
  end if;
  if v_otp.code <> coalesce(p_code, '') then
    update public.pickup_otps set attempts = attempts + 1 where request_id = r.id;
    insert into public.pickup_events (request_id, actor_id, event) values (r.id, (select auth.uid()), 'otp_failed');
    return jsonb_build_object('ok', false, 'reason', 'wrong_code', 'attempts_left', 4 - v_otp.attempts);
  end if;

  update public.food_listings
    set qty_reserved = greatest(qty_reserved - r.qty, 0), qty_collected = qty_collected + r.qty
    where id = l.id;
  update public.food_requests
    set status = 'completed', completed_at = now(), timeline_status = 'collected'
    where id = r.id;
  perform private.close_pickup_state(r.id);
  perform private.refresh_listing_status(l.id);
  insert into public.pickup_events (request_id, actor_id, event) values (r.id, (select auth.uid()), 'collected');
  perform private.award_milestones(l.donor_org_id);
  perform private.award_milestones(r.receiver_org_id);
  if r.rep_id is not null then perform private.award_rep_badges(r.rep_id); end if;
  perform private.notify_org(r.receiver_org_id, 'pickup', 'Pickup completed', l.title, '/dashboard/pickups');
  perform private.notify_org(l.donor_org_id, 'pickup', 'Pickup completed', l.title, '/dashboard/pickups');
  perform private.log_activity('pickup_confirmed', l.donor_org_id, 'food_requests', r.id::text);
  return jsonb_build_object('ok', true);
end $$;

-- representative status: shared by account reps and magic-link reps
create or replace function private.apply_rep_status(
  p_request uuid, p_rep uuid, p_status public.timeline_status, p_eta timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.food_requests; l public.food_listings; v_msg text;
begin
  select * into r from public.food_requests where id = p_request for update;
  if not found or r.rep_id is distinct from p_rep then
    raise exception 'Pickup not found' using errcode = 'P0002';
  end if;
  select * into l from public.food_listings where id = r.listing_id;
  if p_status = 'collected' then
    raise exception 'Collected is recorded when the donor confirms the code' using errcode = 'P0001';
  elsif p_status = 'delivered' then
    if r.status <> 'completed' then
      raise exception 'Mark delivered after the pickup is collected' using errcode = 'P0001';
    end if;
  elsif r.status <> 'accepted' then
    raise exception 'This pickup is not active' using errcode = 'P0001';
  elsif p_status = 'on_the_way' then
    if p_eta is null or p_eta < now() - interval '5 minutes' or p_eta > now() + interval '12 hours' then
      raise exception 'Set a realistic arrival time' using errcode = 'P0001';
    end if;
  elsif p_status = 'arrived' then
    if r.timeline_status not in ('assigned', 'on_the_way', 'arrived') then
      raise exception 'Invalid status change' using errcode = 'P0001';
    end if;
  elsif p_status = 'assigned' then
    raise exception 'Invalid status change' using errcode = 'P0001';
  end if;

  update public.food_requests
    set timeline_status = p_status, eta = case when p_status = 'on_the_way' then p_eta else eta end
    where id = r.id;
  update public.representatives set last_active_at = now() where id = p_rep;
  insert into public.pickup_events (request_id, actor_id, event, data)
  values (r.id, (select auth.uid()), p_status::text, jsonb_build_object('eta', p_eta));

  v_msg := case p_status
    when 'on_the_way' then coalesce(r.rep_name, 'The representative') || ' is on the way, ETA ' || private.fmt_time(p_eta)
    when 'arrived' then coalesce(r.rep_name, 'The representative') || ' has arrived for pickup'
    when 'delivered' then 'Food delivered to the community'
  end;
  perform private.notify_org(l.donor_org_id, 'pickup', v_msg, l.title, '/dashboard/pickups');
  perform private.notify_org(r.receiver_org_id, 'pickup', v_msg, l.title, '/dashboard/pickups');
  perform private.log_activity('rep_status_' || p_status::text, r.receiver_org_id, 'food_requests', r.id::text);
end $$;

create or replace function public.update_rep_status(
  p_request uuid, p_status public.timeline_status, p_eta timestamptz default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_rep uuid;
begin
  v_rep := private.my_rep_id();
  if v_rep is null then raise exception 'Representative access required' using errcode = '42501'; end if;
  perform private.apply_rep_status(p_request, v_rep, p_status, p_eta);
end $$;

-- magic-link path: FastAPI (service role) passes the raw token; only its hash is stored
create or replace function public.update_rep_status_by_token(
  p_token text, p_status public.timeline_status, p_eta timestamptz default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare t public.rep_access_tokens;
begin
  select * into t from public.rep_access_tokens
  where token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
    and revoked_at is null and expires_at > now();
  if not found then raise exception 'This link has expired' using errcode = '42501'; end if;
  perform private.apply_rep_status(t.request_id, t.rep_id, p_status, p_eta);
  return t.request_id;
end $$;

-- issue a single-pickup magic link (service role); returns the raw token once
create or replace function public.issue_rep_access_token(p_request uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare r public.food_requests; l public.food_listings; v_token text;
begin
  select * into r from public.food_requests where id = p_request;
  if not found or r.status <> 'accepted' or r.rep_id is null then
    raise exception 'Pickup not eligible for a link' using errcode = 'P0001';
  end if;
  select * into l from public.food_listings where id = r.listing_id;
  update public.rep_access_tokens set revoked_at = now() where request_id = r.id and revoked_at is null;
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.rep_access_tokens (request_id, rep_id, token_hash, expires_at)
  values (r.id, r.rep_id, encode(sha256(convert_to(v_token, 'UTF8')), 'hex'), l.pickup_by + interval '2 hours');
  return v_token;
end $$;

-- live location: only the assigned rep, only during an active pickup
create or replace function public.update_rep_location(
  p_request uuid, p_lat double precision, p_lng double precision, p_accuracy numeric default null)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.food_requests; v_rep uuid;
begin
  v_rep := private.my_rep_id();
  select * into r from public.food_requests where id = p_request;
  if v_rep is null or not found or r.rep_id is distinct from v_rep then
    raise exception 'Pickup not found' using errcode = 'P0002';
  end if;
  if r.status <> 'accepted' or r.timeline_status not in ('on_the_way', 'arrived') then
    raise exception 'Location sharing is only available during an active trip' using errcode = 'P0001';
  end if;
  if p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'Invalid coordinates' using errcode = 'P0001';
  end if;
  insert into public.rep_locations (request_id, rep_id, point, accuracy_m, recorded_at)
  values (r.id, v_rep, extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography,
          p_accuracy, now())
  on conflict (request_id) do update
    set point = excluded.point, accuracy_m = excluded.accuracy_m, recorded_at = excluded.recorded_at;
end $$;

create or replace function public.stop_rep_location(p_request uuid)
returns void language sql security definer set search_path = '' as $$
  delete from public.rep_locations where request_id = p_request and rep_id = private.my_rep_id();
$$;

-- scheduled: expire listings and stale requests (every 10 minutes)
create or replace function public.expire_listings()
returns integer language plpgsql security definer set search_path = '' as $$
declare r record; v_count integer := 0;
begin
  for r in
    select fr.id from public.food_requests fr join public.food_listings l on l.id = fr.listing_id
    where (fr.status = 'pending' and l.pickup_by <= now())
       or (fr.status = 'accepted' and l.pickup_by + interval '2 hours' <= now())
  loop
    perform private.release_request(r.id, 'expired', 'Pickup window ended');
    v_count := v_count + 1;
  end loop;
  for r in select id from public.food_listings where status in ('active', 'reserved') and pickup_by <= now() loop
    perform private.refresh_listing_status(r.id);
  end loop;
  return v_count;
end $$;

-- ───────────────────────── admin ─────────────────────────
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_admin();
$$;

create or replace function public.admin_review_org(p_org uuid, p_approve boolean, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare o public.organizations;
begin
  perform private.require_admin();
  select * into o from public.organizations where id = p_org for update;
  if not found then raise exception 'Organisation not found' using errcode = 'P0002'; end if;
  if not p_approve and char_length(coalesce(trim(p_note), '')) < 5 then
    raise exception 'A rejection note is required' using errcode = 'P0001';
  end if;
  if p_approve then
    update public.organizations
      set status = 'approved', verified_at = now(), verified_by = (select auth.uid()), rejection_note = null
      where id = p_org;
    perform private.notify(o.owner_id, 'verification', 'Your organisation is verified',
      'You can now ' || case when o.kind = 'donor' then 'list surplus food.' else 'request food.' end, '/dashboard');
  else
    update public.organizations set status = 'rejected', rejection_note = p_note where id = p_org;
    perform private.notify(o.owner_id, 'verification', 'Verification needs attention', p_note, '/dashboard/profile');
  end if;
  perform private.audit(case when p_approve then 'org_approved' else 'org_rejected' end,
    'organizations', p_org::text, o.name,
    jsonb_build_object('status', jsonb_build_object('from', o.status,
                       'to', case when p_approve then 'approved' else 'rejected' end)), p_note);
end $$;

create or replace function public.admin_review_document(p_doc uuid, p_approve boolean, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare d public.verification_documents; v_org public.organizations;
begin
  perform private.require_admin();
  select * into d from public.verification_documents where id = p_doc for update;
  if not found then raise exception 'Document not found' using errcode = 'P0002'; end if;
  if not p_approve and char_length(coalesce(trim(p_note), '')) < 5 then
    raise exception 'A rejection note is required' using errcode = 'P0001';
  end if;
  select * into v_org from public.organizations where id = d.org_id;
  update public.verification_documents
    set status = case when p_approve then 'approved' else 'rejected' end::public.doc_status,
        admin_note = p_note, reviewed_by = (select auth.uid()), reviewed_at = now()
    where id = p_doc;
  perform private.notify(v_org.owner_id, 'verification',
    case when p_approve then 'Document approved' else 'Document rejected' end,
    coalesce(p_note, d.doc_type), '/dashboard/documents');
  perform private.audit(case when p_approve then 'document_approved' else 'document_rejected' end,
    'verification_documents', p_doc::text, v_org.name || ' · ' || d.doc_type,
    jsonb_build_object('status', jsonb_build_object('from', d.status, 'to', case when p_approve then 'approved' else 'rejected' end)),
    p_note);
end $$;

-- suspension withdraws open listings and releases open requests on both sides
create or replace function public.admin_suspend_org(p_org uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare o public.organizations; r record;
begin
  perform private.require_admin();
  if char_length(coalesce(trim(p_reason), '')) < 5 then
    raise exception 'A reason is required' using errcode = 'P0001';
  end if;
  select * into o from public.organizations where id = p_org for update;
  if not found then raise exception 'Organisation not found' using errcode = 'P0002'; end if;
  for r in
    select fr.id, fr.receiver_org_id, l.donor_org_id from public.food_requests fr
    join public.food_listings l on l.id = fr.listing_id
    where fr.status in ('pending', 'accepted') and (l.donor_org_id = p_org or fr.receiver_org_id = p_org)
  loop
    perform private.release_request(r.id, 'cancelled', 'Organisation suspended');
    perform private.notify_org(case when r.donor_org_id = p_org then r.receiver_org_id else r.donor_org_id end,
      'request', 'A pickup was cancelled', 'The other organisation is currently suspended.', '/dashboard/requests');
  end loop;
  update public.food_listings set status = 'withdrawn', withdrawn_reason = 'Organisation suspended'
    where donor_org_id = p_org and status in ('active', 'reserved');
  update public.organizations set status = 'suspended', suspended_reason = p_reason where id = p_org;
  perform private.notify(o.owner_id, 'verification', 'Your organisation has been suspended', p_reason, '/dashboard');
  perform private.audit('org_suspended', 'organizations', p_org::text, o.name,
    jsonb_build_object('status', jsonb_build_object('from', o.status, 'to', 'suspended')), p_reason);
end $$;

create or replace function public.admin_reinstate_org(p_org uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare o public.organizations; v_new public.org_status;
begin
  perform private.require_admin();
  if char_length(coalesce(trim(p_reason), '')) < 5 then
    raise exception 'A reason is required' using errcode = 'P0001';
  end if;
  select * into o from public.organizations where id = p_org for update;
  if not found or o.status <> 'suspended' then
    raise exception 'Organisation is not suspended' using errcode = 'P0001';
  end if;
  v_new := case when o.verified_at is not null then 'approved' else 'pending' end;
  update public.organizations set status = v_new, suspended_reason = null where id = p_org;
  perform private.notify(o.owner_id, 'verification', 'Your organisation has been reinstated', p_reason, '/dashboard');
  perform private.audit('org_reinstated', 'organizations', p_org::text, o.name,
    jsonb_build_object('status', jsonb_build_object('from', 'suspended', 'to', v_new)), p_reason);
end $$;

create or replace function public.admin_withdraw_listing(p_listing uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare l public.food_listings; r record;
begin
  perform private.require_admin();
  if char_length(coalesce(trim(p_reason), '')) < 5 then
    raise exception 'A reason is required' using errcode = 'P0001';
  end if;
  select * into l from public.food_listings where id = p_listing for update;
  if not found then raise exception 'Listing not found' using errcode = 'P0002'; end if;
  for r in select id, receiver_org_id from public.food_requests where listing_id = l.id and status in ('pending', 'accepted') loop
    perform private.release_request(r.id, 'cancelled', 'Listing withdrawn by AnnSetu');
    perform private.notify_org(r.receiver_org_id, 'request', 'A listing was withdrawn', l.title, '/dashboard/requests');
  end loop;
  update public.food_listings set status = 'withdrawn', withdrawn_reason = p_reason where id = l.id;
  perform private.notify_org(l.donor_org_id, 'listing', 'Your listing was withdrawn by AnnSetu', p_reason, '/dashboard/listings');
  perform private.audit('listing_withdrawn', 'food_listings', l.id::text, l.title,
    jsonb_build_object('status', jsonb_build_object('from', l.status, 'to', 'withdrawn')), p_reason);
end $$;

create or replace function public.admin_set_role(p_user uuid, p_role public.user_role, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_old public.user_role; v_name text;
begin
  perform private.require_admin();
  if p_user = (select auth.uid()) then
    raise exception 'You cannot change your own role' using errcode = 'P0001';
  end if;
  if char_length(coalesce(trim(p_reason), '')) < 5 then
    raise exception 'A reason is required' using errcode = 'P0001';
  end if;
  select role, full_name into v_old, v_name from public.profiles where id = p_user for update;
  if not found then raise exception 'User not found' using errcode = 'P0002'; end if;
  update public.profiles set role = p_role where id = p_user;
  perform private.audit('role_changed', 'profiles', p_user::text, v_name,
    jsonb_build_object('role', jsonb_build_object('from', v_old, 'to', p_role)), p_reason);
end $$;

-- weekly landing numbers (cron or admin on demand); only OTP-confirmed pickups count
create or replace function public.rebuild_landing_snapshot()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v jsonb; v_factor numeric; v_portions numeric; v_kg numeric; v_packs numeric;
begin
  -- signed-in callers must be admins; cron and the service role carry no user id
  if (select auth.uid()) is not null then
    perform private.require_admin();
  end if;
  select coalesce((value ->> 'kg_co2e_per_kg')::numeric, 0) into v_factor
  from public.app_settings where key = 'co2_factor';
  select coalesce(sum(r.qty) filter (where l.unit = 'portions'), 0),
         coalesce(sum(r.qty) filter (where l.unit = 'kg'), 0),
         coalesce(sum(r.qty) filter (where l.unit = 'packs'), 0)
    into v_portions, v_kg, v_packs
  from public.food_requests r join public.food_listings l on l.id = r.listing_id
  where r.status = 'completed';

  v := jsonb_build_object(
    'generated_at', now(),
    'completed_pickups', (select count(*) from public.food_requests where status = 'completed'),
    'portions', v_portions, 'kg', v_kg, 'packs', v_packs,
    'meals_est', round(v_portions + v_kg / 0.42),
    'meals_method', 'portions + kg ÷ 0.42 (WRAP 420 g meal equivalent); packs not converted',
    'co2_kg_est', case when v_factor > 0 then round(v_kg * v_factor) end,
    'co2_method', case when v_factor > 0 then 'kg redistributed × ' || v_factor || ' kg CO₂e per kg food' end,
    'verified_donors', (select count(*) from public.organizations where kind = 'donor' and status = 'approved'),
    'verified_receivers', (select count(*) from public.organizations where kind = 'ngo' and status = 'approved'),
    'cities', (select count(distinct lower(city)) from public.organizations where status = 'approved' and city is not null),
    'top_donors_week', coalesce((
      select jsonb_agg(t) from (
        select o.name, o.city, sum(r.qty) as units
        from public.food_requests r join public.food_listings l on l.id = r.listing_id
        join public.organizations o on o.id = l.donor_org_id
        where r.status = 'completed' and r.completed_at > now() - interval '7 days'
        group by o.id order by units desc limit 5) t), '[]'::jsonb));
  insert into public.landing_snapshot (data, created_by) values (v, (select auth.uid()));
  if (select auth.uid()) is not null then
    perform private.audit('landing_snapshot_rebuilt', 'landing_snapshot', null, null, null, null);
  end if;
  return v;
end $$;

-- public certificate verification
create or replace function public.verify_certificate(p_serial text)
returns table (serial text, org_name text, milestone text, issued_at timestamptz, valid boolean)
language sql stable security definer set search_path = '' as $$
  select c.serial, c.org_name_snapshot, d.name, c.issued_at, c.revoked_at is null
  from public.certificates c join public.badge_definitions d on d.code = c.badge_code
  where c.serial = upper(trim(p_serial));
$$;

-- ───────────────────────── execute grants ─────────────────────────
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function public.update_rep_status_by_token(text, public.timeline_status, timestamptz) from authenticated;
revoke execute on function public.issue_rep_access_token(uuid) from authenticated;
revoke execute on function public.expire_listings() from authenticated;
grant execute on function public.public_listings_preview(integer) to anon;
grant execute on function public.verify_certificate(text) to anon;
-- PostGIS/pgvector helper functions live in the extensions schema and are unaffected.
