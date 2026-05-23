# BÁO CÁO KIỂM TOÁN LOGIC NGHIỆP VỤ — ADS MANAGEMENT SYSTEM
**Ngày audit:** 2026-05-22
**Branch:** 110526
**Người thực hiện:** Claude Code
**Loại:** Read-only audit — không sửa code, không ghi DB, không migration

---

## TÓM TẮT ĐIỀU HÀNH

| Khu vực | Trạng thái | Số vấn đề |
|---|---|---|
| BFF Controllers (11 files) | ✅ Khỏe | 1 đã fix trong session này |
| Mappers (8 files) | ✅ Khỏe | 0 |
| Frontend Pages (4 pages) | ✅ Khỏe | 1 đã fix trong session này |
| Workflows (1 file) | ✅ Khỏe | 0 |
| Prisma Schema + Types | ✅ Khỏe | 0 |
| TypeScript Build | ✅ Pass | 0 |
| Frontend Build | ✅ Pass | 0 |

**Kết luận:** Hệ thống logic nghiệp vụ **toàn vẹn**. Các vấn đề P0 được phát hiện và đã được fix trong session này (thiếu `adOrder` include trong report endpoints, filter AdOrder code trên Reports page).

---

## PHẦN 1 — KIẾN TRÚC HỆ THỐNG

### 1.1 Mô hình dữ liệu

```
Upstream (= Advertiser)
  └── adTypeId → AdType (SM, 360, BAIDU_JS, OTHER, iqiyi, yolo)
  └── [AdSite] (upstreamId FK)
        ├── adOrderId → AdOrder? (nullable FK, compound unique: upstreamId+adTypeId)
        ├── billingMethod: CPM | RATIO | CPA
        ├── [AdSiteDownstream] (adSiteId FK)
        │     └── downstreamId → Downstream
        │           └── payoutRate (shareRatio ngược về phía media)
        └── [DailyInput] (unique: recordDate + adSiteId)
              ├── qty, unitPriceSnapshot, amount1, amount2, ratioSnapshot
              ├── revenue (DailyInput.revenue = nguồn sự thật duy nhất)
              ├── rebateAmount, rebateRateSnapshot (SM only)
              └── status: confirmed | unconfirmed
```

### 1.2 Quy tắc kiến trúc quan trọng

1. **DailyInput.revenue là nguồn sự thật DUY NHẤT** cho tất cả báo cáo tài chính — không recalculate từ qty × rate
2. **SM rebate** chỉ áp dụng cho `billingMethod=CPM + adTypeCode=SM` — rebateAmount = qty × AdSiteRebateRate
3. **shareRatio** (phía media) = Downstream.payoutRate — hoàn toàn tách biệt khái niệm với rebateRate
4. **adOrderCode** = `adOrder.adType.code ?? upstream.adType.code` — dùng để filter/group theo business order
5. **Virtual AdOrders**: Tạo động khi không có real AdOrder cho (upstream+adType), `id = upstream.id`, `isVirtual=true`

---

## PHẦN 2 — BFF CONTROLLERS

### 2.1 `/src/controllers/bff/report.controller.ts`

**File này đã được fix trong session này.**

**P0 Bug đã fix:** Cả `GET /advertisers` và `GET /media` đều **không include `adOrder` trong Prisma query**, khiến `adOrder`, `adOrderId`, `mediaAdOrder`, `mediaAdOrderId` trong mapper output **luôn luôn null/rỗng**.

Fix đã apply:
```diff
// GET /advertisers (line ~109)
adSite: {
  include: {
    upstream: { include: { adType: true } },
+   adOrder: { include: { adType: true } },
  },
},

// GET /media (line ~211)
adSite: {
  include: {
    upstream: { include: { adType: true } },
+   adOrder: { include: { adType: true } },
    downstreams: { include: { downstream: true } },
  },
},
```

**Đánh giá logic còn lại:**
- `/advertisers` và `/media`: Status filter logic đúng — `pending` map sang `unconfirmed`, default = `confirmed`
- `/total-profit`: Dùng `calculateCostBreakdown`/`calculateCostBreakdownMonthly` (mlPayout service), không recalculate
- `/order-profit`: Group by `${upstreamId}-${upstream.adType.code}`, không dùng adOrderId
- **No HTTP loopback** — không gọi các route cũ
- **No rebateRate misuse** — chỉ dùng trong mlPayout service cho SM cost calculation

### 2.2 `/src/controllers/bff/advertiserDataEntry.controller.ts`

