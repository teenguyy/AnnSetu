-- AnnSetu schema: extensions, types, tables, constraints, indexes.
-- RLS policies and grants: 20261119000002_rls.sql. Business functions: 20261119000003_functions.sql.

create extension if not exists postgis with schema extensions;
create extension if not exists vector with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

-- ───────────────────────── types ─────────────────────────
create type public.user_role as enum ('donor', 'ngo', 'representative', 'admin');
create type public.org_kind as enum ('donor', 'ngo');
create type public.org_status as enum ('pending', 'approved', 'rejected', 'suspended');
create type public.doc_status as enum ('pending', 'approved', 'rejected');
create type public.rep_status as enum ('invited', 'active', 'inactive');
create type public.food_unit as enum ('portions', 'kg', 'packs');
create type public.diet_type as enum ('veg', 'non_veg', 'mixed');
create type public.listing_status as enum ('active', 'reserved', 'completed', 'expired', 'withdrawn');
create type public.request_status as enum ('pending', 'accepted', 'rejected', 'cancelled', 'completed', 'expired');
create type public.timeline_status as enum ('assigned', 'on_the_way', 'arrived', 'collected', 'delivered');
create type public.report_status as enum ('open', 'in_review', 'resolved', 'dismissed');
create type public.feedback_status as enum ('open', 'in_review', 'resolved', 'closed');
create type public.job_status as enum ('queued', 'running', 'done', 'failed');

-- ───────────────────── people & organisations ─────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role,
  full_name text check (char_length(full_name) <= 120),
  phone text check (phone ~ '^\+?[0-9 ]{7,20}$'),
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_role_idx on public.profiles (role);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles (id) on delete cascade,
  kind public.org_kind not null,
  org_type text not null check (org_type in (
    'restaurant', 'hotel', 'canteen', 'caterer', 'event_organiser', 'food_business', 'community_kitchen',
    'ngo', 'shelter', 'orphanage', 'old_age_home', 'community_group')),
  status public.org_status not null default 'pending',
  name text not null check (char_length(name) between 2 and 160),
  contact_person text check (char_length(contact_person) <= 120),
  phone text check (phone ~ '^\+?[0-9 ]{7,20}$'),
  email text check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  address text check (char_length(address) <= 400),
  city text check (char_length(city) <= 80),
  state text check (char_length(state) <= 80),
  pincode text check (pincode ~ '^[0-9]{6}$'),
  location extensions.geography (point, 4326),
  about text check (char_length(about) <= 2000),
  operating_hours jsonb not null default '{}'::jsonb,
  pickup_windows jsonb not null default '[]'::jsonb,
  logo_path text,
  fssai_number text check (fssai_number ~ '^[0-9]{14}$'),
  area_served text check (char_length(area_served) <= 300),
  beneficiaries_per_day integer check (beneficiaries_per_day between 1 and 1000000),
  profile_completed_at timestamptz,
  no_certificate boolean not null default false,
  no_cert_explanation text check (char_length(no_cert_explanation) <= 3000),
  no_cert_references text check (char_length(no_cert_references) <= 1000),
  review_due_at timestamptz,
  verified_at timestamptz,
  verified_by uuid references public.profiles (id) on delete set null,
  rejection_note text,
  suspended_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint org_type_matches_kind check (
    (kind = 'donor' and org_type in ('restaurant', 'hotel', 'canteen', 'caterer', 'event_organiser', 'food_business', 'community_kitchen'))
    or (kind = 'ngo' and org_type in ('ngo', 'shelter', 'orphanage', 'old_age_home', 'community_kitchen', 'community_group'))),
  constraint no_cert_allowed check (
    not no_certificate
    or (kind = 'ngo' and org_type in ('ngo', 'community_group', 'community_kitchen'))
    or (kind = 'donor' and org_type = 'community_kitchen'))
);
create index organizations_status_kind_idx on public.organizations (status, kind);
create index organizations_location_idx on public.organizations using gist (location);
create index organizations_city_idx on public.organizations (city);
create index organizations_verified_by_idx on public.organizations (verified_by);
create index organizations_no_cert_queue_idx on public.organizations (review_due_at) where no_certificate and status = 'pending';

