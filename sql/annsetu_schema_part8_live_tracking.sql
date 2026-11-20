-- =====================================================================
-- AnnSetu PART 8 (website): delivery-app style live tracking.
-- Steps confirmed by the representative, each with a time:
--   assigned -> on_the_way (trip started) -> arrived (reached donor)
--   -> collected (set automatically when the donor confirms the OTP)
--   -> delivered (representative confirms handover at the NGO)
-- Live location continues on the second leg (donor -> NGO) until delivered.
-- Run AFTER part 7. Additive and safe to re-run.
-- =====================================================================
set search_path = public, extensions;

alter table public.food_requests drop constraint if exists req_trip_status_chk;
alter table public.food_requests add constraint req_trip_status_chk
  check (trip_status in ('assigned','on_the_way','arrived','collected','delivered'));
alter table public.food_requests add column if not exists trip_started_at timestamptz;
alter table public.food_requests add column if not exists arrived_at timestamptz;
alter table public.food_requests add column if not exists collected_at timestamptz;
alter table public.food_requests add column if not exists delivered_at timestamptz;

-- OTP confirmed by the donor => food collected (step 4), automatically
create or replace function public.trg_request_collected() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    new.trip_status := 'collected';
    new.collected_at := now();
    new.trip_updated_at := now();
  end if;
  return new;
end $$;
drop trigger if exists request_collected on public.food_requests;
create trigger request_collected before update of status on public.food_requests
  for each row execute function public.trg_request_collected();
revoke all on function public.trg_request_collected() from public, anon, authenticated;

create or replace function public.set_trip_status(p_request uuid, p_status text, p_eta timestamptz default null) returns void
language plpgsql security definer set search_path = public as $$
declare r food_requests; l food_listings; n organizations; v_who text; v_msg text;
begin
  select * into r from food_requests where id = p_request for update;
  if not found then raise exception 'Request not found'; end if;
  if not (public.is_rep_of_request(p_request)
          or exists (select 1 from organizations where id = r.ngo_org_id and owner_id = auth.uid())) then
    raise exception 'Only the assigned representative or the NGO can update this pickup'; end if;
  if p_status not in ('on_the_way','arrived','delivered') then raise exception 'Invalid status'; end if;
  if p_status = 'delivered' then
    if r.status <> 'completed' or r.trip_status <> 'collected' then
      raise exception 'Mark delivered only after the donor has confirmed the OTP'; end if;
  elsif r.status <> 'accepted' then
    raise exception 'This pickup is not active';
  end if;
  if p_eta is not null and (p_eta < now() - interval '5 minutes' or p_eta > now() + interval '24 hours') then
    raise exception 'ETA must be within the next 24 hours'; end if;
  update food_requests set
    trip_status = p_status,
    eta = case when p_status = 'on_the_way' then coalesce(p_eta, eta) when p_status = 'arrived' then now() else eta end,
    trip_started_at = case when p_status = 'on_the_way' then coalesce(trip_started_at, now()) else trip_started_at end,
    arrived_at = case when p_status = 'arrived' then now() else arrived_at end,
    delivered_at = case when p_status = 'delivered' then now() else delivered_at end,
    trip_updated_at = now()
  where id = p_request;
  if p_status = 'delivered' then delete from rep_locations where request_id = p_request; end if;
  select * into l from food_listings where id = r.listing_id;
  select * into n from organizations where id = r.ngo_org_id;
  v_who := coalesce(r.rep_name, 'The representative');
  v_msg := case p_status
             when 'on_the_way' then v_who || ' started the trip for "' || l.title || '"' ||
                  coalesce(', ETA ' || to_char(coalesce(p_eta, r.eta) at time zone 'Asia/Kolkata', 'HH12:MI AM'), '')
             when 'arrived' then v_who || ' has reached the pickup point for "' || l.title || '"'
             else v_who || ' delivered "' || l.title || '" to ' || n.name end;
  perform notify_org(l.donor_org_id, 'Pickup update', v_msg);
  perform notify_org(r.ngo_org_id, 'Pickup update', v_msg);
end $$;
revoke all on function public.set_trip_status(uuid,text,timestamptz) from public, anon;
grant execute on function public.set_trip_status(uuid,text,timestamptz) to authenticated;

-- live location: first leg (accepted) and second leg (collected, on the way to the NGO)
create or replace function public.update_location(p_request uuid, p_lat numeric, p_lng numeric, p_acc numeric default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_rep_of_request(p_request) or exists (
           select 1 from food_requests r join organizations o on o.id = r.ngo_org_id
            where r.id = p_request and o.owner_id = auth.uid())) then
    raise exception 'Location sharing is only available for your own pickups'; end if;
  if not exists (select 1 from food_requests where id = p_request
                  and (status = 'accepted' or (status = 'completed' and trip_status = 'collected'))) then
    raise exception 'Location sharing is only available during an active pickup'; end if;
  insert into rep_locations (request_id, lat, lng, accuracy_m) values (p_request, p_lat, p_lng, p_acc)
  on conflict (request_id) do update set lat = excluded.lat, lng = excluded.lng,
        accuracy_m = excluded.accuracy_m, updated_at = now()
   where rep_locations.updated_at < now() - interval '3 seconds';
end $$;

-- representative pickups, now with the NGO drop-off point and step times
drop function if exists public.rep_my_pickups();
create function public.rep_my_pickups() returns table (
  request_id uuid, status text, trip_status text, eta timestamptz, quantity int,
  listing_title text, unit text, category text, pickup_by timestamptz, safety_notes text, photo_path text,
  donor_name text, donor_phone text, donor_address text, donor_lat numeric, donor_lng numeric,
  ngo_name text, ngo_phone text, ngo_address text, ngo_lat numeric, ngo_lng numeric, otp text,
  trip_started_at timestamptz, arrived_at timestamptz, collected_at timestamptz, delivered_at timestamptz,
  trip_updated_at timestamptz, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select r.id, r.status, r.trip_status, r.eta, r.quantity,
         l.title, l.unit, l.category, l.pickup_by, l.safety_notes, l.photo_path,
         d.name, d.phone, d.address, d.lat, d.lng,
         n.name, n.phone, n.address, n.lat, n.lng,
         case when r.status = 'accepted' then (select otp from pickup_otps where request_id = r.id) end,
         r.trip_started_at, r.arrived_at, r.collected_at, r.delivered_at, r.trip_updated_at, r.created_at
    from food_requests r
    join representatives p on p.id = r.rep_id and p.user_id = auth.uid() and p.active
    join food_listings l on l.id = r.listing_id
    join organizations d on d.id = l.donor_org_id
    join organizations n on n.id = r.ngo_org_id
   where r.status in ('accepted','completed') and r.created_at > now() - interval '30 days'
   order by (r.status = 'accepted' or r.trip_status = 'collected') desc, l.pickup_by asc $$;
revoke all on function public.rep_my_pickups() from public, anon;
grant execute on function public.rep_my_pickups() to authenticated;

create index if not exists messages_recent_idx on public.messages (created_at desc);
