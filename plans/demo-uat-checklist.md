# Demo / UAT Checklist — Ads Management System
**Branch:** 110526 | **Phase 1 commit:** 85e79f7 | **Phase 2 commit:** ddd5172

---

## 1. Pre-Demo Environment Checks

Before starting the demo, verify each item:

- [ ] Current branch is `110526` — check with `git branch`
- [ ] Latest remote commit is `ddd5172` — check with `git log -1 --oneline`
- [ ] Backend starts without error: `npm run dev` (port 3001)
- [ ] Frontend starts without error: `cd frontend && npm run dev` (port 3000)
- [ ] Database has `OperationLog` table — if missing, apply manual SQL from `plans/operation-log-manual-sql.md`
- [ ] Login page loads at http://localhost:3000
- [ ] No generated files (dist/, node_modules/.prisma/) are staged — run `git status --short | grep -E "^M |^A "` and confirm none
- [ ] Test account credentials are known (admin login)

---

## 2. Smoke Flow

Complete for each step:

### Login
- [ ] Login page renders with username/password fields
- [ ] Successful login redirects to main app
- [ ] Failed login shows error message (do not use wrong credentials)

### Sidebar Username Verification
- [ ] Open browser DevTools → Application → Local Storage
- [ ] Find `token` key and decode the JWT payload (base64 middle section)
- [ ] Confirm the `username` field in the JWT matches the sidebar display
- [ ] Confirm sidebar does NOT show hardcoded "nancy"
- [ ] Log out and log in as a different test account — sidebar username updates

### Page Navigation (all main pages)
Navigate to each menu item and confirm no crash:

- [ ] Advertiser List (`pAdvertiserList`)
- [ ] Ad Order Management (`pAdOrderMgmt`)
- [ ] Ad ID Management (`pAdIdMgmt`)
- [ ] Media Management (`pMediaMgmt`)
- [ ] Media Ad Order Management (`pMediaAdOrderMgmt`)
- [ ] Media ID Management (`pMediaIdMgmt`)
- [ ] AI Entry (`pAiEntry`) — must show locked/unavailable state
- [ ] Advertiser Data Entry (`pAdvEntry`)
- [ ] Media Data Entry (`pMediaDataMgmt`)
- [ ] Total Profit (`pTotalProfit`)
- [ ] Order Profit (`pOrderProfit`)
- [ ] Advertiser Query (`pAdvQuery`)
- [ ] Media Query (`pMediaQuery`)
- [ ] Advertiser Settlement (`pAdvSettlement`) — only if `FEATURE_FLAGS.settlement = true`
- [ ] Media Settlement (`pMediaSettlement`) — only if `FEATURE_FLAGS.settlement = true`
- [ ] Operation Log (`mOpLog`) — must show logs table

### GlobalModal Verification
- [ ] GlobalModal component exists in code but is NOT mounted anywhere
- [ ] No modal/dialog appears that is not part of a standard page component
- [ ] App.tsx does not import GlobalModal (confirm by grep — no active import)

---

## 3. System / CRUD Flow

Test Advertiser and Media CRUD through the BFF adapter.

### Advertiser CRUD
- [ ] List advertisers — table loads with data
- [ ] Open "New Advertiser" form — fields visible: name, type, coefficient inputs (CPM/RATIO), note
- [ ] Save new advertiser — confirm success message
- [ ] Verify new advertiser appears in list
- [ ] Edit advertiser — modify name/note → Save → verify updated in list
- [ ] Delete advertiser (if role allows) — confirm removed from list

### Media CRUD
- [ ] List media — table loads with data
- [ ] Open "New Media" form — fields visible: name, type, coefficient inputs, note
- [ ] Save new media — confirm success message
- [ ] Verify new media appears in list
- [ ] Edit media — modify name/note → Save → verify updated in list
- [ ] Delete media (if role allows) — confirm removed from list

### Operation Log Verification (during CRUD)
- [ ] Open Operation Log page (`mOpLog`)
- [ ] After CREATE: log entry appears with action="CREATE", module="Advertiser" or "Media"
- [ ] After UPDATE: log entry appears with action="UPDATE", module="Advertiser" or "Media"
- [ ] After DELETE: log entry appears with action="DELETE", module="Advertiser" or "Media"
- [ ] Log detail field is readable (not null/empty for CRUD actions)
- [ ] Log timestamp is correct
- [ ] Log username matches the logged-in user

