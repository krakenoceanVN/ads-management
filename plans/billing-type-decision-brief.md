# Billing Type Decision Brief

## 1. Current State

### Frontend Support
| Type | Formula File | UI Selector | Status |
|------|-------------|-------------|--------|
| **CPM** | `dataEntryMath.ts:68,113` | ✅ | **ACTIVE** |
| **RATIO** | ❌ MISSING | ✅ (select) | **PARTIAL — formula missing, display may be wrong** |
| **CPA** | `dataEntryMath.ts:69,116` | ⚠️ (GlobalModal deprecated) | **BLOCKED** |
| **CPS** | `dataEntryMath.ts:70,119` | ⚠️ (GlobalModal deprecated) | **BLOCKED** |

Frontend `EntryType = 'CPM' | 'CPA' | 'CPS'` ([dataEntryMath.ts:1](frontend/src/lib/dataEntryMath.ts#L1))

### Backend Support
| Type | Validation | Calculation | Status |
|------|------------|-------------|--------|
| **CPM** | ✅ Accepts | ✅ `qty × unitPrice - rebateAmount` | **ACTIVE** |
| **RATIO** | ✅ Accepts | ✅ `(amount1 + amount2) × ratioSnapshot` | **ACTIVE** |
| **CPA** | ❌ Rejects (`isIn(['CPM','RATIO'])`) | ❌ No calculation | **BLOCKED** |
| **CPS** | ❌ Rejects (`isIn(['CPM','RATIO'])`) | ❌ No calculation | **BLOCKED** |

Backend `BillingMethod = "CPM" | "RATIO"` ([src/types/index.ts:2](src/types/index.ts#L2))

### Type Active/Partial/Blocked Summary
| Type | Frontend | Backend | Status |
|------|----------|---------|--------|
| CPM | ✅ Full formula | ✅ Full | ACTIVE |
| RATIO | ⚠️ Missing formula | ✅ Full | PARTIAL (frontend display broken) |
| CPA | ✅ Full formula | ❌ Blocked | BLOCKED |
| CPS | ✅ Full formula | ❌ Blocked | BLOCKED |

### Key Evidence Files
- **Frontend block point**: [DataEntry.tsx:231](frontend/src/pages/DataEntry.tsx#L231) — `throw new Error('Only CPM and RATIO are supported.')`
- **Backend validation**: [media.controller.ts:117](src/controllers/bff/media.controller.ts#L117) — `isIn(['CPM', 'RATIO'])`
- **Backend validation 2**: [media.mapper.ts:100](src/mappers/bff/media.mapper.ts#L100) — `billingMethod must be CPM or RATIO`
- **Frontend formulas**: [dataEntryMath.ts:66-121](frontend/src/lib/dataEntryMath.ts#L66-L121) — CPM/CPA/CPS formulas
- **Backend calculations**: [calculations.ts:8-52](src/utils/calculations.ts#L8-L52) — CPM/RATIO formulas
- **Backend workflow**: [dailyInputBatch.workflow.ts:145-185](src/workflows/dailyInputBatch.workflow.ts#L145-L185) — CPM/RATIO revenue logic
- **Schema**: [prisma/schema.prisma:65](prisma/schema.prisma#L65) — `billingMethod String` (no enum, just validation)

---

## 2. Problem

### Problem 1: CPS/CPA Blocked Without Clear Messaging
Frontend có đầy đủ logic cho CPA và CPS trong `dataEntryMath.ts`, nhưng khi user cố gắng lưu entry với type đó, backend trả về lỗi `"Only CPM and RATIO are supported."` từ `isAllowedEntryType()`. Không có UI warning trước — user không biết type bị block cho đến khi save và nhận error.

**Root cause**: Backend validation mismatch với frontend capability.

### Problem 2: RATIO Frontend Display May Be Wrong
Frontend `dataEntryMath.ts` có formulas cho **CPM/CPA/CPS nhưng KHÔNG có formula cho RATIO**. RATIO revenue được tính ở backend (`(amount1 + amount2) × ratio`) và trả về `revenue` trong API response. Tuy nhiên, `dataEntryMath.ts:108-121` (media receivable calculator) không có RATIO branch — nó chỉ có CPM/CPA/CPS. Nếu frontend cần hiển thị/ tính receivable cho RATIO type, **code sẽ return empty string** tại line 120.

### Problem 3: Duplicate Calculation Logic — No Single Source of Truth
| Layer | File | Types Covered |
|------|------|--------------|
| Frontend | `dataEntryMath.ts:66-136` | CPM, **CPA, CPS** (NO RATIO) |
| Backend | `calculations.ts:8-52` | CPM, RATIO (NO CPA/CPS) |
| Backend workflow | `dailyInputBatch.workflow.ts:145-185` | CPM, RATIO (NO CPA/CPS) |

**Hai codebase riêng lẻ, cùng logic nhưng không share.** Nếu formula thay đổi, phải sửa ở 2+ nơi. Risk: inconsistency khi maintain.

### Problem 4: "Đã thu" Column Needs Payment Tracking
PDF v3 page 4 yêu cầu column "Đã thu" (đã thanh toán) trong AdvQuery. Backend hiện tại không track payment status — `DailyInput.revenue` là total receivable, không có trường "đã thu" hay "đã thanh toán". Nếu muốn column này thực sự hoạt động, cần:
1. Thêm payment tracking table hoặc field
2. Backend update payment status on settlement action
3. Report query phải filter theo payment date/status

**Đây là schema/API change lớn**, không thể implement trong 1 sprint mà không có design rõ ràng.

### Problem 5: Billing Type Enum Inconsistency
| Location | Definition |
|----------|------------|
| `frontend/src/lib/dataEntryMath.ts:1` | `EntryType = 'CPM' \| 'CPA' \| 'CPS'` |
| `frontend/src/lib/bffTypes.ts:2` | `EntryType = 'CPM' \| 'RATIO'` |
| `src/types/index.ts:2` | `BillingMethod = "CPM" \| "RATIO"` |

Frontend có 2 định nghĩa EntryType khác nhau: một trong BFF types (chỉ CPM/RATIO) và một trong dataEntryMath (CPM/CPA/CPS). Không nhất quán.

---

## 3. Billing Type Matrix

| Type | Frontend Formula | Backend Validation | Backend Calculation | UI Status | Current Status | Risk |
|------|-----------------|--------------------|--------------------|-----------|----------------|------|
| **CPM** | `rate × settlement / 1000` (advertiser)<br>`rate × settlement × dataCoeff / 1000` (media) | ✅ Accepts (`isIn`) | ✅ `qty × unitPrice - rebateAmount` (workflow.ts:150) | ✅ Working | **ACTIVE** | LOW — formula aligned |
| **RATIO** | ❌ NO FORMULA in frontend | ✅ Accepts | ✅ `(amount1+amount2) × ratioSnapshot` (workflow.ts:184) | ⚠️ May display wrong | **PARTIAL** | **MEDIUM** — backend calculates, frontend can't display/verify |
| **CPA** | `rate × settlement` (advertiser)<br>`rate × settlement × dataCoeff` (media) | ❌ Rejects (`isIn` only CPM/RATIO) | ❌ No calculation | ⚠️ Formula exists but blocked | **BLOCKED** | **MEDIUM** — dead code, user gets silent error |
| **CPS** | `settlement × rate(%)` (advertiser)<br>`settlement × dataCoeff` (media) | ❌ Rejects (`isIn` only CPM/RATIO) | ❌ No calculation | ⚠️ Formula exists but blocked | **BLOCKED** | **HIGH** — v2.pdf describes CPS but not implemented |

---

## 4. Option Analysis

### Option A — Giữ backend hiện tại: CPM + RATIO, cleanup frontend

**Việc cần làm:**
- Frontend: xóa/label rõ ràng các CPA/CPS functions và type definitions — chúng là **dead code**
- Frontend: thêm RATIO formula vào `dataEntryMath.ts` để frontend display đúng khi backend trả về RATIO entries
- Frontend: đồng bộ `EntryType` definition giữa `bffTypes.ts` và `dataEntryMath.ts`
- Frontend: cập nhật GlobalModal deprecated (xóa alert dead code) hoặc xóa hẳn nếu không dùng
- Backend: thêm comment rõ ràng rằng chỉ CPM/RATIO được support

**Ưu điểm:**
- Ít thay đổi nhất — không động vào backend business logic
- Fix được RATIO display issue
- Dọn dead CPA/CPS code
- Low risk — chỉ cleanup, không mở nghiệp vụ mới

**Nhược điểm:**
- Nếu CPS/CPA là real requirement, system sẽ thiếu feature
- User vẫn thấy type selector cho CPA/CPS trong UI (GlobalModal deprecated) nhưng không work

**Effort:** ~2-4 giờ

**Risk:** LOW — không thay đổi business logic, chỉ cleanup và fix display

**Khi nên chọn:**
- Khi product xác nhận CPS/CPA không phải requirement thực tế
- Khi muốn ổn định system trước, chưa mở nghiệp vụ mới

---

### Option B — Mở backend support cho CPA, keep CPS as future

**Việc cần làm:**
- Backend: mở rộng `isIn` validation cho CPA (`media.controller.ts`, `media.mapper.ts`)
- Backend: thêm CPA branch vào `dailyInputBatch.workflow.ts` hoặc xác định CPA dùng formula nào
- Backend: xác định CPS có cần backend calculation không, hay chỉ là frontend display type
- Frontend: unblock `isAllowedEntryType()` cho CPA
- Frontend: verify RATIO formula đã thêm (từ Option A)
- CPS: vẫn block, ghi rõ là P2 backlog item

**Ưu điểm:**
- Mở CPA — CPA có thể là requirement hợp lý (cost per acquisition)
- Không động vào RATIO logic hiện tại
- Ít risk hơn Option C vì chỉ thêm 1 type

**Nhược điểm:**
- Chưa rõ CPA formula chính xác — code hiện có (`rate × settlement`) có thể không đúng business
- CPS vẫn bị block — có thể cần trong tương lai
- Backend workflow change có thể ảnh hưởng existing data

**Effort:** ~4-6 giờ (cần clarify CPA formula trước)

**Risk:** MEDIUM — cần xác nhận CPA formula với business

**Khi nên chọn:**
- Khi product xác nhận CPA là requirement thật và formula `rate × settlement` là đúng
- Khi CPS không phải priority

---

### Option C — Chuẩn hóa: CPM + RATIO + CPA + CPS đầy đủ

**Việc cần làm:**
- Backend: mở validation cho CPA và CPS
- Backend: thêm formulas cho CPA và CPS vào `calculations.ts` và/hoặc `dailyInputBatch.workflow.ts`
- Backend: CPS cần lookup advertiser receivable tại thời điểm media entry — cần clarify cross-entity logic
- Backend: thêm `billingMethod` vào `DailyInput` model nếu cần track type cho từng entry
- Frontend: unblock `isAllowedEntryType()` cho CPA và CPS
- Frontend: thêm RATIO formula (từ Option A)
- Frontend: đồng bộ EntryType definitions
- Reports: update calculations nếu CPA/CPS cần appear trong reports
- Settlement: kiểm tra CPS/CPA settlement calculation
- Testing: end-to-end test cho 4 billing types

**Ưu điểm:**
- Full feature parity với code capability hiện có
- Thống nhất frontend/backend — không còn mismatch

**Nhược điểm:**
- ** Cao nhất — động vào cả frontend lẫn backend business logic
- CPS cross-entity lookup (media → advertiser receivable) phức tạp, cần backend design
- Cần comprehensive testing
- Không biết CPS formula có đúng với business requirement không
- Significant effort: 1-2 sprints

**Effort:** ~1-2 sprints

**Risk:** **HIGH** — nhiều moving parts, business logic chưa rõ, potential data integrity issues

**Khi nên chọn:**
- Khi product xác nhận CPS và CPA đều là requirement thật
- Khi đã có product spec chi tiết cho CPS (kể cả cross-entity settlement logic)
- Khi có resource cho comprehensive testing

---

### Option D — Tạm thời chỉ fix display, chưa mở nghiệp vụ mới

**Việc cần làm:**
- Không mở CPS/CPA
- Chỉ sửa RATIO frontend display: thêm RATIO branch vào `dataEntryMath.ts`
- Ghi rõ trong code và documentation: CPS/CPA là **PENDING CONFIRMATION**, không phải bug
- Thêm comments rõ ràng tại các block points
- Đồng bộ EntryType definitions
- Không thay đổi backend gì cả

**Ưu điểm:**
- **Effort thấp nhất** — chỉ 1-2 giờ
- Không risk gì — không mở nghiệp vụ mới
- Giải quyết RATIO display issue ngay lập tức
- Cho thời gian xác nhận business trước khi commit effort lớn

**Nhược điểm:**
- CPS/CPA vẫn bị block — không có progress
- Dead code vẫn tồn tại (nhưng đã được label/comment rõ ràng)

**Effort:** ~1-2 giờ

**Risk:** LOW — chỉ display fix, no business logic change

**Khi nên chọn:**
- Khi chưa có xác nhận business về CPS/CPA
- Khi muốn quick win trước, không muốn block sprint
- Khi CPS/CPA có thể là mockup không cần implement

---

## 5. Recommended Option

**Option D (Tạm thời chỉ fix display)** là option ít rủi ro nhất cho hiện tại, với điều kiện **kèm theo investigation tasks rõ ràng** để prepare cho Option B hoặc C sau khi business xác nhận.

**Lý do:**
1. **Chưa có business confirmation** cho CPS/CPA — không nên invest effort lớn khi chưa biết có cần không
2. **RATIO display fix là quick win** — chỉ 1-2 giờ, giải quyết PARTIAL issue ngay
3. **Option A/B/C đều có risk cao hơn** vì cần backend validation/calculation change
4. **Backend đang hoạt động tốt** cho CPM và RATIO — không nên đụng vào khi chưa cần

**Tuy nhiên**, nếu product xác nhận **CPA là real requirement** trong tuần này, **Option B** có thể thực hiện song song — effort tương đối nhỏ, reward lớn hơn.

**Phase tiếp theo sau Option D:**
- Phase 2A: Xác nhận CPS/CPA với business → Option B (nếu CPA confirmed) hoặc Option C (nếu cả CPA + CPS confirmed)
- Phase 2B: "Đã thu" column — chỉ thực hiện khi product xác nhận cần payment tracking

---

## 6. Questions for Business/Product

### Billing Type Confirmation
1. **Hệ thống chính thức cần những billing type nào: CPM, RATIO, CPA, CPS?** (Hoặc chỉ CPM và RATIO?)
2. **RATIO trong backend tương ứng với khái niệm nào trên UI/document?** (Là "tỷ lệ chia" hay "doanh số theo tỷ lệ"?)
3. **CPA trong frontend (`rate × settlement`) có phải là requirement thật không?** Hay chỉ là mock/demo code?
4. **CPS trong v2.pdf ("kế thừa số tiền phải thu thượng nguồn") có cần implement không?**
5. **Công thức CPS chính xác là gì?** Phác thảo: Khi media nhập CPS, system nên:
   - Tự động lấy `advertiser.receivable` làm settlement?
   - Hay user nhập settlement nhưng system tính theo rate khác?

### Reports & Settlement
6. **Các report lợi nhuận (Total Profit, Order Profit) có cần tính CPA/CPS không?** Hay CPA/CPS chỉ là data entry type, không ảnh hưởng report?
7. **"Đã thu" trong AdvQuery (v3.pdf page 4) có cần không?** Đây là trường "số tiền đã thanh toán" — có phải là settlement record không?
8. **"Đã thu" theo ngày, theo advertiser, hay theo settlement period?**

### Calculation & Rounding
9. **Decimal rounding rule là gì?** Làm tròn mấy chữ số thập phân? Ai quyết định?
10. **Nguồn sự thật (single source of truth) của calculation nên nằm ở frontend hay backend?** (Frontend tính display, backend là authoritative)
11. **Có cần show "preview" receivable trước khi save không?** (VD: khi user nhập rate + settlement, frontend tự động hiện computed receivable)

### Technical Context
12. **AdSite.billingMethod hiện tại là String không có enum constraint** — có cần thêm enum/schema validation không?
13. **Downstream payoutRate hiện tại hardcoded 0.8 (ML) và 0.9 (LE)** — đây là constants hay nên lấy từ database/config?
14. **Media entry CPS sẽ dùng advertiser nào làm "thượng nguồn"?** Media có thuộc về nhiều advertiser không?

---

## 7. Technical Next Steps After Decision

### If Option A (CPM + RATIO, cleanup frontend)
1. Thêm RATIO formula vào `dataEntryMath.ts:66-121`
2. Xóa hoặc label rõ `EntryType = 'CPM' | 'CPA' | 'CPS'` — CPA/CPS là dead code
3. Đồng bộ `EntryType` definition giữa `bffTypes.ts` và `dataEntryMath.ts`
4. Thêm comment tại `DataEntry.tsx:231` block point
5. Verify RATIO display hoạt động đúng
6. Test: tạo RATIO media entry, verify display đúng

### If Option B (+ CPA support)
1. Tất cả bước Option A
2. Xác nhận CPA formula: `rate × settlement` hay có khác?
3. Mở rộng backend validation `isIn(['CPM', 'RATIO', 'CPA'])` ở `media.controller.ts` và `media.mapper.ts`
4. Thêm CPA branch vào `dailyInputBatch.workflow.ts` hoặc xác định CPA dùng existing calculation
5. Unblock `isAllowedEntryType()` cho CPA
6. Test end-to-end CPA flow

### If Option C (+ Full CPM + RATIO + CPA + CPS)
1. Tất cả bước Option B
2. Xác nhận CPS business logic với product — cần thiết kế cross-entity lookup
3. Thêm `"CPS"` vào backend validation và schema nếu cần
4. Thiết kế CPS backend calculation: `revenue = advertiser.receivable` hay formula khác?
5. Thêm CPS vào `dailyInputBatch.workflow.ts` (có thể cần join query để lookup upstream receivable)
6. Thêm `billingMethod` vào `DailyInput` model nếu cần track type cho từng entry
7. Unblock `isAllowedEntryType()` cho CPS
8. Update reports nếu CPS cần appear
9. Comprehensive testing cho 4 billing types

### If Option D (+ Display-only RATIO fix)
1. Thêm RATIO branch vào `dataEntryMath.ts` cho media receivable calculation
2. Thêm comment rõ: `// CPS/CPA: PENDING CONFIRMATION — not a bug, blocked by business decision`
3. Đồng bộ EntryType definitions (giống Option A bước 2-3)
4. Ghi lại trong `plans/` decision rằng CPS/CPA là pending confirmation

---

## 8. Files/Evidence

### Frontend
| File | Line | Evidence |
|------|------|----------|
| [frontend/src/lib/dataEntryMath.ts](frontend/src/lib/dataEntryMath.ts) | 1 | `EntryType = 'CPM' \| 'CPA' \| 'CPS'` |
| [frontend/src/lib/dataEntryMath.ts](frontend/src/lib/dataEntryMath.ts) | 66-72 | `calculateAdvertiserReceivable()` — CPA/CPS formulas tồn tại |
| [frontend/src/lib/dataEntryMath.ts](frontend/src/lib/dataEntryMath.ts) | 108-121 | `calculateMediaReceivable()` — NO RATIO branch, returns `''` |
| [frontend/src/pages/DataEntry.tsx](frontend/src/pages/DataEntry.tsx) | 231 | `throw new Error('Only CPM and RATIO are supported.')` — BLOCKS CPA/CPS |
| [frontend/src/pages/DataEntry.tsx](frontend/src/pages/DataEntry.tsx) | 489 | Same block cho MediaDataMgmt |
| [frontend/src/lib/bffTypes.ts](frontend/src/lib/bffTypes.ts) | 2 | `EntryType = 'CPM' \| 'RATIO'` — không có CPA/CPS |

### Backend
| File | Line | Evidence |
|------|------|----------|
| [src/controllers/bff/media.controller.ts](src/controllers/bff/media.controller.ts) | 117 | `isIn(['CPM', 'RATIO'])` — BLOCKS CPA/CPS at validation |
| [src/mappers/bff/media.mapper.ts](src/mappers/bff/media.mapper.ts) | 100 | `billingMethod must be CPM or RATIO` |
| [src/types/index.ts](src/types/index.ts) | 2 | `BillingMethod = "CPM" \| "RATIO"` |
| [src/utils/calculations.ts](src/utils/calculations.ts) | 8-52 | CPM/RATIO formulas — NO CPA/CPS |
| [src/workflows/dailyInputBatch.workflow.ts](src/workflows/dailyInputBatch.workflow.ts) | 145-185 | CPM/RATIO revenue logic — NO CPA/CPS |
| [src/mappers/bff/media.mapper.ts](src/mappers/bff/media.mapper.ts) | 59-68 | `mapAdSiteToMedia` — không map billingMethod ra output |
| [src/controllers/bff/media.controller.ts](src/controllers/bff/media.controller.ts) | 156-160 | Create: `billingMethod === "CPM"` sets currentUnitPrice, else sets currentRatio |

### Schema
| File | Line | Evidence |
|------|------|----------|
| [prisma/schema.prisma](prisma/schema.prisma) | 65 | `billingMethod String` — không có enum constraint |

### Reports
| File | Line | Evidence |
|------|------|----------|
| [src/controllers/bff/report.controller.ts](src/controllers/bff/report.controller.ts) | 30-120 | Advertiser report — có revenue/settlements |
| [src/controllers/bff/report.controller.ts](src/controllers/bff/report.controller.ts) | 121-218 | Media report — có receivable/actualReceived |

### Audit Report Reference
- [plans/business-calculation-audit-report.md](plans/business-calculation-audit-report.md) — Chi tiết đầy đủ tất cả calculations

---

## Summary Box

```
QUICK DECISION NEEDED:
• CPS/CPA là real requirement? → YES → Option B/C | NO → Option D
• "Đã thu" column cần không? → YES → Option B/C + Phase 2 for payment tracking | NO → Option D

LOWEST RISK NOW: Option D (RATIO display fix)
LONG TERM BEST: Option C (full 4-type support) — sau khi business xác nhận CPS/CPA
```