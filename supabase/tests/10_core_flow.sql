-- End-to-end lifecycle per role: onboarding, verification, listing, discovery, request,
-- OTP, representative tracking, completion, milestones, plus the attacks RLS must block.
\set ON_ERROR_STOP 1

-- ── actors ──
select tests.create_user('admin@test.in', null, 'Asha Admin') as admin \gset
select tests.create_user('donor@test.in', 'donor', 'Dev Donor') as donor \gset
select tests.create_user('ngo@test.in', 'ngo', 'Nina NGO') as ngo \gset
select tests.create_user('ngo2@test.in', 'ngo', 'Omar Other') as ngo2 \gset
select tests.create_user('rep@test.in', null, 'Ravi Rep') as repuser \gset
select tests.create_user('stranger@test.in', null, 'Sam Stranger') as stranger \gset
update public.profiles set role = 'admin' where id = :'admin';
update public.profiles set role = 'representative' where id = :'repuser';

select tests.ok((select role::text from public.profiles where id = :'donor') = 'donor', 'sign-up metadata sets the donor role');
select tests.ok((select role from public.profiles where id = :'stranger') is null, 'no role until chosen');

-- ── role choice ──
select tests.as_user(:'stranger'); set role authenticated;
select public.set_my_role('ngo');
select tests.ok(private.my_role() = 'ngo', 'set_my_role lets a new user choose receiver');
select tests.throws($$select public.set_my_role('admin')$$, 'cannot self-assign admin', 'Donor or Receiver');
reset role;

-- ── organisations ──
select tests.as_user(:'donor'); set role authenticated;
select tests.throws($$insert into public.organizations (owner_id, kind, org_type, name)
  values (auth.uid(), 'ngo', 'ngo', 'Wrong Kind')$$, 'donor cannot create an NGO organisation', 'row-level security');
select tests.throws($$insert into public.organizations (owner_id, kind, org_type, name, status)
  values (auth.uid(), 'donor', 'restaurant', 'Sneaky', 'approved')$$, 'status is not client-writable', 'permission denied');
insert into public.organizations (owner_id, kind, org_type, name, contact_person, phone, email, address, city, state, pincode,
  location, about, operating_hours, pickup_windows, fssai_number)
values (auth.uid(), 'donor', 'restaurant', 'Spice Route Kitchen', 'Dev', '+91 98765 43210', 'kitchen@test.in',
  '12 MG Road', 'Pune', 'Maharashtra', '411001', 'SRID=4326;POINT(73.8567 18.5204)',
  'Family restaurant cooking fresh vegetarian thalis every day for the neighbourhood.',
  '{"mon":"10:00-22:00"}', '["20:00-22:00"]', '12345678901234');
select tests.throws($$select public.set_my_role('ngo')$$, 'role locks once an organisation exists', 'locked');
select tests.throws($$update public.organizations set status = 'approved'$$, 'org status cannot be updated by the owner', 'permission denied');
select tests.throws($$insert into public.food_listings (donor_org_id, title, category, qty_total, unit, pickup_by, diet)
  values (private.my_org_id(), 'Rice', 'cooked_meals', 10, 'portions', now() + interval '3 hours', 'veg')$$,
  'unverified donor cannot list food', 'row-level security');
select public.complete_my_profile();
select tests.ok((select profile_completed_at is not null from public.organizations where owner_id = auth.uid()), 'wizard completion recorded');
reset role;
select id as donor_org from public.organizations where owner_id = :'donor' \gset