### Log Failure Non-Blocking
- [ ] While logging is failing (e.g. disconnect OperationLog table), perform a CRUD action
- [ ] CRUD action succeeds despite log failure — business action is not blocked

---

## 4. Read-Only Lookup Flow

Confirm AdOrder, AdId, and MediaId are read-only:

### AdOrder List
- [ ] Navigate to Ad Order Management (`pAdOrderMgmt`)
- [ ] Table displays ad order list
- [ ] No "Add New" button visible for ad orders
- [ ] No edit/save controls on ad order rows
- [ ] Ad order data comes from AdType (not a separate write table)

### AdId List
- [ ] Navigate to Ad ID Management (`pAdIdMgmt`)
- [ ] Table displays ad ID list
- [ ] No "Add New" button visible
- [ ] No inline edit/save on ad ID rows

### MediaId List
- [ ] Navigate to Media ID Management (`pMediaIdMgmt`)
- [ ] Table displays media ID list
- [ ] No "Add New" button visible
- [ ] No inline edit/save on media ID rows

---

## 5. Data Entry Flow

Test Advertiser and Media data entry with improved OperationLog details.

### Advertiser Data Entry
- [ ] Navigate to Advertiser Data Entry (`pAdvEntry`)
- [ ] Select an advertiser from dropdown
- [ ] Select a date — table loads existing rows or empty state
- [ ] Enter a new row: ad type code, records count, amount
- [ ] Click Save — confirm success
- [ ] Verify OperationLog entry detail says: `Saved advertiser data entry batch: date=YYYY-MM-DD, adTypeCode=XXX, count=N`
- [ ] Click Confirm — confirm success
- [ ] Verify OperationLog entry detail says: `Confirmed advertiser data entries: count=N`
- [ ] Click Unconfirm on a confirmed row — confirm success
- [ ] Verify OperationLog entry detail says: `Unconfirmed advertiser data entry id=X`

### Media Data Entry
- [ ] Navigate to Media Data Entry (`pMediaDataMgmt`)
- [ ] Select a media from dropdown
- [ ] Select a date — table loads existing rows or empty state
- [ ] Enter a new row: ad type code, records count, amount, coefficient
- [ ] Click Save — confirm success
- [ ] Verify OperationLog entry detail says: `Saved media data entry batch: date=YYYY-MM-DD, adTypeCode=XXX, count=N`
- [ ] Click Confirm — confirm success
- [ ] Verify OperationLog entry detail says: `Confirmed media data entries: count=N`
- [ ] Click Unconfirm on a confirmed row — confirm success
- [ ] Verify OperationLog entry detail says: `Unconfirmed media data entry id=X`

### Media Coefficient Validation
- [ ] Try to save a row with coefficient = 0 → should be rejected with error
- [ ] Try to save a row with coefficient = -1 → should be rejected
- [ ] Try to save a row with coefficient = 50 (non-neutral, non-100%) → should be rejected
- [ ] Try to save a row with coefficient = null/empty → should be accepted
- [ ] Try to save a row with coefficient = 1 → should be accepted
- [ ] Try to save a row with coefficient = 100 → should be accepted

### Frontend/BFF Recalculation Guard
- [ ] While saving data entry, monitor network — frontend must NOT send request that recalculates revenue
- [ ] Backend must use `DailyInput.revenue` as-is without recalculating from CPM formula

### CSV Export (Data Entry)
- [ ] With data loaded, click Export CSV
- [ ] CSV file downloads with correct name
- [ ] CSV has UTF-8 BOM (`﻿` prefix)
- [ ] CSV escapes commas, quotes, and newlines in values
- [ ] CSV contains only visible/filtered rows, not all rows

---

## 6. Reports Flow

### Total Profit Report
- [ ] Navigate to Total Profit (`pTotalProfit`)
- [ ] Select a month → click Query
- [ ] Loading state displays while fetching
- [ ] Data table populates with profit rows
- [ ] Empty state displays when no data for selected month
- [ ] Error state displays when request fails
- [ ] Export CSV works

