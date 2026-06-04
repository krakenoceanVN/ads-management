import { chromium } from 'playwright';
const BASE='http://localhost:3000'; const RATIO='0.9';
const slots=[
 {slot:'6-wap端(716)', daily:{'2026-04-06':98.82,'2026-04-07':108.05}},
 {slot:'1-wap端(674)', daily:{'2026-04-06':13.68,'2026-04-07':13.39}},
];
const DATES=['2026-04-06','2026-04-07'];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function humanType(loc,t){await loc.click();await loc.fill('');await loc.pressSequentially(String(t),{delay:45});await sleep(80);}
async function navTo(page,g,c){const ch=page.locator('.sb-child',{hasText:c}).first();if(!(await ch.isVisible().catch(()=>false))){await page.locator('.sb-group-header',{hasText:g}).first().click();await sleep(400);}await ch.click();await sleep(800);}
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900}});
await page.goto(BASE,{waitUntil:'domcontentloaded'});
await page.locator('#login-username').fill('admin');await page.locator('#login-password').fill('localdev-admin-123');
await page.locator('button.login-submit').click();await page.locator('#sidebar').waitFor({timeout:20000});await sleep(1200);
await page.locator('.lang-btn',{hasText:'EN'}).click();await sleep(600);
await navTo(page,'Data Entry','Advertiser Data Entry');
const di=page.locator('input[type="date"]').first();
for(const date of DATES){
  await di.fill(date);await sleep(1300);
  for(const s of slots){
    const row=page.locator('.entry-table tbody tr',{hasText:s.slot}).first();
    await row.waitFor({timeout:15000});
    const inp=row.locator('input.cell-input');
    await humanType(inp.nth(0),RATIO);await humanType(inp.nth(1),s.daily[date]);await humanType(inp.nth(2),'0');
    // per-row confirm (not Confirm-All) to avoid saving empty CPA rows
    await row.locator('button.entry-confirm-btn').first().click();
    await row.locator('.entry-confirm-btn.confirmed').first().waitFor({timeout:20000});
    console.log('[sim] confirmed',date,s.slot);
  }
}
await page.screenshot({path:'c:/Users/dhuyn/Desktop/260529/sim-artifacts/31-cps-entry-confirmed.png'});
console.log('[sim] DONE');await browser.close();
