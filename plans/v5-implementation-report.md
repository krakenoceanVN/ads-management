# v5.pdf Implementation Report

## 1. Tóm tắt

| Hạng mục | Trạng thái |
|-----------|-----------|
| AdvQuery filter params → backend | Hoàn thành |
| MediaQuery filter params → backend | Hoàn thành |
| Email validation (MediaMgmt) | Hoàn thành |
| Cascade filter | [NEEDS_BACKEND] — phân tích bên dưới |
| Media ID label/display | Không cần thay đổi (đã đúng thiết kế) |
| Typecheck | ✓ PASS (`npx tsc --noEmit`) |
| Build | ✓ PASS (`npm run build` — 299.91KB JS) |
| Lint | Không có lint script |

---

## 2. File đã sửa

### `frontend/src/pages/Reports.tsx` — AdvQuery

**Thay đổi:** Nối `advertiserId` và `adTypeCode` từ filter state vào API call `getAdvertiserReport()`.

**Lý do:** Backend `GET /api/bff/reports/advertisers` hỗ trợ params `advertiserId` và `adTypeCode` (report.controller.ts:42-43) nhưng frontend chỉ gọi `{ date, status }`. Giờ gọi đúng `{ date, status, advertiserId, adTypeCode }`.

**Cụ thể:**
- Thêm `getReportParams()` dùng `useCallback` để derive `advertiserId` từ `filters.advertiser` bằng cách tìm row đầu tiên có `advertiser` = filter value, lấy `advertiserId` của nó.
- `adTypeCode` = `filters.adId` (vì PDF filter `ID QC` tương ứng `adTypeCode`).
- Dùng `rowsRef` để tránh stale closure mà không gây effect loop.
- `useEffect` phụ thuộc `getReportParams` (thay vì chỉ `filters.date/status`) để refetch khi filter thay đổi.

### `frontend/src/pages/Reports.tsx` — MediaQuery

**Thay đổi:** Tương tự AdvQuery, nối `mediaId` và `adTypeCode` vào `getMediaReport()`.

**Lý do:** Backend `GET /api/bff/reports/media` hỗ trợ params `mediaId` và `adTypeCode` (report.controller.ts:129-130) nhưng frontend không truyền.

**Cụ thể:**
- `mediaId` = tìm từ rows bằng `filters.media` (tên media).
- `adTypeCode` = `filters.mediaId` (filter ID trong PDF).

### `frontend/src/pages/Media.tsx` — Email validation

**Thay đổi:** Thêm `isValidEmailForm()` pattern và validation trong `submitForm()`.

**Lý do:** v5.pdf page 5 yêu cầu "Bổ sung kiểm tra định dạng email" khi tạo mới media.

**Cụ thể:**
- Thêm `isValidEmailForm(value: string)` với regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`.
- Rule: email rỗng → cho phép (optional field). Email không hợp lệ → chặn submit + hiện lỗi.
- Validation check trên `selectedAdvertiser.email` — khi chọn advertiser làm upstream, nếu advertiser đó có email không hợp lệ thì báo lỗi trước khi submit.

---

## 3. Chi tiết theo hạng mục

### 3.1 Cascade filter

**Phân tích:** v5.pdf yêu cầu cascade filter (chọn Nhà QC → danh sách Đơn QC tự lọc → chọn Loại tự lọc). Tuy nhiên, kiểm tra data model hiện tại:

**Quan hệ hiện có:**
- `AdOrder` có `advertiserId` (belongs to Advertiser) và `adTypeCode` (belongs to AdType)
- `AdId` có `advertiserId` và `adTypeCode` (join key)
- Media → upstream (Advertiser) → không có direct AdOrder relation

**Vấn đề:**
- Trong `AdIdMgmt`: cascade filter `advFilter → orderFilter → typeFilter` **ĐÃ CÓ** — khi chọn Advertiser, orderOptions được lọc theo `advertiserScopedRows` (Ads that belong to the selected Advertiser have certain adTypeCodes, and orders with those codes are shown).
- Trong `MediaIdMgmt`: tương tự cascade filter đã có `mediaFilter → orderFilter → typeFilter`.
- Tuy nhiên, cascade filter trong AdvertiserList và MediaMgmt **KHÔNG CÓ** — vì các trang này là CRUD list, không phải lookup list với dependent filters.
- MediaMgmt form không có cascade (form chỉ chọn upstream = advertiser, không cascade sang ad order).

**Kết luận:** Cascade filter **cần implement** cho AdvertiserList và MediaMgmt (nếu cần), nhưng **cần backend hỗ trợ** `GET /api/bff/ad-orders?advertiserId=X` để chỉ lấy orders của advertiser đó thay vì load tất cả. Hiện tại frontend load all và filter client-side — cascade vẫn hoạt động được nhưng **cần đảm bảo data relation đủ** (AdOrder.advId → Advertiser.id).

→ Đánh dấu: **NEEDS_BACKEND** — backend cần endpoint filter theo advertiserId cho AdOrders nếu muốn cascade thực sự server-side, hoặc xác nhận client-side cascade đã đủ.

### 3.2 Email validation

- **Form đã cập nhật:** MediaMgmt → submitForm()
- **Rule validation:** Email optional; nếu có phải match `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
- **Error message:** `t('invalidEmail') || 'Email không hợp lệ'` (khóa submit)
- **Validation trigger:** Khi chọn advertiser làm upstream, kiểm tra `selectedAdvertiser.email`
- **Vấn đề phát hiện:** Media form hiện tại KHÔNG có field nhập email — chỉ chọn upstream (advertiser), không nhập trực tiếp email. Validation check trên advertiser.email là hợp lý cho UX: nếu advertiser đó có email không hợp lệ trong database, sẽ được cảnh báo. Nếu muốn nhập email trực tiếp trong form media, cần thêm field → **NEEDS_BACKEND** (CreateMediaInput không có email field).

