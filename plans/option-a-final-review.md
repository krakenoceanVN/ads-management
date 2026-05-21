# Option A Final Review

## 1. Executive Summary

### Đã hoàn thành

**Option A Phase 1-2 (từ các report trước + session này):**
- 3 TypeScript errors đã fix (BFF_AUTH_TOKEN_CHANGED_EVENT, useAppContext import, Table loading prop)
- Cascade filter AdvertiserList/MediaMgmt (row-level filter + form pre-fill)
- Email validation MediaMgmt (regex + advertiser email check)
- AdvQuery/MediaQuery filter params đã gửi xuống backend (advertiserId, mediaId, adTypeCode)
- In-flight request deduplication cho TotalProfit, OrderProfit, AdvQuery, MediaQuery
- MediaMgmt edit form populate currentUnitPrice/currentRatio từ record
- CSV export đầy đủ cho tất cả management pages
- Media type bổ sung currentUnitPrice/currentRatio fields

### Còn thiếu

- **Cascade filter AdOrder dropdown trong AdvertiserList form** — backend AdOrder là virtual/derived từ AdType, không có advertiserId relation. Frontend không thể cascade-filter AdOrder dropdown theo advertiser đã chọn.
- **CPS data entry** — frontend validate throw `"Only CPM and RATIO supported"`, backend không rõ có xử lý CPS không.
- **Đã thu column trong AdvQuery** — backend không track field này.
- **Email field trong Media form** — CreateMediaInput không có email field, không thể nhập email trực tiếp trong media form.
- **MediaQuery: Tỷ lệ hoàn thành / Tỷ lệ đối soát columns** — không có trong backend response.
- **OrderProfit: Thượng nguồn/Hạ nguồn column separation** — bảng gộp chung, không phân tách theo PDF v3.
- **OpLog pagination UI** — hardcoded pageSize=100, không có page controls.
- **Settings page** — có backend /api/auth/password nhưng frontend không có UI.

### Rủi ro

1. **Media type fields không đồng nhất** — bffTypes Media có currentUnitPrice/currentRatio nhưng MediaDto (backend response) có thể chưa map fields này. Nếu backend không trả về, edit form sẽ rỗng thay vì pre-populated.
2. **Cascade filter illusion** — AdvertiserList có advFilter nhưng cascade chỉ ở mức filter rows + reload orders. AdOrder dropdown trong form vẫn hiển thị TẤT CẢ adTypeCodes vì backend không filter theo advertiser.
3. **In-flight Map leak potential** — nếu request fail và không có cleanup trong finally, Map entry sẽ tồn tại mãi. Hiện tại đã có `.finally()` nhưng error path cần verify đầy đủ.

### Khuyến nghị bước tiếp theo

1. **Xác nhận CPS requirement** — nếu cần CPS, cần backend confirm support và frontend remove throw error.
2. **Backend review Media response** — verify MediaDto/Prisma Media model có trả currentUnitPrice/currentRatio không.
3. **v6.pdf** — nếu đọc được, review để xác định có features mới thuộc v2/v3/v5 scope.
4. **Settings page nhẹ** — nếu product cần, có thể implement change password UI đơn giản (backend đã có endpoint).

---

## 2. Completion Matrix

### Data Entry (v2.pdf)

| # | PDF Module | Requirement | Status | Evidence |
|---|-----------|-------------|--------|----------|
| 1 | AdvEntry | Cột data entry (Ngày, Nhà QC, Đơn QC, ID QC, Loại, Đơn giá, Lượt hiển thị, Doanh thu, Trạng thái) | DONE | DataEntry.tsx:374-398 |
| 2 | AdvEntry | Nút Lưu / Xác nhận / Bỏ xác nhận từng dòng | DONE | DataEntry.tsx:387-396 |
| 3 | AdvEntry | "Xác nhận tất cả" button | DONE | DataEntry.tsx:406 (`confirmAllRows`) |
| 4 | AdvEntry | Công thức tính sẵn trong ô | DONE | dataEntryMath.ts |
| 5 | MediaDataMgmt | Cột data entry (14 cột đầy đủ) | DONE | DataEntry.tsx:622-638 |
| 6 | MediaDataMgmt | Nút Lưu / Xác nhận / Bỏ xác nhận từng dòng | DONE | DataEntry.tsx:653-665 |
| 7 | MediaDataMgmt | "Xác nhận tất cả" button | DONE | DataEntry.tsx:675 (`confirmAllRows`) |
| 8 | MediaDataMgmt | CPS logic (CPM kế thừa thượng nguồn, CPS kế thừa số tiền phải thu) | NEEDS_CONFIRMATION | DataEntry.tsx:489 throw "Only CPM and RATIO supported" |
| 9 | MediaDataMgmt | CSV download | DONE | DataEntry.tsx:568-587 (`downloadMediaCsv`) |

