# Frontend ↔ Backend Audit Report

## 1. Tóm tắt nhanh

- **Tổng số màn hình/routes kiểm tra:** 16 page chính (Sidebar menu)
- **Tổng số chức năng kiểm tra:** ~70 action/handler riêng biệt
- **Đã hoạt động đầy đủ:** ~45
- **Chưa nối backend / UI-only filter:** 3
- **Dùng mock/static data:** 1 (legacy initialDb, không ảnh hưởng user)
- **API mismatch:** 0 (không có mismatch endpoint)
- **Handler rỗng/chưa implement:** 1 (AiEntry — cố tình lock)
- **Backend có sẵn nhưng frontend chưa nối:** 0
- **Build/type/lint status:**
  - `npx tsc --noEmit` backend: PASS
  - `npm run build` backend: PASS
  - `cd frontend && npm run build`: PASS

---

## 2. Danh sách chức năng theo màn hình

### `AdvertiserList` — `pAdvertiserList`
File: `frontend/src/pages/Advertiser.tsx:76`

| # | Chức năng | Trạng thái | Bằng chứng |
|---|-----------|------------|------------|
| 1 | Load danh sách advertiser khi mount | [OK] | `loadRows()` → `listAdvertisers()` → `bffApi.ts:151` |
| 2 | Search filter (realtime) | [OK] | `normalizeText(search)` + `rows.filter()` tại `:117-122` |
| 3 | Tạo mới advertiser (button + modal) | [OK] | `openCreate()` → `submitForm()` → `createAdvertiser()` → `bffApi.ts:158` |
| 4 | Sửa advertiser (onEdit + modal) | [OK] | `openEdit()` → `submitForm()` → `updateAdvertiser()` → `bffApi.ts:165` |
| 5 | Xóa advertiser (with confirm) | [OK] | `removeRecord()` → `window.confirm()` + `deleteAdvertiser()` → `bffApi.ts:172` |
| 6 | Toggle status (active/inactive) | [OK] | `StatusToggle` → `updateStatus()` → `updateAdvertiser()` với `{ status: 'active'|'inactive' }` tại `:183-191` |
| 7 | AdType dropdown trong form populate từ API | [OK] | `listAdOrders()` → `adTypeOptions` tại `:89-95` |
| 8 | Loading state | [OK] | `<LoadingState />` khi `loading=true` tại `:201` |
| 9 | Error state + Retry button | [OK] | `<ErrorState message={error} onRetry={loadRows} />` tại `:201` |
| 10 | CSV Export | [MISSING_BACKEND] | Button "Export" **chưa có handler** — không gọi API, không export gì cả |

**Giải thích item 10:** Tại `:198` có button `{t('export')}` nhưng **không có `onClick` handler** nào attach vào. Các trang DataEntry và Settlement đều có `downloadCsv()` được gọi đúng cách, nhưng AdvertiserList thì thiếu.

---

### `AdOrderMgmt` — `pAdOrderMgmt`
File: `frontend/src/pages/Advertiser.tsx:254`

| # | Chức năng | Trạng thái | Bằng chứng |
|---|-----------|------------|------------|
| 1 | Load danh sách ad order + ad id + advertiser | [OK] | `Promise.all([listAdOrders(), listAdIds()])` tại `:268` |
| 2 | Filter theo advertiser dropdown | [OK] | `advFilter` state + `orders.filter()` tại `:289-294` |
| 3 | Search filter | [OK] | `normalizeText(search)` tại `:288` |
| 4 | Count số AdId cho mỗi order (clickable link) | [OK] | `countAdIds()` + `navigateToAdIds()` tại `:296-325` |
| 5 | **Tạo/Sửa/Xóa AdOrder** | [READONLY_BY_DESIGN] | Route `/api/bff/ad-orders` trả 501 cho POST/PUT/DELETE — đúng design |
| 6 | CSV Export | [MISSING_BACKEND] | Button `{t('export')}` **chưa có handler** (giống AdvertiserList) |

---

### `AdIdMgmt` — `pAdIdMgmt`
File: `frontend/src/pages/Advertiser.tsx:337`

