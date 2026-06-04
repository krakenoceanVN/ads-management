// Human-like data-entry simulation via the real UI (Playwright).
// Flow: login -> switch to EN -> create AdType -> Advertiser -> 2 CPA AdIds
//       -> enter 5 days of daily qty for each slot -> confirm -> open report + settlement.
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = 'http://localhost:3000';
const USER = 'admin';
const PASS = 'localdev-admin-123';

const ADV = '上游-响云-bb';
const ADTYPE_CODE = 'XIANGYUN';
const ADTYPE_NAME = 'Xiangyun';
const UNIT = '1.7';

const slots = [
  { slot: 'xpagecn', daily: { '2026-04-01': 1514, '2026-04-02': 1634, '2026-04-03': 1021, '2026-04-04': 122, '2026-04-05': 105 } },
  { slot: 'movetab', daily: { '2026-04-01': 1576, '2026-04-02': 1734, '2026-04-03': 1129, '2026-04-04': 112, '2026-04-05': 121 } },
];
const DATES = ['2026-04-01', '2026-04-02', '2026-04-03', '2026-04-04', '2026-04-05'];

const OUT = 'c:/Users/dhuyn/Desktop/260529/sim-artifacts';
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log('[sim]', ...a);

let shotN = 0;
async function shot(page, name) {
  shotN += 1;
  const file = `${OUT}/${String(shotN).padStart(2, '0')}-${name}.png`;
  await page.screenshot({ path: file, fullPage: false });
  log('screenshot', file);
}

async function humanType(loc, text) {
  await loc.click();
  await loc.fill('');
  await loc.pressSequentially(String(text), { delay: 65 });
  await sleep(120);
}

async function navTo(page, groupText, childText) {
  const child = page.locator('.sb-child', { hasText: childText }).first();
  if (!(await child.isVisible().catch(() => false))) {
    await page.locator('.sb-group-header', { hasText: groupText }).first().click();
    await sleep(350);
  }
  await child.click();
  await sleep(700);
}

async function modalPrimary(page, name) {
  await page.locator('.modal button.btn-primary', { hasText: name }).first().click();
  // wait for modal to close
  await page.locator('.modal').first().waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});
  await sleep(500);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('console', (m) => { if (m.type() === 'error') log('PAGE-ERR', m.text()); });

  // ---- LOGIN ----
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.locator('#login-username').waitFor();
  await humanType(page.locator('#login-username'), USER);
  await humanType(page.locator('#login-password'), PASS);
  await shot(page, 'login-filled');
  await page.locator('button.login-submit').click();
  await page.locator('#sidebar').waitFor({ timeout: 20000 });
  await page.locator('.sb-group-header, .sb-single').first().waitFor({ timeout: 20000 });
  await sleep(1200);
  log('logged in');

  // ---- SWITCH TO ENGLISH ----
  await page.locator('.lang-btn', { hasText: 'EN' }).click();
  await sleep(600);
  await shot(page, 'after-login-en');

  // ---- CREATE AD TYPE (Advertiser Mgmt > Ad Order Management) ----
  await navTo(page, 'Advertiser Management', 'Ad Order Management');
  await page.locator('button.btn-primary', { hasText: 'New Ad Order' }).first().click();
  await page.locator('.modal').waitFor();
  await humanType(page.locator('.modal .form-group', { hasText: 'Ad Order Code' }).locator('input'), ADTYPE_CODE);
  await humanType(page.locator('.modal .form-group', { hasText: 'Ad Order Name' }).locator('input'), ADTYPE_NAME);
  await shot(page, 'adtype-form');
  await modalPrimary(page, 'Save to System');
  log('AdType created');

  // ---- CREATE ADVERTISER ----
  await navTo(page, 'Advertiser Management', 'Advertiser Management');
  await page.locator('button.btn-primary', { hasText: 'New Advertiser' }).first().click();
  await page.locator('.modal').waitFor();
  await humanType(page.locator('.modal .form-group', { hasText: 'Advertiser Name' }).locator('input'), ADV);
  await page.locator('.modal .form-group', { hasText: 'Ad Type' }).locator('select').selectOption({ value: ADTYPE_CODE });
  await sleep(300);
  await shot(page, 'advertiser-form');
  await modalPrimary(page, 'Submit');
  log('Advertiser created');

  // ---- CREATE 2 CPA AD IDS (slots) ----
  await navTo(page, 'Advertiser Management', 'Ad ID Management');
  for (const s of slots) {
    await page.locator('button.btn-primary', { hasText: 'New Ad ID' }).first().click();
    await page.locator('.modal').waitFor();
    // advertiser (first select) — only one advertiser exists => index 1
    await page.locator('.modal .form-group', { hasText: 'Advertiser' }).first().locator('select').selectOption({ index: 1 });
    await sleep(200);
    await page.locator('.modal .form-group', { hasText: 'Ad Type' }).locator('select').selectOption({ value: ADTYPE_CODE });
    await sleep(200);
    await humanType(page.locator('.modal .form-group', { hasText: 'Ad ID' }).locator('input'), s.slot);
    // type select = the one that has a CPA option
    const typeSel = page.locator('.modal select').filter({ has: page.locator('option[value="CPA"]') });
    await typeSel.selectOption({ value: 'CPA' });
    await sleep(300);
    await humanType(page.locator('.modal .form-group', { hasText: 'Unit Price' }).locator('input'), UNIT);
    await shot(page, `adid-${s.slot}`);
    await modalPrimary(page, 'Submit');
    log('AdId created:', s.slot);
  }

  // ---- DATA ENTRY: 5 days, both slots ----
  await navTo(page, 'Data Entry', 'Advertiser Data Entry');
  const dateInput = page.locator('input[type="date"]').first();
  for (const date of DATES) {
    await dateInput.fill(date);
    await sleep(1300); // let rows reload
    // wait for both slot rows to be present
    for (const s of slots) {
      await page.locator('.entry-table tbody tr', { hasText: s.slot }).first().waitFor({ timeout: 15000 });
    }
    for (const s of slots) {
      const row = page.locator('.entry-table tbody tr', { hasText: s.slot }).first();
      const inputs = row.locator('input.cell-input');
      await humanType(inputs.nth(0), UNIT);          // rate / unit price
      await humanType(inputs.nth(1), s.daily[date]); // traffic / qty
    }
    await shot(page, `entry-${date}-typed`);
    await page.locator('button.entry-confirm-btn.all').click();
    // wait until both rows are confirmed
    for (const s of slots) {
      await page.locator('.entry-table tbody tr', { hasText: s.slot })
        .locator('.entry-confirm-btn.confirmed').first().waitFor({ timeout: 20000 });
    }
    await sleep(500);
    await shot(page, `entry-${date}-confirmed`);
    log('entered & confirmed', date);
  }

  // ---- REPORT: Total Profit ----
  await navTo(page, 'Data Query', 'Total Profit Report');
  await sleep(1500);
  await shot(page, 'report-total-profit');

  // ---- SETTLEMENT: Advertiser ----
  await navTo(page, 'Settlement', 'Advertiser Settlement');
  await sleep(1500);
  await shot(page, 'settlement-advertiser');

  log('DONE');
  await browser.close();
}

main().catch(async (e) => {
  console.error('SIM FAILED:', e);
  process.exit(1);
});
