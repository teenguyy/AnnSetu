-- =====================================================================
-- AnnSetu PART 12: phone push notifications for every in-app notification.
-- After a row is inserted into notifications, pg_net calls the AnnSetu API
-- (POST /api/push/send) with that user's device tokens. The API sends through
-- Firebase Cloud Messaging. The call is asynchronous and can never block or fail
-- the notification itself.
-- The push secret is generated inside the database (site_private, not readable by
-- clients); the API only knows its SHA-256 (env PUSH_SECRET_SHA256).
-- Run AFTER parts 9 and 11. Safe to re-run.
-- =====================================================================
create extension if not exists pg_net with schema extensions;

insert into site_private.config (key, value)
select 'push_secret', encode(extensions.gen_random_bytes(32), 'hex')
where not exists (select 1 from site_private.config where key = 'push_secret');
insert into site_private.config (key, value)
values ('push_url', 'https://annsetu-inky.vercel.app/api/push/send')
on conflict (key) do nothing;

create or replace function public.trg_push_notification() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare v_tokens text[]; v_secret text; v_url text;
begin
  select array_agg(token) into v_tokens
    from (select token from device_tokens where user_id = new.user_id order by updated_at desc limit 10) t;
  if v_tokens is null then return new; end if;
  select value into v_secret from site_private.config where key = 'push_secret';
  select value into v_url from site_private.config where key = 'push_url';
  if v_secret is null or v_url is null then return new; end if;
  perform net.http_post(
    url := v_url,
    body := jsonb_build_object('tokens', to_jsonb(v_tokens), 'title', new.title, 'body', new.body),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret),
    timeout_milliseconds := 8000);
  return new;
exception when others then
  return new; -- a push problem must never stop the in-app notification
end $$;
revoke all on function public.trg_push_notification() from public, anon, authenticated;

drop trigger if exists notifications_push on public.notifications;
create trigger notifications_push after insert on public.notifications
  for each row execute function public.trg_push_notification();
