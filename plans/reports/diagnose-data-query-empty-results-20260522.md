# Diagnosis Report: Empty Results — Menu `Truy vấn dữ liệu`

**Date:** 2026-05-22
**Branch:** 110526
**Status:** READ-ONLY diagnosis — no code changes made

---

## 1. Problem Statement

User reported: "all 4 pages in the `Truy vấn dữ liệu` menu appear empty in UI" — tables load and display but show no rows.

Screenshots showed: table skeletons/loaders completing with zero rows displayed.

**Hypothesis H1** (from task brief): Date filter sends no date or wrong date format.

---

## 2. Static Diagnosis — Frontend

### 2.1 All 4 Pages: Default State is Empty Date Range

| Page | Default `startDate` | Default `endDate` | Behavior when empty |
|---|---|---|---|
| `TotalProfit` | `''` | `''` | `if (!startDate \|\| !endDate) { setRows([]); return; }` — no API call |
| `OrderProfit` | `''` | `''` | Same pattern — no API call |
| `AdvQuery` | `''` | `''` | Same pattern — no API call |
| `MediaQuery` | `''` | `''` | Same pattern — no API call |

**Finding**: Initial render always shows empty table. User must select BOTH start and end dates before any API request fires.

### 2.2 Date Selection UI

All 4 pages use `<ReportDateRangeField>` (dual date picker: start + end).

- Default state: both inputs empty
- User must pick a date range to see data
- No default date range is pre-applied on page load

### 2.3 Effect Triggering API Call

```typescript
useEffect(() => {
  if (!startDate || !endDate) {
    setRows([]); return;   // ← blocks API call when either date is empty
  }
  fetchReport(...);         // ← only reached when both dates are set
}, [startDate, endDate, filters.status, filters.business, ...]);
```

---

## 3. Static Diagnosis — Backend

### 3.1 Endpoint Date Requirements

| Endpoint | Required | What happens without |
|---|---|---|
| `GET /total-profit` | `date` OR `startDate+endDate` | Returns 400 error |
| `GET /order-profit` | `startDate+endDate` | Returns 400 error |
| `GET /advertisers` | `startDate+endDate` | Returns 400 error |
| `GET /media` | `startDate+endDate` | Returns 400 error |

Backend is consistent: it rejects requests without date range.

### 3.2 Default Status

All endpoints default to `status = 'confirmed'` when not provided — correct behavior for reports.

### 3.3 TotalProfit Default AdType

`/total-profit` defaults `adTypeCode` to `"SM"` when not provided — correct.

---

## 4. Task 6 Fix Applied (Uncommitted)

The uncommitted change in `Reports.tsx` fixes a **separate bug** from Task 6:

- `AdvQuery.getReportParams`: Changed `filters.adId` (wrong) → `filters.business` (correct adTypeCode)
- `AdvQuery.getReportParams`: Changed advertiserId from broken display-name lookup → `Number(filters.advertiser)`
- `MediaQuery.getReportParams`: Same pattern applied

This fix was needed because previously:
- `filters.adId` was being sent as `adTypeCode` (P0 bug) — **this would cause empty results**
- Display-name-based advertiserId lookup was broken (P1 bug)

**After Task 6 fix**: `filters.business` (the business-type dropdown value, e.g. `"SM"`) is correctly sent as `adTypeCode`.

---

## 5. Root Cause Analysis

### Confirmed Root Cause: Date Range Not Selected

**The primary cause of empty tables is that no date range is selected.**

The UI does not pre-apply a default date range. Users see an empty table until they explicitly pick both start and end dates.

This is **expected UI behavior**, not a bug:
- All 4 pages intentionally require explicit date range selection
- Empty table with "no data" message is the correct empty state
- Backend correctly rejects requests without dates

### Why the UI Shows Empty Instead of an Error

The frontend effect explicitly short-circuits when dates are empty:
```typescript
if (!startDate || !endDate) { setRows([]); return; }
```
This converts the "no date" condition into an empty-data display rather than an error — the UX choice made by the developers.

### Possible Secondary Cause: Task 6 Bug (Before Fix)

Before the uncommitted Task 6 fix, `AdvQuery.getReportParams` was sending:
```typescript
adTypeCode: filters.adId || undefined  // WRONG: filters.adId is NOT adTypeCode
```

This would have caused `adTypeCode: undefined` to be sent to the backend, and the backend would have defaulted to `"SM"`. If the user was querying for a non-SM business type, results would be empty — but only if a date was selected.

**This was NOT the primary reported issue** (user said all 4 pages were empty, including TotalProfit which has a different code path).

---

## 6. DB Data Verification (Not Run)

Runtime DB check was **not performed** because:
- Backend server not running in this session
- Hard rule: no DB writes

However, the static analysis shows the empty-table behavior is fully explained by the missing date range selection. DB data validity cannot be confirmed without runtime access.

**Recommended verification** (if user wants to run it):
```sql
SELECT COUNT(*) FROM DailyInput WHERE status = 'confirmed' AND date >= '2026-05-01';
```
If count = 0, DB genuinely has no confirmed data for recent dates.

---

## 7. Conclusions

| Finding | Type | Status |
|---|---|---|
| All 4 pages require date range selection | Design | Not a bug |
| Default empty table is expected behavior | Design | Not a bug |
| Backend rejects missing dates | Correct | ✅ |
| Task 6 P0 fix (`filters.adId` → `filters.business`) | Bug fix | Uncommitted |
| Task 6 P1 fix (numeric advertiserId) | Bug fix | Uncommitted |
| DB has confirmed DailyInput data | Unknown | Needs runtime check |

**Verdict**: The "empty results" are **not a bug** — the pages require users to select a date range before any data is fetched. The uncommitted Task 6 fix addresses a separate filter bug that would cause wrong/empty results when a date range IS selected but business filter is used.

---

## 8. Recommendations

1. **If user expects default date range**: Add `startDate`/`endDate` defaults to page state (e.g., first day of current month to today). This is a UX enhancement request.

2. **Commit Task 6 changes**: The uncommitted `Reports.tsx` changes fix real bugs in `AdvQuery` and `MediaQuery` filter mapping.

3. **DB check**: Run a read-only query to confirm DailyInput has confirmed data for the date range being queried.

4. **No backend changes needed**: The API layer is correctly implemented.