### Order Profit Report
- [ ] Navigate to Order Profit (`pOrderProfit`)
- [ ] Fill filters (month, advertiser, ad order) → click Query
- [ ] Data table populates
- [ ] Empty state for no data
- [ ] Error state for failures
- [ ] Export CSV works

### Advertiser Query
- [ ] Navigate to Advertiser Query (`pAdvQuery`)
- [ ] Fill date range, advertiser filter → click Query
- [ ] Data table populates
- [ ] Empty/error states work
- [ ] Export CSV works

### Media Query
- [ ] Navigate to Media Query (`pMediaQuery`)
- [ ] Fill date range, media filter → click Query
- [ ] Data table populates
- [ ] Empty/error states work
- [ ] Export CSV works

### CSV Quality
- [ ] UTF-8 BOM present at start of file
- [ ] Comma/quote/newline in cell values are escaped
- [ ] Only visible rows exported (not unfiltered dataset)

### In-Flight Request Prevention
- [ ] Rapidly click Query button multiple times
- [ ] Only one request should be in-flight at a time
- [ ] No duplicate data in table from race conditions

---

## 7. Settlement Flow

### Advertiser Settlement
- [ ] Navigate to Advertiser Settlement (`pAdvSettlement`)
- [ ] Default period is current month (2026-05)
- [ ] Click Query — data loads in table
- [ ] Select a specific advertiser from dropdown → click Query
- [ ] Table filters to that advertiser only
- [ ] Verify network request includes `advertiserId` parameter
- [ ] Export CSV works with correct data

### Media Settlement
- [ ] Navigate to Media Settlement (`pMediaSettlement`)
- [ ] Default period is current month (2026-05)
- [ ] Click Query — data loads in table
- [ ] Select a specific media from dropdown → click Query
- [ ] Table filters to that media only
- [ ] Verify network request includes `mediaId` parameter
- [ ] Export CSV works with correct data

### Filter Behavior
- [ ] If no filter selected → all data shows (not empty)
- [ ] If filter selected → only matching rows show
- [ ] Clear filter → all data restores

---

## 8. AI Entry Locked Flow

- [ ] Navigate to AI Entry (`pAiEntry`)
- [ ] Confirm page is locked / shows unavailable state (not an editable form)
- [ ] No save/submit button is active
- [ ] Feature flag `FEATURE_FLAGS.aiEntry` is false in code — confirm via `frontend/src/lib/featureFlags.ts`

---

## 9. Regression Guardrails

Verify each of these constraints are NOT violated:

- [ ] No migration or `prisma db push` was run during this session
- [ ] Database schema has not been rewritten
- [ ] Financial formulas (CPM, RATIO, SM rebate calculations) remain unchanged
- [ ] CPA/CPS ad types are NOT mapped to RATIO in ad type dropdown or processing
- [ ] AdOrder, AdId, MediaId routes have no POST/PUT/DELETE handlers exposed to frontend
- [ ] GlobalModal component exists in code but is not mounted in App.tsx
- [ ] DailyInput.revenue is not being recalculated by frontend or BFF

---

## 10. Suggested Demo Script

Follow this sequence for a ~20-minute stakeholder demo:

### 1. Login + Sidebar (2 min)
- Open browser to http://localhost:3000
- Login as admin
- Point out sidebar shows real username from JWT token
- Open DevTools → Application → Local Storage → show token → decode and highlight username field

### 2. Navigation Smoke (2 min)
- Rapidly click through all menu items
- Show no crashes, no blank pages
- Point out AI Entry is locked

### 3. CRUD + Operation Log (5 min)
- Create a new Advertiser (fill name, type=CPM, coefficient=1, note=test)
- Open Operation Log in a new tab
- Show CREATE log entry with readable detail
- Edit the advertiser (change note)
- Show UPDATE log entry
- Delete (if demo environment allows)
- Show DELETE log entry

### 4. Data Entry + Log Details (5 min)
- Go to Advertiser Data Entry
- Select advertiser, date, enter 3 rows (different ad type codes)
- Save → show improved log detail: "Saved advertiser data entry batch: date=..., adTypeCode=..., count=3"
- Confirm → show "Confirmed advertiser data entries: count=N"
- Unconfirm → show "Unconfirmed advertiser data entry id=X"
- Repeat for Media Data Entry

