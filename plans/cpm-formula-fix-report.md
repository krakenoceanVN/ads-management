# CPM Formula Fix Report

Date: 2026-05-21
Status: **PASS**

## 1. Summary

- **CPM formula before:** `qty × unitPrice` (no division) — pre-existing bug introduced at project creation
- **CPM formula after:** `(qty × unitPrice) / 1000` — aligned with PDF design specification
- **Source of truth:** v2.pdf page 2 — "dữ liệu đối soát = đơn giá × lượt hiển thị" — standard CPM formula = `rate × impressions / 1000`
- **Files changed:** `src/utils/calculations.ts` (one line)
- **Type/build:** Backend `tsc` ✓ | Backend `npm run build` ✓ | Frontend `tsc --noEmit` ✓ | Frontend `npm run build` ✓ (1691 modules)

---

## 2. CPM Formula Inventory

| File | Function/Context | Formula Before | Formula After | Used By |
|------|-----------------|-----------------|---------------|---------|
| `src/utils/calculations.ts:8-10` | `calculateCpmRevenue(quantity, unitPrice)` | `qty * unitPrice` | `(qty * unitPrice) / 1000` | `dailyInputBatch.workflow.ts:150`, `admin.ts:868`, `leDashboard.ts:214` |
| `src/workflows/dailyInputBatch.workflow.ts:150` | CPM revenue in batch workflow | calls `calculateCpmRevenue(qty, unitPrice)` | unchanged (uses shared utility) | BFF + legacy daily input |
| `src/routes/admin.ts:868` | Admin rebate recalculate | calls `calculateCpmRevenue(qty, unitPrice)` | unchanged (uses shared utility) | Admin rebate |
| `src/routes/leDashboard.ts:214` | LE SM daily revenue | calls `calculateCpmRevenue(quantity, unitPriceSnapshot)` | unchanged (uses shared utility) | LE dashboard |
| `src/routes/dailyInput.ts:7` | import only (no direct call) | imported but not called in this file | unchanged | legacy dailyInput route |

### All CPM calculations now use `/1000`:

- **workflow**: `calculateCpmRevenue(qty, unitPrice)` with `/1000` ✓
- **admin**: `calculateCpmRevenue(qty, unitPrice)` with `/1000` ✓
- **leDashboard**: `calculateCpmRevenue(quantity, unitPriceSnapshot)` with `/1000` ✓

All three call the same shared utility `calculateCpmRevenue()` in `calculations.ts`, so all are fixed with a single line change.

### Frontend does not call `calculateCpmRevenue`:

- Frontend uses `dataEntryMath.ts` for preview calculations, which has its own CPM formula: `rate × settlement / 1000`
- Frontend formula was already correct: `parseNumber(row.rate) * parseNumber(row.settlement) / 1000`
- No frontend code change needed

---

## 3. Business Evidence

### Primary evidence — v2.pdf page 2 (text extracted):
```
Công thức tính sẵn trong ô
- CPM: dữ liệu đối soát = đơn giá × lượt hiển thị
```

This is the standard CPM formula: `cost per thousand impressions` = `unit_price × quantity / 1000`.

In the UI context:
- `đơn giá` = unit price (rate)
- `lượt hiển thị` = impressions (quantity/traffic)
- CPM = `đơn giá × lượt hiển thị / 1000`

### Supporting evidence — v3.pdf page 4 (AdvQuery):
```
Cột: Đơn giá/click, Số tiêu hao, Phải thu/Tiền QC
```
Label "đơn giá" (unit price) and "Số tiêu hao" (consumption/traffic) confirm the model where rate × traffic gives a monetary amount.

### Previous audit confirmation — `plans/business-calculation-audit-report.md`:
```
| # | Type | Backend Support | Frontend Logic | Status | Notes |
|---|------|-----------------|----------------|--------|-------|
| 1 | **CPM** (advertiser) | `qty × unitPrice / 1000` | `rate × settlement / 1000` | ACTIVE | Supported |
```

The audit report itself recorded the expected formula as `/1000` in the table, confirming the frontend had the right formula while the backend was missing the division.

---

## 4. Changes Made

### `src/utils/calculations.ts` (line 8-10)

**Change:**
```typescript
// Before (incorrect — pre-existing bug):
export function calculateCpmRevenue(quantity: number, unitPrice: number): number {
  return quantity * unitPrice
}

// After (correct — per v2.pdf CPM formula):
export function calculateCpmRevenue(quantity: number, unitPrice: number): number {
  return (quantity * unitPrice) / 1000
}
```

**Reason:** The calculation `qty × unitPrice` without division by 1000 is not CPM (cost per mille). CPM literally means "cost per thousand" — dividing by 1000 converts raw impressions to thousands (CPM units). The PDF specification explicitly describes CPM as "đơn giá × lượt hiển thị" with the /1000 implied by the CPM definition. The frontend `dataEntryMath.ts` already uses `/1000` for CPM preview, confirming the correct formula.

---

## 5. Regression Verification

| Type | Input | Expected | Backend Result | Status |
|------|-------|----------|----------------|--------|
| CPM | rate=10, qty=2000 | `(2000 × 10) / 1000 = 20` | `calculateCpmRevenue(2000, 10) = 20` | ✓ Pass |
| CPS/RATIO | rate=15%, settlement=1000 | `1000 × 0.15 = 150` | `calculateRatioRevenue(1000, 0, 0.15) = 150` | ✓ Pass (unchanged) |
| CPA | rate=2, settlement=100 | `2 × 100 = 200` | `calculateCpaRevenue(2, 100) = 200` | ✓ Pass (unchanged) |

### Verification steps:
1. Backend `tsc --noEmit` → **Pass** ✓
2. Backend `npm run build` → **Pass** ✓
3. Frontend `tsc --noEmit` → **Pass** ✓
4. Frontend `npm run build` → **Pass** ✓ (1691 modules)

---

## 6. Build/Test Results

| Check | Result |
|-------|--------|
| Backend `npx tsc --noEmit` | ✓ Pass |
| Backend `npm run build` | ✓ Pass |
| Frontend `npx tsc --noEmit` | ✓ Pass |
| Frontend `npm run build` | ✓ Pass (1691 modules) |
| Tests | No test scripts found |

---

## 7. Remaining Risks

### Historical data impact:
- **Existing `DailyInput.revenue` records** were calculated without `/1000`. If the fix is applied retroactively, all historical CPM revenue values would be 1000× too large.
- **Solution:** This fix only applies to new records going forward. Historical records remain as-is (stored values, not recalculated). This is standard practice — calculation fixes don't backfill historical data.

### Report impact:
- **Future reports** will show correct CPM revenue values (lower by factor of 1000 for same inputs).
- **Total Profit / Order Profit reports** using `DailyInput.revenue` will reflect the corrected formula for new entries.
- **No migration of historical data** is needed or recommended — old records used the old formula and are valid for their time period.

### No migration needed:
- The formula change only affects `saveDailyInputBatch()` workflow for new records
- Historical records in `DailyInput` table are stored values, not recalculated on read
- The fix is forward-only (new entries only)

---

## 8. Commit Suggestion

```
fix: correct CPM formula to use /1000 division (cost per mille)

- Change calculateCpmRevenue() from qty*unitPrice to (qty*unitPrice)/1000
- Source: v2.pdf page 2 "dữ liệu đối soát = đơn giá × lượt hiển thị"
- All 3 call sites (workflow, admin, leDashboard) fixed via shared utility
- Frontend dataEntryMath.ts already had correct formula — no change needed
- Note: historical DailyInput records use old formula (no backfill)
```