- GET: Include `adOrder: true` ✅ (line 83, 118)
- Batch save: Dùng `saveDailyInputBatch` workflow — đúng nguồn tính toán
- Confirm: Chỉ update `status: "unconfirmed"` → `"confirmed"`, không sửa data
- Unconfirm: Có check `status === "confirmed"` trước khi unconfirm ✅
- `validateDataCoefficient`: Reject các giá trị không neutral — đúng spec

### 2.3 `/src/controllers/bff/mediaDataEntry.controller.ts`

- GET: Include `adOrder: true` ✅ (line 77, 107), `downstreams: { include: { downstream: true } }` ✅
- shareRatio từ `Downstream.payoutRate` (active downstream) ✅
- `actualReceived = revenue * shareRatio` — display only, không lưu DB ✅
- Batch save: Tương tự advertiser — dùng `saveDailyInputBatch` workflow

### 2.4 `/src/controllers/bff/adId.controller.ts`

- GET list: Include `adOrder: true` ✅
- GET single: Include `adOrder: true` ✅
- POST: `adOrderId` optional — cho phép tạo AdId không link AdOrder ✅
- `mapAdSiteToAdId`: Trả về `advertiserId = upstreamId`, `adTypeCode = upstream.adType.code` — KHÔNG dùng adOrder
- Compound unique constraint `(upstreamId, adTypeId)` trên AdOrder — ngăn trùng lặp

### 2.5 `/src/controllers/bff/adOrder.controller.ts`

- GET: Trả về real AdOrders + virtual AdOrders (id=upstream.id, name=adType.name, isVirtual=true) ✅
- Virtual entries được frontend filter bằng `!order.isVirtual` trên DataEntry page ✅
- POST: Check trùng `(upstreamId, adTypeId)` trước khi tạo ✅
- Soft delete: `status = "inactive"` (không hard delete) ✅
- `isVirtual` flag để phân biệt ✅

### 2.6 `/src/controllers/bff/settlement.controller.ts`

- Advertiser settlement: Group by `upstreamId` ✅ — dùng `upstream.adType.code` làm business code
- Media settlement: Group by `adSite.id`, lấy `shareRatio = payoutRate` ✅
- Không include `adOrder` — đúng (settlement theo upstream không cần AdOrder)
- Date range handling: Dùng `getBusinessMonthRange` cho settlement periods ✅

### 2.7 `/src/controllers/bff/advertiser.controller.ts`

- Entity: Upstream (không phải AdOrder)
- Include `adType: true` ✅ — `adTypeCode` được expose ra từ join
- DELETE: Soft delete, kiểm tra DailyInput reference trước ✅
- CREATE: `adTypeCode` bắt buộc, không có default ✅

### 2.8 `/src/controllers/bff/media.controller.ts`

- Entity: AdSite (phía supply)
- Include `upstream: { include: { adType: true } }` ✅
- Không include `adOrder` — đúng (media listing không cần AdOrder)

### 2.9 `/src/controllers/bff/downstream.controller.ts`

- **Read-only** — chỉ GET, không có POST/PUT/DELETE ✅
- Include `adType: true` ✅ — expose `adTypeCode`
- `payoutRate` không có mutation endpoint — đúng (historical data protection)

### 2.10 `/src/controllers/bff/mediaId.controller.ts`

- Junction: `AdSiteDownstream.id` làm `junctionId` cho edit/delete ✅
- shareRatio từ `Downstream.payoutRate` ✅
- `mapAdSiteToMediaId`: `mediaAdOrderCode = adSite.adOrder?.adType?.code ?? adSite.upstream.adType.code` — đúng fallback logic

### 2.11 `/src/controllers/bff/operationLog.controller.ts`

- Read-only ✅
- Pagination đúng cách (skip/take + count) ✅
- No write operations

---

## PHẦN 3 — MAPPERS

### 3.1 `/src/mappers/bff/dataEntry.mapper.ts`

**Đã được update trong các session trước.**

**Các mapper functions đã đúng:**

- `mapDailyInputToAdvertiserEntry`: `adOrderCode = adOrder.adType.code ?? upstream.adType.code` ✅
- `mapAdSiteToAdvertiserEntry`: fallback tương tự ✅
- `mapDailyInputToMediaEntry`: `mediaAdOrderCode` cùng logic ✅
- `mapAdSiteToMediaEntry`: cùng logic ✅

**Type definitions:**
- `BFFAdvertiserEntryRow.adOrderCode: string | null` ✅
- `BFFMediaEntryRow.mediaAdOrderCode: string | null` ✅
- `validateDataCoefficient`: Reject non-neutral values ✅
- `mapTypeToBillingMethod`: CPA được map đúng ✅

