-- =====================================================================
-- AnnSetu PART 6 (website): "We don't have a certificate" manual-review path
-- Run AFTER parts 1-4 (part 5 public preview is optional and independent).
-- Additive and safe to re-run. Lets NGOs, community groups and community kitchens
-- without a registration certificate ask an admin for manual review
-- ("reviewed within 3-5 business days"), and lets admins approve them.
-- =====================================================================
set search_path = public;

alter table public.organizations add column if not exists no_certificate boolean not null default false;
alter table public.organizations add column if not exists no_certificate_note text;
alter table public.organizations add column if not exists no_certificate_requested_at timestamptz;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'org_no_cert_note_len') then
    alter table public.organizations add constraint org_no_cert_note_len
      check (no_certificate_note is null or char_length(no_certificate_note) between 30 and 1000);
  end if;
end $$;

-- Owners may set only the request flag and explanation; the timestamp is set by the trigger below.
grant update (no_certificate, no_certificate_note) on public.organizations to authenticated;

-- Only these organisation types may use the no-certificate path.
create or replace function public.trg_no_certificate() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.no_certificate and not coalesce(old.no_certificate, false) then
    if new.org_type not in ('NGO', 'Community group', 'Community kitchen') then
      raise exception 'Only NGOs, community groups and community kitchens can request review without a certificate';
    end if;
    if coalesce(char_length(trim(new.no_certificate_note)), 0) < 30 then
      raise exception 'Please explain who you serve and since when (at least 30 characters)';
    end if;
    new.no_certificate_requested_at := now();
    perform notify_admins('Review without certificate', new.name || ' asked for manual verification (reply within 3-5 business days)');
  elsif not new.no_certificate then
    new.no_certificate_requested_at := null;
  end if;
  return new;
end $$;
drop trigger if exists no_certificate_trg on public.organizations;
create trigger no_certificate_trg before update of no_certificate, no_certificate_note on public.organizations
  for each row execute function public.trg_no_certificate();
revoke all on function public.trg_no_certificate() from public, anon, authenticated;

-- review_org: same rules as part 2, but an organisation that requested manual review without a
-- certificate can be approved without an approved document (the admin decides, and it is audited).
create or replace function public.review_org(p_org uuid, p_approve boolean, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  if p_approve
     and not exists (select 1 from verification_documents where org_id = p_org and status = 'approved')
     and not exists (select 1 from organizations where id = p_org and no_certificate) then
    raise exception 'Approve at least one verification document first'; end if;
  if not p_approve and coalesce(trim(p_note), '') = '' then
    raise exception 'A note is required when rejecting'; end if;
  update organizations set verification = case when p_approve then 'approved' else 'rejected' end,
         verification_note = p_note where id = p_org;
  perform log_audit(case when p_approve then 'org_approved' else 'org_rejected' end,
                    'organizations', p_org, jsonb_build_object('note', p_note,
                    'no_certificate', (select no_certificate from organizations where id = p_org)));
  perform notify_org(p_org, case when p_approve then 'Organisation verified' else 'Verification rejected' end,
                     coalesce(p_note, ''));
end $$;
revoke all on function public.review_org(uuid, boolean, text) from public, anon;
grant execute on function public.review_org(uuid, boolean, text) to authenticated;
