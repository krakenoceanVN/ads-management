# Business Calculation Audit Report

## 1. Executive Summary

| Metric | Count |
|--------|-------|
| Tổng số metric/field/công thức tìm thấy | ~70+ |
| ACTIVE | ~45 |
| PARTIAL | ~10 |
| BLOCKED | 3 (CPS/CPA hiện tại, frontend block type khác CPM/RATIO) |
| UNUSED | ~8 |
| PDF_ONLY | ~5 |
| UNKNOWN | ~4 |

### Những vấn đề quan trọng nhất

1. **Frontend-Backend Billing Type Mismatch**: `EntryType` frontend định nghĩa `'CPM' | 'CPA' | 'CPS'` trong khi backend chỉ chấp nhận `'CPM' | 'RATIO'`. Frontend có đầy đủ formulas cho CPA/CPS (dataEntryMath.ts) nhưng backend validate từ chối. Đây là **root cause** của "CPS blocked".

2. **3 loại billing method nhưng chỉ 2 được support**: Frontend có CPM/CPA/CPS logic, backend chỉ có CPM/RATIO. CPA và CPS bị blocked mà không có thông báo rõ ràng cho user.

3. **Duplicate calculation logic**: Cùng một công thức được implement ở nhiều nơi:
   - Backend: `calculations.ts` + `dailyInputBatch.workflow.ts` (CPM/RATIO)
   - Frontend: `dataEntryMath.ts` (CPM/CPA/CPS) — không share logic
   - Không có single source of truth

4. **Decimal/Number precision**: Backend dùng `Prisma.Decimal` cho financial fields nhưng conversion sang `Number` có thể mất precision. Nhiều chỗ dùng `Math.round(*100)/100` hoặc `toFixed(3)` không nhất quán.

5. **CPS business logic chưa rõ ràng**: v2.pdf mô tả CPS như "kế thừa số tiền phải thu thượng nguồn" nhưng không có tài liệu chi tiết. Cần xác nhận nghiệp vụ.

### Những câu hỏi cần xác nhận trước khi code

1. **CPS/CPA có phải là requirement thực sự không?** Hay chỉ là mockup reference trên v2.pdf?
2. **CPS logic chính xác là gì?** "Kế thừa số tiền phải thu thượng nguồn" có nghĩa là CPS media entry dùng `advertiser.receivable` làm settlement không?
3. **Có cần support CPA không?** Tên gọi CPA xuất hiện trong code nhưng không có trong PDF nào rõ ràng.
4. **Ai là payer cho CPS?** Media trả tiền cho ai — advertiser hay hệ thống?
5. **Settlement cho CPS type được tính như thế nào?** Có khác với CPM/RATIO settlement không?

---

## 2. Calculation Inventory

### 2.1 Billing Method Types

| # | Type | Backend Support | Frontend Logic | Status | Notes |
|---|------|-----------------|----------------|--------|-------|
| 1 | **CPM** | ✅ FULL | ✅ FULL | ACTIVE | `qty × unitPrice / 1000` — được support đầy đủ |
| 2 | **RATIO** | ✅ FULL | ⚠️ PARTIAL | PARTIAL | Frontend `dataEntryMath.ts` KHÔNG có RATIO formula (chỉ CPM/CPA/CPS). Backend RATIO dùng `(amount1 + amount2) × ratio` |
| 3 | **CPA** | ❌ BLOCKED | ✅ FULL | BLOCKED | Frontend có logic CPA (`rate × settlement`) nhưng backend validate từ chối — `'CPA' not in ('CPM'|'RATIO')` |
| 4 | **CPS** | ❌ BLOCKED | ✅ FULL | BLOCKED | Tương tự CPA — frontend có logic, backend từ chối |
| 5 | **CPA** (alias khác) | ❌ BLOCKED | ✅ (GlobalModal) | BLOCKED | GlobalModal deprecated có CPA/CPS selector |

**Root cause**: Backend `EntryType = 'CPM' | 'RATIO'` (bffTypes.ts:2), backend controller validate `billingMethod` chỉ chấp nhận CPM/RATIO. Frontend có định nghĩa `'CPM' | 'CPA' | 'CPS'` trong `dataEntryMath.ts:1`.

### 2.2 Revenue Calculations

