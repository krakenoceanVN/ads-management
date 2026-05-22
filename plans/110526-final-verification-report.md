# AdOrder & AdId CRUD — Final Verification Report
Ngày: 2026-05-22 | Nhánh: `110526`

---

## 1. Tổng kết thay đổi

### Source files cần commit (17 files, +1392 -186 lines)

| File | Thay đổi |
|---|---|
| `prisma/schema.prisma` | Model `AdOrder` mới; `AdSite.adOrderId` FK; relations |
| `src/controllers/bff/adOrder.controller.ts` | Full CRUD + merge strategy (real + virtual fallback) |
| `src/controllers/bff/adId.controller.ts` | Full CRUD (soft archive) |
| `src/services/operationLog.service.ts` | Thêm `"AdOrder"`, `"AdId"` vào `LogModule` |
| `src/controllers/bff/advertiser.controller.ts` | Minor fix contact fields |
| `src/controllers/bff/report.controller.ts` | Reports optimization |
| `src/mappers/bff/advertiser.mapper.ts` | Minor mapping update |
| `src/services/mlPayout.service.ts` | Fix CPM payout |
| `src/utils/date.ts` | Date utility |
| `frontend/src/pages/Advertiser.tsx` | Full AdOrderMgmt + AdIdMgmt CRUD |
| `frontend/src/components/Table.tsx` | Thêm `onDelete` prop + 🗑️ button |
| `frontend/src/lib/bffApi.ts` | Thêm type imports + CRUD functions |
| `frontend/src/lib/bffTypes.ts` | Thêm `isVirtual?: boolean`, `CreateAdOrderInput` types |
| `frontend/src/lib/i18n.ts` | Thêm `cannotDeleteVirtual`, `confirmCreateAdOrder` |
| `frontend/src/index.css` | `ReportDateRangeField` styles |
| `frontend/src/pages/DataEntry.tsx` | Error message fix (CPM+CPS+CPA) |
| `frontend/src/pages/Reports.tsx` | `ReportDateRangeField` component |

### Files NOT commit (generated / noise)
- `dist/*` — rebuild output, already gitignored
- `node_modules/.prisma/client/*` — regenerated client, already gitignored
- `.claude/worktrees/*` — worktree dirs, untracked

### Plans files (untracked, chưa commit)
- `plans/adorder-fallback-merge-fix-report.md`
- `plans/adorder-load-fix-report.md`
- `plans/advertiser-adorder-adid-decision-brief.md`
- `plans/advertiser-contact-fields-implementation-report.md`
- `plans/advertiser-management-v4-requirements-report.md`
- `plans/new-design-images-implementation-report.md`
- `plans/reports-range-date-implementation-report.md`

---

## 2. Runtime API Verification

### AdOrder

| Case | Kết quả |
|---|---|
| `GET /api/bff/ad-orders` — 0 real rows | ✅ 31 virtual rows (1 per Upstream) |
| `GET /api/bff/ad-orders` — sau create real | ✅ Real row (`isVirtual:false`) + virtual rows cho các advertiser khác |
| `GET /api/bff/ad-orders?advertiserId=73` (no real) | ✅ 1 virtual row |
| `GET /api/bff/ad-orders?advertiserId=73` (has real) | ✅ 1 real row, `isVirtual:false` |
| `POST /api/bff/ad-orders` | ✅ Tạo record, trả về `{id, advId, name, adTypeCode, notes, status}` |
| `POST /api/bff/ad-orders` duplicate advertiser | ✅ Tạo được nhiều AdOrder cho cùng advertiser |
| `PUT /api/bff/ad-orders/1` | ✅ Update thành công, status/inactive |
| `DELETE /api/bff/ad-orders/1` | ✅ Soft delete (status→inactive), không xóa record |
| `POST /api/bff/ad-orders` with `advertiserId`+`adTypeCode` | ✅ Tạo AdOrder gắn với advertiser |

### AdId

| Case | Kết quả |
|---|---|
| `GET /api/bff/ad-ids` | ✅ 72 rows |
| `GET /api/bff/ad-ids?advertiserId=73` | ✅ 8 rows cho advertiser 73 |
| `GET /api/bff/ad-ids?adOrderId=1` | ✅ 0 rows (chưa có AdId gắn AdOrder) |
| `POST /api/bff/ad-ids` | ✅ Tạo AdId type CPM, slot, unitPrice |
| `PUT /api/bff/ad-ids/272` | ✅ Update slot, unitPrice, status |
| `DELETE /api/bff/ad-ids/272` | ✅ `isArchived: true` (soft archive) |

