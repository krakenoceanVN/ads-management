// Test #2 (360): CPS/RATIO billing flow via the real UI.
// AdType TEST360 -> Advertiser 响云（BB） -> 2 CPS slots (ratio 0.9) -> 5 days entry -> confirm.
import { chromium } from 'playwright';
const BASE = 'http://localhost:3000';
const USER = 'admin', PASS = 'localdev-admin-123';
const ADV = '响云（BB）';
const ADTYPE_CODE = 'TEST360', ADTYPE_NAME = 'Test 360';
const RATIO = '0.9';
const slots = [
  { slot: '6-wap端(716)', daily: { '2026-04-03': 12.17, '2026-04-04': 79.03, '2026-04-05': 111.96, '2026-04-06': 98.82, '2026-04-07': 108.05 } },
  { slot: '1-wap端(674)', daily: { '2026-04-03': 17.14, '2026-04-04': 101.81, '2026-04-05': 13.72, '2026-04-06': 13.68, '2026-04-07': 13.39 } },
];
const DATES = ['2026-04-03', '2026-04-04', '2026-04-05', '2026-04-06', '2026-04-07'];

const OUT = 'c:/Users/dhuyn/Desktop/260529/sim-artifacts';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let n = 28;
async function shot(p, name) { n++; const f = `${OUT}/${n}-${name}.png`; await p.screenshot({ path: f }); console.log('[sim] shot', f); }
async function humanType(loc, text) { await loc.click(); await loc.fill(''); await loc.pressSequentially(String(text), { delay: 55 }); await sleep(100); }
async function navTo(page, g, c) {
  const child = page.locator('.sb-child', { hasText: c }).first();
  if (!(await child.isVisible().catch(() => false))) { await page.locator('.sb-group-header', { hasText: g }).first().click(); await sleep(400); }
  await child.click(); await sleep(800);
}
async function modalPrimary(page, name) {
  await page.locator('.modal button.btn-primary', { hasText: name }).first().click();
  await page.locator('.modal').first().waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});
  await sleep(500);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('console', (m) => { if (m.type() === 'error') console.log('PAGE-ERR', m.text()); });

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.locator('#login-username').fill(USER);
await page.locator('#login-password').fill(PASS);
await page.locator('button.login-submit').click();
await page.locator('#sidebar').waitFor({ timeout: 20000 });
await sleep(1200);
await page.locator('.lang-btn', { hasText: 'EN' }).click();
await sleep(600);

// AdType
await navTo(page, 'Advertiser Management', 'Ad Order Management');
await page.locator('button.btn-primary', { hasText: 'New Ad Order' }).first().click();
await page.locator('.modal').waitFor();
await humanType(page.locator('.modal .form-group', { hasText: 'Ad Order Code' }).locator('input'), ADTYPE_CODE);
await humanType(page.locator('.modal .form-group', { hasText: 'Ad Order Name' }).locator('input'), ADTYPE_NAME);
await modalPrimary(page, 'Save to System');
console.log('[sim] AdType created');

// Advertiser
await navTo(page, 'Advertiser Management', 'Advertiser Management');
await page.locator('button.btn-primary', { hasText: 'New Advertiser' }).first().click();
await page.locator('.modal').waitFor();
await humanType(page.locator('.modal .form-group', { hasText: 'Advertiser Name' }).locator('input'), ADV);
await page.locator('.modal .form-group', { hasText: 'Ad Type' }).locator('select').selectOption({ value: ADTYPE_CODE });
await sleep(300);
await modalPrimary(page, 'Submit');
console.log('[sim] Advertiser created');

// AdIds (CPS / RATIO, ratio 0.9)
await navTo(page, 'Advertiser Management', 'Ad ID Management');
for (const s of slots) {
  await page.locator('button.btn-primary', { hasText: 'New Ad ID' }).first().click();
  await page.locator('.modal').waitFor();
  // advertiser select: pick the one we just made (last option)
  const advSel = page.locator('.modal .form-group', { hasText: 'Advertiser' }).first().locator('select');
  await advSel.selectOption({ label: ADV });
  await sleep(200);
  await page.locator('.modal .form-group', { hasText: 'Ad Type' }).locator('select').selectOption({ value: ADTYPE_CODE });
  await sleep(200);
  await humanType(page.locator('.modal .form-group', { hasText: 'Ad ID' }).locator('input'), s.slot);
  const typeSel = page.locator('.modal select').filter({ has: page.locator('option[value="RATIO"]') });
  await typeSel.selectOption({ value: 'RATIO' });
  await sleep(300);
  // ratio input = number input with max="1"
  await humanType(page.locator('.modal input[type="number"][max="1"]'), RATIO);
  await shot(page, `cps-adid-${s.slot.replace(/[^a-z0-9]/gi, '')}`);
  await modalPrimary(page, 'Submit');
  console.log('[sim] AdId created:', s.slot);
}

// Data entry
await navTo(page, 'Data Entry', 'Advertiser Data Entry');
const dateInput = page.locator('input[type="date"]').first();
for (const date of DATES) {
  await dateInput.fill(date);
  await sleep(1300);
  for (const s of slots) await page.locator('.entry-table tbody tr', { hasText: s.slot }).first().waitFor({ timeout: 15000 });
  for (const s of slots) {
    const row = page.locator('.entry-table tbody tr', { hasText: s.slot }).first();
    const inputs = row.locator('input.cell-input');
    await humanType(inputs.nth(0), RATIO);          // rate = ratio
    await humanType(inputs.nth(1), s.daily[date]);  // traffic = amount1
    // settlement (nth2) left empty -> amount2 = 0
  }
  await shot(page, `cps-entry-${date}-typed`);
  await page.locator('button.entry-confirm-btn.all').click();
  for (const s of slots) await page.locator('.entry-table tbody tr', { hasText: s.slot }).locator('.entry-confirm-btn.confirmed').first().waitFor({ timeout: 20000 });
  await sleep(400);
  console.log('[sim] entered & confirmed', date);
}
await shot(page, 'cps-entry-confirmed');

console.log('[sim] DONE');
await browser.close();