| # | Metric | Formula | Input fields | Output fields | Stored DB | Calculated where | Screens | Status | Evidence |
|---|--------|---------|--------------|---------------|-----------|-----------------|---------|--------|---------|
| 1 | **CPM Revenue** (advertiser) | `rate × settlement / 1000` | `rate`, `settlement` | `receivable` | ❌ | Frontend (dataEntryMath.ts:68) | AdvEntry | ACTIVE | Formula exists, backend không tính frontend display |
| 2 | **CPA Revenue** (advertiser) | `rate × settlement` | `rate`, `settlement` | `receivable` | ❌ | Frontend (dataEntryMath.ts:69) | AdvEntry | BLOCKED | Type bị block bởi backend |
| 3 | **CPS Revenue** (advertiser) | `settlement × rate(%)` | `rate`, `settlement` | `receivable` | ❌ | Frontend (dataEntryMath.ts:70) | AdvEntry | BLOCKED | Type bị block bởi backend |
| 4 | **CPM Revenue** (media) | `rate × settlement × dataCoefficient / 1000` | `rate`, `settlement`, `dataCoefficient` | `receivable` | ❌ | Frontend (dataEntryMath.ts:113) | MediaDataMgmt | ACTIVE | |
| 5 | **CPA Revenue** (media) | `rate × settlement × dataCoefficient` | `rate`, `settlement`, `dataCoefficient` | `receivable` | ❌ | Frontend (dataEntryMath.ts:116) | MediaDataMgmt | BLOCKED | |
| 6 | **CPS Revenue** (media) | `settlement × dataCoefficient` | `settlement`, `dataCoefficient` | `receivable` | ❌ | Frontend (dataEntryMath.ts:119) | MediaDataMgmt | BLOCKED | |
| 7 | **DailyInput.revenue** (CPM backend) | `qty × unitPrice - rebateAmount` | `qty`, `unitPriceSnapshot` | `revenue` | ✅ | Backend (workflow.ts:150) | DailyInput | ACTIVE | Stored in DailyInput.revenue |
| 8 | **DailyInput.revenue** (RATIO backend) | `(amount1 + amount2) × ratioSnapshot` | `amount1`, `amount2`, `ratioSnapshot` | `revenue` | ✅ | Backend (workflow.ts:184) | DailyInput | ACTIVE | Stored |
| 9 | **Upstream revenue** (advertiser settlement) | `SUM(revenue)` grouped by advertiser | `DailyInput.revenue` | `totalRevenue` | ❌ | Backend (settlement.controller.ts:93) | Settlement | ACTIVE | Computed in settlement query |
| 10 | **Media receivable** (settlement) | `SUM(revenue)` | `DailyInput.revenue` | `receivable` | ❌ | Backend (settlement.controller.ts:198) | Settlement | ACTIVE | |
| 11 | **Media actualReceived** | `revenue × shareRatio` | `revenue`, `Downstream.payoutRate` | `actualReceived` | ❌ | Backend (settlement.controller.ts:198) | Settlement | ACTIVE | shareRatio từ Downstream.payoutRate |

### 2.3 Cost/Payout Calculations

| # | Metric | Formula | Input fields | Output fields | Stored DB | Calculated where | Screens | Status | Evidence |
|---|--------|---------|--------------|---------------|-----------|-----------------|---------|--------|---------|
| 12 | **ML Payout** | `totalRevenue × 0.8` | `totalRevenue` | `ml_payout` | ❌ | Backend (mlPayout.service.ts:106) | Reports/TotalProfit | ACTIVE | Hardcoded 0.8 rate |
| 13 | **LE Revenue (SM)** | `totalRevenue × 0.9` | `totalRevenue` | `le_payout` | ❌ | Backend (mlPayout.service.ts:108) | Reports/TotalProfit | ACTIVE | Hardcoded 0.9 rate |
| 14 | **LE ML Cost** | `totalQty × unitPrice / 1000` | `totalQty`, `leUnitPrice` | `leMlCost` | ❌ | Backend (mlPayout.service.ts:110) | Reports/TotalProfit | ACTIVE | |
| 15 | **LE Tax** | `(leRevenue - leMlCost) × 0.06` | `leRevenue`, `leMlCost` | `leTax` | ❌ | Backend (mlPayout.service.ts:111) | Reports/TotalProfit | ACTIVE | |
| 16 | **LE Payout** | `leRevenue - leMlCost - leTax` | `leRevenue`, `leMlCost`, `leTax` | `lePayout` | ❌ | Backend (mlPayout.service.ts:112) | Reports/TotalProfit | ACTIVE | |
| 17 | **Yiyi Payout** | `qty × unitPrice / 1000` | `qty`, `yiyiUnitPrice` | `yiyi_payout` | ❌ | Backend (mlPayout.service.ts:115) | Reports/TotalProfit | ACTIVE | |
| 18 | **Total Cost** | `mlPayout + lePayout + yiyiPayout` hoặc `mlPayout` (non-SM) | payout components | `cost` | ❌ | Backend (mlPayout.service.ts:113/132) | Reports/TotalProfit | ACTIVE | |
| 19 | **Tax on margin** | `(revenue - cost) × 0.06` | `revenue`, `cost` | `tax` | ❌ | Backend (mlPayout.service.ts:114/136) | Reports/TotalProfit | ACTIVE | 6% flat tax |
| 20 | **Gross Profit** | `revenue - cost` | `revenue`, `cost` | `profit` | ❌ | Backend (mlPayout.service.ts:115/137) | Reports/TotalProfit | ACTIVE | |
| 21 | **Net Profit** | `revenue - cost - tax` | `revenue`, `cost`, `tax` | `netProfit` | ❌ | Backend (mlPayout.service.ts:116/138) | Reports/TotalProfit | ACTIVE | |
| 22 | **Profit Rate** | `profit / revenue` | `profit`, `revenue` | `profit_rate` | ❌ | Backend (mlPayout.service.ts:347) | Reports/TotalProfit | ACTIVE | |
| 23 | **SM Rebate Amount** | `qty × rebateRateSnapshot` | `qty`, `rebateRateSnapshot` | `rebateAmount` | ✅ | Backend (workflow.ts:170) | DailyInput | ACTIVE | Stored in DailyInput.rebateAmount |
| 24 | **SM Rebate Rate** | from AdSiteRebateRate table | `effective rate` | `rebateRateSnapshot` | ✅ | Backend (workflow.ts:153) | DailyInput | ACTIVE | |
| 25 | **Downstream payoutRate** | `Downstream.payoutRate` | default `0.8` (ML) | `shareRatio` | ✅ | Backend (settlement.controller.ts:198) | Settlement | ACTIVE | Hardcoded 0.8 for ML |
| 26 | **LE payout rate** | `0.9` hardcoded | N/A | `le_payout` | ❌ | Backend (mlPayout.service.ts:108) | Reports | ACTIVE | Should come from config |
| 27 | **LE unit price** | `16` hardcoded | N/A | `leMlCost` | ❌ | Backend (mlPayout.service.ts) | Reports | ACTIVE | LE payout price per 1000 UV |
| 28 | **Media actualReceived** (entry) | `receivable × shareRatio` | `receivable`, `shareRatio` | `actualReceived` | ❌ | Frontend (dataEntryMath.ts:124) | MediaDataMgmt | ACTIVE | shareRatio từ Downstream |
| 29 | **Advertiser receivable (entry)** | backend tính display trong mapper | `revenue` | `receivable` | ❌ | Backend (dataEntry.mapper.ts:113-125) | AdvEntry | PARTIAL | Mapper display, không phải stored field |

