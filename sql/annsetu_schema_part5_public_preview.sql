-- =====================================================================
-- AnnSetu: OPTIONAL part 5. Public, privacy-safe food preview for the homepage.
-- Run AFTER parts 1-4, only if you want signed-out visitors to SEE live listings.
-- NOT tested against a live project. Try it on a test project first.
--
-- Without this file the homepage still works: signed-out visitors see a
-- "live listings are for verified receivers" panel (current RLS behaviour).
--
-- What it exposes (read-only): title, category, quantities, unit, pickup deadline,
-- safety notes, photo path and the donor organisation's NAME. It never exposes
-- addresses, phone numbers, coordinates, owners or requests.
-- Only active, unexpired, not fully reserved listings from approved,
-- non-suspended donors are returned. Requesting food still requires a signed-in,
-- verified NGO through create_request(); this function cannot change anything.
-- =====================================================================

create or replace function public.public_listings_preview(p_limit int default 24)
returns table (id uuid, title text, category text, quantity int, qty_reserved int, unit text,
               pickup_by timestamptz, safety_notes text, photo_path text, donor_name text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select l.id, l.title, l.category, l.quantity, l.qty_reserved, l.unit, l.pickup_by,
         l.safety_notes, l.photo_path, o.name, l.created_at
    from food_listings l
    join organizations o on o.id = l.donor_org_id
   where l.status = 'active' and l.pickup_by > now() and l.qty_reserved < l.quantity
     and o.verification = 'approved' and not o.suspended
   order by l.pickup_by asc
   limit least(greatest(coalesce(p_limit, 24), 1), 48) $$;

revoke all on function public.public_listings_preview(int) from public;
grant execute on function public.public_listings_preview(int) to anon, authenticated;
