-- Test helpers: users, impersonation, assertions. Loaded by run.sh after the migrations.
create schema if not exists tests;
grant usage on schema tests to anon, authenticated, service_role;

-- create an auth user (and profile via trigger); returns its id
create or replace function tests.create_user(p_email text, p_role text default null, p_name text default null)
returns uuid language plpgsql security definer as $$
declare v uuid;
begin
  insert into auth.users (email, raw_user_meta_data)
  values (p_email, jsonb_strip_nulls(jsonb_build_object('role', p_role, 'full_name', coalesce(p_name, split_part(p_email, '@', 1)))))
  returning id into v;
  return v;
end $$;

-- impersonate: set JWT claims; caller then runs `set role authenticated`
create or replace function tests.as_user(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', p_user, 'role', 'authenticated')::text, false);
$$;
create or replace function tests.as_anon() returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('role', 'anon')::text, false);
$$;

create or replace function tests.ok(p_cond boolean, p_msg text) returns void language plpgsql as $$
begin
  if p_cond is distinct from true then raise exception 'FAIL: %', p_msg; end if;
  raise notice 'ok - %', p_msg;
end $$;

-- expects the statement to raise; optionally checks the message contains p_like
create or replace function tests.throws(p_sql text, p_msg text, p_like text default null) returns void language plpgsql as $$
declare v_err text;
begin
  begin
    execute p_sql;
  exception when others then
    v_err := sqlerrm;
  end;
  if v_err is null then raise exception 'FAIL (did not throw): %', p_msg; end if;
  if p_like is not null and v_err not ilike '%' || p_like || '%' then
    raise exception 'FAIL (wrong error "%"): %', v_err, p_msg;
  end if;
  raise notice 'ok - % (threw: %)', p_msg, v_err;
end $$;

create or replace function tests.count(p_sql text) returns bigint language plpgsql as $$
declare v bigint;
begin
  execute 'select count(*) from (' || p_sql || ') t' into v;
  return v;
end $$;

grant execute on all functions in schema tests to anon, authenticated, service_role;
