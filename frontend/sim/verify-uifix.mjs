// Verify the two UI fixes: (1) quarantine success screen now renders; (2) EN labels fixed.
import { chromium } from 'playwright';
const BASE = 'http://localhost:3000';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const OUT = 'c:/Users/dhuyn/Desktop/260529/sim-artifacts';
let n = 26;
async function shot(p, name) { n++; const f = `${OUT}/${n}-${name}.png`; await p.screenshot({ path: f }); console.log('[sim] shot', f); }
async function navTo(page, g, c) {
  const child = page.locator('.sb-child', { hasText: c }).first();
  if (!(await child.isVisible().catch(() => false))) { await page.locator('.sb-group-header', { hasText: g }).first().click(); await sleep(400); }
  await child.click(); await sleep(900);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('dialog', (d) => d.accept().catch(() => {}));

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.locator('#login-username').fill('admin');
await page.locator('#login-password').fill('localdev-admin-123');
await page.locator('button.login-submit').click();
await page.locator('#sidebar').waitFor({ timeout: 20000 });
await sleep(1200);
await page.locator('.lang-btn', { hasText: 'EN' }).click();
await sleep(600);

// Fix #2: labels — sidebar child should now read "Data Quarantine", page title "Quarantine Management"
await navTo(page, 'System Administration', 'Data Quarantine');
await sleep(700);
await shot(page, 'labels-fixed');

// Fix #1: quarantine success screen — quarantine a small range (04-04..05)
await navTo(page, 'Advertiser Management', 'Advertiser Management');
await sleep(500);
await page.locator('table .action-btn').first().click();
await page.locator('.modal').first().waitFor();
await page.getByRole('button', { name: 'Delete', exact: true }).click();
const qm = page.locator('.modal', { hasText: 'Cô lập dữ liệu nhập' });
await qm.waitFor({ timeout: 10000 });
const qd = qm.locator('input[type="date"]');
await qd.nth(0).fill('2026-04-04');
await qd.nth(1).fill('2026-04-05');
await qm.locator('textarea').fill('verify success screen');
await qm.locator('button.btn-danger', { hasText: 'Cô lập dữ liệu' }).click();
// success screen should now appear
await page.locator('text=Đã cô lập thành công').first().waitFor({ timeout: 15000 });
await shot(page, 'quarantine-success-shown');
console.log('[sim] success screen rendered');
await qm.getByRole('button', { name: 'Đóng' }).click().catch(() => {});
await sleep(600);

// cleanup: restore the batch we just created
await navTo(page, 'System Administration', 'Data Quarantine');
await sleep(700);
await page.locator('button.btn-sm', { hasText: 'Restore' }).first().click();
await page.locator('.modal').first().waitFor();
await sleep(300);
await page.locator('.modal button.btn-primary', { hasText: 'Restore' }).first().click();
await sleep(1500);
console.log('[sim] cleanup restore done; DONE');
await browser.close();