| # | Chức năng | Trạng thái | Bằng chứng |
|---|-----------|------------|------------|
| 1 | Load ad id list + advertiser + order filter | [OK] | `Promise.all([listAdvertisers(), listAdOrders(), listAdIds()])` tại `:353` |
| 2 | Filter theo advertiser | [OK] | `advFilter` state + `advertiserScopedRows` tại `:380` |
| 3 | Filter theo order | [OK] | `orderFilter` state + `orderScopedRows` tại `:383` |
| 4 | Filter theo type (CPM/RATIO) | [OK] | `typeFilter` state + `typeOptions` tại `:384` |
| 5 | Search filter | [OK] | `normalizeText(search)` tại `:385` |
| 6 | Count link đến AdId từ AdOrderMgmt | [OK] | `adIdPresetFilter` + `navigateToAdIds()` tại `:368-375` |
| 7 | **Tạo/Sửa/Xóa AdId** | [READONLY_BY_DESIGN] | Không có button tạo mới — read-only đúng design |
| 8 | CSV Export | [MISSING_BACKEND] | Button `{t('export')}` **chưa có handler** |

---

### `MediaMgmt` — `pMediaMgmt`
File: `frontend/src/pages/Media.tsx:88`

| # | Chức năng | Trạng thái | Bằng chứng |
|---|-----------|------------|------------|
| 1 | Load danh sách media | [OK] | `listMedia()` + `listAdvertisers()` tại `:105` |
| 2 | Search filter | [OK] | `rows.filter()` tại `:126-131` |
| 3 | Tạo/Sửa/Xóa Media (full CRUD) | [OK] | `createMedia()` → `bffApi.ts:184`, `updateMedia()` → `:192`, `deleteMedia()` → `:198` |
| 4 | Toggle status | [OK] | `updateStatus()` → `updateMedia({ status })` tại `:202-210` |
| 5 | Billing method (CPM/RATIO) form field | [OK] | Form có `billingMethod` + `currentUnitPrice`/`currentRatio` conditional tại `:254-267` |
| 6 | Loading/Error/Retry | [OK] | `LoadingState`, `ErrorState` tại `:220` |
| 7 | CSV Export | [MISSING_BACKEND] | Button `{t('export')}` **chưa có handler** |

---

### `MediaAdOrderMgmt` — `pMediaAdOrderMgmt`
File: `frontend/src/pages/Media.tsx:289`

| # | Chức năng | Trạng thái | Bằng chứng |
|---|-----------|------------|------------|
| 1 | Load ad order list + media id | [OK] | `Promise.all([listAdOrders(), listMediaIds()])` tại `:301` |
| 2 | Count media id trong mỗi order | [OK] | `countMediaIds()` tại `:323` |
| 3 | Search filter | [OK] | `normalizeText(search)` tại `:315` |
| 4 | **Tạo/Sửa MediaAdOrder** | [READONLY_BY_DESIGN] | Không có button tạo — read-only đúng design |
| 5 | CSV Export | [MISSING_BACKEND] | Button `{t('export')}` **chưa có handler** |

---

### `MediaIdMgmt` — `pMediaIdMgmt`
File: `frontend/src/pages/Media.tsx:352`

| # | Chức năng | Trạng thái | Bằng chứng |
|---|-----------|------------|------------|
| 1 | Load media id list + order filter | [OK] | `Promise.all([listAdOrders(), listMediaIds()])` tại `:367` |
| 2 | Filter theo media | [OK] | `mediaFilter` state + `mediaScopedRows` tại `:397` |
| 3 | Filter theo order | [OK] | `orderFilter` state + `orderScopedRows` tại `:400` |
| 4 | Filter theo type | [OK] | `typeFilter` state tại `:401` |
| 5 | Search filter | [OK] | `normalizeText(search)` tại `:402` |
| 6 | Preset filter từ MediaAdOrderMgmt | [OK] | `mediaIdPresetFilter` + `navigateToMediaIds()` tại `:381-388` |
| 7 | **Tạo/Sửa/Xóa MediaId** | [READONLY_BY_DESIGN] | Không có button tạo — read-only đúng design |
| 8 | CSV Export | [MISSING_BACKEND] | Button `{t('export')}` **chưa có handler** |

---

### `AiEntry` — `pAiEntry`
File: `frontend/src/pages/DataEntry.tsx:141`

| # | Chức năng | Trạng thái | Bằng chứng |
|---|-----------|------------|------------|
| 1 | Feature bị khóa / locked state | [OK - CỐ TÌNH] | Render `empty-state` với icon 🔒 và text "Feature locked" — đúng design |
| 2 | Không có handler tạo/sửa/xóa | [OK - CỐ TÌNH] | Component chỉ return locked UI, không có logic gì |

