import { chromium } from 'playwright';
const BASE = 'http://localhost:3000';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function navTo(page, g, c) {
  const child = page.locator('.sb-child', { hasText: c }).first();
  if (!(await child.isVisible().catch(() => false))) { await page.locator('.sb-group-header', { hasText: g }).first().click(); await sleep(400); }
  await child.click(); await sleep(900);
}
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('console', (m) => console.log('PAGE', m.type(), m.text()));
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.locator('#login-username').fill('admin');
await page.locator('#login-password').fill('localdev-admin-123');
await page.locator('button.login-submit').click();
await page.locator('#sidebar').waitFor({ timeout: 20000 });
await sleep(1200);
await page.locator('.lang-btn', { hasText: 'EN' }).click();
await sleep(600);
await navTo(page, 'Data Entry', 'Advertiser Data Entry');
await page.locator('input[type="date"]').first().fill('2026-04-03');
await sleep(2500);
const rows = page.locator('.entry-table tbody tr');
const cnt = await rows.count();
console.log('ROWS:', cnt);
for (let i = 0; i < cnt; i++) {
  const r = rows.nth(i);
  const txt = (await r.innerText()).replace(/\s+/g, ' ').slice(0, 70);
  const inputs = r.locator('input.cell-input');
  const ic = await inputs.count();
  const states = [];
  for (let j = 0; j < ic; j++) states.push(await inputs.nth(j).isEnabled());
  console.log(`ROW${i} [${txt}] inputs=${ic} enabled=${JSON.stringify(states)}`);
}
await browser.close();