### 2.4 Ratio/Rate Fields

| # | Metric | Formula | Input fields | Output fields | Stored DB | Calculated where | Screens | Status | Evidence |
|---|--------|---------|--------------|---------------|-----------|-----------------|---------|--------|---------|
| 30 | **currentUnitPrice** (AdSite) | user input | N/A | `Decimal` in DB | ✅ | Frontend form → backend | MediaMgmt | ACTIVE | |
| 31 | **currentRatio** (AdSite) | user input | N/A | `Decimal` in DB | ✅ | Frontend form → backend | MediaMgmt | ACTIVE | |
| 32 | **dataCoefficient** (media entry) | user input or inherited | `upstream settlement` | `string` | ✅ | Frontend (dataEntryMath.ts:92-98) | MediaDataMgmt | ACTIVE | Must be 1, 100, or empty |
| 33 | **shareRatio** (media entry) | from Downstream.payoutRate | `Downstream.payoutRate` | `string` | ✅ | Backend mapper (mediaId.mapper.ts:94) | MediaDataMgmt | ACTIVE | |
| 34 | **payoutRate** (Downstream) | ML=0.8, LE=0.9 | config | `Decimal` | ✅ | Backend (Downstream model) | Settlement | ACTIVE | |
| 35 | **unitPriceSnapshot** (DailyInput) | snapshot at entry time | `currentUnitPrice` | `Decimal` | ✅ | Backend (workflow.ts:204) | DailyInput | ACTIVE | |
| 36 | **ratioSnapshot** (DailyInput) | snapshot at entry time | `currentRatio` | `Decimal` | ✅ | Backend (workflow.ts:193) | DailyInput | ACTIVE | |
| 37 | **rebateRateSnapshot** (DailyInput) | snapshot at entry time | `AdSiteRebateRate.rate` | `Decimal` | ✅ | Backend (workflow.ts:169) | DailyInput | ACTIVE | SM only |
| 38 | **rate** (AdId/MediaId) | `currentUnitPrice` or `currentRatio` | N/A | `number` | ✅ | Backend mapper (adId.mapper.ts:73-75) | AdIdMgmt | ACTIVE | Rate display từ AdSite |

### 2.5 Settlement/Confirmation

| # | Metric | Formula | Input fields | Output fields | Stored DB | Calculated where | Screens | Status | Evidence |
|---|--------|---------|--------------|---------------|-----------|-----------------|---------|--------|---------|
| 39 | **Receivable Amount** | `SUM(DailyInput.revenue)` by advertiser | `DailyInput.revenue` | `amount` | ❌ | Backend (settlement.controller.ts:93) | Settlement | ACTIVE | |
| 40 | **Actual Received (media)** | `receivable × shareRatio` | `receivable`, `shareRatio` | `actualReceived` | ❌ | Backend (settlement.controller.ts:198) | Settlement | ACTIVE | |
| 41 | **Status: unconfirmed → confirmed** | batch confirm | `ids[]` | status change | ✅ | Backend (advertiserDataEntry.controller.ts:214) | AdvEntry | ACTIVE | |
| 42 | **Status: confirmed → unconfirmed** | unconfirm single | `id` | status change | ✅ | Backend (advertiserDataEntry.controller.ts:253) | AdvEntry | ACTIVE | |
| 43 | **Confirm All** | filter pending → confirm batch | `pending rows` | batch status change | ✅ | Frontend (DataEntry.tsx:292) | AdvEntry | ACTIVE | UI only, gọi confirm-batch API |
| 44 | **AdSiteRebateRate effective** | date-range lookup | `startDate, endDate` | `rate` | ✅ | Backend (workflow.ts:153) | DailyInput | ACTIVE | Active rebate rate for SM |

### 2.6 Metric/KPI Fields

