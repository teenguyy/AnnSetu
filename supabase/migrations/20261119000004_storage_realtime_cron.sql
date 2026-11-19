-- Storage buckets and policies, realtime publication, scheduled jobs.
-- Path conventions: <org_id>/... for organisation files, <user_id>/... for user files,
-- <request_id>/... for chat attachments.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('listing-photos', 'listing-photos', true, 2097152, array['image/jpeg', 'image/png', 'image/webp']),
  ('org-logos', 'org-logos', true, 1048576, array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']),
  ('rep-photos', 'rep-photos', true, 1048576, array['image/jpeg', 'image/png', 'image/webp']),
  ('verification-docs', 'verification-docs', false, 5242880, array['application/pdf', 'image/jpeg', 'image/png']),
  ('feedback-screenshots', 'feedback-screenshots', false, 3145728, array['image/jpeg', 'image/png', 'image/webp']),
  ('chat-attachments', 'chat-attachments', false, 2097152, array['image/jpeg', 'image/png', 'image/webp']),
  ('certificates', 'certificates', false, 10485760, array['application/pdf']),
  ('app-assets', 'app-assets', true, 104857600, null)
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- public buckets: anyone reads; owners write into their own folder
create policy "public buckets readable" on storage.objects for select to anon, authenticated
  using (bucket_id in ('listing-photos', 'org-logos', 'rep-photos', 'app-assets'));

create policy "org folder write" on storage.objects for insert to authenticated
  with check (bucket_id in ('listing-photos', 'org-logos', 'rep-photos', 'verification-docs')
              and (storage.foldername(name))[1] = (select private.my_org_id())::text);
create policy "org folder update" on storage.objects for update to authenticated
  using (bucket_id in ('listing-photos', 'org-logos', 'rep-photos')
         and (storage.foldername(name))[1] = (select private.my_org_id())::text);
create policy "org folder delete" on storage.objects for delete to authenticated
  using (bucket_id in ('listing-photos', 'org-logos', 'rep-photos', 'verification-docs')
         and (storage.foldername(name))[1] = (select private.my_org_id())::text);

-- private: verification documents (owner org + admins)
create policy "verification docs read" on storage.objects for select to authenticated
  using (bucket_id = 'verification-docs'
         and ((storage.foldername(name))[1] = (select private.my_org_id())::text or (select private.is_admin())));

-- private: feedback screenshots (<user_id>/...)
create policy "feedback screenshots write" on storage.objects for insert to authenticated
  with check (bucket_id = 'feedback-screenshots' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "feedback screenshots read" on storage.objects for select to authenticated
  using (bucket_id = 'feedback-screenshots'
         and ((storage.foldername(name))[1] = (select auth.uid())::text or (select private.is_admin())));

-- private: chat attachments (<request_id>/...) for the request's parties
create policy "chat attachments write" on storage.objects for insert to authenticated
  with check (bucket_id = 'chat-attachments'
              and (select private.is_request_party(((storage.foldername(name))[1])::uuid)));
create policy "chat attachments read" on storage.objects for select to authenticated
  using (bucket_id = 'chat-attachments'
         and ((select private.is_request_party(((storage.foldername(name))[1])::uuid))
              or ((select private.is_admin()) and (select private.request_is_reported(((storage.foldername(name))[1])::uuid)))));

-- private: certificates (<org_id>/...) read by the owner org; written by the service role
create policy "certificates read" on storage.objects for select to authenticated
  using (bucket_id = 'certificates'
         and ((storage.foldername(name))[1] = (select private.my_org_id())::text or (select private.is_admin())));

-- app assets: admins upload screenshots and APKs
create policy "app assets admin write" on storage.objects for insert to authenticated
  with check (bucket_id = 'app-assets' and (select private.is_admin()));
create policy "app assets admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'app-assets' and (select private.is_admin()));

-- ───────────────────────── realtime ─────────────────────────
-- Clients subscribe with filters (user_id / request_id); RLS still applies to every change.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table
      public.notifications, public.messages, public.food_requests, public.food_listings,
      public.pickup_events, public.rep_locations;
  end if;
end $$;

-- ───────────────────────── scheduled jobs ─────────────────────────
-- pg_cron needs shared_preload_libraries (enabled on Supabase). Skipped where unavailable.
do $$
begin
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pg_cron unavailable here: %', sqlerrm;
  end;
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('annsetu-expire-listings', '*/10 * * * *', 'select public.expire_listings()');
    perform cron.schedule('annsetu-landing-snapshot', '17 3 * * 1', 'select public.rebuild_landing_snapshot()');
  else
    raise notice 'pg_cron not installed: schedule expire_listings() and rebuild_landing_snapshot() after enabling it';
  end if;
end $$;

-- future functions: no implicit execute for anon/public
alter default privileges in schema public revoke execute on functions from public, anon;