**Ghi chú:** Feature flag `aiEntry` không nằm trong `FEATURE_FLAGS` tại `frontend/src/lib/featureFlags.ts`. Trang vẫn xuất hiện trong menu nhưng hiển thị locked state. Đây là behavior đúng theo yêu cầu.

---

### `AdvEntry` — `pAdvEntry`
File: `frontend/src/pages/DataEntry.tsx:163`

| # | Chức năng | Trạng thái | Bằng chứng |
|---|-----------|------------|------------|
| 1 | Load advertiser entry rows | [OK] | `listAdvertiserEntries(params)` → `bffApi.ts:226` |
| 2 | Date range filter | [OK] | `startDate`/`endDate` → API params |
| 3 | Status filter (All/Confirmed/Pending) | [OK] | `filters.status` → API param `statusParam()` tại `:451` |
| 4 | Search filter | [OK] | `filters.search` → client-side filter tại `:458` |
| 5 | Edit cell (rate/traffic/settlement) inline | [OK] | `updateRow()` → `handleInputChange()` → `handleInputBlur()` → `saveRow()` |
| 6 | **Coefficient validation (media coefficient)** | [OK] | `validateCoefficient()` kiểm tra giá trị hợp lệ tại `:207-239` |
| 7 | **Save row individual** | [OK] | `saveRow()` → `saveMediaEntryBatch()` hoặc `saveAdvertiserEntryBatch()` |
| 8 | **Save all pending rows** | [OK] | `handleSaveAll()` → `saveAdvertiserEntryBatch()` |
| 9 | **Confirm all** | [OK] | `handleConfirmAll()` → `confirmAdvertiserEntryBatch()` |
| 10 | **Unconfirm single row** | [OK] | `handleUnconfirm()` → `unconfirmAdvertiserEntry()` |
| 11 | Pagination (infinite scroll hoặc load more) | [PARTIAL] | Pagination chỉ hoạt động qua date range filter, không có page number UI |
| 12 | **OperationLog SAVE detail** | [OK] | Backend `advertiserDataEntry.controller.ts` ghi `Saved advertiser data entry batch: date=..., adTypeCode=..., count=...` |
| 13 | **OperationLog CONFIRM detail** | [OK] | Backend ghi `Confirmed advertiser data entries: count=...` |
| 14 | **OperationLog UNCONFIRM detail** | [OK] | Backend ghi `Unconfirmed advertiser data entry id=...` |
| 15 | CSV Export | [OK] | `downloadCsv()` với UTF-8 BOM tại `:24-35` |
| 16 | No frontend recalculation (DailyInput.revenue source of truth) | [OK] | Frontend không gọi calculate/revenue logic — chỉ passthrough |

---

### `MediaDataMgmt` — `pMediaDataMgmt`
File: `frontend/src/pages/DataEntry.tsx:550`

| # | Chức năng | Trạng thái | Bằng chứng |
|---|-----------|------------|------------|
| 1-6 | Filters (date range, status, search, business) | [OK] | Tương tự AdvEntry |
| 7 | Edit cell (rate/traffic/settlement/data coefficient) | [OK] | `updateRow()` với thêm `dataCoefficient` field |
| 8 | Coefficient validation | [OK] | `validateCoefficient()` cho media coefficient |
| 9 | Save row / Save all / Confirm all / Unconfirm | [OK] | Tương tự AdvEntry, dùng `saveMediaEntryBatch()` |
| 10 | **OperationLog details** | [OK] | Backend ghi đúng format: `Saved media data entry batch: date=..., count=...`, `Confirmed media data entries: count=...`, `Unconfirmed media data entry id=...` |
| 11 | CSV Export | [OK] | `downloadCsv()` với UTF-8 BOM |
| 12 | No frontend recalculation | [OK] | Không có logic tính toán phía frontend |

---

### `TotalProfit` — `pTotalProfit`
File: `frontend/src/pages/Reports.tsx:215`

