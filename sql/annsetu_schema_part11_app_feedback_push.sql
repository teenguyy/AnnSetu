-- =====================================================================
-- AnnSetu PART 11: feedback & support, admin announcements, push tokens
-- Run AFTER parts 1-4 (part 5 is the optional website public preview and is independent).
-- Additive only: no existing table, policy or function is changed.
-- Safe to re-run: every object is created with IF NOT EXISTS / OR REPLACE / guarded blocks.
-- =====================================================================
set search_path = public;

-- ---------------------------------------------------------------------
-- 1. FEEDBACK
-- ---------------------------------------------------------------------
create table if not exists public.feedback (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  org_id          uuid references public.organizations(id) on delete set null,
  category        text not null check (category in ('general','bug','feature','account','donation','pickup','other')),
  rating          int  check (rating between 1 and 5),
  subject         text not null check (char_length(trim(subject)) between 3 and 120),
  message         text not null check (char_length(trim(message)) between 10 and 2000),
  screenshot_path text check (screenshot_path is null or char_length(screenshot_path) <= 300),
  app_platform    text not null default 'web' check (app_platform in ('android','web','ios')),
  app_version     text check (char_length(app_version) <= 40),
  status          text not null default 'open' check (status in ('open','in_review','resolved','closed')),
  admin_response  text check (char_length(admin_response) <= 2000),
  responded_by    uuid references public.profiles(id) on delete set null,
  responded_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists feedback_user_idx   on public.feedback (user_id, created_at desc);
create index if not exists feedback_status_idx on public.feedback (status, created_at desc);
create index if not exists feedback_cat_idx    on public.feedback (category);

alter table public.feedback enable row level security;

-- Clients may only write the user-facing columns; status/response are set by respond_feedback().
revoke all on public.feedback from anon, authenticated;
grant select on public.feedback to authenticated;
grant insert (org_id, category, rating, subject, message, screenshot_path, app_platform, app_version)
  on public.feedback to authenticated;

drop policy if exists feedback_read on public.feedback;
create policy feedback_read on public.feedback for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists feedback_insert on public.feedback;
create policy feedback_insert on public.feedback for insert to authenticated
  with check (
    user_id = auth.uid()
    and (org_id is null or org_id = public.my_org_id())
    -- screenshots must live in the sender's own folder
    and (screenshot_path is null or split_part(screenshot_path, '/', 1) = auth.uid()::text)
    -- simple abuse limit: at most 10 feedback items per user per hour
    and (select count(*) from public.feedback f
          where f.user_id = auth.uid() and f.created_at > now() - interval '1 hour') < 10
  );

create or replace function public.trg_feedback_touch() returns trigger
language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists feedback_touch on public.feedback;
create trigger feedback_touch before update on public.feedback
  for each row execute function public.trg_feedback_touch();

create or replace function public.trg_feedback_filed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform notify_admins('New feedback', initcap(new.category) || ': ' || left(new.subject, 80));
  return new;
end $$;
drop trigger if exists feedback_filed on public.feedback;
create trigger feedback_filed after insert on public.feedback
  for each row execute function public.trg_feedback_filed();

-- Admin responds / changes status. Audited, and the user is notified.
create or replace function public.respond_feedback(p_feedback uuid, p_status text, p_response text default null)
returns void language plpgsql security definer set search_path = public as $$
declare f feedback;
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  if p_status not in ('open','in_review','resolved','closed') then raise exception 'Invalid status'; end if;
  if p_response is not null and char_length(p_response) > 2000 then raise exception 'Response is too long'; end if;
  update feedback
     set status = p_status,
         admin_response = coalesce(nullif(trim(p_response), ''), admin_response),
         responded_by = case when nullif(trim(p_response), '') is not null then auth.uid() else responded_by end,
         responded_at = case when nullif(trim(p_response), '') is not null then now() else responded_at end
   where id = p_feedback returning * into f;
  if not found then raise exception 'Feedback not found'; end if;
  perform log_audit('feedback_' || p_status, 'feedback', p_feedback,
                    jsonb_build_object('note', nullif(trim(p_response), '')));
  insert into notifications (user_id, title, body)
  values (f.user_id,
          case when nullif(trim(p_response), '') is not null then 'AnnSetu replied to your feedback'
               else 'Feedback ' || replace(p_status, '_', ' ') end,
          left(coalesce(nullif(trim(p_response), ''), f.subject), 120));
end $$;

-- ---------------------------------------------------------------------
-- 2. FEEDBACK SCREENSHOTS (private bucket, own-folder upload, owner + admin read)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('feedback-screenshots', 'feedback-screenshots', false, 3145728, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists feedback_shots_write on storage.objects;
create policy feedback_shots_write on storage.objects for insert to authenticated
  with check (bucket_id = 'feedback-screenshots' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists feedback_shots_read on storage.objects;
create policy feedback_shots_read on storage.objects for select to authenticated
  using (bucket_id = 'feedback-screenshots'
         and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- ---------------------------------------------------------------------
-- 3. ADMIN ANNOUNCEMENTS (one notification per targeted user)
-- ---------------------------------------------------------------------
create or replace function public.admin_announce(p_title text, p_body text, p_audience text default 'all')
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  if p_audience not in ('all','donor','ngo') then raise exception 'Invalid audience'; end if;
  if char_length(trim(coalesce(p_title, ''))) < 3 then raise exception 'Title is too short'; end if;
  if char_length(coalesce(p_body, '')) > 500 then raise exception 'Message is too long'; end if;
  insert into notifications (user_id, title, body)
  select id, 'Announcement: ' || trim(p_title), nullif(trim(p_body), '')
    from profiles where role <> 'admin' and (p_audience = 'all' or role = p_audience);
  get diagnostics n = row_count;
  perform log_audit('announcement', 'notifications', null,
                    jsonb_build_object('note', trim(p_title), 'audience', p_audience, 'recipients', n));
  return n;
end $$;

-- ---------------------------------------------------------------------
-- 4. PUSH DEVICE TOKENS (FCM). Users manage only their own tokens.
-- ---------------------------------------------------------------------
create table if not exists public.device_tokens (
  token      text primary key check (char_length(token) between 20 and 4096),
  user_id    uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  platform   text not null default 'android' check (platform in ('android','ios','web')),
  updated_at timestamptz not null default now()
);
create index if not exists device_tokens_user_idx on public.device_tokens (user_id);
alter table public.device_tokens enable row level security;
revoke all on public.device_tokens from anon, authenticated;
grant select, delete on public.device_tokens to authenticated;

drop policy if exists tokens_own on public.device_tokens;
create policy tokens_own on public.device_tokens for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Upsert through a function so a token that moves to another account is re-assigned safely.
create or replace function public.register_device_token(p_token text, p_platform text default 'android')
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if p_platform not in ('android','ios','web') then raise exception 'Invalid platform'; end if;
  insert into device_tokens (token, user_id, platform, updated_at) values (p_token, auth.uid(), p_platform, now())
  on conflict (token) do update set user_id = auth.uid(), platform = excluded.platform, updated_at = now();
end $$;

-- ---------------------------------------------------------------------
-- 5. PRIVILEGES ON NEW FUNCTIONS
-- ---------------------------------------------------------------------
revoke all on function public.trg_feedback_touch(), public.trg_feedback_filed() from public, anon, authenticated;
revoke all on function public.respond_feedback(uuid, text, text), public.admin_announce(text, text, text),
  public.register_device_token(text, text) from public, anon;
grant execute on function public.respond_feedback(uuid, text, text), public.admin_announce(text, text, text),
  public.register_device_token(text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 6. REALTIME (RLS still applies to every change event)
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['food_listings','feedback'] loop
      if not exists (select 1 from pg_publication_tables
                      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;
