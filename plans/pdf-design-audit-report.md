# PDF Design vs Frontend Code Audit Report
**Branch:** 110526 | **Commits:** `ddd5172` (Phase 1-2), `9367112` (OpLog fix)

---

## 1. Tóm tắt nhanh

| Metric | Số lượng |
|--------|----------|
| PDF tìm thấy | 6 (v1–v6) |
| Trang đọc được text | 18 trang (v2: 3, v3: 5, v5: 9 + v1/v4/v6 đã convert PNG) |
| Trang là ảnh/screenshot | 30 trang (v1: 14, v4: 10, v6: 6) |
| Màn hình trong PDF | ~25 màn hình |
| Route/page frontend kiểm tra | 15 route |
| **[DONE]** | 9 |
| **[PARTIAL]** | 5 |
| **[MISSING_FRONTEND]** | 7 |
| **[UI_ONLY]** | 2 |
| **[DIFFERENT_DESIGN]** | 3 (v1/v4 không liên quan) |
| **[UNKNOWN]** | 2 |
| TypeScript errors | 3 (pre-existing) |
| Lint warnings | GlobalModal deprecated + 10 alert() dead code |

---

## 2. Danh sách PDF đã phân tích

### v1.pdf — 14 trang (toàn ảnh/screenshot)
- **Nội dung:** Login (Trung Quốc), Advertiser List, Media Management grid, Partner Management, User Management
- **Đọc text được:** Không (100% ảnh)
- **Có cần OCR/Vision:** Có — agent đọc được qua PNG đã convert
- **Phát hiện:** Thiết kế **KHÔNG liên quan** đến hệ thống hiện tại. Logo "AdsManage", công ty "Beijing Lituo", sidebar có Dashboard/Tổng quan/Chiến dịch/Nhóm QC/Quảng cáo/Báo cáo/Nhập liệu/Cài đặt — hoàn toàn khác cấu trúc menu.
- **Vấn đề:** Chỉ có thể đọc từng ảnh riêng lẻ, không trích xuất text tự động được.

### v2.pdf — 3 trang (text đầy đủ)
- **Trang 1:** Ghi chú v2.0 — chỉnh sửa giao diện ngày 2026-05-12
- **Trang 2:** Nhập dữ liệu QC (Advertiser Data Entry) — bảng với cột: Ngày, Quảng cáo, Đơn hàng QC, ID QC, Loại, Đơn giá/Số click, Lượt hiển thị, Dữ liệu đối soát, Số tiền phải thu, Trạng thái, nút "Xác nhận", "Xác nhận tất cả"
- **Trang 3:** Nhập dữ liệu media — bảng với cột: Ngày, Media, Đơn hàng media, ID media, Loại, Đơn giá/Số click, Dữ liệu đối soát, Dữ liệu tính, Tỷ lệ, Chi phí media, Tỷ lệ chia, Số tiền phải trả, Trạng thái
- **Ghi chú:** Công thức tính sẵn trong ô, khi loại CPM thì kế thừa dữ liệu kế toán thượng nguồn, khi CPS thì kế thừa số tiền phải thu thượng nguồn

### v3.pdf — 5 trang (text đầy đủ)
- **Trang 1:** Ghi chú v3.0 — chỉnh sửa ngày 2026-05-13
- **Trang 2:** Báo cáo tổng lợi nhuận — bảng ngày với các cột Lâm tổng, Qianwen, Bách hóa, 360, iQIYI; footer tổng cộng 465,000
- **Trang 3:** LN đơn quảng cáo — bảng với filter: Ngày, Nhà QC, Đơn QC, ID QC, Loại; các cột: Thượng nguồn (Doanh thu/Chi phí/Click/Hiển thị) và Hạ nguồn (Chi phí QC/Tài khoản/Cá nhân/Tổng)
- **Trang 4:** Truy vấn dữ liệu nhà quảng cáo — filter theo Ngày, Nhà QC, Đơn QC, ID QC, Loại, Cách tính, Trạng thái; bảng: Ngày, Nhà QC, Quảng cáo, Loại, ID đơn, Đơn giá/click, Số tiêu hao, Phải thu/Tiền QC, Đã thu, Trạng thái
- **Trang 5:** Truy vấn dữ liệu media — tương tự nhưng cho media, thêm cột Tỷ lệ hoàn thành, Tỷ lệ đối soát, Tiền kết toán

### v4.pdf — 10 trang (toàn ảnh)
- **Nội dung:** Dashboard (Trang chủ), Quản lý chiến dịch, Quản lý nhóm quảng cáo, Quản lý quảng cáo, Nhập liệu (import history), Settings, Login modal
- **Menu sidebar:** Trang chủ, Tổng quan, Quản lý chiến dịch, Quản lý nhóm quảng cáo, Quản lý quảng cáo, Báo cáo, Nhập liệu, Cài đặt
- **Đặc điểm:** Blue accent sidebar, footer bản quyền "KrakenOcean"
- **Phát hiện:** Thiết kế **KHÔNG liên quan** trực tiếp đến hệ thống hiện tại. Đây là mockup cho một hệ thống quản lý chiến dịch quảng cáo khác (campaign-centric chứ không phải advertiser/media-centric).