### 3.3 Media ID label/display

v5.pdf page 6 yêu cầu đổi "vị trí quảng cáo" → "ID quảng cáo" khi tạo mới MediaId. Kiểm tra:

- `MediaIdMgmt` column label đang là `t('mediaId')` = "ID media" → đúng.
- Form tạo MediaId không tồn tại trong UI (MediaIdMgmt là read-only, MediaId được tạo qua downstream). Không có modal form tạo media ID trong frontend.
- `AdIdMgmt` column label là `t('adId')` = "ID QC" → đúng.

→ **Không cần thay đổi** — label đã đúng.

### 3.4 AdvQuery/MediaQuery filter params

**Filter đã gửi xuống backend:**

| Filter | AdvQuery | MediaQuery |
|--------|----------|------------|
| date | ✓ | ✓ |
| status | ✓ | ✓ |
| advertiserId | ✓ (từ `filters.advertiser`) | ✗ |
| mediaId | ✗ | ✓ (từ `filters.media`) |
| adTypeCode | ✓ (từ `filters.adId`) | ✓ (từ `filters.mediaId`) |

**Backend đã hỗ trợ:** `advertiserId`, `mediaId`, `adTypeCode` — tất cả các params đều được backend chấp nhận.

**Chưa gửi:**
- `filters.advertiser` → `advertiserId` ✓ (đã fix)
- `filters.media` → `mediaId` ✓ (đã fix)

**Lưu ý:** Việc derive ID từ tên (client-side lookup) hoạt động vì backend trả đầy đủ data, frontend tìm ID tương ứng rồi gửi lại cho backend filter. Pattern này chấp nhận được khi data set nhỏ.

---

## 4. Kết quả kiểm tra

| Lệnh | Kết quả |
|------|---------|
| `npx tsc --noEmit` | ✓ 0 errors |
| `npm run build` | ✓ built in 8.60s, 299.91KB JS |

---

## 5. Commit suggestion

```
feat: pass advertiserId/adTypeCode filter to AdvQuery/MediaQuery backend

- Derive advertiserId from filter state to send server-side filter
- Derive mediaId similarly for MediaQuery
- Add email format validation on MediaMgmt submit (v5.pdf)
- Use rowsRef pattern to avoid stale closure in report effects
```

---

## 6. Phụ lục: NEEDS_BACKEND items

| Item | Mô tả | Backend cần |
|------|-------|-------------|
| Cascade filter cho AdvertiserList/MediaMgmt | Chọn Advertiser → lọc Ad Orders theo advertiser | `GET /api/bff/ad-orders?advertiserId=X` endpoint |
| Email field trong Media form | Nhập email trực tiếp trong media form, không phải từ advertiser lookup | `CreateMediaInput` thêm `email?` field + backend mapper |
| CPS data entry support | v2.pdf mô tả CPS logic, code hiện tại từ chối CPS | Xác nhận business requirement trước |
| Import/sync tự động | v4.pdf có Data Import, hệ thống hiện tại không có | Backend import pipeline từ Google/Facebook |