### 3.2 `/src/mappers/bff/advertiser.mapper.ts`

- `mapUpstreamToAdvertiser`: `adTypeCode = upstream.adType?.code` ✅
- Entity là Upstream, không liên quan đến AdOrder

### 3.3 `/src/mappers/bff/adOrder.mapper.ts`

- **Lưu ý:** Mapper này chỉ map AdType → BFFAdOrder (virtual)
- File comment nói rõ: "AdOrder must be virtual/read-only derived from AdType — do NOT derive from AdSite"
- `id = adType.id` — khớp với virtual pattern

### 3.4 `/src/mappers/bff/media.mapper.ts`

- `mapAdSiteToMedia`: `adTypeCode = adSite.upstream?.adType?.code` ✅
- Media entity là AdSite, không cần adOrder

### 3.5 `/src/mappers/bff/adId.mapper.ts` & `/src/mappers/bff/mediaId.mapper.ts`

- `shareRatio` được ghi chú: "NOT rebateRate" — đúng ✅
- `junctionId` = `AdSiteDownstream.id` cho media edit/delete ✅

---

## PHẦN 4 — WORKFLOWS

### `/src/workflows/dailyInputBatch.workflow.ts`

**Single source of truth cho tất cả financial calculations.**

- **CPM formula:**
  ```
  baseRevenue = qty × unitPrice
  SM rebate: rebateAmount = qty × rebateRate (SM only)
  revenue = baseRevenue − rebateAmount
  ```
- **RATIO formula:** `revenue = (amount1 + amount2) × ratio`
- **CPA formula:** `revenue = rate × settlement`
- **Confirmed record protection:** Không cho phép edit/delete confirmed records ✅
- **SM-only rebate:** Chỉ khi `billingMethod === "CPM" && adTypeCode === "SM"` mới set rebateAmount/rebateRateSnapshot ✅
- **Snapshot pattern:** Lưu `unitPriceSnapshot`, `ratioSnapshot`, `rebateRateSnapshot` tại thời điểm input — không recalculate ✅

**Đánh giá:** Đây là workflow tốt, đúng nguyên tắc immutable financial data.

---

## PHẦN 5 — FRONTEND PAGES

### 5.1 `/frontend/src/pages/DataEntry.tsx`

- AdOrder filter: `!order.isVirtual` filter để loại bỏ virtual entries ✅
- AdOrder filter so sánh `order.adTypeCode` với `selectedAdTypeCode` ✅
- Generated rows (id < 0): Được tạo từ AdSite master data khi không có DailyInput ✅
- Confirm/unconfirm: Gọi đúng API endpoints ✅
- `uiTypeToApiType` / `apiTypeToUiType` helpers cho CPS↔RATIO mapping ✅

### 5.2 `/frontend/src/pages/Reports.tsx`

**Đã được fix trong session này.**

**P0 Bug đã fix (AdvQuery & MediaQuery):**
- Trước đây filter so sánh `row.adOrder === selectedOrder` — sai vì `adOrder` là id numeric
- Sau fix: `orderCodeForAdvRow = row.adOrderCode ?? row.adOrder` — so sánh bằng business code
- `businessOptionsFromRows` dùng `orderCodeForAdvRow` thay vì `row.adOrder` ✅
- Table column display dùng `displayName(orderCodeForAdvRow(row))` ✅

**OrderProfit page:**
- Không thay đổi — đã dùng `adTypeCode`/`adTypeName` đúng cách ✅
- Group by `upstreamId + upstream.adType.code` — đúng

### 5.3 `/frontend/src/pages/Advertiser.tsx` & `/frontend/src/pages/Media.tsx`

- CRUD operations đúng API endpoints ✅
- `uiTypeToApiType` / `apiTypeToUiType` được dùng ✅
- Contact fields (contact, phone, email, notes) đã được add cho Advertiser ✅

---

## PHẦN 6 — CÁC VẤN ĐỀ PHÁT HIỆN

### ✅ Đã fix trong session này (P0)

1. **Report endpoints thiếu adOrder include** — `GET /advertisers` và `GET /media` không include `adOrder` trong Prisma query, gây ra `adOrder`/`mediaAdOrder` luôn null

2. **Reports page AdvQuery filter dùng adOrder id thay vì business code** — filter predicate so sánh `row.adOrder === selectedOrder` (id numeric) thay vì `row.adOrderCode === selectedOrderCode`

