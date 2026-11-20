-- =====================================================================
-- AnnSetu PART 9 (website): automatic AI review right after a document upload.
-- The uploader's browser asks the FastAPI backend to review its own new document.
-- The backend saves the result with save_document_review_auto(), proving it is the
-- backend by sending a server secret. The database keeps ONLY the SHA-256 hash of
-- that secret, so nobody reading the database (or this file) can forge reviews.
-- Run AFTER part 7. Set the hash with the statement at the end (replace the value
-- when you rotate the secret; the secret itself lives only in the backend's env).
-- =====================================================================
set search_path = public, extensions;

create schema if not exists site_private;
revoke all on schema site_private from public, anon, authenticated;
create table if not exists site_private.config (key text primary key, value text not null);
revoke all on site_private.config from public, anon, authenticated;

alter table public.document_reviews add column if not exists automatic boolean not null default false;
alter table public.document_reviews add column if not exists genuine text
  check (genuine in ('likely_genuine','uncertain','likely_fake'));

create or replace function public.save_document_review_auto(p_secret text, p_doc uuid, p_summary text,
  p_extracted jsonb, p_checks jsonb, p_confidence int, p_recommendation text, p_genuine text, p_model text) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare d verification_documents; v_id uuid; v_num text; v_checks jsonb := coalesce(p_checks, '[]'); v_rec text := p_recommendation;
begin
  if coalesce(p_secret, '') = '' or encode(digest(p_secret, 'sha256'), 'hex') is distinct from
     (select value from site_private.config where key = 'ai_secret_sha256') then
    raise exception 'Not allowed';
  end if;
  select * into d from verification_documents where id = p_doc;
  if not found then raise exception 'Document not found'; end if;
  if exists (select 1 from document_reviews where document_id = p_doc and automatic) then
    return (select id from document_reviews where document_id = p_doc and automatic order by created_at desc limit 1);
  end if;
  -- duplicate registration numbers across organisations (checked here, where all reviews are visible)
  v_num := regexp_replace(coalesce(p_extracted->>'registration_number', ''), '\s', '', 'g');
  if v_num <> '' then
    if exists (select 1 from document_reviews r where r.org_id <> d.org_id
                 and regexp_replace(coalesce(r.extracted->>'registration_number', ''), '\s', '', 'g') = v_num) then
      v_checks := v_checks || jsonb_build_array(jsonb_build_object('check', 'Duplicate number', 'result', 'fail',
                  'detail', 'The same number is already used by another organisation.'));
      v_rec := 'likely_invalid';
    else
      v_checks := v_checks || jsonb_build_array(jsonb_build_object('check', 'Duplicate number', 'result', 'pass',
                  'detail', 'Not used by any other organisation on AnnSetu.'));
    end if;
  end if;
  insert into document_reviews (document_id, org_id, kind, summary, extracted, checks, confidence, recommendation, model, automatic, genuine)
  values (p_doc, d.org_id, 'document', left(p_summary, 4000), coalesce(p_extracted, '{}'), v_checks,
          p_confidence, v_rec, p_model, true, p_genuine)
  returning id into v_id;
  perform notify_admins('AI review ready', (select name from organizations where id = d.org_id) || ': ' ||
          case v_rec when 'looks_valid' then 'AI verified' when 'likely_invalid' then 'AI flagged as likely invalid' else 'needs a closer look' end);
  return v_id;
end $$;
revoke all on function public.save_document_review_auto(text,uuid,text,jsonb,jsonb,int,text,text,text) from public, anon;
grant execute on function public.save_document_review_auto(text,uuid,text,jsonb,jsonb,int,text,text,text) to authenticated;

-- manual review keeps working (save_document_review, admins only); store genuineness there too
create or replace function public.save_document_review(p_org uuid, p_doc uuid, p_kind text, p_summary text,
  p_extracted jsonb, p_checks jsonb, p_confidence int, p_recommendation text, p_model text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  insert into document_reviews (document_id, org_id, kind, summary, extracted, checks, confidence, recommendation, model, created_by, genuine)
  values (p_doc, p_org, coalesce(p_kind, 'document'), left(p_summary, 4000), coalesce(p_extracted, '{}'),
          coalesce(p_checks, '[]'), p_confidence, p_recommendation, p_model, auth.uid(),
          case when p_extracted ? 'genuine' and p_extracted->>'genuine' in ('likely_genuine','uncertain','likely_fake')
               then p_extracted->>'genuine' end)
  returning id into v_id;
  perform log_audit('ai_review', 'organizations', p_org, jsonb_build_object('document', p_doc, 'recommendation', p_recommendation));
  return v_id;
end $$;

-- set / rotate the secret hash (value = sha256 hex of the backend's AI_REVIEW_SECRET)
insert into site_private.config (key, value)
values ('ai_secret_sha256', '51f0eb7b42d4b29d99145813ba0daaeaae1eb0a7479574bae9a12d42c2838f6f')
on conflict (key) do update set value = excluded.value;
