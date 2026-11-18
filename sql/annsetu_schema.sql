-- =====================================================================
-- AnnSetu: Supabase schema (Postgres) with Row Level Security
-- Run once on a FRESH Supabase project: SQL Editor -> paste -> Run.
-- NOT yet tested against a live project, so review before production.
--
-- Design rules
--  * All writes to requests, OTPs and notifications go through RPC
--    functions (security definer), never direct table writes.
--  * Browsers can only touch columns that are explicitly granted.
--  * OTP is shown ONLY to the NGO; the DONOR enters it at handover.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- TABLES ----------------------------------------------------
create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  role       text not null default 'donor' check (role in ('donor','ngo','admin')),
  full_name  text,
  created_at timestamptz not null default now()
);

create table public.organizations (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid not null unique references public.profiles(id) on delete cascade,
  kind              text not null check (kind in ('donor','ngo')),
  org_type          text not null,   -- Restaurant, Hotel, NGO, Shelter, ...
  name              text not null check (char_length(name) between 2 and 80),
  phone             text,
  address           text,
  about             text check (char_length(about) <= 300),
  area_served       text,
  lat               numeric(9,6),
  lng               numeric(9,6),
  verification      text not null default 'pending' check (verification in ('pending','approved','rejected')),
  verification_note text,
  created_at        timestamptz not null default now()
);

create table public.verification_documents (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  path       text not null,           -- storage path in verification-docs
  created_at timestamptz not null default now()
);

create table public.representatives (
  id     uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name   text not null,
  phone  text not null
);

create table public.food_listings (
  id           uuid primary key default gen_random_uuid(),
  donor_org_id uuid not null references public.organizations(id) on delete cascade,
  title        text not null check (char_length(title) between 2 and 80),
  category     text not null,
  quantity     int  not null check (quantity > 0),
  unit         text not null check (unit in ('portions','kg','packs')),
  qty_reserved int  not null default 0 check (qty_reserved >= 0),
  prepared_at  timestamptz not null,
  pickup_by    timestamptz not null,
  safety_notes text check (char_length(safety_notes) <= 300),
  status       text not null default 'active'
               check (status in ('active','reserved','completed','expired','withdrawn')),
  created_at   timestamptz not null default now(),
  check (qty_reserved <= quantity),
  check (pickup_by > prepared_at)
);
create index on public.food_listings (status, pickup_by);
create index on public.food_listings (donor_org_id);

create table public.food_requests (
  id          uuid primary key default gen_random_uuid(),
  listing_id  uuid not null references public.food_listings(id) on delete cascade,
  ngo_org_id  uuid not null references public.organizations(id) on delete cascade,
  rep_id      uuid not null references public.representatives(id),
  quantity    int  not null check (quantity > 0),
  status      text not null default 'pending'
              check (status in ('pending','accepted','rejected','cancelled','completed')),
  created_at  timestamptz not null default now(),
  completed_at timestamptz
);
create unique index one_pending_per_ngo_listing
  on public.food_requests (listing_id, ngo_org_id) where status = 'pending';
create index on public.food_requests (ngo_org_id);
create index on public.food_requests (listing_id);

create table public.pickup_otps (
  request_id uuid primary key references public.food_requests(id) on delete cascade,
  ngo_org_id uuid not null references public.organizations(id) on delete cascade,
  otp        text not null,
  attempts   int  not null default 0,
  expires_at timestamptz not null
);

create table public.requirements (
  id         uuid primary key default gen_random_uuid(),
  ngo_org_id uuid not null references public.organizations(id) on delete cascade,
  title      text not null check (char_length(title) between 2 and 80),
  quantity   int  not null check (quantity > 0),
  needed_by  timestamptz not null,
  status     text not null default 'open' check (status in ('open','fulfilled')),
  created_at timestamptz not null default now()
);

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  title      text not null,
  body       text,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.notifications (user_id, created_at desc);

create table public.reviews (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references public.food_requests(id) on delete cascade,
  reviewer_org uuid not null references public.organizations(id) on delete cascade,
  reviewee_org uuid not null references public.organizations(id) on delete cascade,
  rating      int not null check (rating between 1 and 5),
  comment     text check (char_length(comment) <= 300),
  created_at  timestamptz not null default now(),
  unique (request_id, reviewer_org)
);