select tests.as_user(:'ngo'); set role authenticated;
insert into public.organizations (owner_id, kind, org_type, name, about)
values (auth.uid(), 'ngo', 'ngo', 'Annapurna Seva Trust', 'short');
select tests.throws($$select public.complete_my_profile()$$, 'wizard rejects missing fields', 'Please complete');
update public.organizations set contact_person = 'Nina', phone = '+91 91234 56789', email = 'seva@test.in',
  address = '4 Station Road', city = 'Pune', state = 'Maharashtra', pincode = '411002',
  location = 'SRID=4326;POINT(73.8600 18.5300)', about = 'We run a daily community kitchen serving 200 people in Pune.',
  operating_hours = '{"mon":"08:00-20:00"}', pickup_windows = '["18:00-21:00"]', area_served = 'Pune East',
  beneficiaries_per_day = 200
where owner_id = auth.uid();
select public.complete_my_profile();
insert into public.representatives (org_id, name, phone, email) values (private.my_org_id(), 'Ravi Kumar', '+91 90000 11111', 'rep@test.in');
reset role;
select id as ngo_org from public.organizations where owner_id = :'ngo' \gset
select id as rep from public.representatives where org_id = :'ngo_org' \gset
update public.representatives set user_id = :'repuser' where id = :'rep';

select tests.as_user(:'ngo2'); set role authenticated;
insert into public.organizations (owner_id, kind, org_type, name, no_certificate, no_cert_explanation)
values (auth.uid(), 'ngo', 'community_group', 'Lane 5 Residents Group', true,
  'We are a residents group feeding about forty daily-wage workers every evening since 2021.');
insert into public.representatives (org_id, name, phone) values (private.my_org_id(), 'Other Rep', '+91 90000 22222');
reset role;
select id as ngo2_org from public.organizations where owner_id = :'ngo2' \gset
select id as rep2 from public.representatives where org_id = :'ngo2_org' \gset

-- ── admin verification ──
select tests.as_user(:'donor'); set role authenticated;
select tests.throws(format($$select public.admin_review_org(%L, true)$$, :'donor_org'), 'non-admin cannot verify', 'Admin access required');
select tests.ok(tests.count('select * from public.audit_log') = 0, 'non-admin cannot read the audit log');
reset role;

select tests.as_user(:'admin'); set role authenticated;
select tests.throws(format($$select public.admin_review_org(%L, false, '')$$, :'ngo2_org'), 'rejection needs a note', 'note is required');
select public.admin_review_org(:'donor_org', true);
select public.admin_review_org(:'ngo_org', true, 'Registration verified');
select tests.ok((select count(*) = 1 from public.audit_log where action = 'org_approved' and target_id = :'donor_org'
                 and actor_name = 'Asha Admin' and actor_email = 'admin@test.in'), 'approval audited with the admin''s name and email');
reset role;

select tests.as_user(:'donor'); set role authenticated;
select tests.throws($$update public.organizations set name = 'Renamed' where owner_id = auth.uid()$$,
  'name locks after approval', 'locked after verification');
select tests.ok((select count(*) = 1 from public.notifications where category = 'verification'), 'donor notified of verification');

-- ── listings ──
select tests.throws($$insert into public.food_listings (donor_org_id, title, category, qty_total, unit, pickup_by, diet)
  values (private.my_org_id(), 'Too soon', 'cooked_meals', 10, 'portions', now() + interval '5 minutes', 'veg')$$,
  'pickup deadline must be ≥15 minutes away', '15 minutes');
select tests.throws($$insert into public.food_listings (donor_org_id, title, category, qty_total, unit, pickup_by, diet, photos)
  values (private.my_org_id(), 'Bad photo', 'cooked_meals', 10, 'portions', now() + interval '3 hours', 'veg', array['someone-else/x.jpg'])$$,
  'photos must live in the donor folder', 'Invalid photo path');
insert into public.food_listings (donor_org_id, title, category, qty_total, unit, pickup_by, diet, allergens, safety_notes)
values (private.my_org_id(), 'Veg thali portions', 'cooked_meals', 50, 'portions', now() + interval '3 hours', 'veg',
        array['gluten'], 'Cooked at 6 pm, keep covered');
select tests.ok((select status = 'active' and location is not null from public.food_listings), 'listing active with donor location copied');
reset role;
select id as listing from public.food_listings where title = 'Veg thali portions' \gset

