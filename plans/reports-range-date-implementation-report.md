# Reports Range Date Implementation Report

Date: 2026-05-21
Status: **PASS**

## 1. Summary

- **Implemented:** Range date picker (startDate/endDate) support for Reports 2.1, 2.2, 2.3
- **Backward compatible:** All endpoints accept both single `date` param and new `startDate`+`endDate`
- **Type/build:** Backend `tsc` ✓ | Backend `npm run build` ✓ | Frontend `tsc --noEmit` ✓ | Frontend `npm run build` ✓ (1691 modules)

---

## 2. Backend Changes

### `src/controllers/bff/report.controller.ts`

| Endpoint | Change |
|----------|--------|
| `GET /api/bff/reports/advertisers` | Added `startDate`/`endDate` validators + logic (was done in prior session) |
| `GET /api/bff/reports/media` | Added `startDate`/`endDate` validators + logic (was done in prior session) |
| `GET /api/bff/reports/total-profit` | Added `startDate`/`endDate` support with per-month iteration |
| `GET /api/bff/reports/order-profit` | Added `startDate`/`endDate` validators + logic |

**`/total-profit` range logic:** When `startDate` AND `endDate` provided, iterates month-by-month across the range and aggregates each month via `calculateCostBreakdownMonthly` with per-month override ranges, then sums totals.

### `src/services/mlPayout.service.ts`

- Added optional `overrideRange?: { gte: Date; lt: Date }` parameter to `calculateCostBreakdownMonthly`
- When provided, uses the override range instead of computing `getBusinessMonthRange`

### `src/utils/date.ts`

- Added `getDaysInRange(gte: Date, lt: Date): string[]` utility
- Added `getBusinessDateRange(startDateStr, endDateStr)` (was added in prior session)

---

## 3. Frontend Changes

### `frontend/src/lib/bffTypes.ts`

| Type | Change |
|------|--------|
| `AdvertiserReportParams` | `date` now optional; added `startDate?`, `endDate?` |
| `MediaReportParams` | `date` now optional; added `startDate?`, `endDate?` |
| `TotalProfitReportParams` | `date` now optional; added `startDate?`, `endDate?` |
| `OrderProfitReportParams` | `date` now optional; added `startDate?`, `endDate?` |

### `frontend/src/pages/Reports.tsx`

**TotalProfit (2.1):** Replaced `date` state with `startDate`/`endDate`. Calls `getTotalProfitReport({ startDate, endDate })` directly (bypasses `loadTotalProfitRows` cache since key changed).

**OrderProfit:** Replaced `date` state with `startDate`/`endDate`. Calls `getOrderProfitReport({ startDate, endDate, adTypeCode })` directly.

**AdvQuery (2.2):** `filters.date` replaced with `filters.startDate`/`filters.endDate`.

**MediaQuery (2.3):** `filters.date` replaced with `filters.startDate`/`filters.mediaId`.

**New component:** `ReportDateRangeField` — dual date inputs showing as single field with "date1 — date2" label, native `showPicker()` on click.

### `frontend/src/index.css`

```css
.report-date-range-field { width: 220px; min-width: 220px; height: 34px; ... }
.report-date-range-inputs { position: absolute; inset: 0; display: flex; align-items: center; opacity: 0; }
.report-date-range-sep { padding: 0 2px; }
```

---

## 4. API Contract (Backward Compatible)

All report endpoints now accept EITHER:

- **Single date:** `GET /api/bff/reports/{endpoint}?date=2026-05` or `?date=2026-05-15`
- **Date range:** `GET /api/bff/reports/{endpoint}?startDate=2026-05-01&endDate=2026-05-31`

If `startDate` AND `endDate` are both provided, `date` is ignored.

---

## 5. Notes

- `total-profit` range iterates month-by-month internally — no changes needed to `calculateCostBreakdownMonthly` signature for daily iteration (days are derived from the revenue map keys which already span each day)
- Frontend in-flight request caching keys changed from `${date}:` to `${startDate}:${endDate}:` patterns — old cache entries for single-date requests will not be reused for range requests (expected)
- The `ReportDateRangeField` visually displays the label as "startDate — endDate" when both are set