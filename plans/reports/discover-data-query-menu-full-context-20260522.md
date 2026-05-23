# Discovery — Menu Truy vấn dữ liệu

**Date:** 2026-05-22
**Branch:** 110526
**Scope:** READ-ONLY discovery of all 4 report pages under "Truy vấn dữ liệu" menu

---

## 0. Executive Summary

| Page | Component | i18n Key | API | Suspected Issues |
|---|---|---|---|---|
| Bảng lợi nhuận tổng | `TotalProfit` | `pTotalProfit` | `GET /api/bff/reports/total-profit` | Low — no business filter |
| Bảng lợi nhuận đơn quảng cáo | `OrderProfit` | `pOrderProfit` | `GET /api/bff/reports/order-profit` | None obvious |
| Truy vấn dữ liệu nhà quảng cáo | `AdvQuery` | `pAdvQuery` | `GET /api/bff/reports/advertisers` | **P1**: secondary `adOrder` filter uses wrong field |
| Truy vấn dữ liệu media | `MediaQuery` | `pMediaQuery` | `GET /api/bff/reports/media` | **P1**: secondary `mediaAdOrder` filter uses wrong field |

**Top suspected issues:**
1. **P1 — AdvQuery secondary filter `filters.adOrder`** uses `row.adOrder === filters.adOrder` instead of `orderCodeForAdvRow(row) === filters.adOrder`. Since `row.adOrder` is the `AdOrder.name` string (e.g., "SM") and the dropdown options come from `unique(businessRows.map(row => row.adOrder))`, this might work in simple cases but mixes display-name with business-code filtering in the same dropdown.
2. **P1 — MediaQuery secondary filter `filters.mediaAdOrder`** same pattern: `row.mediaAdOrder === filters.mediaAdOrder` instead of `orderCodeForMediaRow`.
3. **P2 — AdvQuery/MediaQuery type filter dropdown** shows "CPS" (UI label) but backend expects "CPS" value mapping to "RATIO". The `apiTypeToUiType`/`uiTypeToApiType` helpers exist but type filter options in Reports.tsx hardcode `"CPS"` as value — unclear if this works end-to-end or if it passes wrong value.

**Areas likely safe:** OrderProfit uses correct `adTypeCode` field from backend response. TotalProfit has no business filter and works with raw revenue/cost data.

---

## 1. Menu/Routes/i18n Map