-- ───────────────────────── verification ─────────────────────────
create table public.verification_documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  doc_type text not null check (doc_type in (
    'fssai_licence', 'ngo_registration', '12a_80g', 'trust_deed', 'society_registration',
    'ngo_darpan', 'authorised_person_id', 'supporting_proof', 'other')),
  storage_path text not null,
  status public.doc_status not null default 'pending',
  admin_note text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index verification_documents_org_idx on public.verification_documents (org_id);
create index verification_documents_status_idx on public.verification_documents (status);
create index verification_documents_reviewed_by_idx on public.verification_documents (reviewed_by);

create table public.document_ai_reviews (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references public.verification_documents (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed', 'unavailable')),
  model text,
  prompt_version text,
  extracted jsonb,
  checks jsonb,
  confidence integer check (confidence between 0 and 100),
  recommendation text check (recommendation in ('looks_valid', 'needs_closer_look', 'likely_invalid')),
  summary text,
  raw jsonb,
  error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index document_ai_reviews_document_idx on public.document_ai_reviews (document_id);
create index document_ai_reviews_org_idx on public.document_ai_reviews (org_id);

-- ───────────────────────── representatives ─────────────────────────
create table public.representatives (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  name text not null check (char_length(name) between 2 and 120),
  phone text not null check (phone ~ '^\+?[0-9 ]{7,20}$'),
  email text check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  photo_path text,
  status public.rep_status not null default 'active',
  invited_at timestamptz,
  last_active_at timestamptz,
  created_at timestamptz not null default now()
);
create index representatives_org_idx on public.representatives (org_id);
create index representatives_user_idx on public.representatives (user_id);
-- a person belongs to at most one active NGO
create unique index representatives_one_active_org on public.representatives (user_id) where status = 'active' and user_id is not null;

create table public.rep_invitations (
  id uuid primary key default gen_random_uuid(),
  rep_id uuid not null references public.representatives (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create index rep_invitations_rep_idx on public.rep_invitations (rep_id);

-- ───────────────────────── food & pickups ─────────────────────────
create table public.food_listings (
  id uuid primary key default gen_random_uuid(),
  donor_org_id uuid not null references public.organizations (id) on delete cascade,
  title text not null check (char_length(title) between 3 and 120),
  category text not null check (category in (
    'cooked_meals', 'bakery', 'fruits_vegetables', 'dairy', 'packaged', 'beverages', 'raw_grains', 'other')),
  qty_total numeric(10, 2) not null check (qty_total > 0 and qty_total <= 100000),
  qty_reserved numeric(10, 2) not null default 0 check (qty_reserved >= 0),
  qty_collected numeric(10, 2) not null default 0 check (qty_collected >= 0),
  unit public.food_unit not null,
  prepared_at timestamptz,
  pickup_by timestamptz not null,
  photos text[] not null default '{}' check (cardinality(photos) <= 3),
  diet public.diet_type not null,
  allergens text[] not null default '{}' check (cardinality(allergens) <= 14),
  safety_notes text check (char_length(safety_notes) <= 1000),
  pickup_instructions text check (char_length(pickup_instructions) <= 1000),
  status public.listing_status not null default 'active',
  location extensions.geography (point, 4326),
  withdrawn_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint qty_within_total check (qty_reserved + qty_collected <= qty_total),
  constraint prepared_before_pickup check (prepared_at is null or prepared_at < pickup_by)
);
create index food_listings_donor_idx on public.food_listings (donor_org_id);
create index food_listings_status_idx on public.food_listings (status);
create index food_listings_active_idx on public.food_listings (pickup_by) where status = 'active';
create index food_listings_location_idx on public.food_listings using gist (location);
create index food_listings_created_idx on public.food_listings (created_at desc);

create table public.food_requests (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.food_listings (id) on delete cascade,
  receiver_org_id uuid not null references public.organizations (id) on delete cascade,
  rep_id uuid references public.representatives (id) on delete set null,
  qty numeric(10, 2) not null check (qty > 0),
  status public.request_status not null default 'pending',
  timeline_status public.timeline_status not null default 'assigned',
  eta timestamptz,
  rep_name text,
  rep_phone text,
  note text check (char_length(note) <= 500),
  response_note text check (char_length(response_note) <= 500),
  responded_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index food_requests_listing_idx on public.food_requests (listing_id);
create index food_requests_receiver_idx on public.food_requests (receiver_org_id, status);
create index food_requests_rep_idx on public.food_requests (rep_id);
create index food_requests_status_idx on public.food_requests (status);
-- one pending request per receiver per listing
create unique index food_requests_one_pending on public.food_requests (listing_id, receiver_org_id) where status = 'pending';

create table public.pickup_otps (
  request_id uuid primary key references public.food_requests (id) on delete cascade,
  code text not null check (code ~ '^[0-9]{4}$'),
  expires_at timestamptz not null,
  attempts integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.rep_access_tokens (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.food_requests (id) on delete cascade,
  rep_id uuid not null references public.representatives (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index rep_access_tokens_request_idx on public.rep_access_tokens (request_id);
create index rep_access_tokens_rep_idx on public.rep_access_tokens (rep_id);

create table public.pickup_events (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.food_requests (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  event text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index pickup_events_request_idx on public.pickup_events (request_id, created_at);
create index pickup_events_actor_idx on public.pickup_events (actor_id);

create table public.rep_locations (
  request_id uuid primary key references public.food_requests (id) on delete cascade,
  rep_id uuid not null references public.representatives (id) on delete cascade,
  point extensions.geography (point, 4326) not null,
  accuracy_m numeric(8, 2),
  recorded_at timestamptz not null default now()
);
create index rep_locations_rep_idx on public.rep_locations (rep_id);

create table public.requirements (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  title text not null check (char_length(title) between 3 and 120),
  category text check (category in (
    'cooked_meals', 'bakery', 'fruits_vegetables', 'dairy', 'packaged', 'beverages', 'raw_grains', 'other')),
  qty numeric(10, 2) check (qty > 0),
  unit public.food_unit,
  needed_by timestamptz,
  notes text check (char_length(notes) <= 1000),
  status text not null default 'open' check (status in ('open', 'fulfilled')),
  created_at timestamptz not null default now()
);
create index requirements_org_idx on public.requirements (org_id);
create index requirements_open_idx on public.requirements (created_at desc) where status = 'open';

-- ───────────────────────── communication ─────────────────────────
create table public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  category text not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;

create table public.notification_preferences (
  user_id uuid not null references public.profiles (id) on delete cascade,
  category text not null,
  in_app boolean not null default true,
  email boolean not null default true,
  primary key (user_id, category)
);

create table public.messages (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.food_requests (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text check (char_length(body) between 1 and 2000),
  attachment_path text,
  created_at timestamptz not null default now(),
  constraint message_has_content check (body is not null or attachment_path is not null)
);
create index messages_request_idx on public.messages (request_id, id);
create index messages_sender_idx on public.messages (sender_id);

create table public.message_reads (
  request_id uuid not null references public.food_requests (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  last_read_message_id bigint not null,
  read_at timestamptz not null default now(),
  primary key (request_id, user_id)
);
create index message_reads_user_idx on public.message_reads (user_id);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  audience text not null check (audience in ('all', 'donor', 'ngo', 'representative')),
  title text not null check (char_length(title) between 3 and 140),
  body text not null check (char_length(body) between 3 and 4000),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index announcements_created_idx on public.announcements (created_at desc);
create index announcements_created_by_idx on public.announcements (created_by);

-- ───────────────────────── trust ─────────────────────────
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.food_requests (id) on delete cascade,
  reviewer_org_id uuid not null references public.organizations (id) on delete cascade,
  reviewee_org_id uuid not null references public.organizations (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text check (char_length(comment) <= 1000),
  created_at timestamptz not null default now(),
  unique (request_id, reviewer_org_id)
);
create index reviews_reviewee_idx on public.reviews (reviewee_org_id);
create index reviews_reviewer_idx on public.reviews (reviewer_org_id);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_org_id uuid references public.organizations (id) on delete cascade,
  request_id uuid references public.food_requests (id) on delete set null,
  listing_id uuid references public.food_listings (id) on delete set null,
  rep_id uuid references public.representatives (id) on delete set null,
  reason text not null check (reason in ('food_safety', 'no_show', 'misconduct', 'fraud', 'spam', 'other')),
  details text not null check (char_length(details) between 10 and 2000),
  status public.report_status not null default 'open',
  resolution_note text,
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index reports_status_idx on public.reports (status);
create index reports_reporter_idx on public.reports (reporter_id);
create index reports_target_idx on public.reports (target_org_id);
create index reports_request_idx on public.reports (request_id);
create index reports_listing_idx on public.reports (listing_id);
create index reports_rep_idx on public.reports (rep_id);
create index reports_resolved_by_idx on public.reports (resolved_by);

create table public.report_actions (
  id bigint generated always as identity primary key,
  report_id uuid not null references public.reports (id) on delete cascade,
  admin_id uuid references public.profiles (id) on delete set null,
  action text not null,
  note text,
  created_at timestamptz not null default now()
);
create index report_actions_report_idx on public.report_actions (report_id);
create index report_actions_admin_idx on public.report_actions (admin_id);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  actor_name text,
  actor_email text,
  actor_role text,
  action text not null,
  target_table text,
  target_id text,
  target_label text,
  diff jsonb,
  note text,
  ip_hash text,
  created_at timestamptz not null default now()
);
create index audit_log_created_idx on public.audit_log (created_at desc);
create index audit_log_actor_idx on public.audit_log (actor_id);
create index audit_log_action_idx on public.audit_log (action);

create table public.activity_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  org_id uuid references public.organizations (id) on delete set null,
  action text not null,
  target_table text,
  target_id text,
  data jsonb,
  created_at timestamptz not null default now()
);
create index activity_log_created_idx on public.activity_log (created_at desc);
create index activity_log_actor_idx on public.activity_log (actor_id);
create index activity_log_org_idx on public.activity_log (org_id);

-- ───────────────────────── recognition ─────────────────────────
create table public.badge_definitions (
  code text primary key,
  name text not null,
  description text not null,
  audience text not null check (audience in ('donor', 'ngo', 'both', 'representative')),
  metric text not null check (metric in ('pickups', 'units', 'partners', 'years')),
  threshold numeric not null check (threshold > 0),
  issues_certificate boolean not null default true,
  sort integer not null default 0
);

create table public.org_badges (
  org_id uuid not null references public.organizations (id) on delete cascade,
  badge_code text not null references public.badge_definitions (code) on delete cascade,
  awarded_at timestamptz not null default now(),
  primary key (org_id, badge_code)
);
create index org_badges_badge_idx on public.org_badges (badge_code);

create table public.rep_badges (
  rep_id uuid not null references public.representatives (id) on delete cascade,
  badge_code text not null references public.badge_definitions (code) on delete cascade,
  awarded_at timestamptz not null default now(),
  primary key (rep_id, badge_code)
);
create index rep_badges_badge_idx on public.rep_badges (badge_code);

create table public.certificates (
  id uuid primary key default gen_random_uuid(),
  serial text not null unique,
  org_id uuid not null references public.organizations (id) on delete cascade,
  badge_code text not null references public.badge_definitions (code),
  org_name_snapshot text not null,
  issued_at timestamptz not null default now(),
  pdf_path text,
  revoked_at timestamptz,
  revoke_reason text
);
create index certificates_org_idx on public.certificates (org_id);
create index certificates_badge_idx on public.certificates (badge_code);

create table public.leaderboard_overrides (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  board text not null check (board in ('donor', 'ngo')),
  action text not null check (action in ('pin', 'hide', 'adjust')),
  rank_delta integer,
  reason text not null check (char_length(reason) between 5 and 500),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  active boolean not null default true
);
create index leaderboard_overrides_org_idx on public.leaderboard_overrides (org_id);
create index leaderboard_overrides_created_by_idx on public.leaderboard_overrides (created_by);

-- ───────────────────────── landing & content ─────────────────────────
create table public.landing_snapshot (
  id bigint generated always as identity primary key,
  data jsonb not null,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null
);
create index landing_snapshot_created_idx on public.landing_snapshot (created_at desc);
create index landing_snapshot_created_by_idx on public.landing_snapshot (created_by);

create table public.facts (
  id uuid primary key default gen_random_uuid(),
  headline text not null,
  detail text,
  stat_value text,
  source_name text not null,
  source_url text not null check (source_url ~ '^https://'),
  verified_at date not null,
  active boolean not null default true,
  sort integer not null default 0
);

create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  subject text not null check (char_length(subject) between 3 and 160),
  body text not null check (char_length(body) between 10 and 4000),
  status text not null default 'new' check (status in ('new', 'read', 'replied')),
  created_at timestamptz not null default now()
);
create index contact_messages_status_idx on public.contact_messages (status, created_at desc);

create table public.testimonials (
  id uuid primary key default gen_random_uuid(),
  quote text not null check (char_length(quote) between 10 and 600),
  author_name text not null,
  author_role text,
  org_name text,
  published boolean not null default false,
  sort integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.faqs (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  category text not null default 'general',
  published boolean not null default true,
  sort integer not null default 0
);

create table public.app_settings (
  key text primary key,
  value jsonb not null,
  is_public boolean not null default true,
  updated_at timestamptz not null default now()
);

-- ───────────────────────── support ─────────────────────────
create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  category text not null check (category in (
    'general', 'bug', 'feature', 'account', 'donation', 'pickup', 'other')),
  rating smallint check (rating between 1 and 5),
  subject text not null check (char_length(subject) between 3 and 120),
  details text not null check (char_length(details) between 10 and 2000),
  screenshot_path text,
  platform text,
  app_version text,
  status public.feedback_status not null default 'open',
  admin_reply text,
  replied_by uuid references public.profiles (id) on delete set null,
  replied_at timestamptz,
  created_at timestamptz not null default now()
);
create index feedback_user_idx on public.feedback (user_id, created_at desc);
create index feedback_status_idx on public.feedback (status, category);
create index feedback_replied_by_idx on public.feedback (replied_by);

create table public.device_tokens (
  token text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  platform text not null check (platform in ('android', 'ios', 'web')),
  created_at timestamptz not null default now()
);
create index device_tokens_user_idx on public.device_tokens (user_id);

-- ───────────────────────── chatbot ─────────────────────────
create table public.chatbot_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete cascade,
  role_at_start text,
  logging_opt_out boolean not null default false,
  created_at timestamptz not null default now()
);
create index chatbot_conversations_user_idx on public.chatbot_conversations (user_id);

create table public.chatbot_messages (
  id bigint generated always as identity primary key,
  conversation_id uuid not null references public.chatbot_conversations (id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'tool')),
  content text not null,
  created_at timestamptz not null default now()
);
create index chatbot_messages_conversation_idx on public.chatbot_messages (conversation_id, id);

create table public.kb_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  source text not null,
  audience text not null default 'all',
  embedding extensions.vector (768),
  updated_at timestamptz not null default now()
);
create index kb_documents_embedding_idx on public.kb_documents using hnsw (embedding extensions.vector_cosine_ops);

-- ───────────────────────── system ─────────────────────────
create table public.jobs (
  id bigint generated always as identity primary key,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  status public.job_status not null default 'queued',
  attempts integer not null default 0,
  run_after timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index jobs_queue_idx on public.jobs (run_after) where status = 'queued';

-- ───────────────────────── updated_at triggers ─────────────────────────
create or replace function private.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_touch before update on public.profiles for each row execute function private.touch_updated_at();
create trigger organizations_touch before update on public.organizations for each row execute function private.touch_updated_at();
create trigger food_listings_touch before update on public.food_listings for each row execute function private.touch_updated_at();
create trigger food_requests_touch before update on public.food_requests for each row execute function private.touch_updated_at();
create trigger jobs_touch before update on public.jobs for each row execute function private.touch_updated_at();
