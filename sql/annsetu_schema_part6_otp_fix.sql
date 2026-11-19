-- AnnSetu part 6 (applied to the live project on 2026-11-19 during the restore).
-- Fix: accepting a request failed with "function gen_random_bytes(integer) does not exist"
-- because pgcrypto lives in the "extensions" schema on Supabase.
alter function public.respond_request(uuid, boolean) set search_path = public, extensions;
