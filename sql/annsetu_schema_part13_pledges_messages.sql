-- =====================================================================
-- AnnSetu PART 13: private need pledges + donor <-> NGO conversations.
--  * A donor can fulfil a community need privately: the food is listed ONLY for that NGO
--    (food_listings.reserved_for), the need becomes 'pledged', and when the NGO picks a
--    representative the request is accepted automatically (the donor already agreed).
--  * Donor and NGO get a lasting conversation (not tied to one pickup) so they can talk
--    and ask for food directly later.
-- Run AFTER parts 1-12. Additive and safe to re-run.
-- =====================================================================

-- ---------- 1. reserved listings and pledged needs ----------
alter table public.food_listings add column if not exists reserved_for uuid references public.organizations(id) on delete set null;
alter table public.food_listings add column if not exists need_id uuid references public.requirements(id) on delete set null;
create index if not exists food_listings_reserved_for_idx on public.food_listings(reserved_for) where reserved_for is not null;
create index if not exists food_listings_need_idx on public.food_listings(need_id) where need_id is not null;

alter table public.requirements add column if not exists pledged_by uuid references public.organizations(id) on delete set null;
create index if not exists requirements_pledged_by_idx on public.requirements(pledged_by) where pledged_by is not null;
alter table public.requirements drop constraint if exists requirements_status_check;
alter table public.requirements add constraint requirements_status_check check (status in ('open', 'pledged', 'fulfilled'));

-- reserved food is visible only to the NGO it is reserved for (plus donor, admins, requesters)
drop policy if exists listings_read on public.food_listings;
create policy listings_read on public.food_listings for select to authenticated using (
  is_admin() or donor_org_id = my_org_id() or has_request_on(id)
  or (status = 'active' and pickup_by > now() and qty_reserved < quantity and my_org_approved('ngo')
      and (reserved_for is null or reserved_for = my_org_id())));

-- pledges are created only through fulfil_need()
drop policy if exists listings_insert on public.food_listings;
create policy listings_insert on public.food_listings for insert to authenticated with check (
  donor_org_id = my_org_id() and my_org_approved('donor') and pickup_by > now() and prepared_at <= now()
  and reserved_for is null and need_id is null);

create or replace function public.trg_listing_pledge_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user = 'authenticated' and (new.reserved_for is distinct from old.reserved_for or new.need_id is distinct from old.need_id) then
    raise exception 'A pledge cannot be moved to another receiver';
  end if;
  return new;
end $$;
drop trigger if exists listing_pledge_guard on public.food_listings;
create trigger listing_pledge_guard before update on public.food_listings
  for each row execute function public.trg_listing_pledge_guard();

-- a pledge that is withdrawn or expires without being collected re-opens the need
create or replace function public.trg_listing_need_sync() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.need_id is not null and new.status in ('withdrawn', 'expired') and old.status not in ('withdrawn', 'expired')
     and not exists (select 1 from food_requests where listing_id = new.id and status = 'completed') then
    update requirements set status = 'open', pledged_by = null where id = new.need_id and status = 'pledged';
    if found then
      perform notify_org(new.reserved_for, 'Pledge cancelled', 'The food pledged for "' || new.title || '" is no longer coming. Your need is open again.');
    end if;
  end if;
  return null;
end $$;
drop trigger if exists listing_need_sync on public.food_listings;
create trigger listing_need_sync after update of status on public.food_listings
  for each row execute function public.trg_listing_need_sync();

-- collecting pledged food marks the need fulfilled
create or replace function public.trg_request_need_done() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    update requirements set status = 'fulfilled'
     where id = (select need_id from food_listings where id = new.listing_id) and status = 'pledged';
  end if;
  return null;
end $$;
drop trigger if exists request_need_done on public.food_requests;
create trigger request_need_done after update of status on public.food_requests
  for each row execute function public.trg_request_need_done();

