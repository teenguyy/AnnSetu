-- AnnSetu Part 3: accounting fixes for expiry and admin withdrawal
-- Run ONLY after annsetu_schema.sql (Part 1) and annsetu_schema_part2.sql (Part 2).
-- Run once in Supabase SQL Editor. Test on a staging project before production.

-- Fix 1: Release accepted quantities when a listing expires.
-- The request-status trigger from Part 2 also removes the associated OTP/location.
create or replace function public.expire_listings()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  expired_listing record;
  open_request record;
begin
  for expired_listing in
    update public.food_listings
       set status = 'expired'
     where status in ('active', 'reserved')
       and pickup_by < now()
    returning id
  loop
    for open_request in
      select id
        from public.food_requests
       where listing_id = expired_listing.id
         and status in ('pending', 'accepted')
    loop
      perform public._release_request(open_request.id);
    end loop;
  end loop;
end;
$$;

-- Keep this function internal. The scheduled database job runs with database privileges.
revoke all on function public.expire_listings() from public, anon, authenticated;

-- Fix 2: Release accepted quantities when an admin withdraws a listing
-- or when a donor is suspended and their listings are withdrawn.
create or replace function public._withdraw_listing(
  p_listing uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  open_request record;
begin
  for open_request in
    select id, ngo_org_id
      from public.food_requests
     where listing_id = p_listing
       and status in ('pending', 'accepted')
     for update
  loop
    perform public._release_request(open_request.id);

    perform public.notify_org(
      open_request.ngo_org_id,
      'Request cancelled',
      coalesce(p_reason, 'The listing was withdrawn.')
    );
  end loop;

  update public.food_listings
     set status = 'withdrawn'
   where id = p_listing
     and status in ('active', 'reserved');
end;
$$;

revoke all on function public._withdraw_listing(uuid, text)
  from public, anon, authenticated;

-- First-admin setup (manual, one time):
-- 1. Create your own account through Supabase Auth.
-- 2. In Supabase Dashboard -> Authentication -> Users, copy that user's UUID.
-- 3. Run the following with your actual UUID:
-- update public.profiles
--    set role = 'admin'
--  where id = 'YOUR-AUTH-USER-UUID';
--
-- Expiry schedule (optional; enable pg_cron first):
-- select cron.schedule(
--   'expire-listings',
--   '*/10 * * * *',
--   'select public.expire_listings()'
-- );