| # | Chức năng | Trạng thái | Bằng chứng |
|---|-----------|------------|------------|
| 1 | Load report khi mount + on date change | [OK] | `loadTotalProfitRows(date)` → `getTotalProfitReport()` |
| 2 | Month picker | [OK] | `<ReportDateField type="month">` tại `:272` |
| 3 | Search filter | [OK] | `matchesLocalized()` tại `:248-250` |
| 4 | Loading row | [OK] | `<LoadingRow colSpan={9} />` khi `loading=true` |
| 5 | Empty row | [OK] | `<EmptyRow colSpan={9} />` khi `visibleRows.length=0` |
| 6 | Error state | [OK] | `<div className="form-error">{error}</div>` tại `:279` |
| 7 | Total row (sticky footer) | [OK] | `{totalRow && <tfoot>...}` tại `:310-324` |
| 8 | In-flight request prevention | [OK] | `totalProfitInFlight` Map tại `:27-37` — deduplicate by date |
| 9 | CSV Export | [OK] | `downloadCsv('总利润表.csv', columns, exportRows)` với UTF-8 BOM |
| 10 | CSV chỉ export visible rows | [OK] | `exportRows = totalRow ? [...visibleRows, totalRow] : visibleRows` |
| 11 | No frontend recalculation | [OK] | Backend tính toán, frontend chỉ hiển thị |

---

### `OrderProfit` — `pOrderProfit`
File: `frontend/src/pages/Reports.tsx:332`

| # | Chức năng | Trạng thái | Bằng chứng |
|---|-----------|------------|------------|
| 1 | Load report khi mount + on date/business change | [OK] | `getOrderProfitReport({ date, adTypeCode: business })` |
| 2 | Month picker | [OK] | `<ReportDateField type="month">` tại `:384` |
| 3 | Business dropdown (từ data) | [OK] | `businessOptionsFromRows()` tại `:367` — dynamic từ `rows` |
| 4 | Search filter | [OK] | `matchesLocalized()` tại `:364-366` |
| 5 | Loading/Empty/Error | [OK] | `<LoadingRow>`, `<EmptyRow>`, `{error && <div>}` |
| 6 | Total footer row | [OK] | `<tfoot>` với `sumRows()` tại `:417-425` |
| 7 | CSV Export | [OK] | `downloadCsv('广告单利润表.csv', ...)` |
| 8 | In-flight request prevention | [MISSING] | **Không có deduplication** — rapid click sẽ trigger nhiều request |

---

### `AdvQuery` — `pAdvQuery`
File: `frontend/src/pages/Reports.tsx:433`

| # | Chức năng | Trạng thái | Bằng chứng |
|---|-----------|------------|------------|
| 1 | Load report | [OK] | `getAdvertiserReport({ date, status })` |
| 2 | All 7 filters (business/advertiser/adOrder/adId/type/rate/status) | [OK] | Filters update `filters` state |
| 3 | Search filter | [OK] | `matchesLocalized()` |
| 4 | Loading/Empty/Error | [OK] | Có đầy đủ |
| 5 | Total footer | [OK] | `sumRows(visibleRows, row => row.receivable)` |
| 6 | CSV Export | [OK] | `downloadCsv('广告主数据查询.csv', ...)` |
| 7 | **Advertiser dropdown filter — KHÔNG passed to backend** | [API_GAP] | Frontend có filter `filters.advertiser`, gọi `getAdvertiserReport({ date, status })` — **không truyền `advertiserId`** lên backend. Backend hỗ trợ param `advertiserId` (theo `bffTypes.ts:257`) nhưng frontend không dùng |
| 8 | **AdOrder/AdId/Type/Rate filters — KHÔNG passed to backend** | [API_GAP] | Tương tự — backend có `adTypeCode` nhưng frontend gọi thiếu |
| 9 | In-flight request prevention | [MISSING] | Không có deduplication |

**Giải thích item 7-8:** Backend endpoint `/api/bff/reports/advertisers` (theo `report.controller.ts:37`) nhận params `advertiserId`, `adTypeCode` theo định nghĩa tại `bffTypes.ts:257`. Nhưng AdvQuery gọi `getAdvertiserReport({ date, status })` — thiếu `advertiserId`, `adTypeCode`. Kết quả: filter dropdown trên UI có tác dụng client-side (lọc visible rows) nhưng API request không được gửi với filter đúng. Nếu dataset lớn, server trả về tất cả rồi frontend lọc — không tối ưu.

---

### `MediaQuery` — `pMediaQuery`
File: `frontend/src/pages/Reports.tsx:580`