### Reports (v3.pdf)

| # | PDF Module | Requirement | Status | Evidence |
|---|-----------|-------------|--------|----------|
| 10 | TotalProfit | Bảng ngày × advertiser, lợi nhuận tổng, CSV export | DONE | Reports.tsx:215-330 |
| 11 | TotalProfit | Filter tháng | DONE | Reports.tsx:272 |
| 12 | OrderProfit | Bảng doanh thu/chi phí/lợi nhuận/tỷ suất | DONE | Reports.tsx:332-445 |
| 13 | OrderProfit | Filter tháng + business dropdown | DONE | Reports.tsx:384-387 |
| 14 | OrderProfit | In-flight deduplication | DONE | Reports.tsx:42-51 (`loadOrderProfitRows`) |
| 15 | OrderProfit | Thượng nguồn/Hạ nguồn column separation | PARTIAL | Bảng gộp, không phân tách. PDF v3 page 3 yêu cầu 2 phần riêng |
| 16 | OrderProfit | Click column, Hiển thị column | PARTIAL | Code có traffic (Click) nhưng không hiển thị riêng cột "Hiển thị" |
| 17 | AdvQuery | Filter Ngày, Nhà QC, Đơn QC, ID QC, Loại | DONE | Reports.tsx:518-521 |
| 18 | AdvQuery | Gửi filter params xuống backend | DONE | Reports.tsx:469-480 (`loadAdvQueryRows`) |
| 19 | AdvQuery | "Đã thu" column | NEEDS_BACKEND | Backend không track field này |
| 20 | MediaQuery | Filter Ngày, Media, Đơn media, Loại | DONE | Reports.tsx:673-678 |
| 21 | MediaQuery | Gửi filter params xuống backend | DONE | Reports.tsx:636-680 (`loadMediaQueryRows`) |
| 22 | MediaQuery | Tỷ lệ hoàn thành, Tỷ lệ đối soát columns | NEEDS_BACKEND | Backend response không có |
| 23 | MediaQuery | In-flight deduplication | DONE | Reports.tsx:660-693 |
| 24 | Settlement | Advertiser/Media settlement với CSV export | DONE | Settlement.tsx |

### Advertiser/Media Management (v5.pdf)

| # | PDF Module | Requirement | Status | Evidence |
|---|-----------|-------------|--------|----------|
| 25 | AdvertiserList | CRUD đầy đủ | DONE | Advertiser.tsx |
| 26 | AdvertiserList | Cascade filter (advFilter → filter rows) | DONE | Advertiser.tsx:183-184 |
| 27 | AdvertiserList | Reload AdOrders when advFilter changes | DONE | Advertiser.tsx:146-148 |
| 28 | AdvertiserList | Reset adTypeCode when advertiser changes | DONE | Advertiser.tsx:151-161 |
| 29 | AdvertiserList | CSV export | DONE | Advertiser.tsx:260-263 |
| 30 | AdvertiserList | Cascade filter AdOrder dropdown trong form | NEEDS_BACKEND | Backend AdOrder virtual, không filter theo advertiser |
| 31 | AdOrderMgmt | CRUD + filter + CSV | DONE | Advertiser.tsx:330-425 |
| 32 | AdIdMgmt | Read-only table với filter | DONE | Advertiser.tsx:420-500 |
| 33 | MediaMgmt | CRUD đầy đủ | DONE | Media.tsx |
| 34 | MediaMgmt | Cascade filter (upstreamFilter → filter rows + pre-fill form) | DONE | Media.tsx:169-181 |
| 35 | MediaMgmt | Email validation on submit | DONE | Media.tsx:215-220 |
| 36 | MediaMgmt | Edit form pre-populate currentUnitPrice/currentRatio | DONE | Media.tsx:107-108 |
| 37 | MediaMgmt | CSV export | DONE | Media.tsx:260-263 |
| 38 | MediaMgmt | Email field in form | NEEDS_BACKEND | CreateMediaInput không có email field |
| 39 | MediaAdOrderMgmt | Read-only table + CSV | DONE | Media.tsx |
| 40 | MediaIdMgmt | Read-only table + filter + CSV | DONE | Media.tsx |