select tests.as_user(:'ngo'); set role authenticated;
select tests.ok(tests.count('select * from public.food_listings') = 1, 'verified receiver sees the active listing');
select tests.ok((select distance_km < 5 from public.discover_listings(15)), 'discovery reports distance within radius');
select tests.ok(tests.count('select * from public.discover_listings(0.5)') = 0, 'radius filter excludes far listings');
reset role;
select tests.as_user(:'ngo2'); set role authenticated;
select tests.ok(tests.count('select * from public.food_listings') = 0, 'unverified receiver sees no listings');
select tests.throws(format($$select public.create_request(%L, 5, %L)$$, :'listing', :'rep2'),
  'unverified receiver cannot request', 'verified receiver');
reset role;
select tests.as_anon(); set role anon;
select tests.ok((select count(*) = 1 and bool_and(donor_name = 'Spice Route Kitchen') from public.public_listings_preview()),
  'anon preview shows title and donor name');
select tests.throws($$select * from public.food_listings$$, 'anon cannot read listings directly', 'permission denied');
select tests.throws($$select public.create_request(gen_random_uuid(), 1, gen_random_uuid())$$, 'anon cannot call create_request', 'permission denied');
reset role;

-- ── requests ──
select tests.as_user(:'ngo'); set role authenticated;
select tests.throws(format($$select public.create_request(%L, 60, %L)$$, :'listing', :'rep'), 'cannot request more than available', 'between 1 and');
select tests.throws(format($$select public.create_request(%L, 5, %L)$$, :'listing', :'rep2'), 'rep must belong to the NGO', 'active representative');
select public.create_request(:'listing', 20, :'rep', 'Evening shift') as req \gset
select tests.throws(format($$select public.create_request(%L, 5, %L)$$, :'listing', :'rep'), 'one pending request per listing', 'already have a pending');
select tests.throws(format($$update public.food_requests set status = 'completed' where id = %L$$, :'req'), 'request status not client-writable', 'permission denied');
select tests.throws(format($$select public.respond_request(%L, true)$$, :'req'), 'receiver cannot accept its own request', 'not found');
select tests.ok((select rep_name = 'Ravi Kumar' from public.food_requests where id = :'req'), 'representative snapshot stored');
reset role;

select tests.as_user(:'ngo2'); set role authenticated;
select tests.ok(tests.count('select * from public.food_requests') = 0, 'other receivers cannot see the request');
reset role;

select tests.as_user(:'donor'); set role authenticated;
select tests.ok((select count(*) = 1 from public.notifications where category = 'request'), 'donor notified of the new request');
select public.respond_request(:'req', true);
select tests.ok((select qty_reserved = 20 from public.food_listings where id = :'listing'), 'accepting reserves the quantity');
select tests.throws(format($$select public.get_pickup_otp(%L)$$, :'req'), 'donor cannot read the OTP', 'not found');
reset role;
select tests.ok((select count(*) = 1 and bool_and(expires_at > now() + interval '4 hours') from public.pickup_otps where request_id = :'req'),
  'OTP issued, valid until deadline + 2 h');
select tests.ok((select count(*) = 1 from public.jobs where kind = 'rep_magic_link'), 'magic-link job queued on accept');

select tests.as_user(:'ngo'); set role authenticated;
select public.get_pickup_otp(:'req') as otp \gset
select tests.ok(:'otp' ~ '^[0-9]{4}$', 'receiver can read the 4-digit OTP');
reset role;
select tests.as_user(:'stranger'); set role authenticated;
select tests.throws(format($$select public.get_pickup_otp(%L)$$, :'req'), 'strangers cannot read the OTP', 'not found');
select tests.throws(format($$select public.update_rep_status(%L, 'on_the_way', now() + interval '20 minutes')$$, :'req'),
  'non-rep cannot change pickup status', 'Representative access required');