| # | Metric | Formula | Input fields | Output fields | Stored DB | Calculated where | Screens | Status | Evidence |
|---|--------|---------|--------------|---------------|-----------|-----------------|---------|--------|---------|
| 45 | **qty** (DailyInput) | user input | N/A | `Int` | ✅ | Frontend form | DailyInput | ACTIVE | CPM quantity |
| 46 | **amount1/amount2** (DailyInput) | user input | N/A | `Decimal` | ✅ | Frontend form | DailyInput | ACTIVE | RATIO amounts |
| 47 | **revenue** (DailyInput) | computed formula | CPM/RATIO inputs | `Decimal` | ✅ | Backend (workflow.ts) | DailyInput | ACTIVE | Final computed revenue stored |
| 48 | **adjustedUV** | `Math.trunc(qty × effectiveRate/100)` | `qty`, `effectiveRate` | `adjustedUV` | ❌ | Backend (dashboard.ts:597) | Dashboard | ACTIVE | UV adjustment from DailyDownstreamRate |
| 49 | **pctHal** (DownstreamPeriod) | UV-to-qty ratio | config | `Decimal` | ✅ | Backend (DownstreamPeriod model) | Dashboard | ACTIVE | |
| 50 | **vendorCost** (LEDailyCost) | `vendorCost + mlCost` | `vendorCost`, `mlCost` | `costAmount` | ✅ | Backend (leDashboard.ts:339) | LE Dashboard | ACTIVE | |
| 51 | **profit_rate** (TotalProfitReportRow) | `profit / revenue` | `profit`, `revenue` | `profit_rate` | ❌ | Backend (report.controller.ts:299) | Reports | ACTIVE | |
| 52 | **recordCount** (OrderProfitReportRow) | COUNT | grouped rows | `recordCount` | ❌ | Backend (report.controller.ts:395) | Reports | ACTIVE | |

---

## 3. CPS Deep Dive

### 3.1 CPS xuất hiện ở đâu

