import { chromium } from 'playwright';
const BASE = 'http://localhost:3000';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const OUT = 'c:/Users/dhuyn/Desktop/260529/sim-artifacts';

async function navTo(page, groupText, childText) {
  const child = page.locator('.sb-child', { hasText: childText }).first();
  if (!(await child.isVisible().catch(() => false))) {
    await page.locator('.sb-group-header', { hasText: groupText }).first().click();
    await sleep(350);
  }
  await child.click();
  await sleep(700);
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

await navTo(page, 'Settlement', 'Advertiser Settlement');
await page.locator('input[type="month"]').first().fill('2026-04');
await sleep(300);
await page.locator('button.btn-primary', { hasText: 'Query' }).first().click();
await sleep(1500);
await page.screenshot({ path: `${OUT}/19-settlement-2026-04.png` });
console.log('[sim] settlement screenshot saved');
await browser.close();
