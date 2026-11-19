-- Onboarding helper: the caller's organisation with plain lat/lng (PostgREST returns geography as
-- WKB otherwise). Security invoker: RLS decides, so it only ever returns the caller's own row.
create or replace function public.my_organization()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select to_jsonb(o) - 'location'
         || jsonb_build_object('lat', extensions.st_y(o.location::extensions.geometry),
                               'lng', extensions.st_x(o.location::extensions.geometry))
  from public.organizations o
  where o.owner_id = (select auth.uid());
$$;
revoke execute on function public.my_organization() from public, anon;
grant execute on function public.my_organization() to authenticated;
