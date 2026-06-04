// CPS entry only (master data already exists) — after the isAllowedEntryType('CPS') fix.
import { chromium } from 'playwright';
const BASE = 'http://localhost:3000';
const RATIO = '0.9';
const slots = [
  { slot: '6-wap端(716)', daily: { '2026-04-03': 12.17, '2026-04-04': 79.03, '2026-04-05': 111.96, '2026-04-06': 98.82, '2026-04-07': 108.05 } },
  { slot: '1-wap端(674)', daily: { '2026-04-03': 17.14, '2026-04-04': 101.81, '2026-04-05': 13.72, '2026-04-06': 13.68, '2026-04-07': 13.39 } },
];
const DATES = ['2026-04-03', '2026-04-04', '2026-04-05', '2026-04-06', '2026-04-07'];
const OUT = 'c:/Users/dhuyn/Desktop/260529/sim-artifacts';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let n = 30;
async function shot(p, name) { n++; const f = `${OUT}/${n}-${name}.png`; await p.screenshot({ path: f }); console.log('[sim] shot', f); }
async function humanType(loc, text) { await loc.click(); await loc.fill(''); await loc.pressSequentially(String(text), { delay: 50 }); await sleep(90); }
async function navTo(page, g, c) {
  const child = page.locator('.sb-child', { hasText: c }).first();
  if (!(await child.isVisible().catch(() => false))) { await page.locator('.sb-group-header', { hasText: g }).first().click(); await sleep(400); }
  await child.click(); await sleep(800);
}
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.locator('#login-username').fill('admin');
await page.locator('#login-password').fill('localdev-admin-123');
await page.locator('button.login-submit').click();
await page.locator('#sidebar').waitFor({ timeout: 20000 });
await sleep(1200);
await page.locator('.lang-btn', { hasText: 'EN' }).click();
await sleep(600);

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
    await humanType(inputs.nth(2), '0');            // settlement = amount2 (required by backend)
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