### v5.pdf — 9 trang (mixed text + ảnh chú thích)
- **Trang 1:** Ghi chú v5.0 — chỉnh sửa ngày 2026-05-15
- **Trang 2-3:** Quản lý nhà quảng cáo — sửa tìm kiếm theo cấp (cascade filter): chọn Nhà QC → danh sách Đơn QC tự lọc → chọn Loại tự lọc theo đơn đã chọn
- **Trang 4:** Quản lý lưu lượng — tham khảo mục 1.1.1
- **Trang 5:** Bổ sung kiểm tra định dạng email khi tạo media
- **Trang 6:** Khi tạo mới ID media, đổi trường "vị trí quảng cáo" thành "ID quảng cáo" và bổ sung phần lọc ID quảng cáo; ID đã chọn không hiển thị trong danh sách
- **Trang 7-9:** Nhập dữ liệu media — sửa tìm kiếm cascade theo mục 1.1.1

### v6.pdf — 6 trang (toàn ảnh)
- **Nội dung:** Không đọc được (agent không render được ảnh PNG)
- **Kích thước:** 6 ảnh 4K (3840x2160)
- **Có thể chứa:** Giao diện bổ sung hoặc chi tiết hơn cho một số màn hình

---

## 3. Frontend hiện tại

- **Framework:** React 18 + TypeScript + Vite
- **Routing:** Custom state-based (AppContext.currentPage), switch/case trong App.tsx, KHÔNG dùng React Router
- **Main routes/pages:**
  ```
  pAdvertiserList  → AdvertiserList (CRUD advertiser)
  pAdOrderMgmt     → AdOrderMgmt     (CRUD ad order)
  pAdIdMgmt        → AdIdMgmt        (read-only ad ID list)
  pMediaMgmt        → MediaMgmt        (CRUD media)
  pMediaAdOrderMgmt → MediaAdOrderMgmt (read-only media ad orders)
  pMediaIdMgmt      → MediaIdMgmt     (read-only media IDs)
  pAiEntry          → AiEntry         (locked, placeholder)
  pAdvEntry         → AdvEntry        (advertiser data entry + save/confirm/unconfirm)
  pMediaDataMgmt    → MediaDataMgmt   (media data entry + save/confirm/unconfirm)
  pTotalProfit      → TotalProfit     (report)
  pOrderProfit      → OrderProfit     (report)
  pAdvQuery         → AdvQuery        (report)
  pMediaQuery       → MediaQuery      (report)
  pAdvSettlement    → AdvSettlement   (settlement - feature flag)
  pMediaSettlement  → MediaSettlement (settlement - feature flag)
  mOpLog            → OpLog           (operation log)
  ```
- **Component structure:**
  - `pages/` — 7 file: Login, Advertiser, Media, DataEntry, Reports, Settlement, System
  - `components/` — 5 file: Sidebar, Topbar, Table, DatePickerInput, GlobalModal (deprecated)
  - `lib/` — bffApi.ts, bffTypes.ts, data.ts, i18n.ts, dataEntryMath.ts, date.ts, featureFlags.ts
- **API layer:** BFF adapter pattern — frontend gọi `/api/bff/*`, backend controller chuyển đổi giữa BFF model và Prisma model
- **UI/styling:** CSS thuần (index.css), CSS-in-JS inline, className truyền thống
- **State/fetching:** React useState/useCallback, KHÔNG dùng React Query/SWR

---

## 4. Mapping PDF → Frontend

### 4.1 Nhóm: Nhập liệu (Data Entry)

#### Nhập dữ liệu QC (Advertiser Data Entry) — v2.pdf, page 2
- **Trạng thái:** [DONE]
- **Frontend route/component:** `pAdvEntry` → `AdvEntry` trong [DataEntry.tsx](frontend/src/pages/DataEntry.tsx)
- **Backend/API:** POST `/api/bff/data-entry/advertisers/batch`, POST `/api/bff/data-entry/advertisers/confirm-batch`
- **PDF yêu cầu:** Nhập ngày, advertiser, đơn QC, ID QC, loại (CPM/CPS), đơn giá, lượt hiển thị, số tiền phải thu, nút "Xác nhận", "Xác nhận tất cả", công thức tính sẵn trong ô
- **Hiện trạng code:** Tương ứng 1-1. Cột data-entry gồm: Ngày, Nhà QC, Đơn QC, ID QC, Loại, Đơn giá, Lượt hiển thị, Doanh thu, Trạng thái. Có nút Lưu, Xác nhận, Bỏ xác nhận. Công thức tính nằm trong `dataEntryMath.ts`.
- **Thiếu/lệch:**
  - PDF có cột "Số tiền phải thu" — code có cột "settlement" (tiền phải thu) ✓
  - PDF có "Xác nhận tất cả" button — code KHÔNG có nút xác nhận tất cả trên toolbar, chỉ có confirm từng dòng
  - PDF: dữ liệu đối soát = đơn giá × lượt hiển thị — code: revenue = cpm × traffic × coefficient