reset role;

-- ── representative ──
select tests.as_user(:'repuser'); set role authenticated;
select tests.ok(public.get_pickup_otp(:'req') = :'otp', 'assigned rep sees the same OTP');
select tests.throws(format($$select public.update_rep_status(%L, 'on_the_way', null)$$, :'req'), 'on the way needs an ETA', 'realistic arrival');
select public.update_rep_status(:'req', 'on_the_way', now() + interval '25 minutes');
select public.update_rep_location(:'req', 18.525, 73.858);
select tests.throws(format($$select public.update_rep_status(%L, 'collected')$$, :'req'), 'rep cannot self-mark collected', 'donor confirms');
select tests.throws($$select public.create_request(gen_random_uuid(), 1, gen_random_uuid())$$, 'representatives cannot create requests', 'verified receiver');
reset role;

select tests.as_user(:'donor'); set role authenticated;
select tests.ok((select count(*) >= 1 from public.notifications where title like 'Ravi Kumar is on the way, ETA %'), 'donor told the rep is on the way with ETA');
select tests.ok(tests.count('select * from public.rep_locations') = 1, 'donor sees the live location');
select tests.ok(tests.count(format('select * from public.representatives where id = %L', :'rep')) = 1, 'donor can see the assigned rep');
reset role;
select tests.as_user(:'ngo2'); set role authenticated;
select tests.ok(tests.count('select * from public.rep_locations') = 0, 'others cannot see the live location');
reset role;

-- ── messaging ──
select tests.as_user(:'ngo'); set role authenticated;
insert into public.messages (request_id, sender_id, body) values (:'req', auth.uid(), 'Ravi will reach by 7');
reset role;
select tests.as_user(:'ngo2'); set role authenticated;
select tests.throws(format($$insert into public.messages (request_id, sender_id, body) values (%L, auth.uid(), 'hi')$$, :'req'),
  'outsiders cannot post in a pickup chat', 'row-level security');
reset role;
select tests.as_user(:'admin'); set role authenticated;
select tests.ok(tests.count('select * from public.messages') = 0, 'admin cannot read chats without a report');
reset role;

-- ── OTP confirmation ──
select tests.as_user(:'donor'); set role authenticated;
select tests.ok((public.confirm_pickup(:'req', '0000') ->> 'ok')::boolean = false or :'otp' = '0000', 'wrong code rejected');
reset role;
select tests.ok((select attempts from public.pickup_otps where request_id = :'req') = (case when :'otp' = '0000' then 0 else 1 end),
  'failed attempt is persisted');
select tests.as_user(:'donor'); set role authenticated;
select tests.ok((public.confirm_pickup(:'req', :'otp') ->> 'ok')::boolean, 'correct code completes the pickup');
reset role;
select tests.ok((select status = 'completed' and timeline_status = 'collected' from public.food_requests where id = :'req'), 'request completed');
select tests.ok((select qty_reserved = 0 and qty_collected = 20 and status = 'active' from public.food_listings where id = :'listing'),
  'quantity moved from reserved to collected; remainder still available');
select tests.ok((select count(*) = 0 from public.pickup_otps where request_id = :'req'), 'OTP removed after completion');
select tests.ok((select count(*) = 0 from public.rep_locations where request_id = :'req'), 'live location deleted when the pickup ends');
select tests.ok((select count(*) = 2 from public.org_badges where badge_code = 'pickup_1'), 'first-pickup badge for both sides');
select tests.ok((select count(*) = 2 from public.certificates where badge_code = 'pickup_1'), 'certificates issued to both sides');
select tests.ok((select count(*) = 1 from public.rep_badges where rep_id = :'rep'), 'representative earns a badge');
select serial as cert from public.certificates where org_id = :'donor_org' limit 1 \gset

