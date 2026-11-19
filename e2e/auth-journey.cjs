// End-to-end auth journey against a running site + Supabase project.
// Needs test accounts (donor, admin) and DONOR_PW / ADMIN_PW env vars; run from web/: node ../e2e/auth-journey.cjs
// In the cloud sandbox Chromium goes through HTTPS_PROXY; elsewhere the proxy option is ignored when unset.
const { chromium } = require('@playwright/test');
const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok -', m); };
(async () => {
  const browser = await chromium.launch(process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } } : {});
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, geolocation: { latitude: 18.5204, longitude: 73.8567 }, permissions: ['geolocation'] });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/tile\.openstreetmap|Failed to load resource/.test(m.text())) errs.push(m.text()); });
  const shot = n => page.screenshot({ path: `e2e/output/${n}.png` });

  // 1. wrong password
  await page.goto(BASE + '/sign-in');
  await page.fill('#email', 'annsetu-test-donor@example.com');
  await page.fill('#password', 'wrong-password-1');
  await page.click('button[type=submit]');
  await page.getByText('Email or password is incorrect.').waitFor({ timeout: 15000 });
  ok(true, 'wrong password shows a clear error');

  // 2. donor journey
  await page.fill('#password', process.env.DONOR_PW);
  await page.click('button[type=submit]');
  await page.waitForURL('**/onboarding/profile', { timeout: 20000 });
  ok(true, 'new donor is sent to the profile wizard');
  await page.click('text=Save & continue');
  await page.getByText('Enter your organisation’s name').waitFor();
  ok(true, 'wizard validates required fields');
  await page.fill('#name', 'Annsetu Test Kitchen');
  await page.selectOption('#org_type', 'restaurant');
  await page.fill('#contact_person', 'Test Donor');
  await page.fill('#phone', '+91 90000 00001');
  await page.fill('#org_email', 'annsetu-test-donor@example.com');
  await page.click('text=Save & continue');
  await page.waitForSelector('#address', { timeout: 15000 });
  ok(true, 'step 1 saved (organisation created under RLS)');
  await page.fill('#address', '1 Test Lane, MG Road');
  await page.fill('#city', 'Pune');
  await page.selectOption('#state', 'Maharashtra');
  await page.fill('#pincode', '411001');
  await page.click('text=Use my location');
  await page.getByText(/Pinned at 18\.520/).waitFor({ timeout: 10000 });
  ok(true, 'use-my-location drops the pin');
  await shot('step2');
  await page.click('text=Save & continue');
  await page.waitForSelector('#about', { timeout: 15000 });
  await page.fill('#about', 'Test restaurant used only for automated end-to-end testing of AnnSetu onboarding.');
  for (const d of ['Mon', 'Tue', 'Wed']) await page.click(`button[aria-pressed]:has-text("${d}")`);
  await page.click('text=Add window');
  await page.click('text=Save & continue');
  await page.waitForSelector('#fssai', { timeout: 15000 });
  await page.fill('#fssai', '12345678901234');
  await page.click('text=Save & continue');
  await page.getByText('Submit for verification').waitFor({ timeout: 15000 });
  await shot('review');
  ok(true, 'review step shows all details');
  await page.click('text=Submit for verification');
  await page.waitForURL('**/dashboard**', { timeout: 20000 });
  await page.getByText('Awaiting verification').waitFor({ timeout: 15000 });
  await shot('dashboard');
  ok(true, 'submit completes profile; dashboard shows Awaiting verification');

  // sign out with confirmation
  await page.click('button:has-text("Sign out")');
  await page.getByText('Sign out of AnnSetu?').waitFor();
  await page.click('dialog button:has-text("Cancel")');
  ok(await page.url().includes('/dashboard'), 'cancel keeps you signed in');
  await page.click('button:has-text("Sign out")');
  await page.click('dialog button:has-text("Sign out")');
  await page.waitForURL(BASE + '/', { timeout: 15000 });
  ok(true, 'confirmed sign-out returns home');
  await page.goto(BASE + '/dashboard');
  await page.waitForURL('**/sign-in?next=%2Fdashboard');
  ok(true, 'dashboard is protected after sign-out');

  // 3. admin
  await page.fill('#email', 'annsetu-test-admin@example.com');
  await page.fill('#password', process.env.ADMIN_PW);
  await page.click('button[type=submit]');
  await page.waitForURL('**/admin', { timeout: 20000 });
  const pending = Number(await page.locator('dd').first().innerText());
  await shot('admin');
  ok(pending >= 1, `admin lands on /admin and sees ${pending} awaiting verification`);

  ok(errs.length === 0, 'no console errors: ' + JSON.stringify(errs));
  await browser.close();
})().catch(e => { console.error(e.message); process.exit(1); });