**Frontend — ACTIVE code (có logic nhưng blocked by backend):**
- [frontend/src/lib/dataEntryMath.ts:1](frontend/src/lib/dataEntryMath.ts#L1) — `EntryType = 'CPM' | 'CPA' | 'CPS'`
- [frontend/src/lib/dataEntryMath.ts:70](frontend/src/lib/dataEntryMath.ts#L70) — `calculateAdvertiserReceivable: CPS → settlement × rate(%)`
- [frontend/src/lib/dataEntryMath.ts:119](frontend/src/lib/dataEntryMath.ts#L119) — `calculateMediaReceivable: CPS → settlement × dataCoefficient`
- [frontend/src/components/GlobalModal.tsx:35-39](frontend/src/components/GlobalModal.tsx#L35) — CPA/CPS type selector (deprecated)
- [frontend/src/components/Table.tsx:61](frontend/src/components/Table.tsx#L61) — CSS class mapping for CPS

**Frontend — UI elements:**
- [frontend/src/pages/DataEntry.tsx:231](frontend/src/pages/DataEntry.tsx#L231) — `throw new Error('Only CPM and RATIO are supported.')` — **BLOCKS CPS at save time**
- [frontend/src/pages/DataEntry.tsx:489](frontend/src/pages/DataEntry.tsx#L489) — same block for MediaDataMgmt

**Backend — Billing Type Validation:**
- [src/controllers/bff/media.controller.ts:117](src/controllers/bff/media.controller.ts#L117) — `billingMethod must be CPM or RATIO`
- [src/mappers/bff/media.mapper.ts:100](src/mappers/bff/media.mapper.ts#L100) — `billingMethod must be CPM or RATIO`
- [src/types/index.ts:2](src/types/index.ts#L2) — `BillingMethod = "CPM" | "RATIO"`

**Database:**
- `DailyInput` model không có billing method stored — billing method đến từ `AdSite.billingMethod`
- `AdSite.billingMethod` chỉ lưu `"CPM"` hoặc `"RATIO"` (không có CPS/CPA)

### 3.2 CPS đang bị block ở đâu

1. **Frontend DataEntry validation** — `isAllowedEntryType()` từ chối CPS/CPA khi save
2. **Backend media controller** — validate `billingMethod` chỉ chấp nhận CPM/RATIO
3. **Backend media mapper** — same validation
4. **Database** — `AdSite.billingMethod` không cho phép CPS/CPA value

### 3.3 UI có field CPS không

- **Form dropdown** — GlobalModal deprecated có CPA/CPS selector, nhưng không mount được
- **Table display** — Table.tsx có CSS class cho CPS tag, nhưng type filter không có CPS option
- **Reports filter** — Reports.tsx filter type có 'CPM'/'RATIO' nhưng không có CPS

### 3.4 Backend có field CPS không

- **Prisma schema**: `AdSite.billingMethod` chỉ có `String` — không có enum constraint nhưng logic chỉ accept "CPM"/"RATIO"
- **API validation**: express-validator `isIn(['CPM', 'RATIO'])`
- **No dedicated CPS fields** anywhere in backend

### 3.5 CPS formula hiện có

**Advertiser CPS** (frontend, blocked):
```
CPS: receivable = settlement × parsePercent(rate)
```
→ `settlement × (rate / 100)` với rate là percentage (VD: 5% → 0.05)

**Media CPS** (frontend, blocked):
```
CPS: receivable = settlement × dataCoefficient
```
→ KHÔNG nhân với rate — chỉ settlement × coefficient

**v2.pdf mô tả:** "CPS thì kế thừa số tiền phải thu thượng nguồn" — nghĩa là media CPS dùng advertiser receivable làm settlement.

### 3.6 Cần gì để implement CPS

**Nếu CPS được xác nhận là requirement:**

| Hạng mục | Cần thêm/sửa |
|----------|-------------|
| Database | Thêm `"CPS"` vào possible values của `AdSite.billingMethod` (không cần schema change nếu String, chỉ cần validate mới) |
| Backend validation | Mở rộng `isIn(['CPM', 'RATIO', 'CPS'])` ở media.controller.ts + media.mapper.ts |
| Backend DailyInput workflow | Thêm CPS branch: `revenue = upstream.receivable` (cần join lookup) |
| Frontend DataEntry | Xóa `isAllowedEntryType` block, thêm UI type selector nếu cần |
| Backend settlement | Kiểm tra settlement calculation cho CPS type |
| Frontend Reports | Thêm CPS vào filter dropdown nếu cần |

**Lưu ý:** Hiện tại `DailyInput` không store `billingMethod` — revenue được tính tại write time từ `AdSite.billingMethod`. CPS sẽ cần backend lookup advertiser receivable khi media entry được tạo — phức tạp hơn CPM/RATIO vì cần cross-entity reference.

### 3.7 Câu hỏi nghiệp vụ CPS

1. **CPS có phải là billing method thực sự không?** Hay " CPS" là tên gọi cho việc media inherit advertiser settlement?
2. **CPS settlement khi nào được xác nhận?** Media entry CPS sau khi confirm cần tính lại settlement dựa trên advertiser receivable tại thời điểm đó hay tại thời điểm tạo?
3. **Có cần report riêng cho CPS không?** Hay CPS chỉ là data entry type, không ảnh hưởng report?
4. **CPA có cần support không?** Tên xuất hiện trong code nhưng không có trong PDF nào rõ ràng.

---

## 4. Report Calculations

### 4.1 Total Profit

**Backend:** `report.controller.ts:219-300` — `getTotalProfitReport()`

| Column | Formula | Source |
|--------|---------|--------|
| `date` | GROUP BY date | DailyInput.recordDate |
| `revenue` | SUM(DailyInput.revenue) | DailyInput |
| `ml_payout` | SUM(revenue × 0.8) | Hardcoded ML rate |
| `le_payout` | (SM only) SUM(revenue × 0.9) | Hardcoded LE rate |
| `yiyi_payout` | (SM only) SUM(qty × unitPrice / 1000) | From YiyiDailyData |
| `cost` | ml_payout + le_payout + yiyi_payout (hoặc chỉ ml_payout non-SM) | Calculated |
| `tax` | (revenue - cost) × 0.06 | Flat 6% |
| `profit` | revenue - cost - tax | Calculated |
| `profit_rate` | profit / revenue | Calculated |

**Frontend:** Reports.tsx:215-330 — Display only, no additional calculation.

**Missing:** Không có breakdown column cho từng advertiser trong Total Profit. Revenue là tổng hợp toàn hệ thống.

### 4.2 Order Profit

**Backend:** `report.controller.ts:376-417` — `getOrderProfitReport()`

| Column | Formula | Source |
|--------|---------|--------|
| `advertiser` | GROUP BY upstreamId | AdSite.upstreamId |
| `adTypeCode` | GROUP BY AdType.code | AdType |
| `adTypeName` | AdType.name | AdType |
| `totalRevenue` | SUM(revenue) grouped by (advertiserId, adTypeCode) | DailyInput |
| `totalQty` | SUM(qty) | DailyInput |
| `recordCount` | COUNT(*) | DailyInput |

**Frontend:** Reports.tsx:332-445 — Display with `sumRows()` totals.

**Ghi chú:** Không có "Thượng nguồn/Hạ nguồn" column separation như PDF v3 page 3 yêu cầu. Đây là PARTIAL gap.

### 4.3 Advertiser Query

**Backend:** `report.controller.ts:30-120` — `getAdvertiserReport()`

| Column | Formula | Source |
|--------|---------|--------|
| `date` | DailyInput.recordDate | DailyInput |
| `advertiser` | upstream.name | upstream (Advertiser) |
| `adOrder` | adType.name | AdType |
| `type` | AdSite.billingMethod | AdSite |
| `adId` | AdSite.name | AdSite |
| `rate` | DailyInput.unitPriceSnapshot hoặc ratioSnapshot | DailyInput |
| `traffic` | DailyInput.qty | DailyInput |
| `settlement` | amount1 (CPM) hoặc amount1+amount2 (RATIO) | DailyInput |
| `receivable` | DailyInput.revenue | DailyInput |
| `status` | DailyInput.status | DailyInput |

**Frontend:** Reports.tsx:447-610 — Display với client-side filter theo advertiser/adOrder/adId/type.

**Missing columns từ PDF v3:**
- "Đã thu" (đã thanh toán) — backend không track
- "Click" column — code có qty nhưng label không đúng
- "Hiển thị" column — không có trong code

### 4.4 Media Query

**Backend:** `report.controller.ts:121-218` — `getMediaReport()`

| Column | Formula | Source |
|--------|---------|--------|
| `date` | DailyInput.recordDate | DailyInput |
| `media` | AdSite.name | AdSite |
| `mediaAdOrder` | adType.name | AdType |
| `type` | AdSite.billingMethod | AdSite |
| `mediaId` | AdSite.name | AdSite (second AdSite reference) |
| `rate` | DailyInput.unitPriceSnapshot/ratioSnapshot | DailyInput |
| `traffic` | DailyInput.qty | DailyInput |
| `settlement` | amount1/amount2 | DailyInput |
| `dataCoefficient` | N/A (không có trong backend response) | — |
| `receivable` | DailyInput.revenue | DailyInput |
| `shareRatio` | Downstream.payoutRate | Downstream |
| `actualReceived` | revenue × shareRatio | Calculated in mapper |
| `status` | DailyInput.status | DailyInput |

**Frontend:** Reports.tsx:617-806 — Display với client-side filter.

**Missing columns từ PDF v3:**
- "Tỷ lệ hoàn thành" (completion rate) — không có
- "Tỷ lệ đối soát" (reconciliation rate) — không có
- "Tiền kết toán" — có `settlement` nhưng không rõ có đúng không

### 4.5 Settlement

**Advertiser Settlement:** `settlement.controller.ts:78-120`

- Group by advertiser → SUM(revenue) = `amount`
- Không có "đã thu" field — `amount` = toàn bộ receivable, không trừ đã thanh toán

**Media Settlement:** `settlement.controller.ts:158-215`

- `receivable` = SUM(revenue)
- `shareRatio` = Downstream.payoutRate (default 0.8 cho ML)
- `actualReceived` = receivable × shareRatio

---

## 5. Form Field Mapping

### 5.1 Advertiser (AdvertiserList)

| Field | Input/Calculated | Stored in DB | GET Response mapped | Edit form pre-populate | Submit → Save | Status |
|-------|-----------------|--------------|---------------------|------------------------|--------------|--------|
| name | Input | ✅ | ✅ | ✅ | ✅ | ACTIVE |
| adTypeCode | Input | ✅ | ✅ | ✅ | ✅ | ACTIVE |
| status | Input (toggle) | ✅ | ✅ | ✅ | ✅ | ACTIVE |
| currentUnitPrice | — | — | — | — | — | N/A (Advertiser không có) |
| currentRatio | — | — | — | — | — | N/A |

### 5.2 Media (MediaMgmt)

| Field | Input/Calculated | Stored in DB | GET Response mapped | Edit form pre-populate | Submit → Save | Status |
|-------|-----------------|--------------|---------------------|------------------------|--------------|--------|
| name | Input | ✅ | ✅ | ✅ | ✅ | ACTIVE |
| upstreamId | Input (select) | ✅ | ✅ | ✅ | ✅ | ACTIVE |
| billingMethod | Input (select) | ✅ | ✅ | ✅ | ✅ | ACTIVE |
| currentUnitPrice | Input (CPM) | ✅ | ✅ (vừa fix) | ✅ (vừa fix) | ✅ | ACTIVE |
| currentRatio | Input (RATIO) | ✅ | ✅ (vừa fix) | ✅ (vừa fix) | ✅ | ACTIVE |
| status | Input (toggle) | ✅ | ✅ | ✅ | ✅ | ACTIVE |
| contact | — | ❌ (hardcoded null) | ❌ | — | — | UNUSED |
| phone | — | ❌ (hardcoded null) | ❌ | — | — | UNUSED |
| email | — | ❌ (hardcoded null) | ❌ | — | — | UNUSED |
| notes | — | ❌ (hardcoded null) | ❌ | — | — | UNUSED |

**Note:** contact/phone/email/notes không có trong AdSite schema — luôn return null.

### 5.3 AdOrder / AdId

| Field | Input/Calculated | Stored in DB | GET Response mapped | Edit form pre-populate | Submit → Save | Status |
|-------|-----------------|--------------|---------------------|------------------------|--------------|--------|
| rate (AdId) | Display only | — | ✅ from currentUnitPrice/currentRatio | N/A (read-only) | — | ACTIVE |
| billingMethod | Display only | ✅ (AdSite) | ✅ | N/A | — | ACTIVE |
| advertiserId | Inherited | ✅ | ✅ | N/A | — | ACTIVE |
| advertiserName | Inherited | — | ✅ upstream.name | N/A | — | ACTIVE |

### 5.4 AdvEntry (Data Entry Advertiser)

| Field | Input/Calculated | Backend Save | GET Response | Status |
|-------|-----------------|-------------|--------------|--------|
| date | Input | ✅ recordDate | ✅ | ACTIVE |
| advertiser | Inherited | ✅ upstreamId | ✅ | ACTIVE |
| adOrder | Inherited | ✅ AdType lookup | ✅ | ACTIVE |
| type | Input (select, BLOCKED: CPA/CPS) | ✅ billingMethod | ✅ | PARTIAL — CPA/CPS blocked |
| adId | Inherited | ✅ adSiteId | ✅ | ACTIVE |
| rate | Input | ✅ unitPriceSnapshot hoặc ratioSnapshot | ✅ | ACTIVE |
| traffic (qty) | Input | ✅ qty | ✅ | ACTIVE |
| settlement | Input | ✅ amount1/amount2 | ✅ | ACTIVE |
| receivable | Calculated (backend display) | ✅ revenue (stored) | ✅ | PARTIAL — backend tính nhưng frontend display tách biệt |
| status | Internal | ✅ | ✅ | ACTIVE |

### 5.5 MediaData (MediaDataMgmt)

| Field | Input/Calculated | Backend Save | GET Response | Status |
|-------|-----------------|-------------|--------------|--------|
| date | Input | ✅ recordDate | ✅ | ACTIVE |
| media | Inherited | ✅ adSiteId | ✅ | ACTIVE |
| mediaAdOrder | Inherited | ✅ AdType lookup | ✅ | ACTIVE |
| type | Input (select, BLOCKED: CPA/CPS) | ✅ billingMethod | ✅ | PARTIAL — CPA/CPS blocked |
| mediaId | Inherited | ✅ (second adSite) | ✅ | ACTIVE |
| rate | Input | ✅ unitPriceSnapshot/ratioSnapshot | ✅ | ACTIVE |
| traffic (qty) | Input | ✅ qty | ✅ | ACTIVE |
| settlement | Input | ✅ amount1/amount2 | ✅ | ACTIVE |
| dataCoefficient | Input (hoặc inherited) | ✅ | ✅ | ACTIVE |
| receivable | Calculated (backend display) | ✅ revenue | ✅ | ACTIVE |
| shareRatio | From Downstream | — (not stored per-row) | ✅ payoutRate | ACTIVE |
| actualReceived | Calculated | — | ✅ (computed) | ACTIVE |
| status | Internal | ✅ | ✅ | ACTIVE |

---

## 6. PDF vs Code Mismatch

| # | PDF Item | PDF Location | Code Status | Missing | Suggested Action |
|---|---------|-------------|-------------|---------|-----------------|
| 1 | "Đã thu" column | v3.pdf page 4 (AdvQuery) | NOT IMPLEMENTED | Backend không track "đã thu" (đã thanh toán) | NEEDS_BACKEND — cần thêm payment tracking |
| 2 | "Tỷ lệ hoàn thành" column | v3.pdf page 5 (MediaQuery) | NOT IMPLEMENTED | Backend không compute completion rate | NEEDS_BACKEND — cần xác định công thức |
| 3 | "Tỷ lệ đối soát" column | v3.pdf page 5 (MediaQuery) | NOT IMPLEMENTED | Backend không compute reconciliation rate | NEEDS_BACKEND — cần xác định công thức |
| 4 | Thượng nguồn/Hạ nguồn separation | v3.pdf page 3 (OrderProfit) | PARTIAL | Backend không return breakdown theo upstream/downstream | NEEDS_CONFIRMATION — UI redesign lớn |
| 5 | "Hiển thị" column | v3.pdf page 3 (OrderProfit) | NOT IMPLEMENTED | Có qty nhưng không có column riêng | NEEDS_CONFIRMATION — có thể chỉ là label |
| 6 | CPS/CPA support | v2.pdf page 3, page 4 | BLOCKED | Frontend có logic, backend validate block | NEEDS_CONFIRMATION — có phải requirement không? |
| 7 | "Chi phí media" column label | v2.pdf page 3 | LABELED DIFFERENTLY | Code gọi "settlement" thay vì "chi phí media" | LOW — có thể đổi i18n label |
| 8 | Email validation | v5.pdf page 5 | IMPLEMENTED | Frontend check advertiser email khi tạo media | DONE (Media.tsx:215-220) |
| 9 | Cascade filter | v5.pdf page 2-3, page 7-9 | PARTIAL | Row-level filter có, cascade dropdown cho AdOrder chưa | NEEDS_BACKEND — cần endpoint filter by advertiser |
| 10 | "Xác nhận tất cả" button | v2.pdf page 2, page 3 | IMPLEMENTED | Có function `confirmAllRows()` | DONE |

---

## 7. Risks

### 7.1 Decimal/Number Conversion Risks

| # | Risk | Location | Impact | Severity |
|---|------|----------|--------|----------|
| 1 | `Number(Prisma.Decimal)` loss of precision | Backend mappers (media.mapper.ts, adId.mapper.ts, dataEntry.mapper.ts) | Decimal values like 0.333333 may lose precision at >3 decimal places | MEDIUM |
| 2 | Inconsistent rounding: `toFixed(3)` vs `Math.round(*100)/100` vs `*1000/1000` | Backend calculations | Financial calculations may differ slightly across reports | MEDIUM |
| 3 | `formatAmount()` in frontend uses 3 decimal max, backend may use more | Reports.tsx vs report.controller.ts | Display may round differently than stored | LOW |
| 4 | `parseNumber()` strips commas and % then parseFloat | dataEntryMath.ts:41-47 | Edge cases: "1,234.56%" or "1.234,56%" may parse incorrectly | LOW |

### 7.2 Rounding Risks

| # | Risk | Location | Impact | Severity |
|---|------|----------|--------|----------|
| 5 | `Math.round(g.totalRevenue * 100) / 100` in settlement vs 3 decimals in reports | settlement.controller.ts:114 vs report.controller.ts:417 | Settlement amount may differ from report amount by small rounding | MEDIUM |
| 6 | Profit rate `profit / revenue` when revenue is 0 | mlPayout.service.ts:347 | Division by zero → Infinity | LOW — handled by conditional |

### 7.3 Frontend/Backend Mismatch Risks

| # | Risk | Location | Impact | Severity |
|---|------|----------|--------|----------|
| 7 | `EntryType` mismatch: frontend `'CPM' \| 'CPA' \| 'CPS'` vs backend `'CPM' \| 'RATIO'` | dataEntryMath.ts:1 vs bffTypes.ts:2 | CPA/CPS blocked silently | HIGH |
| 8 | Frontend `dataEntryMath.ts` có RATIO formula KHÔNG có trong codebase — chỉ CPM/CPA/CPS | dataEntryMath.ts:66-72,108-121 | RATIO display calculation có thể sai ở frontend | MEDIUM |
| 9 | `receivable` in frontend vs `revenue` in backend — cùng semantic nhưng tên khác | DataEntry.tsx vs DailyInput model | Confusion khi debug | LOW |
| 10 | `dataCoefficient` validation "must be 1, 100, or empty" nhưng backend không validate | DataEntry.tsx:490 vs workflow.ts | Invalid dataCoefficient có thể được save | MEDIUM |

### 7.4 Data Migration/Schema Risks

| # | Risk | Location | Impact | Severity |
|---|------|----------|--------|----------|
| 11 | No migration files found — schema applied via `prisma db push` | prisma/ folder | No version-controlled schema history | LOW |
| 12 | `AdSite.billingMethod` là String không có enum constraint | schema.prisma | Invalid billingMethod values có thể được insert | MEDIUM |

---

## 8. Recommended Next Steps

### P0 — Cần xác nhận ngay

1. **CPS/CPA Confirmation**: Hỏi product — CPS và CPA có phải là business requirement thực sự không? Nếu có, cần mô tả flow chi tiết. Nếu không, đánh dấu OUT_OF_SCOPE và xóa dead CPA/CPS code (GlobalModal deprecated, dataEntryMath.ts CPA/CPS functions).

2. **"Đã thu" Column Confirmation**: Hỏi product — "đã thu" (đã thanh toán) có cần trong AdvQuery không? Nếu có, backend cần thêm payment tracking (thời điểm thanh toán, số tiền đã thanh toán) → schema change.

### P1 — Có thể implement an toàn

3. **RATIO formula trong frontend**: `dataEntryMath.ts` không có RATIO formula cho advertiser/media receivable. Thêm `calculateRatioReceivable()` để frontend display consistent với backend.

4. **dataCoefficient backend validation**: Backend `dailyInputBatch.workflow.ts` không validate `dataCoefficient` phải là 1/100/empty như frontend yêu cầu. Thêm validation để đảm bảo data integrity.

5. **Verify BFFMedia mapping for currentUnitPrice/currentRatio**: Sau khi đã fix media.mapper.ts, nên verify thực tế API response có đúng 2 fields này không.

### P2 — Cần backend/schema

6. **Cascade filter AdOrder dropdown**: Backend cần endpoint `GET /api/bff/ad-orders?advertiserId=X` hoặc Advertiser→AdType mapping để frontend cascade-filter AdTypeCode dropdown trong AdvertiserList form.

7. **Tỷ lệ hoàn thành / đối soát columns**: Cần xác định công thức chính xác từ business — có thể là `confirmed_qty / total_qty` và `settled_amount / total_amount`.

8. **OrderProfit upstream/downstream separation**: Nếu cần UI separation (Thượng nguồn/Hạ nguồn), backend cần return thêm breakdown fields → significant API change.

### P3 — Cleanup/documentation

9. **GlobalModal CPA/CPS dead code removal**: File deprecated, có 10+ alert() calls, không mount — nên xóa.

10. **Consolidate calculation utilities**: Backend có `calculations.ts`, frontend có `dataEntryMath.ts` — cùng logic nhưngKHÔNG share. Consider extracting shared formula documentation.

11. **Backend build verification**: Chạy `npm run build` backend để verify mọi thứ compile đúng sau các thay đổi gần đây.

---

## 9. Questions for Product/Business

### CPS/CPA
1. CPS và CPA có đang được sử dụng trong thực tế không, hay chỉ là mockup trên v2.pdf?
2. CPS trong v2.pdf mô tả "kế thừa số tiền phải thu thượng nguồn" — có nghĩa là media entry CPS dùng advertiser.receivable làm giá trị settlement không?
3. CPS có cần settlement/confirm workflow riêng không, hay chỉ là cách nhập liệu khác?

### Reports
4. "Đã thu" trong AdvQuery (v3.pdf page 4) — đây là trường "số tiền đã thanh toán" cho advertiser chưa?
5. "Tỷ lệ hoàn thành" và "Tỷ lệ đối soát" trong MediaQuery (v3.pdf page 5) — công thức tính là gì? Ví dụ: `đã xác nhận / tổng số`?

### Business Logic
6. LE payout rate = 0.9 và ML payout rate = 0.8 — đây là hardcoded constants hay nên lưu trong config/database?
7. Tax rate = 6% — có phải là flat tax cho tất cả revenue không, hay chỉ áp dụng cho certain downstream types?
8. Yiyi unit price = 2 và profit unit price = 1 — đây là hardcoded hay từ pricing table?

### Data Model
9. Media form hiện tại không có email field — có cần thêm không? Hiện tại email lấy từ advertiser (upstream) khi chọn upstream.
10. contact/phone/email/notes luôn return null trong Media response — có phải AdSite schema không có các fields này không?