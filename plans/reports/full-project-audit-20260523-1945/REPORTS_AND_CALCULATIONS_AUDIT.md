# REPORTS AND CALCULATIONS AUDIT

## Overview

Reports are computed in two places:
1. **Backend dashboard routes** (`src/routes/dashboard.ts` and `src/routes/leDashboard.ts`)
2. **BFF report controller** (`src/controllers/bff/report.controller.ts`)
3. **ML Payout service** (`src/services/mlPayout.service.ts`)

The `src/utils/calculations.ts` contains pure calculation functions used across all report paths.

---

## Calculation Functions Audit

### `calculateCpmRevenue(quantity, unitPrice)` — line 8
```typescript
return (quantity * unitPrice) / 1000
```
**Issue**: CPM means "cost per thousand impressions" — revenue should be `qty * unitPrice / 1000`. This matches industry standard. No issue found.

### `calculateRebateAmount(quantity, rebateRate)` — line 12
```typescript
return quantity * rebateRate
```
**Issue**: Rebate is usually a percentage of revenue, not qty × rate. If rebateRate is 0.1 (10%), this returns `qty * 0.1` which is not a monetary amount. This is likely wrong — rebate should be based on revenue, not quantity.

**Example**: qty=1000, unitPrice=10, rebateRate=0.1
- Revenue = 1000 * 10 / 1000 = 10
- Rebate (current) = 1000 * 0.1 = 100 ← this is wrong, should be 10 * 0.1 = 1

### `calculateRatioRevenue(amount1, amount2, ratio)` — line 21
```typescript
return (amount1 + amount2) * ratio
```
**Issue**: No issue with the formula. However, `ratio` is expected to be a decimal like 0.3 meaning 30%. If ratio is stored as 30 instead of 0.3, the result is 30× larger.

### `calculateTaxOnMargin(revenue, cost, taxRate)` — line 50
```typescript
return (revenue - cost) * taxRate
```
**Issue**: This is "tax on margin" — i.e., tax is calculated on profit, not on revenue. This is consistent with how LE payout is computed (revenue - cost - tax = net). No issue.

### `calculateNetProfit(revenue, cost, tax)` — line 58
```typescript
return revenue - cost - tax
```
**Issue**: Confirmed correct.

### `calculateProfitRate(profit, revenue)` — line 62
```typescript
return revenue > 0 ? profit / revenue : 0
```
**Issue**: Returns 0 if revenue is 0 (avoiding division by zero). Could return NaN or Infinity if revenue is negative — but division by positive revenue is safe.

---

## Dashboard Monthly Revenue Computation

**File**: `src/routes/dashboard.ts` lines 349–430

The dashboard monthly route iterates over each day of the month and for each day:
1. Sums `revenue` from confirmed DailyInputs for that day
2. Computes `mlPayout = totalRevenue * mlRate`
3. For SM: also computes LE payout and Yiyi payout
4. Computes `cost = mlPayout` (or `mlPayout + lePayout + yiyiPayout` for SM)
5. Computes `tax = calculateTaxOnMargin(totalRevenue, cost)`
6. Computes `profit = totalRevenue - cost - tax`

**Critical Dependency**: The `totalRevenue` is the SUM of `revenue` fields from DailyInput records. If the frontend sent incorrect `revenue` values when creating DailyInput records, the dashboard will show incorrect revenue.

**VERIFIED**: The dashboard does NOT recompute revenue from qty and unitPrice. It trusts the pre-stored `revenue` field.

---

## ML Payout Calculation

**File**: `src/services/mlPayout.service.ts` lines 155–207

```typescript
const payoutRate = Number(downstream?.downstream.payoutRate ?? DEFAULT_ML_PAYOUT_RATE)
const mlPayout = calculateMlPayoutAmount(Number(totalRevenue), payoutRate)
return {
  total_revenue: Number(totalRevenue),
  ml_payout: mlPayout,
  payout_rate: Number(payoutRate),
}
```

**Formula**: `mlPayout = totalRevenue * 0.8` (or custom rate)

**Issue**: The comment at line 153 says "ALL ad types, ALWAYS ×0.8" but the code actually uses `payoutRate` from the downstream period. If a downstream period is found with payoutRate=0.9, it would use 0.9. The comment is misleading.

---

## LE Payout Calculation

**File**: `src/services/mlPayout.service.ts` lines 215–265

**Formula**:
```
leRevenue = smUpstreamRevenue * lePayoutRate (default 0.9)
leMlCost = totalQty * mlUnitPrice / 1000 (mlUnitPrice default 16)
leTax = (leRevenue - leMlCost) * 0.06
lePayout = leRevenue - leMlCost - leTax
```

