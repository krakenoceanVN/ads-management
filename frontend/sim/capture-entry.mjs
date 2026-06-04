import { chromium } from 'playwright';
const BASE = 'http://localhost:3000';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const OUT = 'c:/Users/dhuyn/Desktop/260529/sim-artifacts';
async function navTo(page, g, c) {
  const child = page.locator('.sb-child', { hasText: c }).first();
  if (!(await child.isVisible().catch(() => false))) { await page.locator('.sb-group-header', { hasText: g }).first().click(); await sleep(350); }
  await child.click(); await sleep(700);
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
await page.locator('input[type="date"]').first().fill('2026-04-01');
await sleep(1500);
await page.screenshot({ path: `${OUT}/20-entry-cpa-traffic-fixed.png` });
console.log('[sim] entry screenshot saved');
await browser.close();