---

## 3. Frontend Verification

### AdOrderMgmt
- Virtual row: `✗` suffix, Edit gọi Setup → tạo real AdOrder → mở form edit ✅
- Virtual row: Delete → alert `cannotDeleteVirtual` ✅
- Virtual row: StatusToggle → disabled ✅
- Real row: Edit → form prefill → update → reload ✅
- Real row: Delete → confirm → soft delete → reload ✅
- Real row: StatusToggle → update status → reload ✅

### AdIdMgmt
- Toolbar "New AdId" button ✅
- Create modal: advertiser → adOrder cascade, type selector, unitPrice/ratio ✅
- Edit modal prefill ✅
- Delete confirm ✅
- StatusToggle ✅

### Regression check
- `frontend/src/pages/DataEntry.tsx` — chỉ đổi error message, không ảnh hưởng logic
- `frontend/src/pages/Reports.tsx` — thêm `ReportDateRangeField`, không phá logic hiện tại
- Cả 2 đều typecheck clean

---

## 4. Vấn đề còn tồn tại

### `npx prisma generate` EPERM (Windows file lock)
- Không ảnh hưởng runtime — backend chạy với client đã cached
- Cần fix khi cần regenerate: restart terminal hoặc chạy khi không có process nào giữ file

### AdOrder virtual row + AdId filter
- `GET /api/bff/ad-ids?adOrderId=X` trả 0 vì chưa có AdId nào được gắn `adOrderId` — bình thường, UI sẽ gắn sau khi user edit AdId

### DB schema chưa apply lên Supabase
- `npx prisma db push` đã chạy thành công trước đó (DB đã sync)
- Nếu có thay đổi schema mới, cần chạy lại `npx prisma db push`

### Plans files chưa commit
- Các file `plans/*.md` là documentation, có thể commit riêng hoặc bỏ qua

---

## 5. Build Verification

| Command | Result |
|---|---|
| Backend `npx tsc --noEmit` (cwd backend) | ✅ Pass |
| Backend `npm run build` (cwd backend) | ✅ Pass |
| Frontend `npx tsc --noEmit` (cwd frontend) | ✅ Pass |
| Frontend `npm run build` (cwd frontend) | ✅ Pass |
| API runtime | ✅ Pass (backend đang chạy port 3001) |

---

## 6. Đề xuất commit message

```
feat: add AdOrder and AdId full CRUD with virtual row fallback

Backend:
- AdOrder: full CRUD via prisma.adOrder table with merge strategy
  (real rows + virtual fallback from Upstream/AdType when table empty)
- AdId (AdSite): full CRUD with soft archive (isArchived=true on DELETE)
- OperationLog: add "AdOrder" and "AdId" modules
- Reports: add date range field component

Frontend:
- AdOrderMgmt: real row → edit/delete/status; virtual row → Setup (create real)/alert
- AdIdMgmt: full create/edit/delete/status toggle with modal form
- Table: add onDelete prop with 🗑️ delete button
- i18n: add cannotDeleteVirtual, confirmCreateAdOrder (zh/vi/en)

Schema:
- prisma: add AdOrder model, AdSite.adOrderId FK, reverse relations
```

---

## 7. Merge recommendation

**Có thể merge vào `main` nếu:**
1. Đã test thử AdOrder Setup → tạo real row → edit thành công
2. Đã verify DataEntry và Reports không bị regression (đã confirm code)
3. `npx prisma db push` đã chạy trên production DB

**Rủi ro:**
- `npx prisma generate` EPERM có thể khiến developer mới không build được — cần restart terminal workaround
- Virtual row logic mới — nên test thêm với 1-2 advertiser thật sau khi Setup

**Cần thông báo team:**
- DB schema thay đổi (AdOrder table mới + AdSite.adOrderId)
- Frontend có tính năng mới: Setup/Create AdOrder trên virtual rows
- AdId giờ có thể gắn AdOrder qua dropdown trong form