| # | Chức năng | Trạng thái | Bằng chứng |
|---|-----------|------------|------------|
| 1 | Load report | [OK] | `getMediaReport({ date, status })` |
| 2 | All 8 filters (business/media/mediaAdOrder/mediaId/type/rate/shareRatio/status) | [OK] | Filters update state |
| 3 | Search filter | [OK] | `matchesLocalized()` |
| 4 | Loading/Empty/Error | [OK] | Có đầy đủ |
| 5 | Total footer | [OK] | `sumRows(visibleRows, row => row.actualReceived)` |
| 6 | CSV Export | [OK] | `downloadCsv('媒体数据查询.csv', ...)` |
| 7 | **Media/MediaAdOrder/MediaId filters — KHÔNG passed to backend** | [API_GAP] | Tương tự AdvQuery — backend nhận `mediaId`, `adTypeCode` nhưng frontend không truyền |
| 8 | In-flight request prevention | [MISSING] | Không có deduplication |

---

### `AdvSettlement` — `pAdvSettlement`
File: `frontend/src/pages/Settlement.tsx:64`

| # | Chức năng | Trạng thái | Bằng chứng |
|---|-----------|------------|------------|
| 1 | Load settlement rows | [OK] | `getAdvertiserSettlement({ period, advertiserId })` |
| 2 | Period picker (month) | [OK] | `<input type="month">` tại `:111` |
| 3 | Advertiser filter dropdown | [OK] | Populated từ `rows` data tại `:95` |
| 4 | Filter passed to backend | [OK] | `advertiserId: advertiserId ? Number(advertiserId) : undefined` |
| 5 | Search (client-side) | [OK] | `advertiserId` filter — client-side từ `rows` |
| 6 | CSV Export | [OK] | `downloadCsv('广告主结算单.csv', columns, visibleRows)` |
| 7 | **OperationLog details** | [OK] | Backend ghi đúng format — không liên quan Settlement |

---

### `MediaSettlement` — `pMediaSettlement`
File: `frontend/src/pages/Settlement.tsx:138`

| # | Chức năng | Trạng thái | Bằng chứng |
|---|-----------|------------|------------|
| 1 | Load settlement rows | [OK] | `getMediaSettlement({ period, mediaId })` |
| 2 | Media filter | [OK] | `mediaId: mediaId ? Number(mediaId) : undefined` |
| 3 | CSV Export | [OK] | `downloadCsv('媒体结算单.csv', columns, visibleRows)` |
| 4 | **Share ratio display** | [OK] | `formatPercent()` tại `:177` |
| 5 | **OperationLog details** | [OK] | Backend ghi đúng format |

---

### `OpLog` — `mOpLog`
File: `frontend/src/pages/System.tsx:14`

| # | Chức năng | Trạng thái | Bằng chứng |
|---|-----------|------------|------------|
| 1 | Load operation logs | [OK] | `listOperationLogs()` → `bffApi.ts:298` |
| 2 | Date range filter (startDate/endDate) | [OK] | Gửi lên backend params tại `:32-34` |
| 3 | Keyword search filter | [OK] | `keyword` → backend `where.OR` tại `operationLog.controller.ts:71-79` |
| 4 | Module filter | [OK] | `module` → backend param |
| 5 | Action filter | [OK] | `action` → backend param |
| 6 | Pagination (hardcoded pageSize=100) | [PARTIAL] | Load 100 bản ghi gần nhất, không có pagination UI |
| 7 | Refresh / Reload | [OK] | `loadLogs()` được gọi on mount và on filter change |
| 8 | Log detail hiển thị | [OK] | `action + targetId + detail` tại `:45` |

---

### `LoginPage` — `/`
File: `frontend/src/pages/Login.tsx`

| # | Chức năng | Trạng thái | Bằng chứng |
|---|-----------|------------|------------|
| 1 | Login form submit | [OK] | `handleSubmit()` → `login(data)` → `bffApi.ts:143` |
| 2 | Error handling (wrong credentials) | [OK] | `BffApiError` catch + display tại `:43` |
| 3 | Token lưu vào localStorage | [OK] | App.tsx `handleLogin()` gọi `window.localStorage.setItem()` |
| 4 | Redirect sau login thành công | [OK] | `<AppProvider>` render → `<MainContent>` → render pages |
| 5 | **OperationLog LOGIN_SUCCESS** | [OK] | `admin.ts:2183` ghi log sau khi tạo JWT thành công |
| 6 | **OperationLog LOGIN_FAILED** | [OK] | `admin.ts` ghi log khi login fail |

---

### `App.tsx` / Sidebar navigation