-- ---------- NEW USER -> PROFILE --------------------------------------
-- Sign up with: supabase.auth.signUp({ email, password, options:{ data:{ role:'donor'|'ngo', full_name } } })
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, role, full_name)
  values (new.id,
          case when new.raw_user_meta_data->>'role' in ('donor','ngo')
               then new.raw_user_meta_data->>'role' else 'donor' end,
          new.raw_user_meta_data->>'full_name');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- HELPERS (security definer = no RLS recursion) -------------
create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin') $$;

create function public.my_org_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from organizations where owner_id = auth.uid() $$;

create function public.my_org_approved(p_kind text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from organizations
                 where owner_id = auth.uid() and kind = p_kind and verification = 'approved') $$;

create function public.i_am_approved() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from organizations
                 where owner_id = auth.uid() and verification = 'approved') $$;

create function public.owns_listing(p_listing uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from food_listings l join organizations o on o.id = l.donor_org_id
                 where l.id = p_listing and o.owner_id = auth.uid()) $$;

create function public.has_request_on(p_listing uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from food_requests r join organizations o on o.id = r.ngo_org_id
                 where r.listing_id = p_listing and o.owner_id = auth.uid()) $$;

-- internal only: other RPCs call it, browsers cannot
create function public.notify_org(p_org uuid, p_title text, p_body text) returns void
language sql security definer set search_path = public as $$
  insert into notifications (user_id, title, body)
  select owner_id, p_title, p_body from organizations where id = p_org $$;
revoke all on function public.notify_org(uuid, text, text) from public, anon, authenticated;

-- ---------- TABLE PRIVILEGES (column-level, deny by default) ----------
revoke all on all tables in schema public from anon, authenticated;

grant select on public.profiles, public.organizations, public.verification_documents,
  public.representatives, public.food_listings, public.food_requests, public.pickup_otps,
  public.requirements, public.notifications, public.reviews to authenticated;

grant update (full_name) on public.profiles to authenticated;
grant insert (owner_id, kind, org_type, name, phone, address, about, area_served, lat, lng)
  on public.organizations to authenticated;
grant update (org_type, name, phone, address, about, area_served, lat, lng)
  on public.organizations to authenticated;
grant insert, delete on public.verification_documents to authenticated;
grant insert, update, delete on public.representatives to authenticated;
grant insert (donor_org_id, title, category, quantity, unit, prepared_at, pickup_by, safety_notes)
  on public.food_listings to authenticated;
grant update (title, category, quantity, unit, prepared_at, pickup_by, safety_notes, status)
  on public.food_listings to authenticated;   -- qty_reserved is NOT updatable by clients
grant insert, update, delete on public.requirements to authenticated;
grant update (read) on public.notifications to authenticated;
grant insert (request_id, reviewer_org, reviewee_org, rating, comment) on public.reviews to authenticated;

-- ---------- ROW LEVEL SECURITY ----------------------------------------
alter table public.profiles               enable row level security;
alter table public.organizations          enable row level security;
alter table public.verification_documents enable row level security;
alter table public.representatives        enable row level security;
alter table public.food_listings          enable row level security;
alter table public.food_requests          enable row level security;
alter table public.pickup_otps            enable row level security;
alter table public.requirements           enable row level security;
alter table public.notifications          enable row level security;
alter table public.reviews                enable row level security;

create policy profiles_read   on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy org_read on public.organizations for select to authenticated
  using (owner_id = auth.uid() or public.is_admin()
         or (verification = 'approved' and public.i_am_approved()));
create policy org_insert on public.organizations for insert to authenticated
  with check (owner_id = auth.uid()
              and kind = (select role from public.profiles where id = auth.uid()));
create policy org_update on public.organizations for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy vdocs_read on public.verification_documents for select to authenticated
  using (org_id = public.my_org_id() or public.is_admin());
create policy vdocs_insert on public.verification_documents for insert to authenticated
  with check (org_id = public.my_org_id());
create policy vdocs_delete on public.verification_documents for delete to authenticated
  using (org_id = public.my_org_id());

create policy reps_all on public.representatives for all to authenticated
  using (org_id = public.my_org_id()) with check (org_id = public.my_org_id());

create policy listings_read on public.food_listings for select to authenticated
  using (public.is_admin()
         or donor_org_id = public.my_org_id()
         or public.has_request_on(id)
         or (status = 'active' and pickup_by > now() and qty_reserved < quantity
             and public.my_org_approved('ngo')));
create policy listings_insert on public.food_listings for insert to authenticated
  with check (donor_org_id = public.my_org_id() and public.my_org_approved('donor')
              and pickup_by > now() and prepared_at <= now());