### 5. Reports (3 min)
- Open Total Profit → select May 2026 → Query
- Point out data loads from backend, not frontend calculated
- Show CSV export works with correct UTF-8 encoding

### 6. Settlement (3 min)
- Open Advertiser Settlement → show filter by advertiser
- Show backend receives `advertiserId` parameter (DevTools → Network)
- Export CSV

---

## 11. UAT Sign-Off Template

```
============================================================
ADS MANAGEMENT SYSTEM — UAT SIGN-OFF
============================================================

Tester Name: ___________________________
Date/Time: _____________________________
Environment: localhost:3000 (frontend) / localhost:3001 (backend)
Branch: 110526
Phase 1 Commit: 85e79f7
Phase 2 Commit: ddd5172

PRE-DEMO CHECKS
[ ] Backend starts (port 3001)
[ ] Frontend starts (port 3000)
[ ] Login works
[ ] No generated files staged
[ ] OperationLog table exists (or manual SQL applied)

SMOKE FLOW
[ ] Login successful
[ ] Sidebar username = JWT username (not hardcoded)
[ ] All pages navigate without crash
[ ] GlobalModal NOT reachable

CRUD + OPERATION LOG
[ ] Advertiser CREATE → log detail correct
[ ] Advertiser UPDATE → log detail correct
[ ] Advertiser DELETE → log detail correct
[ ] Media CRUD same checks
[ ] Log failure does not block CRUD

READ-ONLY LOOKUPS
[ ] AdOrder — no create/edit controls
[ ] AdId — no create/edit controls
[ ] MediaId — no create/edit controls

DATA ENTRY
[ ] Advertiser save → detail: "Saved advertiser data entry batch: date=..., adTypeCode=..., count=..."
[ ] Advertiser confirm → detail: "Confirmed advertiser data entries: count=..."
[ ] Advertiser unconfirm → detail: "Unconfirmed advertiser data entry id=..."
[ ] Media save/confirm/unconfirm → same pattern
[ ] Neutral coefficient accepted (null, 1, 100)
[ ] Non-neutral coefficient rejected (0, 50, -1)

REPORTS
[ ] Total Profit loads with correct data
[ ] Order Profit loads
[ ] Advertiser Query loads
[ ] Media Query loads
[ ] Loading/empty/error states work
[ ] CSV export with UTF-8 BOM
[ ] CSV escape for comma/quote/newline

SETTLEMENT
[ ] Advertiser Settlement filters by advertiserId
[ ] Media Settlement filters by mediaId
[ ] Backend receives filter parameters
[ ] Export works

AI ENTRY
[ ] Page is locked/unavailable

REGRESSION GUARDRAILS
[ ] No migration run
[ ] No formula changes
[ ] No CPA/CPS → RATIO mapping
[ ] No write paths for AdOrder/AdId/MediaId
[ ] GlobalModal not revived

PASSED ITEMS: _____________________________________________
FAILED ITEMS: _____________________________________________
NOTES: ____________________________________________________

SIGN-OFF DECISION: [ ] PASS  [ ] PASS WITH ISSUES  [ ] FAIL

Tester Signature: ___________________ Date: ___________
============================================================
```

---

## 12. Known Facts / Notes

- **Phase 1** (`85e79f7`) on remote: BFF adapter layer, 10 controllers, 6 mappers, operation log service, reports, CSV export
- **Phase 2** (`ddd5172`) on remote: Improved operation log detail strings, sidebar dynamic username, settlement filters passed to BFF, GlobalModal deprecation
- **Typecheck/Build**: Both `npx tsc --noEmit` and `npm run build` pass on current commit `ddd5172`
- **Frontend build**: `cd frontend && npm run build` passes
- **OperationLog table**: Requires manual SQL setup if not auto-created — see `plans/operation-log-manual-sql.md`
- **Feature flags**: `settlement = true`, `aiEntry` is not in `FEATURE_FLAGS` (defaults to hidden/blocked)
- **GlobalModal**: Deprecated, not mounted, not reachable via UI — exists in code only as reference
- **Untracked files**: `frontend/` directory contains the complete frontend source (not within the main repo root); these are NOT shipped unless committed to the `110526` branch
- **Fire-and-forget logging**: Operation log failures are silently swallowed — business actions succeed even if logging fails
- **DailyInput.revenue**: Source of truth — no frontend or BFF recalculation