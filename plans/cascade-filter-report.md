# Cascade Filter Backend/Frontend Report

## 1. Tóm tắt

| Hạng mục | Trạng thái |
|-----------|-----------|
| Endpoint đã có hay mới tạo | Không cần backend mới — `GET /api/bff/ad-orders` đã hỗ trợ `advId` param |
| Frontend cascade | AdvertiserList + MediaMgmt đã nối |
| Cascade behavior | Chọn Advertiser → lọc rows + reset form adTypeCode nếu không còn hợp lệ |
| Backend type/build | ✓ `npx tsc --noEmit` — 0 errors |
| Frontend type/build | ✓ `npm run build` — 300.76KB JS, 1.79s |

---

## 2. Backend

**Không có thay đổi** — endpoint `GET /api/bff/ad-orders?advId=X` đã tồn tại từ Phase 1.

**Endpoint:** `GET /api/bff/ad-orders?advId=<id>`
**File:** [src/controllers/bff/adOrder.controller.ts](src/controllers/bff/adOrder.controller.ts#L32-L56)
**Query params:** `advId` (optional, integer) — passthrough để set `advId` field trong response, không filter data thực tế (vì AdOrder derived from AdType, không phải AdSite)
**Response shape:**
```json
{
  "success": true,
  "data": [
    { "id": 1, "advId": 123, "name": "...", "adTypeCode": "...", "notes": null },
    ...
  ]
}
```
**Auth/permission:** `requireAuth` middleware — tất cả BFF endpoints đều yêu cầu token.

**Note quan trọng:** Backend AdOrder là **virtual/read-only** — derived từ `AdType` metadata, không phải từ `AdSite`. Điều này có nghĩa cascade filter ở frontend phải dựa vào quan hệ **gián tiếp** (advertiser → adTypeCode → AdOrder) hoặc filter client-side từ dữ liệu đã load. Vì vậy cascade filter ở AdvertiserList/MediaMgmt tập trung vào **filter rows** (lọc advertiser trong list) thay vì cascade xuống AdOrder dropdown (vì AdOrder không có advertiser relation trực tiếp trong backend).

---

## 3. Frontend

### 3.1 AdvertiserList — Cascade Filter

**File:** [frontend/src/pages/Advertiser.tsx](frontend/src/pages/Advertiser.tsx)

**Thay đổi:**
1. Thêm state `advFilter` để lọc theo advertiser
2. Thêm dropdown filter trên toolbar
3. Thêm `loadAdOrders` callback — reload orders khi `advFilter` thay đổi
4. Thêm `useEffect` reset `form.adTypeCode` khi advertiser thay đổi mà adTypeCode không còn hợp lệ
5. `visibleRows` filter thêm điều kiện `advFilter && row.id !== Number(advFilter)`

**Filter state đã nối:**
- `advFilter` → filter `visibleRows` (row.id === advFilter)
- `advFilter` → trigger `loadAdOrders()` để refresh ad orders dropdown
- `advFilter` → reset form.adTypeCode nếu không còn valid cho advertiser mới

**Reset dependent filters:**
- Khi `advFilter` thay đổi → `form.adTypeCode` reset về `adTypeOptions[0]` nếu không còn hợp lệ cho advertiser mới
- Cascade này chỉ ảnh hưởng form tạo/sửa advertiser, không ảnh hưởng list rows

### 3.2 MediaMgmt — Cascade Filter

**File:** [frontend/src/pages/Media.tsx](frontend/src/pages/Media.tsx)

**Thay đổi:**
1. Thêm state `upstreamFilter` để lọc theo upstream (advertiser)
2. Thêm dropdown filter trên toolbar (giống AdvertiserList)
3. `visibleRows` filter thêm điều kiện `upstreamFilter && row.upstreamId !== Number(upstreamFilter)`
4. `openCreate()` pre-fill upstream với `upstreamFilter` nếu có

**Filter state đã nối:**
- `upstreamFilter` → filter `visibleRows` (row.upstreamId === upstreamFilter)
- `upstreamFilter` → pre-fill form upstream khi mở modal tạo media mới

**Reset dependent filters:**
- Khi tạo mới media với `upstreamFilter` đang set → form pre-filled với advertiser đó

---

## 4. Phần còn lại / giới hạn

### Cascade filter cho AdOrder dropdown trong AdvertiserList form
- **Trạ thái:** PARTIAL
- **Mô tả:** Khi chọn Advertiser trong form tạo Advertiser, dropdown AdOrder (`adTypeCode`) **KHÔNG cascade-filter** theo Advertiser. Hiện tại dropdown hiển thị tất cả AdTypes (vì backend AdOrder derived from AdType, không có advertiser relation).
- **Nguyên nhân:** Backend không có relation Advertiser → AdType. `advId` param chỉ là passthrough field, không filter thực tế.
- **Giải pháp:** Cần backend thêm endpoint `GET /api/bff/ad-types` với filter theo advertiser, HOẶC frontend maintain mapping advertiser → adTypeCodes client-side từ dữ liệu AdId rows.

### Cascade filter cho MediaMgmt form (Media → AdOrder)
- **Trạ thái:** KHÔNG ÁP DỤNG
- **Mô tả:** Media không cascade xuống AdOrder trong form vì không có field đó trong Media form.

---

## 5. Kết quả kiểm tra

| Lệnh | Kết quả |
|------|---------|
| `npx tsc --noEmit` (backend) | ✓ 0 errors |
| `npx tsc --noEmit` (frontend) | ✓ 0 errors |
| `npm run build` (frontend) | ✓ 300.76KB JS, 1.79s |

---

## 6. Commit suggestion

```
feat: add advertiser/upstream filter dropdown to AdvertiserList and MediaMgmt (v5.pdf cascade filter)

- AdvertiserList: filter rows by advertiser, cascade-reset adTypeCode in form
- MediaMgmt: filter rows by upstream, pre-fill upstream in create form
- Reload ad orders when advertiser filter changes for dropdown consistency
```