**Issue — Date Boundary**: The `getActivePeriodForDate` function in dashboard.ts uses `period.endDate >= currentDate` which means a period ending on date X is still active ON date X. This is inclusive. If business intended exclusive (period ends at start of endDate), this would cause off-by-one errors on period boundaries.

**Issue**: If `totalQty = 0` (no SM confirmed inputs), `leMlCost = 0`, `leTax = leRevenue * 0.06`, `lePayout = leRevenue - leRevenue * 0.06 = leRevenue * 0.94`. This seems intentional but unusual.

---

## Yiyi Payout Calculation

**File**: `src/services/mlPayout.service.ts` lines 272–293

**Formula**: If YiyiDailyData records exist for the date, sum all qty and compute `qty * unitPrice / 1000`. Otherwise fallback to UV (totalQty from DailyInput) × unitPrice / 1000.

**Issue**: The fallback uses `totalUV` which is actually `qty` from SM DailyInput — representing UV/impressions. If there's no YiyiDailyData, it uses impressions as a proxy for yiyi quantity. This may be acceptable but is a conceptual mismatch (impressions ≠ yiyi channel quantity).

---

## Date/Timezone Handling

**File**: `src/utils/date.ts`

- `BUSINESS_TIME_ZONE = "Asia/Bangkok"` (UTC+7)
- All date range functions use UTC-based date construction
- `getBusinessDayRange("2026-05-23")` → `{ gte: 2026-05-22T17:00:00Z, lt: 2026-05-23T17:00:00Z }`

**Potential Issue**: The `getBusinessDayRange` computes `lt` as `day + 1` in UTC terms:
```typescript
lt: new Date(Date.UTC(year, month - 1, day + 1, -BUSINESS_UTC_OFFSET_HOURS, 0, 0))
```
This means for `2026-05-23`:
- gte = 2026-05-22 17:00 UTC (2026-05-23 00:00 Bangkok)
- lt = 2026-05-23 17:00 UTC (2026-05-24 00:00 Bangkok)

This correctly captures 2026-05-23 00:00 to 23:59:59 Bangkok time. **No issue found.**

**`getActivePeriodForDate` Boundary**: line 187 uses `>=` for endDate:
```typescript
period.startDate <= currentDate && (period.endDate === null || period.endDate >= currentDate)
```
- A period with `endDate = 2026-05-31` is considered active on `2026-05-31 23:59`.
- This is inclusive behavior — the period ends at the **close** of endDate, not the start.

This is likely **intentional** (inclusive last day). If business wants exclusive (period ends at start of endDate, i.e., valid through the day before), the check should be `>` not `>=`.

---

## Revenue Precision and Rounding

All calculations use JavaScript `number` type. For monetary values:
- `revenue`, `amount`, `cost`, `profit` — stored as `Decimal` in Prisma but converted to `Number` in calculations
- `Decimal` in Prisma maps to JavaScript `number` — precision is IEEE 754 double (~15 significant digits) — **sufficient for typical advertising revenue up to billions**
- No explicit rounding in calculation functions — relies on JS floating point
- No explicit decimal places constraint in schema

---

## Report Aggregation Double-Counting Risk

**Dashboard downstream-monthly route** (lines 447–629):
- Groups by `adSite.downstreams` — each downstream per adSite is processed separately
- If a DailyInput belongs to an AdSite with multiple downstreams (e.g., ML + LE both linked), the revenue is counted twice — once per downstream payout calculation

**Example**: SM AdSite with both ML and LE downstreams linked:
- Loop processes each downstream type
- For ML: calculates ML payout on the full revenue
- For LE: also calculates LE payout on the full revenue
- This double-counts the cost because both ML and LE take a cut of the same revenue

However, looking more carefully — the downstream-monthly route is for the downstream supply-side view (ML/LE payouts to publishers), while the monthly dashboard is for the advertiser revenue view. They are different perspectives and the double-counting may be intentional for the downstream view. **Needs business confirmation.**

---

## Zero/Null Handling

| Field | Null/Zero Behavior |
|-------|-------------------|
| `qty = 0` | Revenue = 0, mlPayout = 0 |
| `unitPrice = 0` | Revenue = 0, but division by 1000 is safe |
| `revenue = 0` | ML payout = 0 |
| `totalRevenue = null` | Uses `?? 0` coalescing — safe |
| Division by zero | Only `calculateProfitRate` checks `revenue > 0`; others don't divide |
| Negative values | No guard — negative revenue would produce negative profit (loss) |