| # | Chức năng | Trạng thái | Bằng chứng |
|---|-----------|------------|------------|
| 1 | State-based routing (switch pageKey) | [OK] | `App.tsx:27-44` |
| 2 | Feature flag filtering | [OK] | `isPageEnabled()` + `FALLBACK_PAGE` |
| 3 | Sidebar username từ JWT | [OK] | `getUsernameFromToken()` được gọi trong Sidebar render |
| 4 | Sidebar re-render on token change | [OK] | `window.addEventListener('bff-auth-token-changed', handler)` tại `Sidebar.tsx:22-28` |
| 5 | **Logout** | [OK] | `onLogout()` callback được gọi từ Topbar → App.tsx `logout()` xóa token |
| 6 | Redirect to login when no token | [OK] | `if (!token) return <LoginPage />` tại `App.tsx:87` |

---

## 3. Backend endpoints frontend đang gọi

| Method | Endpoint | Frontend file | Backend tồn tại? | Ghi chú |
|--------|----------|---------------|-----------------|---------|
| POST | `/api/auth/login` | `Login.tsx` | ✓ `admin.ts` | |
| GET | `/api/bff/advertisers` | `bffApi.ts:151` | ✓ `advertiser.controller.ts` | |
| POST | `/api/bff/advertisers` | `bffApi.ts:158` | ✓ | |
| PUT | `/api/bff/advertisers/:id` | `bffApi.ts:165` | ✓ | |
| DELETE | `/api/bff/advertisers/:id` | `bffApi.ts:172` | ✓ | |
| GET | `/api/bff/media` | `bffApi.ts:176` | ✓ `media.controller.ts` | |
| POST | `/api/bff/media` | `bffApi.ts:184` | ✓ | |
| PUT | `/api/bff/media/:id` | `bffApi.ts:192` | ✓ | |
| DELETE | `/api/bff/media/:id` | `bffApi.ts:198` | ✓ | |
| GET | `/api/bff/ad-orders` | `bffApi.ts:202` | ✓ `adOrder.controller.ts` | Read-only (501 on write) |
| GET | `/api/bff/ad-ids` | `bffApi.ts:210` | ✓ `adId.controller.ts` | Read-only |
| GET | `/api/bff/media-ids` | `bffApi.ts:218` | ✓ `mediaId.controller.ts` | Read-only |
| GET | `/api/bff/data-entry/advertisers` | `bffApi.ts:226` | ✓ | |
| POST | `/api/bff/data-entry/advertisers/batch` | `bffApi.ts:230` | ✓ | |
| POST | `/api/bff/data-entry/advertisers/confirm-batch` | `bffApi.ts:237` | ✓ | |
| PUT | `/api/bff/data-entry/advertisers/:id/unconfirm` | `bffApi.ts:244` | ✓ | |
| GET | `/api/bff/data-entry/media` | `bffApi.ts:250` | ✓ | |
| POST | `/api/bff/data-entry/media/batch` | `bffApi.ts:254` | ✓ | |
| POST | `/api/bff/data-entry/media/confirm-batch` | `bffApi.ts:261` | ✓ | |
| PUT | `/api/bff/data-entry/media/:id/unconfirm` | `bffApi.ts:268` | ✓ | |
| GET | `/api/bff/reports/advertisers` | `bffApi.ts:274` | ✓ | **Frontend KHÔNG pass advertiserId/adTypeCode** |
| GET | `/api/bff/reports/media` | `bffApi.ts:278` | ✓ | **Frontend KHÔNG pass mediaId/adTypeCode** |
| GET | `/api/bff/reports/total-profit` | `bffApi.ts:282` | ✓ | |
| GET | `/api/bff/reports/order-profit` | `bffApi.ts:286` | ✓ | |
| GET | `/api/bff/settlement/advertisers` | `bffApi.ts:290` | ✓ | |
| GET | `/api/bff/settlement/media` | `bffApi.ts:294` | ✓ | |
| GET | `/api/bff/operation-logs` | `bffApi.ts:298` | ✓ | |

**Tất cả endpoint backend đều tồn tại và khớp với frontend.** Không có API mismatch về method/path.

---

## 4. Backend endpoints có sẵn nhưng frontend chưa dùng