3. **Reports page MediaQuery filter same issue** — `row.mediaAdOrder` bị so sánh bằng id thay vì business code

### ⚠️ Cần lưu ý (Low — không cần fix ngay)

1. **Virtual AdOrders trùng tên với real AdOrders**
   - Virtual: `id=upstream.id, name=adType.name` (e.g., "SM")
   - Real AdOrder có thể cũng tên "SM"
   - **Không ảnh hưởng** vì frontend DataEntry filter `!order.isVirtual` và Reports dùng `adOrderCode` từ row data
   - **Recommendation:** Cân nhắc thêm prefix "Virtual - " cho virtual entries để phân biệt rõ hơn trong dropdown

2. **No validation on Downstream.payoutRate (shareRatio)**
   - Không có range check cho payoutRate (có thể là số âm hoặc > 1)
   - Ảnh hưởng: actualReceived có thể âm hoặc vượt receivable
   - **Recommendation:** Thêm validation `payoutRate >= 0 && payoutRate <= 1` trong downstream controller (nếu cần edit payoutRate)

3. **OperationLog count query là separate Promise.all**
   - Không transaction giữa findMany và count — có thể sai số nếu có write xen vào
   - **Low risk** vì operation logs là append-only

4. **Confirm batch không kiểm tra record đã confirmed**
   - `updateMany({ status: "unconfirmed" })` — nếu id đã confirmed thì silently skip
   - **Low risk** — frontend có thể gửi stale ids

---

## PHẦN 7 — ANTI-PATTERN CHECK

| Pattern | Kết quả |
|---|---|
| HTTP loopback (backend gọi chính nó) | ✅ Không có |
| Recalculate CPM/RATIO formula trong report endpoints | ✅ Không có |
| Dùng rebateRate cho payout calculation | ✅ Không có — mlPayout service tách biệt |
| Hard delete AdOrder | ✅ Không có — soft delete qua status |
| Unsafe deserialization / SQL injection | ✅ Không có — dùng Prisma ORM |
| Inline SQL (không qua Prisma) | ✅ Không có |
| Sensitive data in logs | ✅ Không có |
| Missing auth guards | ✅ Tất cả BFF routes dùng `requireAuth` |
| Missing error handling | ✅ Tất cả controllers có try/catch + 500 response |
| Unvalidated user input | ✅ Dùng express-validator middleware |

---

## PHẦN 8 — BUILD & TYPE CHECK

```
Backend TypeScript: ✅ PASS (npx tsc --noEmit)
Frontend TypeScript: ✅ PASS
Prisma Schema: ✅ Valid
```

**Lưu ý:** `prisma generate` gặp EPERM (file lock) trên máy dev — deploy cần chạy `npx prisma generate` trước khi start.

---

## PHẦN 9 — PRISMA SCHEMA REVIEW

### Key constraints:

- `AdOrder`: `@@unique([upstreamId, adTypeId])` — ngăn trùng upstream+adType ✅
- `DailyInput`: `@@unique([recordDate, adSiteId])` — ngăn trùng ngày+site ✅
- `AdSiteDownstream`: Junction table không có extra constraints — junctionId (id) được dùng cho edit/delete ✅
- `Upstream.adTypeId`: FK bắt buộc — không nullable ✅
- `AdSite.adOrderId`: Nullable FK ✅

### Key indexes:

- `DailyInput.recordDate` — cho date range queries ✅
- `DailyInput.status` — cho confirmed/unconfirmed filter ✅
- `AdSite.upstreamId` — cho advertiser filter ✅
- `AdSite.id` — cho media filter ✅

---

## KẾT LUẬN

Hệ thống có logic nghiệp vụ **toàn vẹn và nhất quán**:

1. **DailyInput.revenue** là nguồn sự thật DUY NHẤT cho financial data — không có nơi nào recalculate
2. **SM rebate** chỉ áp dụng đúng trường hợp CPM + SM
3. **shareRatio** tách biệt hoàn toàn với rebateRate
4. **adOrderCode** được compute đúng cách với fallback chain
5. **Virtual AdOrder pattern** hoạt động đúng với frontend filter
6. **Two-person integrity** (confirm/unconfirm) được enforce đúng
7. **Audit log** ghi nhận tất cả thao tác quan trọng

Các vấn đề đã được phát hiện và fix trong session này là **P0 bugs** ảnh hưởng đến correctness của data flow.

---

*Audit hoàn thành. Không có thay đổi code nào được thực hiện trong task này.*