create policy listings_update on public.food_listings for update to authenticated
  using (donor_org_id = public.my_org_id())
  with check (donor_org_id = public.my_org_id()
              and status in ('active','withdrawn')
              and (status = 'active' or qty_reserved = 0));

create policy requests_read on public.food_requests for select to authenticated
  using (public.is_admin() or ngo_org_id = public.my_org_id() or public.owns_listing(listing_id));

create policy otp_read on public.pickup_otps for select to authenticated
  using (ngo_org_id = public.my_org_id());   -- donors can NOT read it

create policy needs_read on public.requirements for select to authenticated
  using (public.is_admin() or ngo_org_id = public.my_org_id() or public.i_am_approved());
create policy needs_write on public.requirements for all to authenticated
  using (ngo_org_id = public.my_org_id())
  with check (ngo_org_id = public.my_org_id() and public.my_org_approved('ngo'));

create policy notes_read   on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notes_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy reviews_read on public.reviews for select to authenticated
  using (reviewer_org = public.my_org_id() or reviewee_org = public.my_org_id()
         or public.is_admin() or public.i_am_approved());
create policy reviews_insert on public.reviews for insert to authenticated
  with check (reviewer_org = public.my_org_id() and exists (
    select 1 from public.food_requests r join public.food_listings l on l.id = r.listing_id
    where r.id = request_id and r.status = 'completed'
      and ((r.ngo_org_id = reviewer_org and l.donor_org_id = reviewee_org)
        or (l.donor_org_id = reviewer_org and r.ngo_org_id = reviewee_org))));