-- nearby search: reserved-for-me food always shows (any distance), first
drop function if exists public.nearby_listings(double precision, double precision, double precision, text);
create function public.nearby_listings(p_lat double precision, p_lng double precision, p_radius_km double precision default 15, p_category text default null)
returns table(id uuid, title text, category text, quantity integer, qty_reserved integer, unit text, pickup_by timestamptz,
              safety_notes text, photo_path text, donor_org_id uuid, donor_name text, distance_km double precision, reserved_for uuid, need_id uuid)
language sql stable set search_path = public, extensions as $$
  select l.id, l.title, l.category, l.quantity, l.qty_reserved, l.unit, l.pickup_by, l.safety_notes,
         l.photo_path, o.id, o.name,
         st_distance(o.geo, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography) / 1000,
         l.reserved_for, l.need_id
    from food_listings l join organizations o on o.id = l.donor_org_id
   where l.status = 'active' and l.pickup_by > now() and l.qty_reserved < l.quantity
     and o.geo is not null and not o.suspended
     and (p_category is null or l.category = p_category)
     and (l.reserved_for = my_org_id()
          or st_dwithin(o.geo, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography, p_radius_km * 1000))
   order by (l.reserved_for is null), 12 limit 100 $$;
grant execute on function public.nearby_listings(double precision, double precision, double precision, text) to authenticated;

-- the public homepage never shows reserved food
create or replace function public.public_listings_preview(p_limit integer default 24)
returns table(id uuid, title text, category text, quantity integer, qty_reserved integer, unit text, pickup_by timestamptz,
              safety_notes text, photo_path text, donor_name text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select l.id, l.title, l.category, l.quantity, l.qty_reserved, l.unit, l.pickup_by,
         l.safety_notes, l.photo_path, o.name, l.created_at
    from food_listings l join organizations o on o.id = l.donor_org_id
   where l.status = 'active' and l.pickup_by > now() and l.qty_reserved < l.quantity
     and l.reserved_for is null
     and o.verification = 'approved' and not o.suspended
   order by l.pickup_by asc
   limit least(greatest(coalesce(p_limit, 24), 1), 48) $$;

-- requesting food: reserved food only for its NGO, and accepted automatically
create or replace function public.create_request(p_listing uuid, p_qty integer, p_rep uuid)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
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
  if l.reserved_for is not null and l.reserved_for <> v_org then
    raise exception 'This food is reserved for another organisation'; end if;
  if exists (select 1 from organizations where id = l.donor_org_id and suspended) then
    raise exception 'This donor is not accepting requests'; end if;
  if p_qty < 1 or p_qty > l.quantity - l.qty_reserved then
    raise exception 'Quantity exceeds what is available'; end if;
  insert into food_requests (listing_id, ngo_org_id, rep_id, rep_name, rep_phone, quantity)
  values (p_listing, v_org, p_rep, v_rn, v_rp, p_qty) returning id into v_id;
  if l.reserved_for = v_org then
    update food_listings set qty_reserved = qty_reserved + p_qty,
           status = case when qty_reserved + p_qty = quantity then 'reserved' else status end
     where id = l.id;
    update food_requests set status = 'accepted' where id = v_id;
    insert into pickup_otps (request_id, ngo_org_id, otp, expires_at)
    values (v_id, v_org,
            lpad((((('x' || encode(gen_random_bytes(3), 'hex'))::bit(24)::int) % 10000))::text, 4, '0'),
            l.pickup_by + interval '2 hours');
    perform notify_org(l.donor_org_id, 'Pickup arranged', v_rn || ' will collect ' || p_qty || ' ' || l.unit || ' of ' || l.title || ' (your pledge).');
    perform notify_org(v_org, 'Pickup confirmed', 'Collect ' || l.title || '. Your pickup OTP is in Pickups.');
  else
    perform notify_org(l.donor_org_id, 'New food request', p_qty || ' ' || l.unit || ' of ' || l.title);
  end if;
  return v_id;
end $$;

-- ---------- 2. donor <-> NGO conversations ----------
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  donor_org_id uuid not null references public.organizations(id) on delete cascade,
  ngo_org_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  unique (donor_org_id, ngo_org_id)
);
create index if not exists conversations_ngo_idx on public.conversations(ngo_org_id);

