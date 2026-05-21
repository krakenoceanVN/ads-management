# Option A Implementation Report — Phase 2

## 1. Tóm tắt

| Hạng mục | Trạng thái |
|-----------|-----------|
| In-flight request deduplication | Hoàn thành |
| MediaMgmt edit form populate price/ratio | Hoàn thành |
| MediaMgmt placeholder comment cleanup | Hoàn thành |
| Backend type/build | ✓ `npx tsc --noEmit` — 0 errors |
| Frontend type/build | ✓ `npm run build` — 301.39KB JS, 10.31s |

---

## 2. Chi tiết từng thay đổi

### 2.1 In-flight request deduplication cho Reports

**File:** [frontend/src/pages/Reports.tsx](frontend/src/pages/Reports.tsx)

**Thêm 3 maps mới:**
```typescript
const orderProfitInFlight = new Map<string, Promise<OrderProfitReportRow[]>>();
const advQueryInFlight = new Map<string, Promise<AdvertiserEntryRow[]>>();
const mediaQueryInFlight = new Map<string, Promise<MediaEntryRow[]>>();
```

**OrderProfit** — Thêm `loadOrderProfitRows()` wrapper:
```typescript
function loadOrderProfitRows(date: string, adTypeCode?: string) {
  const key = `${date}:${adTypeCode ?? ''}`;
  const existing = orderProfitInFlight.get(key);
  if (existing) return existing;
  const request = getOrderProfitReport({ date, adTypeCode }).finally(() => {
    orderProfitInFlight.delete(key);
  });
  orderProfitInFlight.set(key, request);
  return request;
}
```
Effect gọi `loadOrderProfitRows(date, business || undefined)` thay vì `getOrderProfitReport(...)` trực tiếp.

**AdvQuery** — Thêm `loadAdvQueryRows()` wrapper:
```typescript
const loadAdvQueryRows = React.useCallback(() => {
  const params = getReportParams();
  const key = `${params.date}:${params.status}:${params.advertiserId ?? ''}:${params.adTypeCode ?? ''}`;
  const existing = advQueryInFlight.get(key);
  if (existing) return existing;
  const request = getAdvertiserReport(params).finally(() => {
    advQueryInFlight.delete(key);
  });
  advQueryInFlight.set(key, request);
  return request;
}, [getReportParams]);
```
Effect gọi `loadAdvQueryRows()` thay vì `getAdvertiserReport(getReportParams())` trực tiếp.

**MediaQuery** — Thêm `loadMediaQueryRows()` wrapper:
```typescript
const loadMediaQueryRows = React.useCallback(() => {
  const params = getReportParams();
  const key = `${params.date}:${params.status}:${params.mediaId ?? ''}:${params.adTypeCode ?? ''}`;
  const existing = mediaQueryInFlight.get(key);
  if (existing) return existing;
  const request = getMediaReport(params).finally(() => {
    mediaQueryInFlight.delete(key);
  });
  mediaQueryInFlight.set(key, request);
  return request;
}, [getReportParams]);
```
Effect gọi `loadMediaQueryRows()` thay vì `getMediaReport(getReportParams())` trực tiếp.

**Pattern:** cùng pattern với `totalProfitInFlight` đã có sẵn — Map key → Promise, reuse cho cùng request, cleanup trong finally.

### 2.2 MediaMgmt edit form — populate currentUnitPrice/currentRatio

