// UI test: Quarantine (advertiser) -> Restore (#9) -> Unconfirm (#5), via the real UI.
import { chromium } from 'playwright';
const BASE = 'http://localhost:3000';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const OUT = 'c:/Users/dhuyn/Desktop/260529/sim-artifacts';
let n = 20;
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

// ===== QUARANTINE (advertiser, 2026-04-01..05) =====
await navTo(page, 'Advertiser Management', 'Advertiser Management');
await sleep(500);
await page.locator('table .action-btn').first().click();           // edit advertiser
await page.locator('.modal').first().waitFor();
await page.getByRole('button', { name: 'Delete', exact: true }).click(); // -> window.confirm -> quarantine modal
const qm = page.locator('.modal', { hasText: 'Cô lập dữ liệu nhập' });
await qm.waitFor({ timeout: 10000 });
const qd = qm.locator('input[type="date"]');
await qd.nth(0).fill('2026-04-01');
await qd.nth(1).fill('2026-04-05');
await qm.locator('textarea').fill('Test quarantine batch');
await shot(page, 'quarantine-form');
await qm.locator('button.btn-danger', { hasText: 'Cô lập dữ liệu' }).click();
await page.locator('text=Đã cô lập thành công').first().waitFor({ timeout: 15000 });
await shot(page, 'quarantine-success');
await qm.getByRole('button', { name: 'Đóng' }).click().catch(() => {});
await sleep(800);
console.log('[sim] quarantine done');

// ===== RESTORE (Quarantine Management) =====
await navTo(page, 'System Administration', 'Cô lập dữ liệu');
await sleep(800);
await shot(page, 'quarantine-list');
await page.locator('button.btn-sm', { hasText: 'Restore' }).first().click();
await page.locator('.modal').first().waitFor();
await page.locator('.modal button.btn-primary', { hasText: 'Restore' }).first().click();
await sleep(1800);
await shot(page, 'quarantine-restored');
console.log('[sim] restore done');

// ===== UNCONFIRM (advertiser data entry, 2026-04-01, xpagecn) =====
await navTo(page, 'Data Entry', 'Advertiser Data Entry');
await page.locator('input[type="date"]').first().fill('2026-04-01');
await sleep(1600);
const row = page.locator('.entry-table tbody tr', { hasText: 'xpagecn' }).first();
await row.waitFor({ timeout: 15000 });
await row.locator('button.entry-edit-btn', { hasText: 'Edit' }).click(); // -> unconfirm
await sleep(1600);
await shot(page, 'after-unconfirm');
console.log('[sim] unconfirm done');

console.log('[sim] DONE');
await browser.close();