- **Bằng chứng:** Code [DataEntry.tsx:387-389](frontend/src/pages/DataEntry.tsx#L387) — input cells cho rate, traffic, settlement

---

#### Nhập dữ liệu media — v2.pdf, page 3
- **Trạng thái:** [DONE]
- **Frontend route/component:** `pMediaDataMgmt` → `MediaDataMgmt` trong [DataEntry.tsx](frontend/src/pages/DataEntry.tsx)
- **Backend/API:** POST `/api/bff/data-entry/media/batch`, POST `/api/bff/data-entry/media/confirm-batch`
- **PDF yêu cầu:** Tương tự advertiser nhưng thêm cột: Tỷ lệ, Chi phí media, Tỷ lệ chia, Số tiền phải trả. Có 2 loại: CPM kế thừa dữ liệu kế toán thượng nguồn, CPS kế thừa số tiền phải thu thượng nguồn.
- **Hiện trạng code:** Có đầy đủ cột rate, traffic, settlement, dataCoefficient (tỷ lệ). Nút Lưu, Xác nhận, Bỏ xác nhận.
- **Thiếu/lệch:**
  - PDF có "Chi phí media" — code gọi là "settlement" (cùng ý nghĩa) ✓
  - PDF có 2 loại CPS/CPM xử lý khác nhau — code chỉ hỗ trợ CPM và RATIO theo validation tại [DataEntry.tsx:231](frontend/src/pages/DataEntry.tsx#L231)
  - PDF: "Xác nhận tất cả" — code không có
  - CPS support: PDF mô tả logic CPS nhưng code validation từ chối CPS type
- **Bằng chứng:** [DataEntry.tsx:489](frontend/src/pages/DataEntry.tsx#L489) — `if (!isAllowedEntryType(row.type)) throw new Error('Only CPM and RATIO are supported.')`

---

### 4.2 Nhóm: Báo cáo (Reports)

#### Báo cáo tổng lợi nhuận — v3.pdf, page 2
- **Trạng thái:** [DONE]
- **Frontend route/component:** `pTotalProfit` → `TotalProfit` trong [Reports.tsx](frontend/src/pages/Reports.tsx)
- **Backend/API:** GET `/api/bff/reports/total-profit`
- **PDF yêu cầu:** Bảng ngày × advertiser với số liệu lợi nhuận tổng
- **Hiện trạng code:** Chọn tháng, hiển thị bảng với các cột ngày và advertiser, có CSV export ✓
- **Thiếu/lệch:** Không thấy khác biệt lớn

---

#### LN đơn quảng cáo — v3.pdf, page 3
- **Trạng thái:** [PARTIAL]
- **Frontend route/component:** `pOrderProfit` → `OrderProfit` trong [Reports.tsx](frontend/src/pages/Reports.tsx)
- **Backend/API:** GET `/api/bff/reports/order-profit`
- **PDF yêu cầu:** Filter: Ngày, Nhà QC, Đơn QC, ID QC, Loại. Bảng có phần Thượng nguồn (Doanh thu, Chi phí, Click, Hiển thị) và Hạ nguồn (Chi phí QC, Tài khoản, Cá nhân, Tổng).
- **Hiện trạng code:**
  - Filter theo tháng, advertiser — có ✓
  - Bảng có: doanh thu, chi phí, lợi nhuận, tỷ suất — có ✓
  - Không có phân chia Thượng nguồn/Hạ nguồn rõ ràng trong UI
- **Thiếu/lệch:**
  - PDF: column "Click" — code có traffic ✓
  - PDF: column "Hiển thị" — code không hiển thị riêng
  - PDF: phân tách Thượng nguồn/Hạ nguồn — code gộp chung
- **Bằng chứng:** [Reports.tsx:330-390](frontend/src/pages/Reports.tsx#L330) — OrderProfit component

---

#### Truy vấn dữ liệu nhà quảng cáo — v3.pdf, page 4
- **Trạng thái:** [PARTIAL]
- **Frontend route/component:** `pAdvQuery` → `AdvQuery` trong [Reports.tsx](frontend/src/pages/Reports.tsx)
- **Backend/API:** GET `/api/bff/reports/advertisers`
- **PDF yêu cầu:** Filter: Ngày, Nhà QC, Đơn QC, ID QC, Loại, Cách tính, Trạng thái. Bảng: Ngày, Nhà QC, Quảng cáo, Loại, ID đơn, Đơn giá/click, Số tiêu hao, Phải thu/Tiền QC, Đã thu, Trạng thái.
- **Hiện trạng code:**
  - Filter: Ngày, trạng thái — có ✓
  - Filter: Nhà QC, Đơn QC, Loại — UI có dropdown nhưng **KHÔNG truyền xuống backend** (API gap — xem section 6)
- **Thiếu/lệch:**
  - PDF: filter Cách tính — code UI không có filter này
  - PDF: cột "Đã thu" — code không có
  - PDF: cột "ID đơn" format "123|123456" — code hiển thị adTypeCode
- **Bằng chứng:** [Reports.tsx:433](frontend/src/pages/Reports.tsx#L433) — `getAdvertiserReport({ date, status })` thiếu advertiserId, adTypeCode

---

#### Truy vấn dữ liệu media — v3.pdf, page 5
- **Trạng thái:** [PARTIAL]
- **Frontend route/component:** `pMediaQuery` → `MediaQuery` trong [Reports.tsx](frontend/src/pages/Reports.tsx)
- **Backend/API:** GET `/api/bff/reports/media`
- **PDF yêu cầu:** Tương tự advertiser query nhưng thêm cột: Tỷ lệ hoàn thành, Tỷ lệ đối soát, Tiền kết toán.
- **Hiện trạng code:**
  - Filter: Ngày, trạng thái — có ✓
  - Filter: Media, Đơn media, Loại — UI có dropdown nhưng **KHÔNG truyền xuống backend**
- **Thiếu/lệch:**
  - PDF: cột "Tỷ lệ hoàn thành", "Tỷ lệ đối soát" — code không có
  - PDF: cột "Tiền kết toán" — code có settlement amount ✓
- **Bằng chứng:** [Reports.tsx:580](frontend/src/pages/Reports.tsx#L580) — `getMediaReport({ date, status })` thiếu mediaId, adTypeCode

---

### 4.3 Nhóm: Quản lý (Management)

#### Quản lý nhà quảng cáo (Advertiser CRUD) — v5.pdf, page 2-3
- **Trạng thái:** [DONE]
- **Frontend route/component:** `pAdvertiserList` → `AdvertiserList` trong [Advertiser.tsx](frontend/src/pages/Advertiser.tsx)
- **Backend/API:** GET/POST/PUT/DELETE `/api/bff/advertisers`
- **PDF yêu cầu (v5.0):** Tìm kiếm theo cấp (cascade): chọn Nhà QC → danh sách Đơn QC tự lọc → chọn Loại tự lọc
- **Hiện trạng code:**
  - Advertiser CRUD: đầy đủ ✓
  - Cascade filter: KHÔNG CÓ — filter độc lập không cascade
  - Search: tìm kiếm fuzzy theo tên ✓
  - Export CSV: mới thêm gần đây ✓
- **Thiếu/lệch:**
  - PDF v5.0 yêu cầu cascade filter — code chỉ có single-field search/filter
  - PDF: Import button — code KHÔNG có
  - PDF: cột "ID", "Ngày tạo", "Trạng thái" — code có ✓
- **Bằng chứng:** [Advertiser.tsx](frontend/src/pages/Advertiser.tsx) — AdvertiserList chỉ có `search` state, không có cascade filter

---

#### Quản lý đơn hàng QC (Ad Order CRUD) — v5.pdf, page 2
- **Trạng thái:** [DONE]
- **Frontend route/component:** `pAdOrderMgmt` → `AdOrderMgmt` trong [Advertiser.tsx](frontend/src/pages/Advertiser.tsx)
- **Backend/API:** GET/POST/PUT/DELETE `/api/bff/ad-orders`
- **PDF yêu cầu:** Nằm trong module quản lý nhà quảng cáo, tương tự advertiser filter cascade
- **Hiện trạng code:** CRUD đầy đủ, filter theo advertiser dropdown, export CSV mới thêm ✓
- **Thiếu/lệch:** Không cascade filter giống advertiser

---

#### Quản lý ID QC (Ad ID read-only) — v5.pdf, page 6
- **Trạng thái:** [DONE]
- **Frontend route/component:** `pAdIdMgmt` → `AdIdMgmt` trong [Advertiser.tsx](frontend/src/pages/Advertiser.tsx)
- **Backend/API:** GET `/api/bff/ad-ids`
- **PDF yêu cầu:** (v5.0) Đổi trường "vị trí quảng cáo" thành "ID quảng cáo" khi tạo mới AdId
- **Hiện trạng code:** Read-only table. Filter theo advertiser và ad order. Link đến số lượng AdId per order.
- **Thiếu/lệch:** PDF yêu cầu đổi tên label — không rõ đã thực hiện chưa (cần check thực tế)

---

#### Quản lý media — v5.pdf, page 5
- **Trạng thái:** [DONE]
- **Frontend route/component:** `pMediaMgmt` → `MediaMgmt` trong [Media.tsx](frontend/src/pages/Media.tsx)
- **Backend/API:** GET/POST/PUT/DELETE `/api/bff/media`
- **PDF yêu cầu (v5.0):** Bổ sung kiểm tra định dạng email
- **Hiện trạng code:** CRUD đầy đủ. Export CSV mới thêm. Email validation — **KHÔNG THẤY** trong code.
- **Thiếu/lệch:**
  - PDF: email validation — code KHÔNG có email format validation khi tạo media
- **Bằng chứng:** [Media.tsx:172-185](frontend/src/pages/Media.tsx#L172) — `buildPayload()` không validate email format

---

#### Quản lý đơn hàng media — v5.pdf, page 4
- **Trạng thái:** [DONE]
- **Frontend route/component:** `pMediaAdOrderMgmt` → `MediaAdOrderMgmt` trong [Media.tsx](frontend/src/pages/Media.tsx)
- **Backend/API:** GET `/api/bff/ad-orders` (media ad orders)
- **Hiện trạng code:** Read-only table với số lượng media ID per order. Export CSV mới thêm ✓
- **Thiếu/lệch:** Không cascade filter giống v5.0 requirement

---

#### Quản lý ID media — v5.pdf, page 6
- **Trạng thái:** [DONE]
- **Frontend route/component:** `pMediaIdMgmt` → `MediaIdMgmt` trong [Media.tsx](frontend/src/pages/Media.tsx)
- **Backend/API:** GET `/api/bff/media-ids`
- **PDF yêu cầu (v5.0):** Đổi trường "vị trí quảng cáo" thành "ID quảng cáo". Bổ sung phần lọc ID quảng cáo. ID đã chọn không hiển thị trong danh sách.
- **Hiện trạng code:** Read-only table với filter dropdown (media/ad order/type). Export CSV mới thêm ✓
- **Thiếu/lệch:**
  - PDF: ID đã chọn không hiển thị trong dropdown — code KHÔNG có logic này
  - PDF: đổi label "vị trí quảng cáo" → "ID quảng cáo" — cần kiểm tra thực tế

---

### 4.4 Nhóm: Settlement (Đối soát)

#### Đơn kết toán Advertiser — v3.pdf (có đề cập trong menu)
- **Trạng thái:** [DONE]
- **Frontend route/component:** `pAdvSettlement` → `AdvSettlement` trong [Settlement.tsx](frontend/src/pages/Settlement.tsx)
- **Backend/API:** GET `/api/bff/settlement/advertisers?advertiserId=&startDate=&endDate=`
- **PDF yêu cầu:** Default period = current month, filter theo advertiser, export CSV
- **Hiện trạng code:** Đầy đủ ✓ Filter advertiser, date range, CSV export

---

#### Đơn kết toán Media — v3.pdf
- **Trạng thái:** [DONE]
- **Frontend route/component:** `pMediaSettlement` → `MediaSettlement` trong [Settlement.tsx](frontend/src/pages/Settlement.tsx)
- **Backend/API:** GET `/api/bff/settlement/media?mediaId=&startDate=&endDate=`
- **Hiện trạng code:** Đầy đủ ✓

---

### 4.5 Nhóm: Nhật ký thao tác (Operation Log)

#### Nhật ký thao tác — v2.pdf, v3.pdf (menu item)
- **Trạng thái:** [DONE]
- **Frontend route/component:** `mOpLog` → `OpLog` trong [System.tsx](frontend/src/pages/System.tsx)
- **Backend/API:** GET `/api/bff/operation-logs?startDate=&endDate=&keyword=&module=&action=&pageSize=100`
- **PDF yêu cầu:** Hiển thị log với thời gian, người thao tác, module, hành động, chi tiết
- **Hiện trạng code:** Có đầy đủ filter theo ngày, keyword, module, action. Data loaded từ BFF.
- **Thiếu/lệch:**
  - PDF không mô tả chi tiết UI log — nhưng code có vẻ đầy đủ
  - **Pagination:** Hardcoded `pageSize: 100` tại [System.tsx:39](frontend/src/pages/System.tsx#L39) — không có UI để chọn page hoặc load more

---

### 4.6 Nhóm: Các màn hình KHÔNG có trong frontend hiện tại

#### Dashboard / Trang chủ — v4.pdf, page 1
- **Trạng thái:** [MISSING_FRONTEND]
- **PDF mô tả:** Trang chủ với stats cards (Tổng chiến dịch, Chiến dịch đang chạy, Tổng chi phí, CP xem), line chart chi phí theo ngày, bảng Hoạt động gần đây
- **Frontend hiện tại:** KHÔNG có dashboard riêng. Khi login redirect vào AdvertiserList.
- **Backend:** Có data trong các bảng nhưng không có endpoint dashboard chuyên dụng
- **Gợi ý:** Cần tạo route mới `pDashboard` với BFF endpoint `/api/bff/dashboard` nếu cần

---

#### Quản lý chiến dịch (Campaign Management) — v4.pdf, page 2
- **Trạng thái:** [MISSING_FRONTEND]
- **PDF mô tả:** CRUD campaigns với bảng: Tên, Tài khoản, Ngân sách, Chi phí, Trạng thái, Ngày bắt đầu/kết thúc. Sidebar có: Trang chủ, Tổng quan, Quản lý chiến dịch, Nhóm QC, Quảng cáo, Báo cáo, Nhập liệu, Cài đặt.
- **Frontend hiện tại:** KHÔNG có. Hệ thống hiện tại quản lý Advertiser/Media không phải campaign-centric.
- **Nhận xét:** Đây là design của hệ thống **KHÁC** (campaign-centric với blue sidebar), không phải phiên bản advertiser/media-centric của hệ thống hiện tại.

---

#### Quản lý nhóm quảng cáo (Ad Group Management) — v4.pdf, page 3
- **Trạng thái:** [MISSING_FRONTEND]
- **PDF mô tả:** CRUD ad groups với breadcrumb: Chiến dịch > Nhóm QC > Quảng cáo
- **Frontend hiện tại:** KHÔNG có cấu trúc campaign → ad group → ad
- **Nhận xét:** Cùng design system với campaign management — hệ thống khác

---

#### Quản lý quảng cáo (Ad Management) — v4.pdf, page 4
- **Trạng thái:** [MISSING_FRONTEND]
- **Frontend hiện tại:** KHÔNG có
- **Nhận xét:** Hệ thống khác (campaign-centric)

---

#### Nhập liệu (Import Data / Sync) — v4.pdf, page 5
- **Trạng thái:** [MISSING_FRONTEND]
- **PDF mô tả:** Bảng import history với Ngày, Tài khoản, Loại nhập, Số bản ghi, Trạng thái. Nút "+ Nhập dữ liệu" (import từ nền tảng quảng cáo như Google, Facebook).
- **Frontend hiện tại:** KHÔNG có chức năng import/sync tự động từ các nền tảng quảng cáo
- **Nhận xét:** Hệ thống hiện tại nhập liệu thủ công (manual data entry), không có import tự động

---

#### Cài đặt (Settings) — v4.pdf, page 10
- **Trạng thái:** [MISSING_FRONTEND]
- **PDF mô tả:** Username, Email, Language, Timezone, Change Password
- **Frontend hiện tại:** KHÔNG có trang Settings. Chỉ có thay đổi ngôn ngữ (lang state trong AppContext).
- **Backend:** Có route `/api/auth/password` (change password) — nhưng frontend không gọi

---

#### Partner Management (Quản lý đối tác) — v1.pdf, page 12
- **Trạng thái:** [MISSING_FRONTEND]
- **PDF mô tả:** Bảng đối tác với: Tên, Địa chỉ, Điện thoại, Email, Trạng thái, Thao tác. Modal thêm/sửa đối tác.
- **Frontend hiện tại:** KHÔNG có trang Partner Management
- **Nhận xét:** Một phần của hệ thống v1.pdf (thiết kế cũ)

---

#### User Management (Quản lý người dùng) — v1.pdf, page 13
- **Trạng thái:** [MISSING_FRONTEND]
- **PDF mô tả:** Bảng user với: Username, Họ tên, Email, Điện thoại, Vai trò, Trạng thái, Thao tác. Roles: Quản trị viên, Người dùng, Marketing, Kế toán.
- **Frontend hiện tại:** KHÔNG có trang User Management. Chỉ có login. Vai trò hiện chỉ hardcoded là "Admin" trong Sidebar.
- **Backend:** Có các user management route nhưng chưa kết nối frontend

---

### 4.7 Nhóm: Có UI nhưng chưa kết nối API

#### Export CSV — 5 trang — v5.pdf (note có export)
- **Trạng thái:** [DONE] — đã fix gần đây
- **Frontend:** AdvertiserList, AdOrderMgmt, MediaMgmt, MediaAdOrderMgmt, MediaIdMgmt đều đã có export CSV handler
- **Trước đây:** [UI_ONLY] — button tồn tại nhưng không có onClick handler

---

## 5. Danh sách chức năng/action cần chú ý

### 5.1 Filter/Cascade — Chưa có cascade filter (theo v5.0)
- **Màn hình:** AdvertiserList, MediaMgmt, AdvEntry, MediaDataMgmt
- **Mức độ:** P1
- **Trạng thái:** [MISSING_FRONTEND]
- **File liên quan:** Advertiser.tsx, Media.tsx, DataEntry.tsx
- **Cần:** Cascade filter (chọn advertiser → lọc ad orders → lọc loại)

### 5.2 Email Validation — Chưa validate email format
- **Màn hình:** MediaMgmt (khi tạo/sửa media)
- **Mức độ:** P2
- **Trạng thái:** [MISSING_FRONTEND]
- **File liên quan:** [Media.tsx:172](frontend/src/pages/Media.tsx#L172)
- **Cần:** Backend validation hoặc frontend regex check

### 5.3 Import/Sync tự động — Chưa có
- **Màn hình:** Nhập liệu (Data Import theo v4.pdf)
- **Mức độ:** P0 (business requirement)
- **Trạng thái:** [MISSING_FRONTEND] + [NEEDS_BACKEND]
- **Cần:** Backend endpoint cho import từ Google/Facebook/other ad platforms

### 5.4 Dashboard — Chưa có
- **Màn hình:** Dashboard / Trang chủ
- **Mức độ:** P1
- **Trạng thái:** [MISSING_FRONTEND]
- **Cần:** BFF endpoint + React component

### 5.5 Settings/User Management/Partner Management
- **Mức độ:** P2/P3
- **Trạng thái:** [MISSING_FRONTEND]
- **Note:** Có thể là design của hệ thống cũ, không trong scope hiện tại

### 5.6 CPS Data Entry — Không hỗ trợ đầy đủ
- **Màn hình:** AdvEntry, MediaDataMgmt
- **Mức độ:** P1
- **Trạng thái:** [PARTIAL]
- **File liên quan:** [DataEntry.tsx:231](frontend/src/pages/DataEntry.tsx#L231)
- **Cần:** Xác nhận lại business requirement — PDF mô tả CPS nhưng code chỉ hỗ trợ CPM và RATIO

### 5.7 Pagination UI cho Operation Log
- **Màn hình:** mOpLog
- **Mức độ:** P2
- **Trạng thái:** [PARTIAL]
- **File liên quan:** [System.tsx:39](frontend/src/pages/System.tsx#L39)
- **Cần:** Backend hỗ trợ pagination (cursor/page), frontend thêm UI

---

## 6. Backend/API đối chiếu

### 6.1 API frontend đang gọi

| Method | Endpoint | Frontend file | Backend tồn tại | Mismatch |
|--------|----------|---------------|-----------------|-----------|
| POST | `/api/auth/login` | Login.tsx | ✓ | — |
| GET | `/api/bff/advertisers` | Advertiser.tsx | ✓ | — |
| POST | `/api/bff/advertisers` | Advertiser.tsx | ✓ | — |
| PUT | `/api/bff/advertisers/:id` | Advertiser.tsx | ✓ | — |
| DELETE | `/api/bff/advertisers/:id` | Advertiser.tsx | ✓ | — |
| GET | `/api/bff/media` | Media.tsx | ✓ | — |
| POST | `/api/bff/media` | Media.tsx | ✓ | — |
| PUT | `/api/bff/media/:id` | Media.tsx | ✓ | — |
| DELETE | `/api/bff/media/:id` | Media.tsx | ✓ | — |
| GET | `/api/bff/ad-orders` | Advertiser.tsx, Media.tsx | ✓ | — |
| GET | `/api/bff/ad-ids` | Advertiser.tsx | ✓ | — |
| GET | `/api/bff/media-ids` | Media.tsx | ✓ | — |
| GET | `/api/bff/data-entry/advertisers` | DataEntry.tsx | ✓ | — |
| POST | `/api/bff/data-entry/advertisers/batch` | DataEntry.tsx | ✓ | — |
| POST | `/api/bff/data-entry/advertisers/confirm-batch` | DataEntry.tsx | ✓ | — |
| PUT | `/api/bff/data-entry/advertisers/:id/unconfirm` | DataEntry.tsx | ✓ | — |
| GET | `/api/bff/data-entry/media` | DataEntry.tsx | ✓ | — |
| POST | `/api/bff/data-entry/media/batch` | DataEntry.tsx | ✓ | — |
| POST | `/api/bff/data-entry/media/confirm-batch` | DataEntry.tsx | ✓ | — |
| PUT | `/api/bff/data-entry/media/:id/unconfirm` | DataEntry.tsx | ✓ | — |
| GET | `/api/bff/reports/total-profit` | Reports.tsx | ✓ | — |
| GET | `/api/bff/reports/order-profit` | Reports.tsx | ✓ | — |
| GET | `/api/bff/reports/advertisers` | Reports.tsx | ✓ | **Có — thiếu filter params** |
| GET | `/api/bff/reports/media` | Reports.tsx | ✓ | **Có — thiếu filter params** |
| GET | `/api/bff/settlement/advertisers` | Settlement.tsx | ✓ | — |
| GET | `/api/bff/settlement/media` | Settlement.tsx | ✓ | — |
| GET | `/api/bff/operation-logs` | System.tsx | ✓ | — |

### 6.2 API frontend gọi thiếu filter params (P1)

- **GET `/api/bff/reports/advertisers`:** [Reports.tsx:433](frontend/src/pages/Reports.tsx#L433) — chỉ gọi `getAdvertiserReport({ date, status })`, THIẾU `advertiserId`, `adTypeCode` dù backend hỗ trợ
- **GET `/api/bff/reports/media`:** [Reports.tsx:580](frontend/src/pages/Reports.tsx#L580) — chỉ gọi `getMediaReport({ date, status })`, THIẾU `mediaId`, `adTypeCode` dù backend hỗ trợ

### 6.3 Backend endpoint có sẵn nhưng frontend chưa dùng

- **GET `/api/bff/advertisers/:id`** — frontend có hàm `getAdvertiser(id)` trong bffApi.ts nhưng KHÔNG gọi ở đâu cả. MediaMgmt edit form không pre-populate current price/ratio.
- **GET `/api/bff/media/:id`** — tương tự, có hàm nhưng không dùng
- **POST/PUT/DELETE `/api/bff/ad-ids`** — backend trả error "not implemented" vì AdId được quản lý qua Media downstream
- **POST/PUT/DELETE `/api/bff/media-ids`** — backend trả error "not implemented"
- **PUT `/api/auth/password`** — có endpoint đổi password nhưng frontend không có UI

---

## 7. TODO / Mock / Placeholder / Stub tìm thấy

| Keyword | File:line | Nội dung | Chức năng liên quan | Mức ảnh hưởng |
|---------|-----------|----------|---------------------|---------------|
| `alert(` | GlobalModal.tsx:145-260 (10 instances) | `alert(t('advertiserName') + '?')` v.v. | DEPRECATED GlobalModal — không mount | Low (dead code) |
| `BFF_AUTH_TOKEN_CHANGED_EVENT` | App.tsx:84 (undefined constant) | Missing import of `BFF_AUTH_TOKEN_CHANGED_EVENT` | Login token event dispatch | Medium (runtime error if login fires) |
| `useAppContext` | GlobalModal.tsx:55 | `import { useAppContext }` nhưng GlobalModal không dùng AppContext | DEPRECATED component | Low (dead code) |
| `loading` prop | System.tsx:101 | Table nhận `loading` prop nhưng Table component không có prop này | OpLog page | Medium (TypeScript error, runtime ignored) |
| `Not implemented` | adId.controller.ts:126,138,150 | AdId POST/PUT/DELETE returns error message | AdId management | Low (by design) |
| `Not implemented` | mediaId.controller.ts:155,170,183 | MediaId POST/PUT/DELETE returns error message | MediaId management | Low (by design) |
| `placeholder` | DatePickerInput.tsx:7 | `placeholder?: string` prop type | DatePickerInput | Low (legitimate prop) |
| `Only CPM and RATIO` | DataEntry.tsx:231,489 | `throw new Error('Only CPM and RATIO are supported.')` | Data entry validation | Medium (CPS blocked at frontend) |
| `hardcoded` comment | dashboard.ts:228,462 | `// Look up AdType ID from database instead of hardcoded map` | Dashboard | Low (TODO comment in backend) |

---

## 8. Ưu tiên triển khai lượt 2

### P0 — Cần sửa trước

1. **BFF_AUTH_TOKEN_CHANGED_EVENT missing in App.tsx**
   - **Lý do:** Compile error, runtime sẽ crash khi login thành công
   - **File:** [App.tsx:84](frontend/src/App.tsx#L84)
   - **Cần backend:** Không
   - **Effort:** S (1 dòng import)

2. **Table `loading` prop type mismatch in System.tsx**
   - **Lý do:** TypeScript error rõ ràng, prop bị ignore ở runtime
   - **File:** [System.tsx:101](frontend/src/pages/System.tsx#L101)
   - **Cần backend:** Không
   - **Effort:** S (thêm prop vào Table component hoặc bỏ khỏi OpLog)

3. **AdvQuery/MediaQuery filter params không gửi xuống backend**
   - **Lý do:** Filter dropdown có UI nhưng không hoạt động — user chọn advertiserId filter nhưng backend không nhận được
   - **File:** [Reports.tsx:433](frontend/src/pages/Reports.tsx#L433), [Reports.tsx:580](frontend/src/pages/Reports.tsx#L580)
   - **Cần backend:** Không (backend đã hỗ trợ params)
   - **Effort:** S (thêm advertiserId/mediaId vào API call)

### P1 — Chức năng quan trọng còn thiếu

4. **Cascade filter (theo v5.0)**
   - **Lý do:** PDF v5.0 yêu cầu rõ: chọn Nhà QC → danh sách Đơn QC tự lọc → chọn Loại tự lọc. Hiện tại filter độc lập.
   - **File:** Advertiser.tsx (3 pages), Media.tsx (3 pages), DataEntry.tsx
   - **Cần backend:** Không (frontend logic thuần)
   - **Effort:** M (cần thay đổi state management)

5. **MediaMgmt edit form không populate current price/ratio**
   - **Lý do:** Khi edit media, form không hiển thị giá trị hiện tại của billingMethod, unitPrice, ratio
   - **File:** [Media.tsx:70](frontend/src/pages/Media.tsx#L70) — `mediaFormFromRecord()`
   - **Cần backend:** Có — GET `/api/bff/media/:id`
   - **Effort:** S (gọi getMedia trước khi mở form)

6. **CPS data entry support**
   - **Lý do:** PDF v2 mô tả logic CPS khác với CPM, nhưng frontend validation từ chối CPS type
   - **File:** [DataEntry.tsx:231](frontend/src/pages/DataEntry.tsx#L231), [DataEntry.tsx:489](frontend/src/pages/DataEntry.tsx#L489)
   - **Cần xác nhận:** Đây là by design hay thiếu sót? Backend có xử lý CPS không?
   - **Effort:** M (cần business decision)

7. **OperationLog pagination UI**
   - **Lý do:** Chỉ load 100 records, không có UI chuyển trang
   - **File:** [System.tsx:39](frontend/src/pages/System.tsx#L39)
   - **Cần backend:** Có — backend cần hỗ trợ cursor-based pagination
   - **Effort:** M

### P2 — Hoàn thiện UX/state

8. **Email validation khi tạo/sửa media**
   - **File:** [Media.tsx:172](frontend/src/pages/Media.tsx#L172)
   - **Effort:** S

9. **"Xác nhận tất cả" button**
   - **Lý do:** PDF v2 mô tả nút "Xác nhận tất cả" trên toolbar data entry
   - **File:** DataEntry.tsx (AdvEntry, MediaDataMgmt)
   - **Effort:** S

10. **In-flight request prevention cho OrderProfit, AdvQuery, MediaQuery**
    - **Lý do:** TotalProfit có deduplication map, các report khác thì không
    - **File:** [Reports.tsx](frontend/src/pages/Reports.tsx)
    - **Effort:** S

### P3 — Cleanup/polish

11. **GlobalModal alert() calls — xóa dead code**
    - **File:** [GlobalModal.tsx:145-260](frontend/src/components/GlobalModal.tsx#L145)
    - **Effort:** S (xóa file hoặc ít nhất xóa các alert())

12. **Partner Management + User Management — xác nhận scope**
    - **Lý do:** Các trang này xuất hiện trong v1.pdf nhưng có vẻ là thiết kế hệ thống cũ. Cần xác nhận có nằm trong scope không.

13. **Settings page — có thể cần**
    - **File:** MISSING
    - **Cần backend:** Có — `/api/auth/password` đã tồn tại

---

## 9. Kết luận

### 3-5 khoảng trống lớn nhất

1. **TypeScript compile errors (3 lỗi):** `BFF_AUTH_TOKEN_CHANGED_EVENT` missing import, `useAppContext` unused import in GlobalModal, `loading` prop type mismatch — cần fix trước khi build

2. **API filter params không được gửi:** AdvQuery và MediaQuery có filter UI (dropdown) nhưng không truyền xuống backend — filter không hoạt động

3. **Hệ thống campaign-centric (v4.pdf) hoàn toàn khác:** Dashboard, Campaign Management, Ad Group Management, Ad Management, Data Import, Settings trong v4.pdf không có trong frontend hiện tại. Đây là **2 thiết kế khác nhau** — cần xác nhận đâu là design chính thức.

4. **Missing global features:** Import/Sync tự động từ ad platforms, Dashboard, Settings, Partner Management, User Management — tất cả đều không có trong frontend hiện tại

5. **Cascade filter chưa implement:** v5.0 rõ ràng yêu cầu cascade filter (cascade dropdown) nhưng code chỉ có independent filter

### Thứ tự implement đề xuất

1. Fix 3 TypeScript errors (P0, < 30 phút)
2. Fix AdvQuery/MediaQuery filter params (P0, < 30 phút)
3. Fix MediaMgmt edit form pre-populate (P1, < 1 giờ)
4. Cascade filter (P1, 2-3 giờ)
5. Confirm "Xác nhận tất cả" + CPS decision (P1)
6. OperationLog pagination UI (P2)
7. Remaining P2/P3 items

### Câu hỏi cần hỏi trước khi code

1. **v4.pdf (campaign-centric) vs v2/v3 (advertiser/media-centric):** Đâu là design chính thức? Hai bộ design này mô tả 2 hệ thống khác nhau hoàn toàn.

2. **CPS data entry:** Có cần hỗ trợ CPS type không? Backend đã xử lý CPS chưa? Nếu có, cần mô tả flow chi tiết vì logic tính CPS khác CPM.

3. **Partner Management / User Management:** Có nằm trong scope không? Nếu có, cần API endpoint và chi tiết field.

4. **"Xác nhận tất cả" button:** Có cần thiết không hay chỉ confirm từng dòng?

5. **Import/Sync tự động:** Có cần tính năng import từ Google/Facebook/other platforms không? Nếu có, cần thiết kế chi tiết.

---

## Phụ lục: Chi tiết lỗi TypeScript

```
src/App.tsx(84,36): error TS2304: Cannot find name 'BFF_AUTH_TOKEN_CHANGED_EVENT'.
  → App.tsx imports BFF_AUTH_TOKEN_INVALID_EVENT nhưng dùng BFF_AUTH_TOKEN_CHANGED_EVENT
  → Fix: Thêm BFF_AUTH_TOKEN_CHANGED_EVENT vào import từ bffApi.ts

src/components/GlobalModal.tsx(55,84): error TS2304: Cannot find name 'useAppContext'.
  → GlobalModal đã deprecated, không mount, import không dùng
  → Fix: Xóa import hoặc xóa file

src/pages/System.tsx(101,11): error TS2322: Type 'loading' does not exist on TableProps<OpLogRow>
  → Table component (Table.tsx:10) không định nghĩa prop `loading`
  → Fix: Thêm `loading?: boolean` vào TableProps hoặc bỏ prop khỏi System.tsx
```