create table if not exists public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists conversation_messages_conv_idx on public.conversation_messages(conversation_id, created_at);
create index if not exists conversation_messages_sender_idx on public.conversation_messages(sender_id);

alter table public.conversations enable row level security;
alter table public.conversation_messages enable row level security;

create or replace function public.in_conversation(p_conv uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from conversations c where c.id = p_conv and my_org_id() in (c.donor_org_id, c.ngo_org_id)) $$;

drop policy if exists conv_read on public.conversations;
create policy conv_read on public.conversations for select to authenticated
  using (my_org_id() in (donor_org_id, ngo_org_id));
drop policy if exists conv_msgs_read on public.conversation_messages;
create policy conv_msgs_read on public.conversation_messages for select to authenticated
  using (in_conversation(conversation_id));
drop policy if exists conv_msgs_insert on public.conversation_messages;
create policy conv_msgs_insert on public.conversation_messages for insert to authenticated
  with check (sender_id = auth.uid() and in_conversation(conversation_id) and i_am_approved());
revoke update, delete, truncate on public.conversation_messages from anon, authenticated;
revoke insert, update, delete, truncate on public.conversations from anon, authenticated;

create or replace function public._conversation(p_donor uuid, p_ngo uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  insert into conversations (donor_org_id, ngo_org_id) values (p_donor, p_ngo)
  on conflict (donor_org_id, ngo_org_id) do update set donor_org_id = excluded.donor_org_id
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public._conversation(uuid, uuid) from public, anon, authenticated;

-- Donors may message any verified NGO. NGOs may message donors they collected from or who wrote first.
create or replace function public.open_conversation(p_other uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_me uuid; v_kind text; v_okind text; v_donor uuid; v_ngo uuid;
begin
  select id, kind into v_me, v_kind from organizations
   where owner_id = auth.uid() and verification = 'approved' and not suspended;
  if v_me is null then raise exception 'Your organisation must be verified first'; end if;
  select kind into v_okind from organizations where id = p_other and verification = 'approved' and not suspended;
  if v_okind is null then raise exception 'This organisation is not available'; end if;
  if v_kind = v_okind then raise exception 'Messages are between a donor and a receiver'; end if;
  v_donor := case when v_kind = 'donor' then v_me else p_other end;
  v_ngo   := case when v_kind = 'ngo' then v_me else p_other end;
  if v_kind = 'ngo'
     and not exists (select 1 from conversations where donor_org_id = v_donor and ngo_org_id = v_ngo)
     and not exists (select 1 from food_requests r join food_listings l on l.id = r.listing_id
                      where r.ngo_org_id = v_ngo and l.donor_org_id = v_donor) then
    raise exception 'You can message donors you have received food from, or who messaged you first';
  end if;
  return _conversation(v_donor, v_ngo);
end $$;
grant execute on function public.open_conversation(uuid) to authenticated;

-- my conversation list, newest first, plus (for NGOs) past donors to start a chat with
create or replace function public.my_conversations()
returns table(id uuid, other_org_id uuid, other_name text, other_phone text, last_body text, last_sender uuid, last_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.id, o.id, o.name, o.phone, m.body, m.sender_id, c.last_message_at
    from conversations c
    join organizations o on o.id = case when c.donor_org_id = my_org_id() then c.ngo_org_id else c.donor_org_id end
    left join lateral (select body, sender_id from conversation_messages
                        where conversation_id = c.id order by created_at desc limit 1) m on true
   where my_org_id() in (c.donor_org_id, c.ngo_org_id)
   order by c.last_message_at desc $$;
grant execute on function public.my_conversations() to authenticated;

create or replace function public.message_partners()
returns table(org_id uuid, name text)
language sql stable security definer set search_path = public as $$
  select distinct o.id, o.name
    from food_requests r join food_listings l on l.id = r.listing_id
    join organizations o on o.id = case when r.ngo_org_id = my_org_id() then l.donor_org_id else r.ngo_org_id end
   where my_org_id() in (r.ngo_org_id, l.donor_org_id)
     and o.verification = 'approved' and not o.suspended
   order by o.name $$;
grant execute on function public.message_partners() to authenticated;

create or replace function public.trg_conversation_message() returns trigger
language plpgsql security definer set search_path = public as $$
declare c conversations; v_from text; v_to uuid;
begin
  select * into c from conversations where id = new.conversation_id;
  update conversations set last_message_at = new.created_at where id = c.id;
  select name into v_from from organizations where owner_id = new.sender_id;
  v_to := case when (select owner_id from organizations where id = c.donor_org_id) = new.sender_id then c.ngo_org_id else c.donor_org_id end;
  insert into notifications (user_id, title, body)
  select owner_id, 'Message from ' || coalesce(v_from, 'AnnSetu'), left(new.body, 80) from organizations where id = v_to;
  return null;
end $$;
drop trigger if exists conversation_message on public.conversation_messages;
create trigger conversation_message after insert on public.conversation_messages
  for each row execute function public.trg_conversation_message();

-- ---------- 3. fulfil a need privately ----------
create or replace function public.fulfil_need(p_need uuid, p_quantity integer, p_unit text, p_category text,
  p_pickup_by timestamptz, p_notes text default null, p_photo text default null, p_message text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_name text; n requirements; v_id uuid; v_conv uuid;
begin
  select id, name into v_org, v_name from organizations
   where owner_id = auth.uid() and kind = 'donor' and verification = 'approved' and not suspended;
  if v_org is null then raise exception 'Only verified, active donors can fulfil needs'; end if;
  select * into n from requirements where id = p_need for update;
  if not found then raise exception 'Need not found'; end if;
  if n.status <> 'open' then raise exception 'Another donor has already pledged this need'; end if;
  if not exists (select 1 from organizations where id = n.ngo_org_id and verification = 'approved' and not suspended) then
    raise exception 'This receiver is not active right now'; end if;
  if p_quantity is null or p_quantity < 1 then raise exception 'Enter a quantity'; end if;
  if p_pickup_by is null or p_pickup_by < now() + interval '15 minutes' then
    raise exception 'Pickup-by must be at least 15 minutes from now'; end if;
  insert into food_listings (donor_org_id, title, category, quantity, unit, prepared_at, pickup_by,
                             safety_notes, photo_path, reserved_for, need_id)
  values (v_org, n.title, p_category, p_quantity, p_unit, now(), p_pickup_by,
          nullif(trim(coalesce(p_notes, '')), ''), p_photo, n.ngo_org_id, n.id)
  returning id into v_id;
  update requirements set status = 'pledged', pledged_by = v_org where id = n.id;
  v_conv := _conversation(v_org, n.ngo_org_id);
  insert into conversation_messages (conversation_id, sender_id, body)
  values (v_conv, auth.uid(), left(coalesce(nullif(trim(coalesce(p_message, '')), ''),
          'We will fulfil your need: ' || p_quantity || ' ' || p_unit || ' of ' || n.title
          || '. Please send your representative before ' || to_char(p_pickup_by at time zone 'Asia/Kolkata', 'DD Mon, HH12:MI AM') || '.'), 1000));
  perform notify_org(n.ngo_org_id, 'Your need is being fulfilled',
    v_name || ' pledged ' || p_quantity || ' ' || p_unit || ' of ' || n.title || '. Choose a representative to collect it.');
  return v_id;
end $$;
grant execute on function public.fulfil_need(uuid, integer, text, text, timestamptz, text, text, text) to authenticated;

-- live updates for chats
do $$ begin
  alter publication supabase_realtime add table public.conversation_messages;
exception when duplicate_object then null; end $$;