**File:** [frontend/src/pages/Media.tsx](frontend/src/pages/Media.tsx#L102-L110)

**Thêm import:**
```typescript
import { getMedia, ... } from '../lib/bffApi';
```

**Thay đổi `mediaFormFromRecord()`:**
```typescript
function mediaFormFromRecord(record: Media, fallbackUpstreamId = ''): MediaFormState {
  return {
    name: record.name ?? '',
    upstreamId: String(record.upstreamId ?? fallbackUpstreamId),
    billingMethod: record.billingMethod ?? 'CPM',
    currentUnitPrice: record.currentUnitPrice != null ? String(record.currentUnitPrice) : '',
    currentRatio: record.currentRatio != null ? String(record.currentRatio) : '',
    status: record.status ?? 'active',
  };
}
```
Trước đây luôn rỗng `''`. Giờ populate từ record.

**Thêm field vào Media type:**

[frontend/src/lib/bffTypes.ts:76-77](frontend/src/lib/bffTypes.ts#L76-L77)
```typescript
currentUnitPrice?: number;
currentRatio?: number;
```

**Note:** `getMedia(id)` đã tồn tại trong bffApi.ts — chỉ cần thêm import và sửa `mediaFormFromRecord`. Không cần gọi API mới vì `listMedia()` đã trả đầy đủ data (backend trả Media full record từ Prisma).

### 2.3 MediaMgmt submitForm — xóa placeholder comment

**File:** [frontend/src/pages/Media.tsx](frontend/src/pages/Media.tsx#L208-L217)

**Xóa:**
```typescript
if (!isValidEmailForm(form.upstreamId)) {
  // Note: upstreamId is advertiser select, not email — email comes from advertisers list
  // This is a placeholder; actual email validation is handled below
}
```
Đoạn này là dead code — `isValidEmailForm` check sai context (`upstreamId` là ID advertiser, không phải email). Validation email thực tế nằm ở `selectedAdvertiser.email` check phía dưới đã đúng.

---

## 3. Kết quả kiểm tra

| Lệnh | Kết quả |
|------|---------|
| `npx tsc --noEmit` (backend) | ✓ 0 errors |
| `npx tsc --noEmit` (frontend) | ✓ 0 errors |
| `npm run build` (frontend) | ✓ 301.39KB JS, 10.31s |

---

## 4. Commit suggestion

```
feat: add in-flight request deduplication for all report pages

- OrderProfit: add orderProfitInFlight Map, loadOrderProfitRows wrapper
- AdvQuery: add advQueryInFlight Map, loadAdvQueryRows wrapper
- MediaQuery: add mediaQueryInFlight Map, loadMediaQueryRows wrapper
- MediaMgmt: populate currentUnitPrice/currentRatio from record in edit form
- MediaMgmt: remove dead placeholder email validation comment
- Media type: add currentUnitPrice and currentRatio optional fields
```

---

## 5. Các item đã hoàn thành trong session này

| # | Item | PDF ref | File |
|---|------|---------|------|
| 1 | In-flight deduplication OrderProfit | P2 | Reports.tsx |
| 2 | In-flight deduplication AdvQuery | P2 | Reports.tsx |
| 3 | In-flight deduplication MediaQuery | P2 | Reports.tsx |
| 4 | MediaMgmt edit form pre-populate price/ratio | P1 | Media.tsx + bffTypes.ts |
| 5 | Remove MediaMgmt placeholder comment | Cleanup | Media.tsx |

---

## 6. Các item còn lại từ audit (NOT in this session)

### NEEDS_BACKEND items (cần backend thay đổi):
- **Cascade filter AdOrder dropdown** — backend cần `GET /api/bff/ad-orders?advertiserId=X` hoặc frontend maintain client-side mapping
- **CPS data entry support** — code validate throw "Only CPM and RATIO supported"
- **"Đã thu" column in AdvQuery** — backend không track field này
- **Email field trong Media form** — CreateMediaInput không có email field

### UI/STATE items (ít impact, low priority):
- **OpLog pagination UI** — hardcoded pageSize=100, không có page controls
- **"Xác nhận tất cả" button** — đã có `confirmAllRows` function, không rõ UI đã đủ chưa
- **Settings page** — có backend `/api/auth/password`, frontend không có UI
- **OrderProfit column separation** — Thượng nguồn/Hạ nguồn columns không trong spec hiện tại
- **MediaQuery completion/reconciliation rate columns** — tương tự, không có trong backend response

### Items bỏ qua (v4.pdf - campaign-centric, not in scope):
- Dashboard, Campaign Management, Ad Group Management, Ad Management, Data Import