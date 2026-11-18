-- AnnSetu Part 4: lets a brand-new Google sign-in pick Donor or Receiver.
-- Run AFTER part 1, part 2 and part 3. Safe to run once.
-- A user may switch between donor and ngo ONLY while they have no organisation yet.
-- Admin accounts can never be changed through this function.
create or replace function public.set_my_role(p_role text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if p_role not in ('donor','ngo') then raise exception 'Invalid role'; end if;
  if exists (select 1 from organizations where owner_id = auth.uid()) then
    raise exception 'Role can''t be changed after your organisation profile exists'; end if;
  update profiles set role = p_role where id = auth.uid() and role <> 'admin';
end $$;
revoke all on function public.set_my_role(text) from public, anon;
grant execute on function public.set_my_role(text) to authenticated;