| Method | Endpoint | Backend file | Gợi ý màn hình nên nối |
|--------|----------|---------------|----------------------|
| GET | `/api/bff/advertisers/:id` | `advertiser.controller.ts` | Chưa dùng — detail view cho Advertiser (hiện tại click vào row không mở detail) |
| GET | `/api/bff/media/:id` | `media.controller.ts` | Chưa dùng — detail view cho Media |
| GET | `/api/bff/ad-orders/:id` | `adOrder.controller.ts` | Chưa dùng — detail view cho AdOrder |
| GET | `/api/bff/ad-ids/:id` | `adId.controller.ts` | Chưa dùng — detail view cho AdId |
| GET | `/api/bff/media-ids/:id` | `mediaId.controller.ts` | Chưa dùng — detail view cho MediaId |

**Giải thích:** Hiện tại tất cả các trang list đều chỉ có bảng, không có mở detail modal khi click vào row. Các endpoint GET /:id đã tồn tại nhưng frontend không gọi.

---

## 5. TODO / Mock / Placeholder / Stub tìm thấy

| Keyword | File:line | Nội dung | Mức độ ảnh hưởng |
|---------|-----------|----------|-----------------|
| `alert(` | `GlobalModal.tsx:145-260` (10 vị trí) | Validation alerts trong deprecated GlobalModal — **không ảnh hưởng vì component không mounted** | Không (dead code) |
| `initialDb` | `data.ts:80-95` | Mock `operationLogs` với hardcoded "nancy" và ngày 2025-05-07 — legacy local mode | Không (không dùng khi có token) |
| `placeholder` CSS class | Nhiều file CSS/JSX | Chỉ là CSS class cho placeholder text style — hợp lệ | Không |
| `return null` | `AppContext.tsx:95`, `GlobalModal.tsx:83` | Context guard và modal early exit — hợp lệ | Không |
| `[MISSING_BACKEND]` Export buttons | `Advertiser.tsx:198`, `AdOrderMgmt:305`, `MediaAdOrderMgmt:330`, `MediaIdMgmt:423`, `MediaMgmt:218` | Export button không có handler — **5 trang thiếu export CSV** | P1 |

---

## 6. Ưu tiên sửa

### P0 — Chặn chức năng chính / Gây lỗi người dùng

| # | Mô tả | File liên quan | Backend cần | Effort |
|---|-------|----------------|-------------|--------|
| 1 | **AdvertiserList/AdOrderMgmt/Media/MediaAdOrder/MediaIdMgmt — thiếu Export CSV handler** | `Advertiser.tsx:198`, `Media.tsx:218`, v.v. | Không cần backend — export từ client-side data | S |
| 2 | **`operationLog.service.ts` crash khi Prisma chưa generate** — Đã fix gần đây bằng `try/catch` + `if (!prisma.operationLog) return` | `src/services/operationLog.service.ts:34` | — | Đã fix rồi |

### P1 — Có UI nhưng chưa dùng được

| # | Mô tả | File liên quan | Backend cần | Effort |
|---|-------|----------------|-------------|--------|
| 3 | **AdvQuery/MediaQuery — frontend filter không gửi lên backend** — Advertiser filter, AdOrder filter, Type filter, Rate filter chỉ có tác dụng client-side. Backend có hỗ trợ `advertiserId`, `adTypeCode` params nhưng frontend không truyền. Nếu dataset lớn → server trả tất cả rồi lọc phía frontend | `Reports.tsx:458`, `Reports.tsx:606` | Không cần backend — chỉ cần frontend thêm params vào API call | S |
| 4 | **OrderProfit/TotalProfit/AdvQuery/MediaQuery — thiếu in-flight request prevention** — Rapid click Query button trigger nhiều request. TotalProfit đã có (`totalProfitInFlight` Map), các trang khác chưa | `Reports.tsx:349`, `Reports.tsx:458`, `Reports.tsx:606` | Không cần backend — thêm Map deduplicate tương tự TotalProfit | S |
| 5 | **OpLog pagination** — Chỉ load 100 bản ghi, không có pagination UI. Nếu có >100 action logs thì không xem được | `System.tsx:38` | Backend đã hỗ trợ `page` + `pageSize` params (`operationLog.controller.ts:36-37`) | M |

### P2 — Thiếu polish/UX