select tests.as_anon(); set role anon;
select tests.ok((select valid and org_name = 'Spice Route Kitchen' from public.verify_certificate(:'cert')), 'public certificate verification');
select tests.ok(tests.count($$select * from public.verify_certificate('AS-0000-NOPE')$$) = 0, 'unknown serial not found');
reset role;

select tests.as_user(:'repuser'); set role authenticated;
select public.update_rep_status(:'req', 'delivered');
reset role;

-- ── OTP lockout after 5 wrong attempts ──
select tests.as_user(:'ngo'); set role authenticated;
select public.create_request(:'listing', 10, :'rep') as req2 \gset
reset role;
select tests.as_user(:'donor'); set role authenticated;
select public.respond_request(:'req2', true);
reset role;
select code as otp2 from public.pickup_otps where request_id = :'req2' \gset
select tests.as_user(:'donor'); set role authenticated;
select public.confirm_pickup(:'req2', case when :'otp2' = '9999' then '9998' else '9999' end) from generate_series(1, 5);
select tests.ok((public.confirm_pickup(:'req2', :'otp2') ->> 'reason') = 'locked', 'locked after five wrong attempts');
select tests.throws(format($$select public.withdraw_listing(%L)$$, :'listing'), 'cannot withdraw while food is reserved', 'nothing is reserved');
reset role;

-- ── cancellation releases the reservation ──
select tests.as_user(:'ngo'); set role authenticated;
select public.cancel_request(:'req2');
reset role;
select tests.ok((select qty_reserved = 0 from public.food_listings where id = :'listing'), 'cancel releases the reservation');
select tests.ok((select count(*) = 0 from public.pickup_otps where request_id = :'req2'), 'cancel removes the OTP');

-- ── magic link (service role path) ──
select tests.as_user(:'ngo'); set role authenticated;
select public.create_request(:'listing', 5, :'rep') as req3 \gset
reset role;
select tests.as_user(:'donor'); set role authenticated;
select public.respond_request(:'req3', true);
reset role;
select set_config('request.jwt.claims', '{"role":"service_role"}', false);
set role service_role;
select public.issue_rep_access_token(:'req3') as token \gset
select tests.ok(public.update_rep_status_by_token(:'token', 'arrived') = :'req3'::uuid, 'magic link updates status');
select tests.throws($$select public.update_rep_status_by_token('not-a-real-token', 'arrived')$$, 'invalid token refused', 'expired');
reset role;
select tests.ok((select count(*) = 0 from public.rep_access_tokens where token_hash = :'token'), 'only the token hash is stored');
select tests.as_user(:'ngo'); set role authenticated;
select tests.throws(format($$select public.issue_rep_access_token(%L)$$, :'req3'), 'clients cannot mint magic links', 'permission denied');
reset role;

-- ── reports open the chat to admins ──
select tests.as_user(:'donor'); set role authenticated;
insert into public.reports (reporter_id, target_org_id, request_id, reason, details)
values (auth.uid(), :'ngo_org', :'req', 'misconduct', 'Testing that a report opens the chat to admins.');
reset role;
select tests.as_user(:'admin'); set role authenticated;
select tests.ok(tests.count('select * from public.messages') = 1, 'admin can read a reported chat');
reset role;

-- ── suspension ──
select tests.as_user(:'admin'); set role authenticated;
select public.admin_suspend_org(:'donor_org', 'Repeated food safety complaints');
reset role;
select tests.ok((select status = 'withdrawn' from public.food_listings where id = :'listing'), 'suspension withdraws open listings');
select tests.ok((select status = 'cancelled' from public.food_requests where id = :'req3'), 'suspension releases open requests');
select tests.as_user(:'donor'); set role authenticated;
select tests.ok(tests.count($$select * from public.organizations where status = 'suspended'$$) = 1, 'donor can still see own suspended org');
update public.organizations set about = 'Trying to edit while suspended, which should silently match no rows.' where owner_id = auth.uid();
reset role;
select tests.ok((select about not like 'Trying%' from public.organizations where id = :'donor_org'), 'suspended org cannot edit its profile');
select tests.as_user(:'admin'); set role authenticated;
select public.admin_reinstate_org(:'donor_org', 'Issue resolved after inspection');
reset role;
select tests.ok((select status = 'approved' from public.organizations where id = :'donor_org'), 'reinstated to approved');

