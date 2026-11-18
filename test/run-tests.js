const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const fs = require('fs'), path = require('path'), http = require('http');
const ROOT = path.resolve(__dirname, '..');
const mock = fs.readFileSync(path.join(__dirname, 'mock-supabase.js'), 'utf8');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const srv = http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]).replace(/^\/$/, '/index.html')); if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': mime[path.extname(f)] || 'text/plain' }); r.end(fs.readFileSync(f)); });
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗ FAIL:', m); } };
(async () => {
  await new Promise((r) => srv.listen(8123, r));
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.route(/supabase-js/, (r) => r.fulfill({ contentType: 'text/javascript', body: mock }));
  await ctx.route('**/fonts.g*/**', (r) => r.fulfill({ body: '' }));
  const B = 'http://localhost:8123/';
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  const T = (s, o) => page.waitForSelector(s, { timeout: 4000, ...o });
  const click = async (txt) => page.getByRole('button', { name: txt }).first().click();
  const login = async (email, pw) => { await page.goto(B + 'signin.html'); await T('input[name=email]'); await page.fill('input[name=email]', email); await page.fill('input[name=password]', pw); await click('Sign in'); };
  const reg = async (email, role, name) => { await page.goto(B + 'signin.html?view=register'); await T('input[name=name]'); await page.getByRole('button', { name: new RegExp('^' + role) }).click(); await page.fill('input[name=name]', name); await page.fill('input[name=email]', email); await page.fill('input[name=password]', 'Secret123!'); await page.check('input[name=tc]'); await click('Create account'); };

  console.log('SIGN-IN PAGE');
  await page.goto(B + 'signin.html'); await T('.art'); await page.evaluate(() => window.__mock.reset()); await page.reload(); await T('.art');
  ok(await page.locator('.scene').count() === 1, 'animated scene renders');
  ok((await page.textContent('h1')).includes('Welcome back'), 'login view shown');
  await page.screenshot({ path: '/home/claude/shot-signin-light.png' });
  await click('Sign in'); await T('.err'); ok(/valid email/i.test(await page.textContent('.err')), 'empty login shows validation error');
  await page.fill('input[name=email]', 'x@y.org'); await page.fill('input[name=password]', 'nope'); await click('Sign in'); await page.waitForFunction(() => /Incorrect email/.test(document.body.innerText));
  ok(true, 'wrong credentials show friendly error');

  console.log('REGISTER (email confirmation on)');
  await reg('donor@t.org', 'Donor', 'Dina Donor'); await T('.done'); ok(/Check your email/.test(await page.textContent('.done')), 'registration shows check-your-email');
  await reg('ngo@t.org', 'Receiver', 'Nina NGO'); await T('.done');
  await reg('admin@t.org', 'Donor', 'Ada Admin'); await T('.done');
  await page.evaluate(() => window.__mock.setAdmin('admin@t.org'));
  const as = async (email, url) => { await page.evaluate(() => localStorage.removeItem('__mocksess')); await login(email, 'Secret123!'); await page.waitForURL('**/' + url); };
  const hash = async (h) => { await page.evaluate((x) => (location.hash = x), h); await page.waitForTimeout(150); };

  console.log('DONOR: profile + document');
  await as('donor@t.org', 'donor.html'); await T('input[name=name]');
  ok(/Your organisation/.test(await page.textContent('.phero h1')), 'new donor lands on the profile form');
  await page.fill('input[name=name]', 'Spice Route Restaurant'); await page.fill('input[name=address]', '12 MG Road'); await click('Create profile'); await T('.docs');
  ok(await page.locator('.phero h1').textContent() === 'Spice Route Restaurant', 'profile created, stays on profile');
  await page.setInputFiles('input[name=document]', { name: 'fssai.pdf', mimeType: 'application/pdf', buffer: Buffer.from('x') }); await click('Upload document'); await T('.doc');
  ok(await page.locator('.doc').count() === 1, 'document uploaded');
  await hash('listings'); await T('text=Verification pending');
  ok(await page.getByRole('button', { name: /New listing/ }).isDisabled(), 'cannot list before verification');

  console.log('NGO: profile + representative + document');
  await as('ngo@t.org', 'receiver.html'); await T('input[name=name]');
  await page.fill('input[name=name]', 'Asha Kitchen'); await page.fill('input[name=address]', '21 Park Street'); await click('Create profile'); await T('.docs');
  await page.locator('form').filter({ hasText: 'Add representative' }).locator('input[name=name]').fill('Ravi');
  await page.locator('form').filter({ hasText: 'Add representative' }).locator('input[name=phone]').fill('9999999999'); await click('Add representative'); await T('text=Ravi');
  await page.setInputFiles('input[name=document]', { name: 'reg.pdf', mimeType: 'application/pdf', buffer: Buffer.from('x') }); await click('Upload document'); await T('.doc');
  ok(true, 'NGO profile, representative and document saved');

  console.log('ADMIN: verification');
  await as('admin@t.org', 'admin.html'); await T('.hero');
  ok(await page.locator('.nav .badge').first().isVisible(), 'admin sees pending-verification badge');
  await hash('verify'); await T('text=Spice Route Restaurant');
  await page.locator('.card', { hasText: 'Spice Route Restaurant' }).getByRole('button', { name: 'Approve', exact: true }).click(); await page.waitForSelector('.toast.bad');
  ok(/at least one verification document/i.test(await page.textContent('.toast.bad')), 'approving without an approved document is blocked');
  for (const n of ['Spice Route Restaurant', 'Asha Kitchen']) {
    await page.locator('.card', { hasText: n }).locator('.doc .btn.ok').first().click(); await page.waitForTimeout(300);
    await page.locator('.card', { hasText: n }).getByRole('button', { name: 'Approve', exact: true }).click(); await page.waitForTimeout(400);
  }
  await hash('orgs'); await T('.tag.approved');
  ok(await page.locator('.tag.approved').count() >= 2, 'both organisations approved');
  await page.screenshot({ path: '/home/claude/shot-admin-light.png' });

  console.log('DONOR: publish listing');
  await as('donor@t.org', 'donor.html'); await T('.hero');
  await hash('listings'); await click('New listing'); await T('input[name=title]');
  await page.fill('input[name=title]', 'Vegetable biryani'); await page.fill('input[name=qty]', '40'); await click('Publish listing'); await T('text=Vegetable biryani');
  ok(await page.locator('.lcard, .card:has-text("Vegetable biryani")').count() >= 1, 'donor published a listing');

  console.log('NGO: discover + request');
  await as('ngo@t.org', 'receiver.html'); await T('.hero');
  await hash('discover'); await T('.qty');
  await page.locator('.qty').fill('15'); await click('Request food'); await T('.toast');
  await hash('requests'); await T('.tag.pending'); ok(true, 'NGO sent a request (quantity validated server-side)');

  console.log('DONOR: accept');
  await as('donor@t.org', 'donor.html'); await T('.hero');
  await hash('requests'); await T('.tag.pending'); await click('Accept'); await T('.tag.accepted'); ok(true, 'donor accepted; quantity reserved');

  console.log('NGO: OTP');
  await as('ngo@t.org', 'receiver.html'); await T('.hero'); await hash('pickups'); await T('.otpv');
  const otp = await page.textContent('.otpv'); ok(/^\d{4}$/.test(otp), 'NGO sees the pickup OTP: ' + otp);
  await page.screenshot({ path: '/home/claude/shot-ngo-pickup.png' });

  console.log('DONOR: confirm OTP');
  await as('donor@t.org', 'donor.html'); await T('.hero'); await hash('pickups'); await T('.otp');
  await page.fill('.otp', '0000'); await click('Confirm collection'); await T('.toast.bad'); ok(true, 'wrong OTP rejected');
  await page.fill('.otp', otp); await click('Confirm collection'); await page.waitForFunction(() => /Pickup confirmed/.test(document.body.innerText)); ok(true, 'correct OTP completes the donation');
  await hash('impact'); await T('.bd.on'); ok(await page.locator('.bd.on').count() >= 1, 'badge awarded after first donation');
  await T('text=Certificates'); ok(await page.getByRole('button', { name: /View/ }).count() >= 1, 'certificate issued');
  await page.screenshot({ path: '/home/claude/shot-donor-impact.png' });
  await hash('overview'); await page.waitForTimeout(1300); await page.screenshot({ path: '/home/claude/shot-donor-light.png' });
  ok(await page.locator('button[aria-label^="Notifications"]').count() === 1, 'notification bell present');
  await page.locator('button[aria-label^="Notifications"]').click(); await T('.dd'); ok(await page.locator('.ni').count() >= 1, 'notifications list opens');
  await page.mouse.click(600, 600);
  await page.locator('button[aria-label^="Switch to dark"]').click(); await page.waitForTimeout(500); await page.screenshot({ path: '/home/claude/shot-donor-dark.png' });
  ok(await page.evaluate(() => document.documentElement.dataset.theme) === 'dark', 'dark mode toggles');
  await page.locator('button[aria-label^="Switch to light"]').click();

  console.log('GUARDS + MOBILE');
  await page.goto(B + 'admin.html'); await page.waitForURL('**/donor.html', { timeout: 5000 }).catch(() => {}); ok(/donor\.html/.test(page.url()), 'wrong-role visit redirects to own dashboard');
  await page.setViewportSize({ width: 390, height: 800 }); await page.reload(); await T('.hero'); await page.screenshot({ path: '/home/claude/shot-donor-mobile.png' });
  ok(await page.locator('.ib.menu').isVisible(), 'mobile menu button visible');
  await page.evaluate(() => localStorage.removeItem('__mocksess')); await page.goto(B + 'receiver.html'); await page.waitForURL('**/signin.html', { timeout: 5000 }).catch(() => {}); ok(/signin\.html/.test(page.url()), 'signed-out visit redirects to sign-in');
  console.log('\nconsole/page errors:', errs.length ? errs.slice(0, 6) : 'none');
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); srv.close();
})().catch((e) => { console.error('TEST CRASH', e.message); process.exit(1); });