| # | Mô tả | File | Effort |
|---|-------|------|--------|
| 6 | **MediaMgmt form — khi edit không load lại `currentUnitPrice`/`currentRatio`** — `mediaFormFromRecord()` set `currentUnitPrice: ''` và `currentRatio: ''` khi edit. Giá trị hiện tại không hiển thị trong form | `Media.tsx:70-79` | S |
| 7 | **AdvEntry/MediaDataMgmt — không có Refresh/Reload button cho table data** — User phải đổi date filter hoặc reload page để refresh data | `DataEntry.tsx:163`, `DataEntry.tsx:550` | S |
| 8 | **AiEntry sidebar — menu hiển thị nhưng locked state có thể confuse user** — Cân nhắc ẩn luôn khỏi sidebar bằng feature flag thay vì show locked state | `data.ts:97`, `featureFlags.ts` | S |

### P3 — Cleanup/mock nhỏ

| # | Mô tả | File | Effort |
|---|-------|------|--------|
| 9 | **GlobalModal alert()** — 10 `alert()` calls trong deprecated GlobalModal. Không ảnh hưởng vì component không mounted, nhưng nên xóa để tránh nhầm lẫn | `GlobalModal.tsx:145-260` | S |
| 10 | **initialDb mock operationLogs** — Hardcoded "nancy" và ngày 2025 trong initialDb. Không ảnh hưởng khi đã login (chỉ dùng local mode khi không có token) | `data.ts:89-94` | L |
| 11 | **`getUsernameFromToken()` fallback "Admin"** — Khi token không có username field, fallback là "Admin". Đây là hardcoded default — có thể là đúng behavior, nhưng cần confirm nếu user expectation là khác | `bffApi.ts:82` | Không cần sửa |

---

## 7. Kết luận

### 3-5 vấn đề quan trọng nhất cần sửa trước

1. **[P1] AdvQuery/MediaQuery — frontend filter không gửi lên backend**
   - **Ảnh hưởng:** Khi chọn advertiser filter, server vẫn trả tất cả data rồi frontend lọc. Nếu dataset lớn → chậm, tốn bandwidth.
   - **Fix:** Thêm `advertiserId`, `adTypeCode` params vào `getAdvertiserReport()` và `getMediaReport()` calls trong `Reports.tsx`.

2. **[P0] 5 trang thiếu Export CSV handler**
   - **Ảnh hưởng:** AdvertiserList, AdOrderMgmt, MediaMgmt, MediaAdOrderMgmt, MediaIdMgmt có button Export nhưng bấm không có tác dụng.
   - **Fix:** Thêm `downloadCsv()` calls giống DataEntry/Settlement cho 5 trang đó.

3. **[P1] In-flight request prevention thiếu ở 3/4 report pages**
   - **Ảnh hưởng:** Rapid click Query → nhiều request cùng lúc → potential race condition → duplicate/wrong data.
   - **Fix:** Thêm `Map` deduplicate tương tự `totalProfitInFlight` cho OrderProfit, AdvQuery, MediaQuery.

4. **[P2] OpLog pagination chỉ load 100 bản ghi**
   - **Ảnh hưởng:** Nếu có nhiều action logs, user không thể xem lịch sử đầy đủ.
   - **Fix:** Thêm pagination UI (prev/next buttons) và truyền `page`/`pageSize` params lên backend.

5. **[P2] MediaMgmt edit form không populate current price/ratio**
   - **Ảnh hưởng:** Khi sửa Media, form không hiển thị giá trị CPM/RATIO hiện tại — user không biết giá trị cũ là gì.
   - **Fix:** Map `record.currentUnitPrice` và `record.currentRatio` vào form state khi edit.

### Đề xuất thứ tự triển khai

```
1. Fix Export CSV handler (5 trang) — Effort S, có thể làm trong 30 phút
2. Fix AdvQuery/MediaQuery filter params — Effort S, 30 phút
3. Thêm in-flight request prevention — Effort S, 30 phút
4. Fix MediaMgmt edit form populate — Effort S, 15 phút
5. OpLog pagination UI — Effort M, 1-2 giờ
```

**Tổng estimate toàn bộ fix:** ~4-5 giờ cho tất cả P0-P2 items.

### Các điểm đã confirm hoạt động tốt
- Login/logout flow + OperationLog tracking
- BFF adapter pattern — tất cả endpoint backend đều tồn tại và khớp frontend
- Data Entry save/confirm/unconfirm với improved operation log details
- Settlement filter backend passing
- CSV export với UTF-8 BOM
- Total Profit in-flight deduplication
- AiEntry locked state (cố tình)
- AdOrder/AdId/MediaId read-only design (đúng spec)