| UI Label (VI) | i18n Key | Component | File | API Endpoint |
|---|---|---|---|---|
| Bảng lợi nhuận tổng | `pTotalProfit` | `TotalProfit` | [Reports.tsx:294](frontend/src/pages/Reports.tsx#L294) | `GET /api/bff/reports/total-profit` |
| Bảng lợi nhuận đơn quảng cáo | `pOrderProfit` | `OrderProfit` | [Reports.tsx:418](frontend/src/pages/Reports.tsx#L418) | `GET /api/bff/reports/order-profit` |
| Truy vấn dữ liệu nhà quảng cáo | `pAdvQuery` | `AdvQuery` | [Reports.tsx:526](frontend/src/pages/Reports.tsx#L526) | `GET /api/bff/reports/advertisers` |
| Truy vấn dữ liệu media | `pMediaQuery` | `MediaQuery` | [Reports.tsx:713](frontend/src/pages/Reports.tsx#L713) | `GET /api/bff/reports/media` |

**Menu registration (App.tsx lines 8, 38-41):**
```typescript
import { TotalProfit, OrderProfit, AdvQuery, MediaQuery } from './pages/Reports';
case 'pTotalProfit': return <TotalProfit />;
case 'pOrderProfit': return <OrderProfit />;
case 'pAdvQuery': return <AdvQuery />;
case 'pMediaQuery': return <MediaQuery />;
```

**i18n values (i18n.ts lines 207-210, 365-368, 49-52):**
```typescript
// VI
pTotalProfit: 'Bảng lợi nhuận tổng',
pOrderProfit: 'Bảng lợi nhuận đơn quảng cáo',
pAdvQuery: 'Truy vấn dữ liệu nhà quảng cáo',
pMediaQuery: 'Truy vấn dữ liệu media',
// EN
pTotalProfit: 'Total Profit Report',
pOrderProfit: 'Ad Order Profit Report',
pAdvQuery: 'Advertiser Data Query',
pMediaQuery: 'Media Data Query',
// ZH
pTotalProfit: '总利润表',
pOrderProfit: '广告单利润表',
pAdvQuery: '广告主数据查询',
pMediaQuery: '媒体数据查询',
```

---

## 2. Concept Dictionary for This Menu

| Concept | Meaning in this system |
|---|---|
| `advertiser` / `nhà quảng cáo` | Upstream entity ( advertiser = upstream.name) |
| `media` | AdSite.name (supply-side slot, also called "mediaId" in some contexts) |
| `adOrder` / `Đơn quảng cáo` | Real AdOrder record OR `adOrder.name` (display string, e.g., "SM") |
| `mediaAdOrder` | `adSite.adOrder?.name` string (display name for media's linked AdOrder) |
| `adTypeCode` | Business code: `SM`, `360`, `BAIDU_JS`, `OTHER`, `iqiyi`, `yolo` |
| `adTypeName` | Display name for adType: `SM业务`, `360业务`, etc. |
| `adOrderCode` / `mediaAdOrderCode` | `adOrder.adType?.code ?? upstream.adType.code` (business code attached to a row) |
| `billingMethod` | `CPM` | `RATIO` | `CPA` — billing formula type, NOT business order code |
| `type` (filter) | Billing method filter: `CPM`, `CPS` (UI) → `RATIO` (API), `CPA` |
| `revenue` | `DailyInput.revenue` — financial source of truth |
| `ml_payout` | Cost calculated via `mlPayout.service.ts` using SM rebate formula |
| `le_payout` | Cost calculated via LE payout rate |
| `yiyi_payout` | Cost from Yiyi pricing service |
| `cost` | Total cost: `ml_payout + le_payout + yiyi_payout` |
| `profit` | `revenue - cost - tax` |
| `profit_rate` | `profit / revenue` |
| `shareRatio` | `Downstream.payoutRate` (media payout ratio, NOT rebateRate) |
| `actualReceived` | `revenue * shareRatio` (display only, not stored) |
| `rebateRate` / `rebateAmount` | SM-specific CPM rebate, stored in `DailyInput` |
| `status` | `confirmed` | `unconfirmed` on DailyInput |
| `confirmed` filter | Default for AdvQuery and MediaQuery; excludes pending records |

---

## 3. Page: Bảng lợi nhuận tổng (TotalProfit)

### Frontend

**File:** `frontend/src/pages/Reports.tsx:294-415`

**State:**
```typescript
const [startDate, setStartDate] = React.useState('');  // YYYY-MM-DD
const [endDate, setEndDate] = React.useState('');
const [search, setSearch] = React.useState('');
const [rows, setRows] = React.useState<TotalProfitReportRow[]>([]);
```

**Date behavior:**
- Uses `ReportDateRangeField` (dual date picker, not month picker)
- Required both startDate and endDate to load data
- `getTotalProfitReport({ startDate, endDate })` called on every change

**Default filters:** None — all types aggregated, no business/adType filter

**Table columns:**
`date | revenue | ML payout | LE payout | Yiyi payout | expense(cost) | tax | profit | profitMargin`

**Search:** `matchesLocalized` on `[row.date, row.revenue, row.cost, row.profit]`

**Export:** `总利润表.csv` with all visible rows + total row appended

**Total row behavior:**
- Backend sends a row where `date.endsWith('-total')` (e.g., "2026-05-01-total")
- Frontend splits: `dailyRows = rows.filter(!endsWith('-total'))`, `totalRow = rows.find(endsWith('-total'))`
- Footer shows totalRow with all aggregated values

**Loading/error:** Standard pattern with `cancelled` ref for cleanup

### API/Backend

**API function:** `getTotalProfitReport` → `GET /api/bff/reports/total-profit`

**Params:** `{ startDate, endDate, adTypeCode? }`

**Controller:** `src/controllers/bff/report.controller.ts` → `GET /total-profit`

**Logic:**
- If `startDate` + `endDate` provided → calls `calculateCostBreakdownMonthly` for each month in range
- If single `date` (YYYY-MM-DD) → calls `calculateCostBreakdown` (single day)
- If single `date` (YYYY-MM) → calls `calculateCostBreakdownMonthly` for the month

**Key Prisma query:** No direct Prisma query in controller — delegates to `mlPayout.service.ts`

**Status:** Always uses `status: "confirmed"` filter inside `calculateCostBreakdownMonthly`

### Schema/Data Source

- Uses `DailyInput.revenue` via `groupBy` on `recordDate`
- Uses `DownstreamPeriod` for ML/LE payout period lookup
- SM rebate comes from `AdSiteRebateRate` lookup inside `calculateCostBreakdownMonthly`
- Yiyi cost comes from `getYiyiDailyPricing`

**Fields used:** `DailyInput.revenue`, `DailyInput.qty`, `DailyInput.status`, `AdSite.upstream.adTypeId`, `DownstreamPeriod`, `Downstream.payoutRate`, `AdSiteRebateRate`

### Formula

**From `mlPayout.service.ts` and `calculations.ts`:**
```
revenue = sum(DailyInput.revenue where confirmed)
ml_payout = qty * ml_payout_rate (from downstreamPeriod)
le_payout = revenue * le_payout_rate OR qty * le_unit_price
yiyi_payout = from getYiyiDailyPricing per day
cost = ml_payout + le_payout + yiyi_payout
tax = calculateTaxOnMargin(profit)  // only if profit > threshold
profit = revenue - cost - tax
profit_rate = profit / revenue
```

**Important:** `revenue` comes directly from `DailyInput.revenue` — no recalculation. SM rebate is embedded in `ml_payout` calculation, not as a separate field.

### Filters

**Business filter:** None — shows all adTypes combined in single table

**Date filter:** Required range; cannot load without both dates

**Search:** Full-text search on date/revenue/cost/profit

### Risks/Findings

**P2:** No business filter means user cannot isolate SM vs 360 vs OTHER. If different business types have very different margin profiles, the total table obscures this.

**P2:** Backend aggregates ALL adTypes together unless `adTypeCode` param is passed. But frontend never passes `adTypeCode` — no filter UI for it. So the table always shows combined total.

**P3:** If date range spans multiple months, the total row combines monthly totals from `calculateCostBreakdownMonthly` which internally handles each month independently.

---

## 4. Page: Bảng lợi nhuận đơn quảng cáo (OrderProfit)

### Frontend

**File:** `frontend/src/pages/Reports.tsx:418-523`

**State:**
```typescript
const [startDate, setStartDate] = React.useState('');
const [endDate, setEndDate] = React.useState('');
const [business, setBusiness] = React.useState('');  // adTypeCode filter
const [search, setSearch] = React.useState('');
const [rows, setRows] = React.useState<OrderProfitReportRow[]>([]);
```

**Date behavior:** Uses `ReportDateRangeField` (dual date picker). Calls `getOrderProfitReport({ startDate, endDate, adTypeCode: business || undefined })`

**Business filter:** `business` state → `adTypeCode` param. Uses `businessOptionsFromRows(rows, row => row.adTypeCode, row => row.adTypeName)` to build options from actual row data.

**Table columns:**
`advertiser | adOrder (adTypeName) | Code (adTypeCode) | revenue | trafficData | Records`

**Key:** Column "adOrder" displays `row.adTypeName` (e.g., "SM业务"), not `row.adTypeCode`. This is the `adType.name` from the AdType table.

**Sort:** No explicit sort — rows returned by backend sorted by `totalRevenue desc`

**Search:** `matchesLocalized(displayName, search, [row.advertiser, row.adTypeCode, row.adTypeName])`

**Export:** `广告单利润表.csv`

### API/Backend

**API function:** `getOrderProfitReport` → `GET /api/bff/reports/order-profit`

**Params:** `{ startDate, endDate, adTypeCode? }`

**Controller:** `src/controllers/bff/report.controller.ts` → `GET /order-profit`

**Prisma query:**
```typescript
const records = await prisma.dailyInput.findMany({
  where: {
    recordDate: { gte, lt },
    status: "confirmed",
    ...(adTypeCode ? { adSite: { upstream: { adType: { code: adTypeCode } } } } : {}),
  },
  include: { adSite: { include: { upstream: { include: { adType: true } } } } },
});
```

**Grouping:** Groups by `${record.adSite.upstreamId}-${record.adSite.upstream.adType.code}` in a Map

**Aggregation:** `totalRevenue = sum(revenue)`, `totalQty = sum(qty)`, `recordCount = count`

**Response shape:** `OrderProfitReportRow[]` — one row per (upstream, adTypeCode) pair, sorted by totalRevenue desc

### Schema/Data Source

- `DailyInput.revenue` (confirmed only)
- `DailyInput.qty`
- `AdSite.upstreamId` → `Upstream.name`
- `Upstream.adType.code` → business code grouping key
- `AdType.name` → display name for column

**Fields used:** `revenue`, `qty`, `upstream.name`, `upstream.adType.code`, `upstream.adType.name`

### Formula

**No calculation.** This page shows raw aggregated revenue/qty per advertiser-type combination:
```
totalRevenue = SUM(record.revenue)
totalQty = SUM(record.qty)
recordCount = COUNT(records)
```
No cost, no profit, no margin calculation.

### Filters

| Filter | Key | Option Source | Predicate |
|---|---|---|---|
| Business | `business` | `businessOptionsFromRows(rows, row.adTypeCode, row.adTypeName)` | `adTypeCode === business` (via API param) |
| Search | `search` | client-side | `matchesLocalized([advertiser, adTypeCode, adTypeName])` |
| Date | `startDate/endDate` | dual date picker | via API params |

**Note:** The `adTypeName` column is the AdType's `name` field (e.g., "SM业务"), NOT the AdOrder's name. This is intentional and correct for this page — it shows group by business type.

### Risks/Findings

**P3:** Column labeled "adOrder" actually shows `adTypeName` (e.g., "SM业务"). This could confuse users who expect actual AdOrder names. However, since this page groups by business type, using `adTypeName` is correct for the grouping purpose.

**P3:** No way to see individual real AdOrders in this view — all SM-type advertisers are grouped together regardless of which specific AdOrder they belong to.

---

## 5. Page: Truy vấn dữ liệu nhà quảng cáo (AdvQuery)

### Frontend

**File:** `frontend/src/pages/Reports.tsx:526-710`

**State:**
```typescript
const [filters, setFilters] = React.useState({
  startDate: '', endDate: '',
  business: '',        // adTypeCode business code
  advertiser: '',      // display name string
  adOrder: '',         // display name string (NOT business code!) — SECONDARY filter
  adId: '',            // adId string
  type: '',            // 'CPM' | 'CPS' | 'CPA'
  rate: '',            // rate string
  status: 'confirmed', // default confirmed
  search: '',
});
```

**Date behavior:** Dual date picker. `getReportParams()` builds `{ startDate, endDate, status, advertiserId, adTypeCode }`. Note: `adOrder` and `adId` are NOT sent to API — only used as client-side filters.

**API params sent to backend:**
```typescript
{
  startDate: filters.startDate || undefined,
  endDate: filters.endDate || undefined,
  status: statusParam(filters.status),  // confirmed | pending | undefined (all)
  advertiserId: numeric id from advertiser name lookup,
  adTypeCode: filters.adId || undefined,  // NOTE: adTypeCode mapped from filters.adId!
}
```

**advertiserId resolution:** Client-side lookup — finds row where `r.advertiser === filters.advertiser`, extracts `r.advertiserId`. This is fragile if multiple advertisers share the same name.

**adTypeCode resolution:** Uses `filters.adId` (which is the adId string) to find matching row's `adTypeCode`. This seems wrong — `filters.adId` should be adId, not adTypeCode. **P1 bug suspected here.**

**Filters used in API:** `startDate`, `endDate`, `status`, `advertiserId`, `adTypeCode`

**Filters NOT sent to API (client-side only):** `business`, `adOrder`, `type`, `rate`, `search`

**advertiserId derived from display name (fragile):**
```typescript
const match = rows.find(r => r.advertiser === filters.advertiser);
return match?.advertiserId;
```
If two advertisers have the same name, wrong one may be selected.

**Type filter values in UI:**
```tsx
<option value="CPM">CPM</option>
<option value="CPS">CPS</option>
<option value="CPA">CPA</option>
```
Note: CPS (user-facing) maps to RATIO (backend). Backend accepts `CPM`, `RATIO`, `CPA`. **P2 risk: if user selects CPS, backend receives "CPS" which is invalid. No frontend validation.**

**visibleRows filter predicate (line 600-609):**
```typescript
(!filters.business || orderCodeForAdvRow(row) === filters.business)  // ✅ business code filter
&& (!filters.advertiser || row.advertiser === filters.advertiser)      // ✅ display name filter
&& (!filters.adOrder || row.adOrder === filters.adOrder)               // ⚠️ string-to-string filter — uses row.adOrder (display name), not orderCode
&& (!filters.adId || row.adId === filters.adId)                        // ✅ adId string
&& (!filters.type || row.type === filters.type)                        // ✅ type enum
&& (!filters.rate || row.rate === filters.rate)                        // ✅ rate string
&& matchesStatus(row.status, filters.status)                           // ✅
&& matchesLocalized(...)                                               // ✅
```

**businessOptions (line 611):** Uses `orderCodeForAdvRow` → correctly uses business code ✅

**adOrder options (line 648):**
```tsx
{unique(businessRows.map(row => row.adOrder)).map(value =>
  <option key={value} value={value}>{displayName(value)}</option>
)}
```
Dropdown populated from `businessRows.map(row => row.adOrder)` — display names from `adOrder` field (AdOrder.name string). Not business code. This is SECONDARY filter, separate from `filters.business`.

### API/Backend

**API function:** `getAdvertiserReport` → `GET /api/bff/reports/advertisers`

**Params:** `AdvertiserReportParams { date?, startDate?, endDate?, advertiserId?, adTypeCode?, status? }`

**Backend controller:** `src/controllers/bff/report.controller.ts` → `GET /advertisers`

**Prisma query includes:**
```typescript
include: {
  adSite: {
    include: {
      upstream: { include: { adType: true } },
      adOrder: { include: { adType: true } },  // ✅ fixed in this session
    },
  },
}
```

**Status default:** If no status param, defaults to `status: "confirmed"` (line 103)

**adTypeCode filter:** If provided, filters by `adSite.upstream.adType.code`

**Response:** `AdvertiserEntryRow[]` with `adOrder`, `adOrderId`, `adOrderCode` fields

### Schema/Data Source

**Mapper:** `mapDailyInputToAdvertiserEntry` (dataEntry.mapper.ts)
```typescript
adOrder: record.adSite.adOrder?.name ?? ''         // display name (AdOrder.name)
adOrderId: record.adSite.adOrder?.id ?? null         // numeric id
adOrderCode: record.adSite.adOrder?.adType?.code ?? record.adSite.upstream.adType.code  // business code
```

**Important:** `adOrderCode` fallback is `upstream.adType.code` (business code). `adOrder` is `adOrder.name` (display string, e.g., "SM").

### Formula

**No calculation.** Shows raw daily input data from `DailyInput`:
- `revenue` = `DailyInput.revenue` (already calculated financial amount)
- `rate` = `unitPriceSnapshot` (CPM) or `ratioSnapshot` (RATIO)
- `traffic` = `qty`
- `settlement` = `amount1` (CPM) or `amount1+amount2` (RATIO)
- `receivable` = `revenue`

No recalculation. Uses `DailyInput.revenue` directly.

### Filters

| Filter | Sent to API? | Used in predicate | Issue |
|---|---|---|---|
| `business` | No (client-side) | `orderCodeForAdvRow(row) === filters.business` ✅ | Correctly uses business code |
| `advertiser` | Yes (numeric id) | `row.advertiser === filters.advertiser` ✅ | Display name comparison — fragile if duplicate names |
| `adOrder` | No (client-side) | `row.adOrder === filters.adOrder` ⚠️ | Uses `row.adOrder` (display name string), dropdown options from `row.adOrder` values. String-to-string comparison — works but inconsistent with `business` filter logic |
| `adId` | Yes (as adTypeCode!) | `row.adId === filters.adId` ⚠️ | Frontend sends `filters.adId` (adId string) as `adTypeCode` param — this is likely a bug |
| `type` | No | `row.type === filters.type` ⚠️ | UI shows CPS but backend expects RATIO — type mismatch |
| `rate` | No | `row.rate === filters.rate` ✅ | String comparison on rate |
| `status` | Yes | `matchesStatus(row.status, filters.status)` ✅ | |
| `search` | No | `matchesLocalized` ✅ | |

### Risks/Findings

**P0 — `filters.adId` sent as `adTypeCode` param (line 559):**
```typescript
adTypeCode: filters.adId || undefined,
```
This passes the adId string (e.g., "site-123") to `adTypeCode` parameter, which the backend interprets as a business code like "SM" or "360". This will silently filter to zero rows or wrong rows. **Fix: should use `filters.business` instead or remove entirely.**

**P1 — `filters.adOrder` filter mismatch:**
- `filters.adOrder` dropdown options from `businessRows.map(row => row.adOrder)` — display name strings
- Predicate `row.adOrder === filters.adOrder` — compares display name to display name
- But primary business filter uses `orderCodeForAdvRow` (business code)
- User could select business="SM" (business code) AND adOrder="360" (different code) — inconsistent

**P2 — Type filter passes invalid value:**
- UI filter options: `"CPM"`, `"CPS"`, `"CPA"`
- Backend accepts: `"CPM"`, `"RATIO"`, `"CPA"`
- If user selects "CPS", backend receives "CPS" and may return error or 0 rows
- No frontend conversion (backend expects RATIO but gets CPS)

**P2 — advertiserId derivation is display-name based:**
```typescript
const match = rows.find(r => r.advertiser === filters.advertiser);
return match?.advertiserId;
```
If two advertisers have the same name (possible after name deduplication), wrong one is selected.

---

## 6. Page: Truy vấn dữ liệu media (MediaQuery)

### Frontend

**File:** `frontend/src/pages/Reports.tsx:713-900+`

**State:**
```typescript
const [filters, setFilters] = React.useState({
  startDate: '', endDate: '',
  business: '',          // business code filter
  media: '',              // media display name
  mediaAdOrder: '',       // display name string (secondary filter, NOT business code)
  mediaId: '',            // media adId string
  type: '',
  rate: '',
  shareRatio: '',
  status: 'confirmed',
  search: '',
});
```

**API params:**
```typescript
{
  startDate: filters.startDate || undefined,
  endDate: filters.endDate || undefined,
  status: statusParam(filters.status),
  mediaId: numeric mediaId from media name lookup,
  adTypeCode: filters.mediaId || undefined,  // Same P0 bug as AdvQuery
}
```

**mediaId derivation (fragile):**
```typescript
const match = rows.find(r => r.media === filters.media);
return match?.mediaId;
```
Same display-name-based lookup issue as AdvQuery.

**visibleRows filter predicate (line 788-798):**
```typescript
(!filters.business || orderCodeForMediaRow(row) === filters.business)  // ✅ business code
&& (!filters.media || row.media === filters.media)                     // ✅ display name
&& (!filters.mediaAdOrder || row.mediaAdOrder === filters.mediaAdOrder) // ⚠️ string-to-string
&& (!filters.mediaId || row.mediaIdStr === filters.mediaId)            // ✅
&& (!filters.type || row.type === filters.type)                       // ⚠️ CPS/RATIO mismatch
&& (!filters.rate || row.rate === filters.rate)                       // ✅
&& (!filters.shareRatio || row.shareRatio === filters.shareRatio)     // ✅
&& matchesStatus(row.status, filters.status)                           // ✅
&& matchesLocalized(...)                                               // ✅
```

**mediaAdOrder options (line 840):**
```tsx
{unique(businessRows.map(row => row.mediaAdOrder)).map(value =>
  <option key={value} value={value}>{displayName(value)}</option>
)}
```
Same pattern as AdvQuery — display name strings, not business code.

### API/Backend

**API function:** `getMediaReport` → `GET /api/bff/reports/media`

**Controller:** `src/controllers/bff/report.controller.ts` → `GET /media`

**Prisma query includes:**
```typescript
include: {
  adSite: {
    include: {
      upstream: { include: { adType: true } },
      adOrder: { include: { adType: true } },  // ✅ fixed in this session
      downstreams: { include: { downstream: true } },
    },
  },
}
```

**shareRatio derivation:** From first active downstream's `payoutRate`

**Status default:** `status: "confirmed"` (line 204)

### Schema/Data Source

**Mapper:** `mapDailyInputToMediaEntry` (dataEntry.mapper.ts)
```typescript
mediaAdOrder: record.adSite.adOrder?.name ?? ''     // display name
mediaAdOrderCode: record.adSite.adOrder?.adType?.code ?? record.adSite.upstream.adType.code  // business code
```

**actualReceived calculation:**
```typescript
actualReceived = shareRatio !== null && receivable !== "" && receivable !== 0
  ? Number((Number(record.revenue) * shareRatio).toFixed(3))
  : null
```
Display only — not stored.

### Formula

**No calculation for basic display.** `revenue` from `DailyInput.revenue`. `actualReceived` computed client-side as `revenue * shareRatio` for display.

### Filters

Same pattern as AdvQuery with same issues (P0: `filters.mediaId` sent as `adTypeCode`, P1: `mediaAdOrder` filter mismatch, P2: type CPS/RATIO mismatch, P2: mediaId derivation fragile).

### Risks/Findings

Same issues as AdvQuery but with `media` prefix. Additional note: `shareRatio` filter compares exact string match of `row.shareRatio` (e.g., "0.7") — if backend returns different precision, filter won't match.

---

## 7. Cross-Page Consistency Matrix

| Concept | TotalProfit | OrderProfit | AdvQuery | MediaQuery | Consistent? | Notes |
|---|---|---|---|---|---|---|
| Uses `DailyInput.revenue` directly | ✅ | ✅ | ✅ | ✅ | Yes | |
| Recalculates from qty/rate | ❌ | ❌ | ❌ | ❌ | Yes | All use stored revenue |
| Status default | N/A | `confirmed` implied | `confirmed` | `confirmed` | Yes | |
| Business filter uses business code | ❌ (no filter) | ✅ (adTypeCode) | ✅ (`orderCodeForAdvRow`) | ✅ (`orderCodeForMediaRow`) | Mostly | Secondary filters use display name |
| Date range parameter | ✅ (start/end) | ✅ (start/end) | ✅ (start/end) | ✅ (start/end) | Yes | |
| Has CSV export | ✅ | ✅ | ✅ | ✅ | Yes | |
| Has search | ✅ | ✅ | ✅ | ✅ | Yes | |
| Has total row | ✅ | ❌ | ✅ (footer sum) | ✅ (footer sum) | Partial | Only TotalProfit has backend-computed total |
| adOrder in response | N/A | N/A | ✅ | ✅ | Yes | `adOrder` field in rows |
| adOrderCode in response | N/A | N/A | ✅ | ✅ | Yes | `adOrderCode` field |
| type filter accepts CPS | N/A | N/A | ⚠️ (invalid value) | ⚠️ (invalid value) | No | Backend expects RATIO not CPS |
| advertiserId derived from | N/A | N/A | ⚠️ (display name) | N/A | Fragile | Display name lookup can collide |

---

## 8. Search Hits Reviewed

### Confirmed correct patterns (✅)
- `orderCodeForAdvRow = row.adOrderCode ?? row.adOrder` — correctly uses business code fallback for primary filter
- `orderCodeForMediaRow = row.mediaAdOrderCode ?? row.mediaAdOrder` — same for media
- `businessOptionsFromRows(rows, orderCodeForAdvRow)` — correct
- `calculateCostBreakdownMonthly` uses `DailyInput.revenue` directly without recalculation
- `mapDailyInputToAdvertiserEntry` uses `adOrderCode` fallback chain

### Problematic patterns (⚠️)

**`adTypeCode: filters.adId || undefined` (line 559 in AdvQuery, line 747 in MediaQuery):**
```typescript
adTypeCode: filters.adId || undefined,
```
`filters.adId` is an adId string like "123" (site id). This is passed as `adTypeCode` which expects "SM", "360", etc. This will cause the API to filter by wrong adTypeCode and return 0 or wrong rows.

**`filters.adOrder` and `filters.mediaAdOrder` secondary filters:**
```typescript
&& (!filters.adOrder || row.adOrder === filters.adOrder)  // line 603
&& (!filters.mediaAdOrder || row.mediaAdOrder === filters.mediaAdOrder)  // line 791
```
These use display-name comparison and have no primary business-code counterpart in the same dropdown. The `business` filter already covers the business-code aspect, so these secondary filters compare display names (which may be the same as business code for SM but different for other types).

**Type filter hardcoded CPS value:**
```tsx
<option value="CPS">CPS</option>
```
Backend expects `RATIO` for CPS billing method. No frontend conversion.

**advertiserId/mediaId derivation from display name:**
```typescript
const match = rows.find(r => r.advertiser === filters.advertiser);
return match?.advertiserId;
```
If two entities share the same name, wrong one is selected.

---

## 9. Runtime/Read-Only Verification

Skipped — backend server not running in this session. All analysis based on static code inspection.

---

## 10. Prioritized Suspected Issues

### P0 — Critical (likely wrong data returned)

**Issue 1:** `filters.adId` used as `adTypeCode` in AdvQuery and MediaQuery
- **Severity:** P0
- **Page:** AdvQuery, MediaQuery
- **File/Line:** `Reports.tsx:559`, `Reports.tsx:747`
- **Evidence:**
  ```typescript
  // AdvQuery getReportParams (line 559)
  adTypeCode: filters.adId || undefined,
  // MediaQuery getReportParams (line 747)
  adTypeCode: filters.mediaId || undefined,
  ```
- **Impact:** When user selects an adId filter (e.g., "site-123"), the backend receives `adTypeCode="site-123"` which doesn't match any real adTypeCode. API returns 0 rows or wrong filtered rows instead of filtering by the selected adId value.
- **Correct fix:** Either remove `adTypeCode` from API call (no filter), or pass the actual `filters.business` value if business filter should also filter via API.
- **DB write needed:** No

### P1 — Filter inconsistency / wrong field for secondary filter

**Issue 2:** `filters.adOrder` uses `row.adOrder` (display name) instead of business code
- **Severity:** P1
- **Page:** AdvQuery
- **File/Line:** `Reports.tsx:603`
- **Evidence:** `(!filters.adOrder || row.adOrder === filters.adOrder)` — compares `row.adOrder` (display name) to `filters.adOrder` (from dropdown populated by `businessRows.map(row => row.adOrder)` — display names)
- **Impact:** Works when `row.adOrder` string matches the display name exactly. But if the business code and display name diverge (e.g., code="SM" vs display name "SM"), the filter works. However mixing `filters.business` (business code) with `filters.adOrder` (display name) in the same UI creates confusion and potential inconsistency.
- **Suggested fix direction:** Consider whether `filters.adOrder` should also use `orderCodeForAdvRow` like `filters.business`, or remove it as redundant.
- **DB write needed:** No

**Issue 3:** Same as Issue 2 for MediaQuery `filters.mediaAdOrder`
- **Severity:** P1
- **Page:** MediaQuery
- **File/Line:** `Reports.tsx:791`
- **Impact & fix:** Same pattern as Issue 2.

### P2 — Type filter passes invalid value

**Issue 4:** Type filter shows CPS but backend expects RATIO
- **Severity:** P2
- **Page:** AdvQuery, MediaQuery
- **File/Line:** `Reports.tsx:650` (AdvQuery), `Reports.tsx:842` (MediaQuery)
- **Evidence:**
  ```tsx
  <option value="CPS">CPS</option>
  // No uiTypeToApiType conversion on filter value
  // Backend accepts: CPM, RATIO, CPA
  ```
- **Impact:** If user selects CPS filter, backend receives invalid value and may return 0 rows or error.
- **Suggested fix:** Either convert CPS→RATIO before API call, or remove CPS from filter options and use RATIO directly.
- **DB write needed:** No

### P3 — Fragile advertiserId/mediaId derivation

**Issue 5:** advertiserId derived from display name match
- **Severity:** P3
- **Page:** AdvQuery, MediaQuery
- **File/Line:** `Reports.tsx:551-553` (AdvQuery), `Reports.tsx:739-741` (MediaQuery)
- **Evidence:**
  ```typescript
  const match = rows.find(r => r.advertiser === filters.advertiser);
  return match?.advertiserId;
  ```
- **Impact:** If two advertisers share the same name, wrong one is selected.
- **Suggested fix:** Use the advertiser filter dropdown's option value (which should be the numeric id) instead of deriving from display name lookup.
- **DB write needed:** No

---

## 11. Recommended Next Prompt

Write a fix prompt for the following, in priority order:

**1. FIX P0 — `filters.adId` passed as `adTypeCode` (AdvQuery + MediaQuery)**
- File: `frontend/src/pages/Reports.tsx`
- Lines: ~559 (AdvQuery), ~747 (MediaQuery)
- Change: Remove `adTypeCode: filters.adId || undefined` from `getReportParams()` — the API already filters by advertiserId/mediaId, and the `filters.business` is client-side. Or properly derive adTypeCode from the selected business filter value.

**2. FIX P2 — Type filter accepts CPS (AdvQuery + MediaQuery)**
- File: `frontend/src/pages/Reports.tsx`
- Lines: ~650 (AdvQuery), ~842 (MediaQuery)
- Change: Either remove CPS option or add client-side conversion from CPS to RATIO when building API params.

**3. FIX P1 — advertiserId derivation is display-name based (AdvQuery + MediaQuery)**
- File: `frontend/src/pages/Reports.tsx`
- Lines: ~549-553 (AdvQuery), ~737-741 (MediaQuery)
- Change: Derive advertiserId from the advertiser filter dropdown option value (numeric), not from display-name lookup.

Do NOT change formula, do NOT change backend, do NOT modify mlPayout or DailyInput workflow.