-- ---------- RPC: NGO creates a request --------------------------------
create function public.create_request(p_listing uuid, p_qty int, p_rep uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_org uuid; l food_listings; v_id uuid;
begin
  select id into v_org from organizations
   where owner_id = auth.uid() and kind = 'ngo' and verification = 'approved';
  if v_org is null then raise exception 'Only verified NGOs can request food'; end if;
  if not exists (select 1 from representatives where id = p_rep and org_id = v_org) then
    raise exception 'Choose one of your own representatives'; end if;
  select * into l from food_listings where id = p_listing for update;
  if not found or l.status <> 'active' or l.pickup_by <= now() then
    raise exception 'This listing is no longer available'; end if;
  if p_qty < 1 or p_qty > l.quantity - l.qty_reserved then
    raise exception 'Quantity exceeds what is available'; end if;
  insert into food_requests (listing_id, ngo_org_id, rep_id, quantity)
  values (p_listing, v_org, p_rep, p_qty) returning id into v_id;   -- unique index blocks duplicates
  perform notify_org(l.donor_org_id, 'New food request', p_qty || ' ' || l.unit || ' of ' || l.title);
  return v_id;
end $$;

-- ---------- RPC: donor accepts / rejects ------------------------------
create function public.respond_request(p_request uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
declare r food_requests; l food_listings;
begin
  select * into r from food_requests where id = p_request for update;
  if not found then raise exception 'Request not found'; end if;
  select * into l from food_listings where id = r.listing_id for update;
  if not exists (select 1 from organizations where id = l.donor_org_id and owner_id = auth.uid()) then
    raise exception 'Not your listing'; end if;
  if r.status <> 'pending' then raise exception 'Request already handled'; end if;

  if p_accept then
    if l.status <> 'active' or l.pickup_by <= now() then raise exception 'Listing is no longer active'; end if;
    if r.quantity > l.quantity - l.qty_reserved then raise exception 'Not enough quantity left'; end if;
    update food_listings set qty_reserved = qty_reserved + r.quantity,
           status = case when qty_reserved + r.quantity = quantity then 'reserved' else status end
     where id = l.id;
    update food_requests set status = 'accepted' where id = r.id;
    insert into pickup_otps (request_id, ngo_org_id, otp, expires_at)
    values (r.id, r.ngo_org_id,
            lpad((((('x' || encode(gen_random_bytes(3), 'hex'))::bit(24)::int) % 10000))::text, 4, '0'),
            l.pickup_by + interval '2 hours');
    perform notify_org(r.ngo_org_id, 'Request accepted', 'Collect ' || l.title || '. Your pickup OTP is in Pickups.');
  else
    update food_requests set status = 'rejected' where id = r.id;
    perform notify_org(r.ngo_org_id, 'Request rejected', l.title);
  end if;
end $$;

-- ---------- RPC: NGO cancels (pending or accepted) -------------------
create function public.cancel_request(p_request uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r food_requests;
begin
  select * into r from food_requests where id = p_request for update;
  if not found or not exists (select 1 from organizations where id = r.ngo_org_id and owner_id = auth.uid()) then
    raise exception 'Not your request'; end if;
  if r.status not in ('pending','accepted') then raise exception 'Cannot cancel this request'; end if;
  if r.status = 'accepted' then
    update food_listings set qty_reserved = qty_reserved - r.quantity,
           status = case when status = 'reserved' then 'active' else status end
     where id = r.listing_id;
    delete from pickup_otps where request_id = r.id;
  end if;
  update food_requests set status = 'cancelled' where id = r.id;
  perform notify_org((select donor_org_id from food_listings where id = r.listing_id),
                     'Request cancelled', 'An NGO cancelled its request.');
end $$;

-- ---------- RPC: donor confirms handover with the OTP -----------------
create function public.confirm_pickup(p_request uuid, p_otp text) returns boolean
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
  if o.attempts >= 5 or o.expires_at < now() then raise exception 'OTP locked or expired'; end if;
  if o.otp <> p_otp then
    update pickup_otps set attempts = attempts + 1 where request_id = r.id;
    return false;                               -- wrong OTP: counted, not rolled back
  end if;
  update food_requests set status = 'completed', completed_at = now() where id = r.id;
  delete from pickup_otps where request_id = r.id;
  if l.qty_reserved = l.quantity and not exists
     (select 1 from food_requests where listing_id = l.id and status = 'accepted') then
    update food_listings set status = 'completed' where id = l.id;
  end if;
  perform notify_org(r.ngo_org_id, 'Pickup confirmed', 'Collection of ' || l.title || ' is complete.');
  return true;
end $$;

-- ---------- RPC: admin verifies an organisation -----------------------
create function public.review_org(p_org uuid, p_approve boolean, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  update organizations set verification = case when p_approve then 'approved' else 'rejected' end,
         verification_note = p_note where id = p_org;
  perform notify_org(p_org, case when p_approve then 'Organisation verified' else 'Verification rejected' end,
                     coalesce(p_note, ''));
end $$;

-- ---------- Housekeeping: expire old listings -------------------------
create function public.expire_listings() returns void
language sql security definer set search_path = public as $$
  with ex as (
    update food_listings set status = 'expired'
     where status in ('active','reserved') and pickup_by < now() returning id)
  update food_requests set status = 'cancelled'
   where status in ('pending','accepted') and listing_id in (select id from ex) $$;
revoke all on function public.expire_listings() from public, anon, authenticated;
-- Schedule every 10 min (Database -> Extensions -> enable pg_cron):
-- select cron.schedule('expire-listings','*/10 * * * *','select public.expire_listings()');

-- ---------- Let browsers call only the user-facing RPCs ---------------
revoke all on function public.create_request(uuid,int,uuid), public.respond_request(uuid,boolean),
  public.cancel_request(uuid), public.confirm_pickup(uuid,text), public.review_org(uuid,boolean,text)
  from public, anon;
grant execute on function public.create_request(uuid,int,uuid), public.respond_request(uuid,boolean),
  public.cancel_request(uuid), public.confirm_pickup(uuid,text), public.review_org(uuid,boolean,text)
  to authenticated;

-- ---------- Impact views (RLS applies to the caller) ------------------
create view public.donor_impact with (security_invoker = true) as
  select l.donor_org_id, count(*) as donations, sum(r.quantity) as units,
         count(distinct r.ngo_org_id) as ngos_served
    from public.food_requests r join public.food_listings l on l.id = r.listing_id
   where r.status = 'completed' group by l.donor_org_id;

create view public.ngo_impact with (security_invoker = true) as
  select r.ngo_org_id, count(*) as pickups, sum(r.quantity) as units_received
    from public.food_requests r where r.status = 'completed' group by r.ngo_org_id;

grant select on public.donor_impact, public.ngo_impact to authenticated;

-- ---------- Storage: private bucket for verification documents --------
insert into storage.buckets (id, name, public) values ('verification-docs','verification-docs', false)
on conflict (id) do nothing;

create policy vdocs_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'verification-docs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy vdocs_view on storage.objects for select to authenticated
  using (bucket_id = 'verification-docs'
         and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- ---------- Realtime (live notifications and request updates) ---------
alter publication supabase_realtime add table public.notifications, public.food_requests;

-- ---------- Make yourself the first admin (run once, with YOUR user id)
-- update public.profiles set role = 'admin' where id = '<your-auth-user-uuid>';