---

## 3. Remaining Gaps

### Gap 1: AdOrder Cascade Filter trong AdvertiserList Form
- **Impact:** Khi tạo Advertiser mới, dropdown AdTypeCode hiển thị TẤT CẢ loại, không lọc theo advertiser đã chọn. Người dùng có thể chọn sai.
- **Needed decision/API:** Backend cần hỗ trợ `GET /api/bff/ad-types?advertiserId=X` HOẶC frontend maintain client-side mapping advertiser → adTypeCodes từ AdId data đã load.
- **Suggested priority:** P2 — functional gap nhưng work-around có sẵn (cascade ở list level đã OK).

### Gap 2: CPS Data Entry Support
- **Impact:** Nếu business cần nhập CPS, hiện tại frontend throw error và chặn. Backend có thể support nhưng chưa test.
- **Needed decision/API:** Xác nhận business requirement — CPS có cần support không? Nếu có, cần mô tả flow chi tiết (logic tính khác CPM).
- **Suggested priority:** P1 nếu CPS là business requirement thực sự, P3 nếu chỉ là mô tả trên PDF.

### Gap 3: Backend Media Response thiếu currentUnitPrice/currentRatio
- **Impact:** Nếu backend MediaDto không map currentUnitPrice/currentRatio từ Prisma, edit form sẽ rỗng thay vì pre-populated. Cần verify backend mapper.
- **Needed decision/API:** Kiểm tra media.mapper.ts — Prisma Media model có billingPrice.currentUnitPrice/currentRatio không.
- **Suggested priority:** P1 — cần verify vì đây là bug tiềm ẩn nếu backend không trả field này.

### Gap 4: "Đã thu" Column trong AdvQuery
- **Impact:** PDF v3 page 4 yêu cầu column "Đã thu", frontend không có.
- **Needed decision/API:** Backend có track "đã thu" (số tiền đã thanh toán) không? Cần thêm field hay chỉ là display column?
- **Suggested priority:** P3 — không có trong backend response hiện tại.

### Gap 5: MediaQuery Completion/Reconciliation Rate Columns
- **Impact:** PDF v3 page 5 yêu cầu "Tỷ lệ hoàn thành" và "Tỷ lệ đối soát", không có trong backend.
- **Needed decision/API:** Backend có compute và return các tỷ lệ này không? Hay chỉ là công thức tính client-side từ existing data?
- **Suggested priority:** P2 — nếu business cần report đầy đủ theo v3.

### Gap 6: OpLog Pagination UI
- **Impact:** Chỉ load 100 records, không có UI chuyển trang. OpLog có thể có hàng nghìn records.
- **Needed decision/API:** Backend đã hỗ trợ pagination chưa? Cần cursor hay offset-based pagination?
- **Suggested priority:** P2 — có thể cần khi system scale.

### Gap 7: Email Field trong Media Form
- **Impact:** Media form không cho nhập email trực tiếp — chỉ có thể chọn upstream (advertiser), email lấy từ advertiser đó. Muốn override email phải sửa advertiser.
- **Needed decision/API:** Cần thêm email field vào CreateMediaInput/UpdateMediaInput + backend mapper.
- **Suggested priority:** P3 — work-around có (dùng advertiser email).

### Gap 8: OrderProfit Thượng nguồn/Hạ nguồn Separation
- **Impact:** PDF v3 page 3 yêu cầu 2 phần bảng riêng biệt (Thượng nguồn: Doanh thu/Chi phí/Click/Hiển thị; Hạ nguồn: Chi phí QC/Tài khoản/Cá nhân/Tổng). Hiện tại gộp chung 1 bảng.
- **Needed decision/API:** Đây là UI redesign lớn. Cần xác nhận có cần column separation không vì backend OrderProfit response hiện tại chỉ có aggregate data.
- **Suggested priority:** P3 — có thể chỉ là mockup reference, không phải requirement bắt buộc.

---

## 4. Regression/Code Quality Notes

### In-flight request logic
- **TotalProfit, OrderProfit, AdvQuery, MediaQuery** đều có deduplication map. Pattern nhất quán với `.finally()` cleanup.
- **Map key construction** cho AdvQuery và MediaQuery dùng `?? ''` cho optional fields — đúng.
- **Potential issue:** Nếu request throw ngoài `finally()` (ví dụ unhandled rejection), Map entry có thể không cleanup. Ít risk vì tất cả đều có `.finally()`.

