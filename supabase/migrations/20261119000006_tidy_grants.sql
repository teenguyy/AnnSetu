-- The project's rls_auto_enable event-trigger function is not an API: remove execute rights that
-- the blanket grant in 20261119000003 gave it (no-op where the function does not exist).
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;
