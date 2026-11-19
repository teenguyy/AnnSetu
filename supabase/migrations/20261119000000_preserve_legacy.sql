-- Upgrade path from the first AnnSetu schema (v1). Runs only when the v1 tables are present
-- (detected by organizations.verification); on a fresh database it does nothing.
--
-- Nothing is deleted: every v1 table and view moves, data intact, into the private `legacy`
-- schema (not exposed through the API). The v1 functions, triggers and storage policies are
-- dropped because they reference the old structure. 20261119000005_import_legacy.sql copies the
-- rows into the new tables. Drop `legacy` only after the owner confirms the import.

do $$
declare
  r record;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'organizations' and column_name = 'verification'
  ) then
    raise notice 'No v1 schema found; nothing to preserve';
    return;
  end if;

  create schema if not exists legacy;
  revoke all on schema legacy from public, anon, authenticated;

  -- stop broadcasting v1 tables over realtime
  for r in select schemaname, tablename from pg_publication_tables
           where pubname = 'supabase_realtime' and schemaname = 'public' loop
    execute format('alter publication supabase_realtime drop table %I.%I', r.schemaname, r.tablename);
  end loop;

  -- v1 storage policies (buckets and files stay)
  drop policy if exists photos_delete on storage.objects;
  drop policy if exists photos_update on storage.objects;
  drop policy if exists photos_write on storage.objects;
  drop policy if exists vdocs_upload on storage.objects;
  drop policy if exists vdocs_view on storage.objects;

  drop trigger if exists on_auth_user_created on auth.users;

  -- v1 functions (cascade removes their triggers and policies). Keep extension-owned
  -- functions and the project's rls_auto_enable event-trigger function.
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f' and p.proname <> 'rls_auto_enable'
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    execute 'drop function ' || r.sig || ' cascade';
  end loop;

  for r in select table_name from information_schema.views where table_schema = 'public' loop
    execute format('alter view public.%I set schema legacy', r.table_name);
  end loop;
  for r in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I set schema legacy', r.tablename);
  end loop;
end $$;