### Filter/query params
- **AdvQuery:** advertiserId derive từ rows lookup bằng tên — phụ thuộc vào `filters.advertiser` match đúng tên trong rows. Work OK khi data loaded.
- **MediaQuery:** tương tự với `filters.media` → mediaId.
- **Note:** rowsRef pattern đúng để tránh stale closure, nhưng nếu rows thay đổi (filter date khác) mà getReportParams vẫn dùng rows cũ thì có thể derive sai advertiserId. Tuy nhiên vì rowsRef update mỗi render, effect phụ thuộc vào loadAdvQueryRows (phụ thuộc getReportParams) nên re-run đúng.

### Form validation
- **MediaMgmt email validation:** `isValidEmailForm` check đúng context (`selectedAdvertiser.email`), regex chuẩn. placeholder comment đã xóa.
- **DataEntry type validation:** `isAllowedEntryType` chỉ cho CPM và RATIO — CPS bị block. Đây là design decision chưa xác nhận.

### Edit form pre-populate
- **MediaMgmt edit form:** `mediaFormFromRecord` giờ populate `currentUnitPrice`/`currentRatio` từ record. **Risk:** nếu backend MediaDto không map các field này, form sẽ rỗng. Cần verify backend.
- **AdvertiserList edit form:** `advertiserFormFromRecord` chỉ populate name/adTypeCode/status, không populate gì khác — đúng vì Advertiser không có price/ratio fields.

### Duplicate/dead code
- **`csvEscape` function:** tồn tại riêng trong mỗi page file (Reports.tsx, Media.tsx, Advertiser.tsx, DataEntry.tsx). Đây là acceptable duplication vì mỗi page có output format riêng. Không có cross-file dead code.
- **`getMedia` import ở Media.tsx:** đã thêm import nhưng chưa gọi trực tiếp trong code hiện tại (vì listMedia trả đủ data). Import dead weight nhưng không gây lỗi.
- **Placeholder comment Media.tsx:** đã xóa ✓.

---

## 5. Verification

### TypeScript

| Check | Result | Notes |
|-------|--------|-------|
| Backend `npx tsc --noEmit` | ✓ PASS | 0 errors |
| Frontend `npx tsc --noEmit` | ✓ PASS | 0 errors |

### Build

| Check | Result | Notes |
|-------|--------|-------|
| `npm run build` | ✓ PASS | 301.39KB JS, 10.31s (1.82s last run) |

### Lint

- Không có `npm run lint` script trong package.json. Không thể chạy lint check.

### Notes

- Build lần đầu (sau các thay đổi): 10.31s
- Build lần sau (re-run verify): 1.82s — có thể do Vite cache
- Tất cả thay đổi phase 1-2 không gây regression TypeScript hoặc build

---

## 6. Recommended Next Phase

### Option A: Xác nhận và fix Media edit form backend gap
**Effort:** < 1h review + 1h potential fix

- Verify backend `media.mapper.ts` / Prisma `Media` model có map `currentUnitPrice`/`currentRatio` không
- Nếu có → không cần làm gì
- Nếu không → backend cần add mapping, frontend đã ready

### Option B: CPS business requirement confirmation
**Effort:** < 30 phút xác nhận + 2-4h implementation nếu confirmed

- Hỏi product/stakeholder: CPS có phải là requirement thực sự không?
- Nếu có: backend cần confirm support + frontend remove throw error + implement logic
- Nếu không: đánh dấu DONE (out of scope)

### Option C: v6.pdf review
**Effort:** < 1h nếu đọc được

- v6.pdf hiện tại không đọc được (6 trang 4K image)
- Nếu user có bản text/PDF đọc được khác → review có features nào thuộc v2/v3/v5 scope không
- Nếu không có → bỏ qua

### Option D: Backend cascade relation for AdOrder (low priority)
**Effort:** 2-3h

- Backend cần endpoint `GET /api/bff/ad-types?advertiserId=X` hoặc Advertiser → AdType mapping
- Frontend dùng endpoint để cascade-filter AdTypeCode dropdown trong AdvertiserList form
- Có thể implement client-side mapping từ AdId data nếu backend không support

### Không khuyến nghị (out of scope v4.pdf):
- Dashboard theo v4 (campaign-centric, khác hẳn hệ thống hiện tại)
- Campaign/Ad Group Management theo v4
- Data Import từ Google/Facebook (backend không có, business requirement chưa rõ)