// Continuation: Restore the quarantine batch (#9) then Unconfirm one entry (#5), via UI.
import { chromium } from 'playwright';
const BASE = 'http://localhost:3000';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const OUT = 'c:/Users/dhuyn/Desktop/260529/sim-artifacts';
let n = 22;
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

// ===== RESTORE =====
await navTo(page, 'System Administration', 'Cô lập dữ liệu');
await sleep(900);
await shot(page, 'quarantine-list');
await page.locator('button.btn-sm', { hasText: 'Restore' }).first().click();
await page.locator('.modal').first().waitFor();
await sleep(400);
await page.locator('.modal button.btn-primary', { hasText: 'Restore' }).first().click();
await sleep(2000);
await shot(page, 'quarantine-restored');
console.log('[sim] restore done');

// ===== UNCONFIRM =====
await navTo(page, 'Data Entry', 'Advertiser Data Entry');
await page.locator('input[type="date"]').first().fill('2026-04-01');
await sleep(1600);
const row = page.locator('.entry-table tbody tr', { hasText: 'xpagecn' }).first();
await row.waitFor({ timeout: 15000 });
await shot(page, 'before-unconfirm');
await row.locator('button.entry-edit-btn', { hasText: 'Edit' }).click();
await sleep(1800);
await shot(page, 'after-unconfirm');
console.log('[sim] unconfirm done');

console.log('[sim] DONE');
await browser.close();
