/* End-to-end UI tests against an in-memory Supabase mock (test/mock-supabase.js).
   Run: npm run build && npm test     Screenshots: $SHOTS (default: <tmp>/annsetu-shots) */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), http = require('http'), os = require('os');
const ROOT = path.resolve(__dirname, '..');
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'annsetu-shots');
fs.mkdirSync(SHOTS, { recursive: true });
const mock = fs.readFileSync(path.join(__dirname, 'mock-supabase.js'), 'utf8');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };
const srv = http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]).replace(/^\/$/, '/index.html')); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': mime[path.extname(f)] || 'text/plain' }); r.end(fs.readFileSync(f)); });
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗ FAIL:', m); } };
const shot = (p, n) => p.screenshot({ path: path.join(SHOTS, n + '.png') });

(async () => {
  await new Promise((r) => srv.listen(8123, r));
  const b = await chromium.launch();
  const B = 'http://localhost:8123/';
  const newCtx = async (o = {}) => {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, ...o });
    await ctx.route(/supabase-js/, (r) => r.fulfill({ contentType: 'text/javascript', body: mock }));
    await ctx.route('**/fonts.g*/**', (r) => r.fulfill({ body: '' }));
    return ctx;
  };
  const ctx = await newCtx();
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  const T = (s, o) => page.waitForSelector(s, { timeout: 5000, ...o });
  const click = async (txt) => page.getByRole('button', { name: txt }).first().click();
  const login = async (email, pw) => { await page.goto(B + 'signin.html'); await T('input[name=email]'); await page.fill('input[name=email]', email); await page.fill('input[name=password]', pw); await click('Sign in'); };
  const reg = async (email, role, name) => { await page.goto(B + 'signin.html?view=register'); await T('input[name=name]'); await page.getByRole('button', { name: new RegExp(role) }).click(); await page.fill('input[name=name]', name); await page.fill('input[name=email]', email); await page.fill('input[name=password]', 'Secret123!'); await page.check('input[name=tc]'); await click('Create account'); };
  const signOutLocal = () => page.evaluate(() => localStorage.removeItem('__mocksess'));
  const as = async (email, url) => { await signOutLocal(); await login(email, 'Secret123!'); await page.waitForURL('**/' + url); };
  const fillProfile = async (name, address, { ngo = false, type } = {}) => {
    await page.fill('input[name=name]', name);
    if (type) await page.selectOption('select[name=type]', type);
    await page.fill('input[name=phone]', '9876543210');
    await page.fill('input[name=address]', address);
    if (ngo) await page.fill('input[name=area]', 'Ward 12, Central');
    await page.fill('textarea[name=about]', 'We serve hot meals to families in our neighbourhood every day.');
    await page.getByLabel('Latitude *').fill('12.9716'); await page.getByLabel('Longitude *').fill('77.5946');
  };
  const hash = async (h) => { await page.evaluate((x) => (location.hash = x), h); await page.waitForTimeout(450); };
  const overflow = (p) => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  const drag = async (from, to) => {
    await from.scrollIntoViewIfNeeded();
    const a = await from.boundingBox(); const t = await to.boundingBox();
    await page.mouse.move(a.x + a.width / 2, a.y + 40); await page.mouse.down();
    await page.mouse.move(a.x + a.width / 2 + 12, a.y + 52, { steps: 4 });
    const t2 = await to.boundingBox();
    await page.mouse.move(t2.x + t2.width / 2, t2.y + 60, { steps: 12 });
    const st = await page.evaluate(() => ({ drag: document.querySelector('.cx')?.classList.contains('is-drag'), drop: document.querySelector('.cx')?.classList.contains('is-drop'), hot: document.querySelector('.tray')?.classList.contains('hot') }));
    await page.mouse.up(); void t;
    return st;
  };

  console.log('HOMEPAGE (signed out)');
  await page.goto(B); await page.evaluate(() => window.__mock.reset()); await page.reload(); await T('.hero-h');
  await page.waitForTimeout(1800);
  ok((await page.getAttribute('.hero-h', 'aria-label')) === 'Good food deserves a second journey.', 'hero headline present (accessible name)');
  ok(await page.locator('svg.hands .hd-giver').count() === 1 && await page.locator('svg.hands .hd-receiver').count() === 1 && await page.locator('svg.hands image[href*="hand-giver"]').count() === 1 && await page.locator('svg.hands image[href*="hand-receiver"]').count() === 1, 'hero shows the real giving hand with the apple and the receiving hand');
  const handPos = () => page.evaluate(() => getComputedStyle(document.querySelector('.hd-giver')).transform);
  const h1 = await handPos(); await page.waitForTimeout(900); const h2 = await handPos();
  ok(h1 !== h2, 'hands keep moving gently after drifting in (idle animation)');
  ok(await page.locator('.band-steps li').count() === 4 && /Representative/.test(await page.textContent('.band-steps')), 'journey band: Donor → NGO → Representative → Community (no transport fleet)');
  const btnH = await page.locator('.hero-cta a.primary-hero').evaluate((e) => e.getBoundingClientRect().height);
  ok(btnH >= 56, `hero buttons are large and bold (${Math.round(btnH)}px tall)`);
  await page.click('.hnav-search'); await T('.search-box'); await page.keyboard.type('donor');
  ok(/donor/i.test(await page.textContent('.search-res')), 'header search finds pages'); await page.keyboard.press('Escape');
  ok(await page.locator('.search-box').count() === 0, 'search closes with Escape');
  await page.locator('#journey').scrollIntoViewIfNeeded(); await page.waitForTimeout(600);
  const mk = () => page.evaluate(() => document.querySelector('.jr-marker').getAttribute('transform') || getComputedStyle(document.querySelector('.jr-marker')).transform);
  const m1 = await mk(); await page.waitForTimeout(1200); const m2 = await mk();
  ok(m1 !== m2, 'journey plays on its own (no scrolling needed): the food marker travels');
  ok(await page.locator('.jr-marker .jr-steam').count() === 1, 'journey marker is a steaming food bowl, not a square');
  await page.click('.jr-play'); const m3 = await mk(); await page.waitForTimeout(800); const m4 = await mk();
  ok(m3 === m4, 'journey can be paused');
  ok(await page.locator('.pin-spacer').count() === 0, 'journey is not scroll-pinned');
  ok(await page.locator('.foot-cols a').count() >= 9 && await page.locator('.foot-cols h3').count() === 3, 'footer uses grouped link columns, not a table');
  ok(await page.locator('#home').getByRole('link', { name: /Donate surplus/i }).isVisible() && await page.locator('#home').getByRole('link', { name: /Explore food/i }).isVisible(), 'hero has Donate surplus + Explore food');
  ok(await page.locator('.hero-x .imp, .hero-x .food, .hero-x .stat').count() === 0, 'no stats / food cards / widgets above the fold');
  ok(/signin\.html\?role=donor/.test(await page.getAttribute('.hero-cta a.primary-hero', 'href')), 'Donate surplus goes to donor registration');
  await shot(page, 'home-hero-1280');
  ok(await page.locator('html.has-cx').count() === 1 && await page.locator('.cx').count() === 1, 'custom cursor mounted on desktop pointer');
  await page.mouse.move(400, 400); await page.hover('.hero-cta a.primary-hero'); await page.waitForTimeout(150);
  ok(await page.locator('.cx.is-hover').count() === 1, 'cursor hover state on links/buttons');
  await page.locator('#home').getByRole('link', { name: /Explore food/i }).click(); await page.waitForTimeout(900);
  ok(await page.locator('.locked-board').isVisible(), 'anonymous discovery shows the honest locked state (RLS hides listings)');
  ok(/verified receivers/i.test(await page.textContent('.locked-board')), 'locked state explains why');
  await page.locator('#impact').scrollIntoViewIfNeeded(); await page.waitForTimeout(500);
  ok(await page.locator('.imp-empty').isVisible(), 'impact shows honest empty state with no data');
  ok(/waiting for real voices/.test(await page.textContent('#stories')), 'stories show empty state with no published testimonials');

  console.log('CONTACT FORM → ADMIN INBOX');
  await page.locator('#join').scrollIntoViewIfNeeded();
  await page.locator('.contact input[name=name]').hover(); await page.waitForTimeout(100);
  ok(await page.locator('.cx.is-text').count() === 1, 'decorative cursor steps aside over text inputs');
  await click('Send message'); await T('.contact .err'); ok(/name/i.test(await page.textContent('.contact .err')), 'contact form validates');
  await page.fill('.contact input[name=name]', 'Meera'); await page.fill('.contact input[name=email]', 'meera@example.org');
  await page.fill('.contact input[name=subject]', 'Partnership idea'); await page.fill('.contact textarea[name=message]', 'We run a canteen and want to help.');
  await click('Send message'); await T('.sent'); ok(true, 'contact message saved (contact_messages insert)');

  console.log('SIGN-IN PAGE');
  await page.goto(B + 'signin.html'); await T('.art');
  ok(await page.locator('.art.art-signin').count() === 1, 'sign-in shows the shared sign-in animation');
  await page.goto(B + 'signin.html?view=register'); await T('.art');
  ok(await page.locator('.art.art-choose').count() === 1, 'register starts neutral until a role is chosen');
  await page.getByRole('button', { name: /^01 ?Donor/ }).click(); await page.waitForTimeout(200);
  ok(await page.locator('.art.art-donor .sc-crate').count() === 1, 'donor sign-up has its own animation (food crate onto the bridge)');
  await page.getByRole('button', { name: /^02 ?Receiver/ }).click(); await page.waitForTimeout(200);
  ok(await page.locator('.art.art-ngo .sc-hands').count() === 1, 'receiver sign-up has a different animation (receiving hands)');
  await page.goto(B + 'signin.html'); await T('.art');
  ok(await page.locator('.scene').count() === 1, 'editorial art panel renders');
  ok((await page.textContent('h1')).includes('Welcome back'), 'login view shown');
  await shot(page, 'signin');
  await click('Sign in'); await T('.err'); ok(/valid email/i.test(await page.textContent('.err')), 'empty login shows validation error');
  await page.fill('input[name=email]', 'x@y.org'); await page.fill('input[name=password]', 'nope'); await click('Sign in'); await page.waitForFunction(() => /Incorrect email/.test(document.body.innerText));
  ok(true, 'wrong credentials show friendly error');
  await click('Forgot password?'); await T('text=Send reset link'); await page.fill('input[name=email]', 'a@b.org'); await click('Send reset link'); await T('.done'); ok(true, 'forgot-password flow reaches confirmation');
  await page.goto(B + 'signin.html'); await T('.art'); ok(await page.getByRole('button', { name: /Continue with Google/ }).isVisible(), 'Google sign-in still offered');
  ok(await page.getByRole('button', { name: /Continue with Apple/ }).isVisible() && await page.getByRole('button', { name: /Continue with Microsoft/ }).isVisible(), 'Apple and Microsoft sign-in offered');
  await page.getByRole('button', { name: /Continue with Microsoft/ }).click(); await page.waitForTimeout(200);
  ok(await page.evaluate(() => window.__oauth) === 'azure', 'Microsoft button starts Supabase OAuth with the azure provider');
  await page.getByRole('button', { name: /Continue with Apple/ }).click(); await page.waitForSelector('.toast.bad');
  ok(/Apple sign-in isn’t switched on yet/.test(await page.textContent('.toast.bad')), 'a provider that is not enabled shows a friendly message');
  ok(await page.locator('.bot-fab').count() === 0, 'assistant stays hidden until the AI service is configured');
  await page.goto(B + 'signin.html?view=register'); await T('.art');
  await page.getByRole('button', { name: /^03 ?Representative/ }).click(); await page.waitForTimeout(150);
  ok(/same email your NGO saved/.test(await page.textContent('.rep-note')), 'Representative sign-up explains how accounts link to the NGO');

  console.log('REGISTER (email confirmation on)');
  await reg('donor@t.org', 'Donor', 'Dina Donor'); await T('.done'); ok(/Check your email/.test(await page.textContent('.done')), 'registration shows check-your-email');
  await reg('ngo@t.org', 'Receiver', 'Nina NGO'); await T('.done');
  await reg('admin@t.org', 'Donor', 'Ada Admin'); await T('.done');
  await reg('group@t.org', 'Receiver', 'Gita Group'); await T('.done');
  await reg('ravi@t.org', 'Representative', 'Ravi Rao'); await T('.done');
  await page.evaluate(() => window.__mock.setAdmin('admin@t.org'));

  console.log('DONOR: profile + document');
  await as('donor@t.org', 'donor.html'); await T('input[name=name]');
  ok(/Your organisation/.test(await page.textContent('.phero h1')), 'new donor lands on the profile form');
  ok(await page.locator('button.nav:disabled').count() >= 4, 'dashboard tabs stay locked until the profile is complete');
  await page.fill('input[name=name]', 'Spice Route Restaurant'); await click('Create profile'); await T('.err');
  ok(/phone/i.test(await page.textContent('.err')), 'incomplete profile is refused (phone, address, about, location are compulsory)');
  await fillProfile('Spice Route Restaurant', '12 MG Road, Bengaluru'); await click('Create profile'); await T('.docs');
  ok(await page.locator('button.nav:disabled').count() === 0, 'tabs unlock once the profile is complete (documents not required)');
  ok(await page.locator('.phero h1').textContent() === 'Spice Route Restaurant', 'profile created, stays on profile');
  await page.setInputFiles('input[name=document]', { name: 'fssai.pdf', mimeType: 'application/pdf', buffer: Buffer.from('x') }); await click('Upload document'); await T('.doc');
  ok(await page.locator('.doc').count() === 1, 'document uploaded');
  await hash('listings'); await T('text=Verification pending');
  ok(await page.getByRole('button', { name: /New listing/ }).isDisabled(), 'cannot list before verification');

  console.log('NGO: profile + representative + document');
  await as('ngo@t.org', 'receiver.html'); await T('input[name=name]');
  await fillProfile('Asha Kitchen', '21 Park Street, Kolkata', { ngo: true }); await click('Create profile'); await T('.docs');
  await page.locator('form').filter({ hasText: 'Add representative' }).locator('input[name=name]').fill('Ravi');
  await page.locator('form').filter({ hasText: 'Add representative' }).locator('input[name=phone]').fill('9999999999');
  await page.locator('form').filter({ hasText: 'Add representative' }).locator('input[name=email]').fill('ravi@t.org'); await click('Add representative'); await T('text=Ravi');
  ok(/Can sign up as representative/.test(await page.textContent('.rep-row')), 'NGO’s representative list shows the email and invite status');
  await page.setInputFiles('input[name=document]', { name: 'reg.pdf', mimeType: 'application/pdf', buffer: Buffer.from('x') }); await click('Upload document'); await T('.doc');
  ok(true, 'NGO profile, representative and document saved');

  console.log('COMMUNITY GROUP WITHOUT A CERTIFICATE');
  await as('group@t.org', 'receiver.html'); await T('input[name=name]');
  await fillProfile('Ward 12 Residents Group', 'Ward 12, Central Market, Pune', { ngo: true, type: 'Community group' }); await click('Create profile'); await T('.docs');
  await page.getByText('We don’t have a registration certificate').click();
  await page.fill('textarea[name=note]', 'We are a residents group feeding 40 elderly people daily since 2021, references: ward office.');
  await click('Request admin review'); await page.waitForSelector('.nocert.done');
  ok(/3–5 business days/.test(await page.textContent('.nocert.done')), 'no-certificate request tells them it will be reviewed within 3–5 business days');

  console.log('ADMIN: verification, inbox, content');
  await as('admin@t.org', 'admin.html'); await T('.hero');
  ok(await page.locator('.nav .badge').first().isVisible(), 'admin sees pending-verification badge');
  await hash('verify'); await T('text=Spice Route Restaurant');
  await page.locator('.card', { hasText: 'Spice Route Restaurant' }).getByRole('button', { name: 'Approve', exact: true }).click(); await page.waitForSelector('.toast.bad');
  ok(/at least one verification document/i.test(await page.textContent('.toast.bad')), 'approving without an approved document is blocked');
  for (const n of ['Spice Route Restaurant', 'Asha Kitchen']) {
    await page.locator('.card', { hasText: n }).locator('.doc .btn.ok').first().click(); await page.waitForTimeout(300);
    await page.locator('.card', { hasText: n }).getByRole('button', { name: 'Approve', exact: true }).click(); await page.waitForTimeout(400);
  }
  await hash('verify'); await T('.nocert-admin');
  ok(/manual review requested/i.test(await page.textContent('.nocert-admin')) && /due by/.test(await page.textContent('.nocert-admin')), 'admin sees the no-certificate request with its explanation and due date');
  await page.locator('.card', { hasText: 'Ward 12 Residents Group' }).getByRole('button', { name: 'Approve', exact: true }).click(); await page.waitForTimeout(500);
  ok(await page.evaluate(() => window.__mock.db.organizations.find((o) => o.name === 'Ward 12 Residents Group').verification) === 'approved', 'admin can approve a no-certificate organisation after review (no document needed)');
  await hash('orgs'); await T('.tag.approved');
  ok(await page.locator('.tag.approved').count() >= 2, 'both organisations approved');
  await hash('inbox'); await T('text=Partnership idea'); ok(true, 'homepage contact message arrives in admin inbox');
  await hash('content'); await T('textarea[name=quote]');
  await page.fill('textarea[name=quote]', 'The biryani reached forty children before dinner.'); await page.fill('input[name=author]', 'Asha Kitchen');
  await click('Add testimonial'); await T('text=The biryani reached');
  await page.locator('.ck', { hasText: 'The biryani reached' }).getByRole('button', { name: 'Publish' }).click(); await page.waitForTimeout(400);
  ok(await page.locator('.ck', { hasText: 'The biryani reached' }).locator('.tag.approved').count() === 1, 'testimonial published from content management');
  await hash('audit'); await T('.tbl'); ok(await page.locator('.tbl tbody tr').count() >= 2, 'audit log renders as a table');
  ok(/Ada Admin/.test(await page.textContent('.tbl tbody')), 'audit log shows WHO approved or rejected (admin name)');
  await shot(page, 'admin');

  console.log('DONOR: publish listing');
  await as('donor@t.org', 'donor.html'); await T('.hero');
  await hash('listings'); await click('New listing'); await T('input[name=title]');
  await page.fill('input[name=title]', 'Vegetable biryani'); await page.fill('input[name=qty]', '40'); await click('Publish listing'); await T('text=Vegetable biryani');
  ok(await page.locator('.lcard, .card:has-text("Vegetable biryani")').count() >= 1, 'donor published a listing');
  await page.goto(B); await T('#discover'); await page.locator('#discover').scrollIntoViewIfNeeded(); await page.waitForTimeout(700);
  ok(/signed in as a donor/i.test(await page.textContent('#discover')), 'homepage discovery explains it is for receivers when a donor is signed in');

  console.log('NGO: discover board + real drag-and-drop request');
  await as('ngo@t.org', 'receiver.html'); await T('.hero');
  await hash('discover'); await T('.food');
  await page.fill('.search-f input', 'zzz'); await T('text=No matches'); ok(true, 'search filters listings');
  await page.fill('.search-f input', 'biryani'); await T('.food');
  await page.getByRole('button', { name: 'Dairy', exact: true }).click(); await T('text=No matches'); ok(true, 'category filter works');
  await page.getByRole('button', { name: 'All', exact: true }).click(); await T('.food');
  ok(/40/.test(await page.textContent('.food .food-qty')) && /Spice Route/.test(await page.textContent('.food')), 'card shows quantity and donor organisation');
  const st = await drag(page.locator('.food').first(), page.locator('.tray'));
  ok(st.drag && st.drop && st.hot, 'drag feedback: cursor drag + valid-drop states, tray highlights');
  await T('.tray-list li'); ok(await page.locator('.tray-list li').count() === 1, 'dropped listing lands in the request tray');
  await page.fill('.tl-q input', '999'); await click('Send request'); await T('.toast.bad');
  ok(/between 1 and 40/.test(await page.textContent('.toast.bad')), 'tray validates quantity before calling create_request');
  await page.fill('.tl-q input', '15'); await click('Send request'); await page.waitForFunction(() => /Request sent to the donor/.test(document.body.innerText));
  await hash('requests'); await T('.tag.pending'); ok(true, 'create_request RPC created a pending request');
  await shot(page, 'ngo-requests');

  console.log('HOMEPAGE as verified NGO: button alternative + honest failure');
  await page.goto(B); await page.locator('#discover').scrollIntoViewIfNeeded(); await T('#discover .food');
  ok(await page.locator('#discover .food-add').count() >= 1, 'live listings + keyboard/button alternative on homepage');
  await page.locator('#discover .food-add').first().focus(); await page.keyboard.press('Enter'); await T('#discover .tray-list li');
  ok(true, 'listing added to tray with keyboard (Enter on "Add to request")');
  await page.locator('#discover').getByRole('button', { name: 'Send request' }).click(); await T('.tl-r.bad');
  ok(/pending request/i.test(await page.textContent('.tl-r.bad')), 'duplicate request is rejected by the backend and shown, not faked');
  ok(!(await page.evaluate(() => /Request sent to the donor/.test(document.querySelector('.toasts').innerText))), 'no success toast for a failed request');

  console.log('DONOR: accept');
  await as('donor@t.org', 'donor.html'); await T('.hero');
  await hash('requests'); await T('.tag.pending'); await click('Accept'); await T('.tag.accepted'); ok(true, 'donor accepted; quantity reserved');

  console.log('NGO: OTP');
  await as('ngo@t.org', 'receiver.html'); await T('.hero'); await hash('pickups'); await T('.otpv');
  const otp = await page.textContent('.otpv'); ok(/^\d{4}$/.test(otp), 'NGO sees the pickup OTP: ' + otp);
  await shot(page, 'ngo-pickup');

  console.log('REPRESENTATIVE: pickup page, directions, ETA');
  await as('ravi@t.org', 'rep.html'); await T('.rep-pick');
  ok(/Hi Ravi/.test(await page.textContent('.hero')), 'representative account links to the NGO automatically');
  ok((await page.textContent('.rep-pick .otpv')).trim() === otp, 'representative sees the same pickup OTP');
  ok(/Directions/.test(await page.textContent('.rep-pick')) && (await page.locator('.rep-pick a[href*="google.com/maps/dir"]').getAttribute('href')).includes('destination='), 'representative gets Google Maps directions to the donor');
  ok(/Spice Route Restaurant/.test(await page.textContent('.rep-pick')) && await page.locator('.rep-pick a[href^="tel:"]', { hasText: 'Call donor' }).count() === 1 && await page.locator('.rep-pick a[href^="tel:"]', { hasText: 'Call NGO' }).count() === 1, 'representative sees donor name, address and can call the donor and the NGO');
  ok(await page.locator('.rep-pick .lt-steps li').count() === 5, 'representative sees the 5 delivery steps (assigned → on the way → reached → collected → delivered)');
  await click('Start trip'); await page.waitForSelector('.toast');
  ok(/Trip started/i.test(await page.textContent('.toast')), 'representative confirms “Start trip”');
  await page.waitForTimeout(500); ok(/On the way/.test(await page.textContent('.lt-steps li.now')), 'step moves to “On the way”');
  await shot(page, 'rep-pickup');

  console.log('DONOR: confirm OTP');
  await as('donor@t.org', 'donor.html'); await T('.hero'); await hash('pickups'); await T('.otp');
  ok(/On the way/.test(await page.textContent('.lt-steps li.now')) && /ETA/.test(await page.textContent('.lt-eta')), 'donor tracks the representative: on the way, with ETA');
  ok(await page.locator('.lt-map').count() === 1 && await page.locator('.lt a[href^="tel:"]', { hasText: 'Call' }).count() >= 1, 'donor sees the live map and can call the representative');
  ok(await page.evaluate(() => window.__mock.db.notifications.filter((n) => n.title === 'Pickup update').length) >= 2, 'both donor and NGO were notified of the trip update');
  await page.fill('.otp', '0000'); await click('Confirm collection'); await T('.toast.bad'); ok(true, 'wrong OTP rejected');
  await page.fill('.otp', otp); await click('Confirm collection'); await page.waitForFunction(() => /Pickup confirmed/.test(document.body.innerText)); ok(true, 'correct OTP completes the donation');
  ok(await page.evaluate(() => window.__mock.db.food_requests.find((r) => r.status === 'completed').trip_status) === 'collected', 'OTP automatically marks the food as collected');
  await as('ravi@t.org', 'rep.html'); await T('.rep-pick');
  ok(/Food collected/.test(await page.textContent('.rep-pick .lt-steps li.now')), 'representative sees “Food collected” and heads to the NGO');
  await click('Delivered to NGO'); await page.waitForSelector('.toast'); await page.waitForTimeout(400);
  ok(await page.evaluate(() => window.__mock.db.food_requests.find((r) => r.status === 'completed').trip_status) === 'delivered', 'representative confirms delivery at the NGO');
  await as('donor@t.org', 'donor.html'); await T('.hero');
  await hash('impact'); await T('.bd.on'); ok(await page.locator('.bd.on').count() >= 1, 'badge awarded after first donation');
  await T('text=Certificates'); ok(await page.getByRole('button', { name: /View/ }).count() >= 1, 'certificate issued');
  await shot(page, 'donor-impact');
  await hash('overview'); await page.waitForTimeout(800); await shot(page, 'donor-light');
  ok(await page.locator('button[aria-label^="Notifications"]').count() === 1, 'notification bell present');
  await page.locator('button[aria-label^="Notifications"]').click(); await T('.dd'); ok(await page.locator('.ni').count() >= 1, 'notifications list opens');
  await page.mouse.click(600, 600);
  await page.locator('button[aria-label^="Switch to dark"]').click(); await page.waitForTimeout(500); await shot(page, 'donor-dark');
  ok(await page.evaluate(() => document.documentElement.dataset.theme) === 'dark', 'dark mode toggles');
  await page.locator('button[aria-label^="Switch to light"]').click();

  console.log('ADMIN: leaderboard + weekly landing snapshot');
  await as('admin@t.org', 'admin.html'); await T('.hero'); await hash('leaderboard'); await T('.lb-row');
  ok(/Spice Route Restaurant/.test(await page.textContent('main')), 'admin sees the donor leaderboard');
  await click('Refresh now'); await page.waitForSelector('.toast'); ok(/refreshed/i.test(await page.textContent('.toast')), 'admin can refresh landing numbers now (otherwise weekly)');
  await page.locator('.lb-row', { hasText: 'Spice Route Restaurant' }).getByRole('button', { name: /Pin/ }).click(); await T('.modal textarea');
  await page.fill('.modal textarea', 'Featured partner this week'); await page.locator('.modal').getByRole('button', { name: 'Pin' }).click(); await page.waitForTimeout(500);
  ok(await page.locator('.lb-row', { hasText: 'Spice Route Restaurant' }).locator('.tag').count() === 1, 'admin can curate the leaderboard (pinned, with a reason)');

  console.log('HOMEPAGE: live impact, stories, certificate check');
  const serial = await page.evaluate(() => window.__mock.db.certificates[0].serial);
  await signOutLocal(); await page.goto(B); await T('.hero-h');
  await page.locator('#impact').scrollIntoViewIfNeeded(); await page.waitForTimeout(2600);
  ok(await page.locator('#impact dd').first().textContent() === '1', 'impact counter shows the real completed pickup count (1)');
  ok(/biryani reached forty/.test(await page.textContent('#stories')), 'published testimonial appears in community stories');
  ok(/This week/.test(await page.textContent('.imp-week')), 'landing shows the weekly snapshot');
  await page.locator('#leaderboard').scrollIntoViewIfNeeded(); await page.waitForTimeout(400);
  ok(/Spice Route Restaurant/.test(await page.textContent('#leaderboard')), 'public leaderboard shows top donors to everyone');
  await page.getByRole('tab', { name: 'Top receivers' }).click(); await page.waitForTimeout(200);
  ok(/Asha Kitchen/.test(await page.textContent('#leaderboard')), 'public leaderboard shows top receivers');
  ok(await page.locator('#app h2').count() === 1 && /Representative mode/.test(await page.textContent('#app')), 'homepage has an About the app section');
  await page.fill('#cert-serial', serial); await page.locator('.foot').getByRole('button', { name: 'Check' }).click(); await T('.cert-r');
  ok(/Valid/.test(await page.textContent('.cert-r')), 'footer verifies a real certificate serial');
  await page.fill('#cert-serial', 'AS-NOPE0000'); await page.locator('.foot').getByRole('button', { name: 'Check' }).click(); await page.waitForFunction(() => /No certificate found/.test(document.querySelector('.cert-r').innerText));
  ok(true, 'unknown serial reported honestly');

  console.log('SIDEBAR + SIGN-OUT');
  await as('donor@t.org', 'donor.html'); await T('.hero');
  ok(await page.locator('.nav-no, .tb-no').count() === 0, 'menu has no numbering');
  await page.click('.nav-toggle'); ok(await page.locator('.shell.collapsed').count() === 1, 'menu bar can be hidden (collapsed to icons)');
  await page.reload(); await T('.hero'); ok(await page.locator('.shell.collapsed').count() === 1, 'collapsed menu is remembered');
  await page.click('.nav-toggle'); ok(await page.locator('.shell.collapsed').count() === 0, 'menu bar can be shown again');
  await page.getByRole('button', { name: 'Sign out' }).click(); await T('.modal');
  ok(/Sign out of AnnSetu\?/.test(await page.textContent('.modal')), 'signing out asks for confirmation');
  await page.getByRole('button', { name: 'Stay signed in' }).click(); await page.waitForTimeout(300);
  ok(/donor\.html/.test(page.url()) && await page.locator('.modal').count() === 0, 'cancelling keeps you signed in');

  console.log('GUARDS + MOBILE');
  await as('donor@t.org', 'donor.html'); await T('.hero');
  await page.goto(B + 'admin.html'); await page.waitForURL('**/donor.html', { timeout: 5000 }).catch(() => {}); ok(/donor\.html/.test(page.url()), 'wrong-role visit redirects to own dashboard');
  await page.setViewportSize({ width: 390, height: 800 }); await page.reload(); await T('.hero'); await shot(page, 'donor-mobile');
  ok(await page.locator('.ib.menu').isVisible(), 'mobile menu button visible');
  await page.locator('.ib.menu').click(); await page.waitForTimeout(500); ok(await page.locator('.side.open').isVisible(), 'mobile dashboard navigation opens');
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  ok(await overflow(page) <= 0, 'donor dashboard has no horizontal overflow at 390px');
  await signOutLocal(); await page.goto(B + 'receiver.html'); await page.waitForURL('**/signin.html', { timeout: 5000 }).catch(() => {}); ok(/signin\.html/.test(page.url()), 'signed-out visit redirects to sign-in');

  console.log('RESPONSIVE (no horizontal overflow)');
  for (const w of [1440, 1280, 768, 390, 360]) {
    await page.setViewportSize({ width: w, height: 860 });
    for (const u of ['', 'signin.html']) {
      await page.goto(B + u); await page.waitForTimeout(700);
      if (!u) { for (let y = 0; y < 12; y++) { await page.mouse.wheel(0, 900); await page.waitForTimeout(40); } await page.waitForTimeout(300); }
      const o = await overflow(page); ok(o <= 0, `${u || 'home'} @${w}px: no horizontal overflow` + (o > 0 ? ` (${o}px)` : ''));
    }
  }
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto(B); await T('.hnav-menu');
  await page.click('.hnav-menu'); await page.waitForTimeout(200);
  const sheet = await page.locator('.hnav-sheet').boundingBox();
  ok(sheet && sheet.height > 400, 'mobile homepage menu opens full-screen');
  await shot(page, 'home-menu-390');

  console.log('AI SERVICE CONNECTED: chatbot + AI document check');
  const state = await page.evaluate(() => localStorage.getItem('__mockdb'));
  const apiCtx = await newCtx();
  await apiCtx.addInitScript((st) => { window.ANNSETU_API_URL = 'http://api.test'; if (!sessionStorage.getItem('seeded')) { localStorage.setItem('__mockdb', st); sessionStorage.setItem('seeded', '1'); } }, state);
  const apiCalls = [];
  await apiCtx.route('http://api.test/**', async (r) => {
    const u = new URL(r.request().url()); apiCalls.push({ path: u.pathname, auth: r.request().headers().authorization || '' });
    const body = u.pathname === '/chat' ? { reply: 'Restaurants, hotels and canteens can donate. Sign up as a Donor to start.', role: 'observer' }
      : { id: 'r1', summary: 'FSSAI licence for Spice Route Restaurant.', checks: [], confidence: 90, recommendation: 'looks_valid' };
    await r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
  });
  const ap = await apiCtx.newPage(); ap.on('pageerror', (e) => errs.push(e.message));
  await ap.goto(B); await ap.waitForSelector('.bot-fab');
  await ap.click('.bot-fab'); await ap.waitForSelector('.bot-panel');
  await ap.locator('.bot-starters button').first().click(); await ap.waitForSelector('.bot-bub.assistant:not(.typing)');
  ok(/Sign up as a Donor/.test(await ap.textContent('.bot-bub.assistant:not(.typing)')) && await ap.locator('.bot-fast').count() === 1, 'chatbot answers common questions instantly');
  ok(await ap.locator('.bot-bub.assistant li').count() >= 3, 'chatbot answers are formatted as clean bullet points');
  ok(!apiCalls.some((c) => c.path === '/chat'), 'instant answers need no AI call');
  await ap.fill('.bot-form input', 'Tell me something unusual about mangoes'); await ap.press('.bot-form input', 'Enter'); await ap.waitForFunction(() => document.querySelectorAll('.bot-bub.assistant:not(.typing)').length >= 2);
  ok(apiCalls.some((c) => c.path === '/chat'), 'other questions go to the AI');
  await ap.mouse.click(200, 300); await ap.waitForTimeout(300);
  ok(await ap.locator('.bot-panel').count() === 0, 'chatbot closes when you click outside it');
  await shot(ap, 'chatbot');
  await ap.goto(B + 'signin.html'); await ap.fill('input[name=email]', 'admin@t.org'); await ap.fill('input[name=password]', 'Secret123!'); await ap.getByRole('button', { name: 'Sign in' }).first().click(); await ap.waitForURL('**/admin.html');
  await ap.evaluate(() => (location.hash = 'orgs')); await ap.waitForSelector('.doc');
  await ap.locator('.card', { hasText: 'Spice Route Restaurant' }).getByRole('button', { name: /AI check|Re-check/ }).first().click(); await ap.waitForSelector('.toast');
  ok(/AI check complete/.test(await ap.textContent('.toast')), 'admin runs the AI document check from the verification card');
  ok(apiCalls.some((c) => c.path === '/ai/review-document' && /^Bearer mock-token-/.test(c.auth)), 'AI check is sent to FastAPI with the admin’s own session token');
  ok(await ap.locator('.bot-fab').count() === 1, 'assistant is also available inside dashboards');
  await apiCtx.close();

  console.log('TOUCH + REDUCED MOTION');
  const touch = await newCtx({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const tp = await touch.newPage(); await tp.goto(B); await tp.waitForSelector('.hero-h');
  ok(await tp.locator('.cx').count() === 0 && await tp.locator('html.has-cx').count() === 0, 'decorative cursor disabled on touch devices');
  await touch.close();
  const rm = await newCtx({ reducedMotion: 'reduce' });
  const rp = await rm.newPage(); const rerr = []; rp.on('pageerror', (e) => rerr.push(e.message));
  await rp.goto(B); await rp.waitForSelector('.hero-h'); await rp.waitForTimeout(400);
  ok(await rp.evaluate(() => getComputedStyle(document.querySelector('.hero-h .wi')).transform) === 'none', 'reduced motion: headline is shown immediately');
  ok(await rp.locator('.pin-spacer').count() === 0, 'reduced motion: journey is not scroll-pinned');
  ok(await rp.locator('.jr-node.on').count() === 5, 'reduced motion: all journey stops shown');
  await rp.mouse.move(300, 300); await rp.mouse.move(500, 400); await rp.waitForTimeout(200);
  ok(await rp.evaluate(() => !document.querySelector('.cx-trail')), 'no cursor trail canvas (removed for a lag-free cursor)');
  ok(rerr.length === 0, 'reduced motion: no page errors');
  await rm.close();

  console.log('\nconsole/page errors:', errs.length ? errs.slice(0, 8) : 'none');
  ok(errs.length === 0, 'no console or page errors during the whole run');
  console.log(`\n${pass} passed, ${fail} failed  (screenshots in ${SHOTS})`);
  await b.close(); srv.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('TEST CRASH', e.message); process.exit(1); });
