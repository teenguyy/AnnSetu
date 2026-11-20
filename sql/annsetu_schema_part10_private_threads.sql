-- =====================================================================
-- AnnSetu PART 10 (website): private chat threads per pickup.
-- Each request has three separate conversations, each visible ONLY to its two parties:
--   donor_ngo  (donor <-> receiver), donor_rep (donor <-> representative), ngo_rep (receiver <-> representative)
-- Existing messages become donor_ngo. Admins can still read threads of a reported request.
-- Run AFTER part 7. Additive and safe to re-run.
-- =====================================================================
set search_path = public;

alter table public.messages add column if not exists thread text not null default 'donor_ngo';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'messages_thread_chk') then
    alter table public.messages add constraint messages_thread_chk check (thread in ('donor_ngo','donor_rep','ngo_rep'));
  end if;
end $$;
create index if not exists messages_thread_idx on public.messages (request_id, thread, created_at);
grant insert (thread) on public.messages to authenticated;

-- which sides of this request the caller is on (an account can be at most donor/ngo owner and/or rep)
create or replace function public.my_sides(p_req uuid) returns text[]
language sql stable security definer set search_path = public as $$
  select array_remove(array[
    case when exists (select 1 from food_requests r join food_listings l on l.id = r.listing_id
                       join organizations o on o.id = l.donor_org_id
                      where r.id = p_req and o.owner_id = auth.uid()) then 'donor' end,
    case when exists (select 1 from food_requests r join organizations o on o.id = r.ngo_org_id
                      where r.id = p_req and o.owner_id = auth.uid()) then 'ngo' end,
    case when public.is_rep_of_request(p_req) then 'rep' end], null) $$;

create or replace function public.can_use_thread(p_req uuid, p_thread text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from unnest(public.my_sides(p_req)) s
                  where (p_thread = 'donor_ngo' and s in ('donor','ngo'))
                     or (p_thread = 'donor_rep' and s in ('donor','rep'))
                     or (p_thread = 'ngo_rep'   and s in ('ngo','rep'))) $$;
revoke all on function public.my_sides(uuid), public.can_use_thread(uuid, text) from public, anon;
grant execute on function public.my_sides(uuid), public.can_use_thread(uuid, text) to authenticated;

drop policy if exists msgs_read on public.messages;
create policy msgs_read on public.messages for select to authenticated
  using (public.can_use_thread(request_id, thread)
         or (public.is_admin() and exists (select 1 from public.reports rp where rp.request_id = messages.request_id)));
drop policy if exists msgs_insert on public.messages;
create policy msgs_insert on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and public.can_use_thread(request_id, thread)
              and exists (select 1 from public.food_requests r where r.id = request_id
                          and r.status in ('pending','accepted','completed')));

-- notify only the other party of the thread
create or replace function public.trg_message_sent() returns trigger
language plpgsql security definer set search_path = public as $$
declare r food_requests; l food_listings; ngo_owner uuid; donor_owner uuid; rep_user uuid; v_to uuid[];
begin
  select * into r from food_requests where id = new.request_id;
  select * into l from food_listings where id = r.listing_id;
  select owner_id into ngo_owner   from organizations where id = r.ngo_org_id;
  select owner_id into donor_owner from organizations where id = l.donor_org_id;
  select user_id into rep_user from representatives where id = r.rep_id;
  v_to := case new.thread when 'donor_ngo' then array[donor_owner, ngo_owner]
                          when 'donor_rep' then array[donor_owner, rep_user]
                          else array[ngo_owner, rep_user] end;
  insert into notifications (user_id, title, body)
  select u, 'New message', left(new.body, 80) from unnest(v_to) u
   where u is not null and u <> new.sender_id;
  return new;
end $$;