-- ── expiry job ──
select tests.as_user(:'donor'); set role authenticated;
insert into public.food_listings (donor_org_id, title, category, qty_total, unit, pickup_by, diet)
values (private.my_org_id(), 'Bread loaves', 'bakery', 12, 'packs', now() + interval '1 hour', 'veg');
reset role;
select id as listing2 from public.food_listings where title = 'Bread loaves' \gset
select tests.as_user(:'ngo'); set role authenticated;
select public.create_request(:'listing2', 4, :'rep') as req4 \gset
reset role;
update public.food_listings set pickup_by = now() - interval '1 minute' where id = :'listing2';
select tests.ok(public.expire_listings() >= 1, 'expiry job releases stale requests');
select tests.ok((select status = 'expired' from public.food_requests where id = :'req4'), 'pending request expired');
select tests.ok((select status = 'expired' from public.food_listings where id = :'listing2'), 'listing expired');

-- ── landing snapshot ──
select tests.as_user(:'donor'); set role authenticated;
select tests.throws($$select public.rebuild_landing_snapshot()$$, 'only admins rebuild the snapshot on demand', 'Admin access required');
reset role;
select tests.as_user(:'admin'); set role authenticated;
select tests.ok((public.rebuild_landing_snapshot() ->> 'completed_pickups')::int = 1, 'snapshot counts only OTP-confirmed pickups');
reset role;
select tests.ok((select (data ->> 'meals_est')::int = 20 from public.landing_snapshot order by id desc limit 1), 'meals estimate = 20 portions');

-- ── storage ──
select tests.as_user(:'donor'); set role authenticated;
insert into storage.objects (bucket_id, name) values ('listing-photos', :'donor_org' || '/thali.jpg');
select tests.throws(format($$insert into storage.objects (bucket_id, name) values ('listing-photos', %L)$$, :'ngo_org' || '/x.jpg'),
  'cannot upload into another organisation''s folder', 'row-level security');
insert into storage.objects (bucket_id, name) values ('verification-docs', :'donor_org' || '/fssai.pdf');
reset role;
select tests.as_anon(); set role anon;
select tests.ok(tests.count($$select * from storage.objects where bucket_id = 'listing-photos'$$) = 1, 'public photos readable by anyone');
select tests.ok(tests.count($$select * from storage.objects where bucket_id = 'verification-docs'$$) = 0, 'verification docs are private');
reset role;
select tests.as_user(:'ngo'); set role authenticated;
select tests.ok(tests.count($$select * from storage.objects where bucket_id = 'verification-docs'$$) = 0, 'other orgs cannot read verification docs');
reset role;

-- ── no-certificate path ──
select tests.as_user(:'ngo2'); set role authenticated;
update public.organizations set contact_person = 'Omar', phone = '+91 93333 44444', email = 'lane5@test.in', address = 'Lane 5',
  city = 'Pune', state = 'Maharashtra', pincode = '411003', location = 'SRID=4326;POINT(73.87 18.53)',
  about = 'Residents group running an evening meal for daily-wage workers.', operating_hours = '{"mon":"17:00-21:00"}',
  pickup_windows = '["18:00-20:00"]', area_served = 'Lane 5', beneficiaries_per_day = 40
where owner_id = auth.uid();
select public.complete_my_profile();
reset role;
select tests.ok((select review_due_at > now() + interval '4 days' from public.organizations where id = :'ngo2_org'),
  'no-certificate review due in 5 business days');
select tests.ok((select count(*) = 1 from public.jobs where kind = 'ai_no_cert_summary'), 'AI summary queued for the no-certificate request');
