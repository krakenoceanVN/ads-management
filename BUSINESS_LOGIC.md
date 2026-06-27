# KrakenOcean — Tài liệu Kỹ thuật & Logic Nghiệp vụ

> Tài liệu tổng hợp toàn bộ kiến trúc, mô hình dữ liệu, luồng nghiệp vụ và quy tắc tính toán của hệ thống **Ads Management** (mã nội bộ: KrakenOcean). Cập nhật lần cuối: **2026-06-26** (đồng bộ với code hiện tại: xác nhận MediaAdOrder scope theo Downstream, AdSite.rebateRate vẫn còn, resolveDownstreamRate throw thay vì trả 0, route đã đổi sang dạng số nhiều + thêm `/daily-input/quarantine`).
>
> Mục tiêu: một tài liệu duy nhất để onboarding kỹ sư mới, đối chiếu nghiệp vụ với khách hàng, và làm cơ sở cho các bài review/QA.

---

## Mục lục

1. [Tổng quan hệ thống](#1-tổng-quan-hệ-thống)
2. [Stack công nghệ](#2-stack-công-nghệ)
3. [Cấu trúc mã nguồn](#3-cấu-trúc-mã-nguồn)
4. [Mô hình dữ liệu (Prisma)](#4-mô-hình-dữ-liệu-prisma)
5. [Bảo mật & Phân quyền (RBAC)](#5-bảo-mật--phân-quyền-rbac)
6. [API & Routing](#6-api--routing)
7. [Luồng nghiệp vụ chính](#7-luồng-nghiệp-vụ-chính)
8. [Công thức tính tiền & lợi nhuận](#8-công-thức-tính-tiền--lợi-nhuận)
9. [Trạng thái bản ghi & Vòng đời dữ liệu](#9-trạng-thái-bản-ghi--vòng-đời-dữ-liệu)
10. [Khu cách ly (Quarantine)](#10-khu-cách-ly-quarantine)
11. [Hard Delete & Toàn vẹn dữ liệu](#11-hard-delete--toàn-vẹn-dữ-liệu)
12. [Báo cáo & Dashboard](#12-báo-cáo--dashboard)
13. [Module Yiyi](#13-module-yiyi)
14. [Nhật ký thao tác (OperationLog)](#14-nhật-ký-thao-tác-operationlog)
15. [Frontend — Cấu trúc & Routing](#15-frontend--cấu-trúc--routing)
16. [Điểm mở cần xác nhận](#16-điểm-mở-cần-xác-nhận)
17. [Lịch sử thay đổi lớn](#17-lịch-sử-thay-đổi-lớn)

---

## 1. Tổng quan hệ thống

**KrakenOcean** là hệ thống quản lý nghiệp vụ quảng cáo nội bộ, phục vụ 3 nhóm công việc chính:

```
┌──────────────────────┐    ┌──────────────────────┐    ┌──────────────────────┐
│  Danh mục (Master)   │    │  Nhập liệu (Entry)   │    │  Báo cáo (Reports)   │
│                      │    │                      │    │                      │
│ • AdType (Loại QC)   │    │ • Advertiser Entry   │    │ • Advertiser Report  │
│ • Upstream (Advert.) │ →  │ • Media Entry        │ →  │ • Media Report       │
│ • AdSite (ID QC)     │    │ • Yiyi (4 channels)  │    │ • Total Profit       │
│ • Downstream         │    │                      │    │ • Order Profit       │
│ • MediaAdOrder       │    │ • Save → Confirm     │    │ • Settlement         │
│                      │    │                      │    │ • Dashboard          │
└──────────────────────┘    └──────────────────────┘    └──────────────────────┘
```

- **Danh mục** (master data) do Admin thiết lập một lần; **nhập liệu** do Operator thực hiện hằng ngày; **báo cáo** là read-only cho mọi vai trò có quyền.
- Mọi thao tác ghi (tạo/sửa/cách ly/xoá cứng) đều được ghi vào `OperationLog` để truy vết.
- Dữ liệu đã xác nhận **không bao giờ bị xoá cứng** — khi cần loại bỏ khỏi báo cáo, dùng cơ chế **Quarantine** (cách ly mềm).

### Thay đổi lớn gần đây (xem §17)
- **Drop bảng `AdOrder`**: trước đây có bảng `AdOrder` (đơn QC của nhà QC), đã được gộp vào `AdType` — `AdType` hiện giữ vai trò "đơn QC" với field `upstreamId` (chủ sở hữu), `notes`, `status`.
- **`MediaAdOrder` scope theo `(downstreamId, adTypeId, seq)`** — KHÔNG gắn với AdSite. Mỗi downstream sở hữu một tập đơn QC, có thứ tự `seq` (auto-increment).
- **Bỏ folder `bff/ad-orders/`**: route `/api/bff/ad-orders/*` đã xóa. Thay bằng `bff/media-ad-orders/` (đơn QC gắn với Downstream).
- **Đổi tất cả PK sang `String`** (6-char alphanumeric, tạo app-side qua `generateShortId()`). PK của `OperationLog` dùng format inline `opl_<timestamp>_<random>`.
- **Tất cả route `/api/users/me` đổi thành `/api/auth/me`** (để đồng bộ với router auth).
- **Routes plural**: data-entry, reports, settlement dùng dạng số nhiều (`advertisers`, `media`).
- **Quarantine routes** đổi từ `/quarantine` → `/daily-input/quarantine` (xem §6.3, §7.1.4).
- **`resolveDownstreamRate` throw** khi không tìm được rate (trước đây fallback về 0).

---

## 2. Stack công nghệ

### Backend
| Thành phần | Phiên bản | Ghi chú |
|---|---|---|
| Node.js + Express | 4.21.x | REST API, dev cổng **3001** |
| TypeScript | 5.9 | `ts-node-dev` cho dev, `tsc` cho build |
| Prisma | 5.22 | ORM; schema đặt tại `backend/prisma/schema.prisma` |
| PostgreSQL | — | Host qua `DATABASE_URL` + `DIRECT_URL` |
| `jsonwebtoken` | 9.0 | JWT cho auth; secret qua `JWT_SECRET`, TTL mặc định `7d` |
| `bcrypt` | 5.1 | Hash mật khẩu (10 rounds) |
| `helmet` + `cors` | 8.0 / 2.8 | Hardening HTTP, CORS mở `origin:true` (chỉ dev) |
| `express-rate-limit` | 7.4 | Rate-limit cho `/api/auth/login` (production: 5 req / 15 phút) |

### Frontend
| Thành phần | Phiên bản | Ghi chú |
|---|---|---|
| React | 19.0 | Hook + Context (không Redux) |
| Vite | 6.2 | Dev server mặc định cổng 5173 (preview `vite preview` cũng dùng 5173) |
| TypeScript | 5.8 | `tsc --noEmit` cho lint |
| `lucide-react` | 0.546 | Icon |
| Tailwind CSS | 4.1 | Cấu hình qua plugin Vite |

### Cổng & URL
- Backend dev: `http://localhost:3001`
- Frontend dev: `http://localhost:5173` (sau khi chạy `npx vite preview` với `dist/`)
- Tất cả API nghiệp vụ mount dưới `/api/bff/*` (BFF — Backend-For-Frontend)
- Auth: `/api/auth/*`; User/Role/Yiyi: `/api/*`; Health: `/health`

---

## 3. Cấu trúc mã nguồn

```
260604/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/20260623000000_…          # bỏ 20260627000000_restore_ad_order (rollback)
│   ├── scripts/bootstrap-admin.ts                # seed 4 user: admin/operator/viewer + roles + permissions
│   └── src/
│       ├── app.ts                                # Express composition
│       ├── index.ts                              # HTTP server bootstrap
│       ├── config/index.ts                       # env → config
│       ├── middleware/
│       │   ├── requireAuth.ts                    # JWT verify → load AuthUser (sub: String)
│       │   └── requirePermission.ts              # RBAC + legacy fallback
│       ├── shared/
│       │   ├── prisma/                           # Prisma client instance
│       │   ├── errors/                           # AppError + errorHandler
│       │   ├── response/success.ts               # bffData() helper
│       │   ├── ids.ts                            # generateShortId (6-char alphanumeric)
│       │   └── services/
│       │       ├── revenue.service.ts            # calculateRevenue()
│       │       ├── rebate.service.ts             # resolveRebateRate() (priority: AdSiteRebateRate → AdSite.rebateRate)
│       │       └── payout.service.ts             # resolveDownstreamRate (THROW nếu không match) / aggregateDownstreamCost / calculateProfit
│       └── modules/
│           ├── auth/                             # JWT login + /me
│           ├── users/                            # CRUD user
│           ├── roles/                            # role + permission
│           ├── health/
│           ├── yiyi/                             # 4-channel daily/monthly/batch
│           └── bff/
│               ├── advertisers/                  # CRUD Upstream (soft delete)
│               ├── ad-types/                     # CRUD AdType (loại QC)
│               ├── ad-ids/                       # CRUD AdSite (soft delete)
│               ├── media/                        # CRUD (legacy, route ẩn khỏi menu)
│               ├── media-ids/                    # AdSiteDownstream junction (delete throw)
│               ├── media-ad-orders/              # per-Downstream ad order (soft delete)
│               ├── downstreams/                  # CRUD + period (delete khi không có ref, ngược lại deactivate)
│               ├── data-entry/                   # list/save/confirm/unconfirm (advertiser + media)
│               ├── reports/                      # advertiser / media / total-profit / order-profit
│               ├── settlement/                   # advertiser / media settlement
│               ├── quarantine/                   # quarantine + restore (route /daily-input/quarantine)
│               ├── operation-logs/               # read + list
│               ├── dashboard/                    # monthly aggregate
│               ├── hard-delete/                  # master data delete (có kiểm tra ràng buộc)
│               ├── mappers.ts
│               └── bff.types.ts
├── frontend/
│   └── src/
│       ├── App.tsx
│       ├── AppContext.tsx
│       ├── main.tsx
│       ├── lib/                                  # bffApi, bffTypes, i18n, data, date
│       ├── components/                           # Sidebar, Topbar, Table, modals
│       ├── api/yiyiApi.ts                        # yiyi API (đặc thù, dùng cổng 3001)
│       └── pages/
│           ├── Login.tsx
│           ├── Advertiser.tsx                    # AdvertiserList + AdIdMgmt
│           ├── Media.tsx                         # MediaMgmt + MediaAdOrderMgmt + MediaIdMgmt
│           ├── AdTypeMgmt.tsx                    # AdType CRUD (form 7 cột theo docx mục 1.2)
│           ├── DownstreamMgmt.tsx
│           ├── DataEntry.tsx                     # AdvEntry + MediaDataMgmt + AiEntry (locked)
│           ├── YiyiData.tsx
│           ├── YiyiReport.tsx
│           ├── Reports.tsx                       # TotalProfit + OrderProfit + AdvQuery + MediaQuery
│           ├── Settlement.tsx
│           ├── QuarantineMgmt.tsx
│           ├── System.tsx                        # OpLog
│           ├── UserManagement.tsx
│           └── RoleManagement.tsx
├── docs/downstream-detail-wireframe.md
└── BUSINESS_LOGIC.md                             # file này
```

---

## 4. Mô hình dữ liệu (Prisma)

> Database: **PostgreSQL**. Tất cả bảng chính dùng `id: String @id` (6-char alphanumeric, tạo app-side qua `generateShortId()`). Bảng phụ trợ dùng `uuid() @default(uuid())`.

### 4.1 Bảng tổng quan

| Bảng | Vai trò | Ghi chú đặc biệt |
|---|---|---|
| `AdType` | Loại quảng cáo (SM, 360, BAIDU_JS, …) — **cũng đóng vai trò "đơn QC của nhà QC"** sau khi drop bảng AdOrder | Có `upstreamId` (FK → Upstream, nullable = Nhà QC sở hữu), `notes`, `status` (active/inactive). `code` đã bỏ — `id` (6-char alphanumeric) là identifier duy nhất. |
| `Upstream` | Nhà quảng cáo (advertiser) | 1 upstream gắn 1 `defaultAdType` (FK → AdType); có thể thêm nhiều `UpstreamAdType` |
| `UpstreamAdType` | Junction Upstream ↔ AdType | `@@unique([upstreamId, adTypeId])` |
| `AdSite` | ID quảng cáo (UI gọi "ID quảng cáo" / "Media") | Có `billingMethod` (CPM/CPS/CPA), `currentUnitPrice`, `currentRatio`, `isActive`, `isArchived`, **`rebateRate` (Float?) — vẫn còn** dùng làm fallback cho CPM rebate. |
| `AdSiteDownstream` | Junction AdSite ↔ Downstream | Có `customPrice` (giá tự điền cho cặp), `pctHal` (tỷ lệ chia riêng — hiện chưa dùng, giữ để tương thích), `mediaAdTypeId` (FK AdType — đơn QC ở MEDIA side), `mediaIdName` (tên media tự đặt), `status` |
| `AdSiteRebateRate` | Lịch sử tỷ lệ hoàn CPM | Có `startDate`/`endDate` (null = đang hiệu lực), **ưu tiên cao hơn `AdSite.rebateRate`** |
| `AdSiteEvent` | Sự kiện của AdSite (note + ngày) | Dùng cho timeline |
| `Downstream` | Đối tác phân phối (hạ nguồn) | `downstreamType`: ML / LE / YIYI. **API có nhận `payoutRate` nhưng KHÔNG lưu** (no-op, chỉ validate). |
| `DownstreamPeriod` | Kỳ giá/tỷ lệ của Downstream | `pctHal` (1.0 = 100%), `unitPrice` (payout rate), `startDate`/`endDate` |
| `DownstreamAdType` | Junction Downstream ↔ AdType | Tương tự UpstreamAdType |
| `DailyDownstreamRate` | Giá payout theo ngày (override period) | `@@unique([downstreamId, date])` |
| `MediaAdOrder` | Đơn hàng QC gắn với `(downstreamId, adTypeId)` — **THAY THẾ bảng AdOrder cũ** | Có `seq` (auto-increment theo `(downstreamId, adTypeId)`), `name` (unique toàn hệ thống), `notes`, `status`. **KHÔNG gắn với AdSite.** |
| `DailyInput` | **Bản ghi nhập liệu hằng ngày** | Trái tim của hệ thống; `@@unique([recordDate, adSiteId])` |
| `DailyInputQuarantineBatch` | Đợt cách ly | `scopeType`: advertiser / media |
| `DailyInputQuarantineRecord` | Bản ghi thuộc đợt cách ly | Snapshot `statusBefore` + `revenueSnapshot` |
| `YiyiDailyData` | Lượt theo kênh Yiyi | `channel`: yy-02-01..04, `@@unique([recordDate, channel])` |
| `YiyiDailyPricing` | Đơn giá Yiyi theo ngày | `unitPrice` (mặc định 2), `profitUnitPrice` (mặc định 1) |
| `LEDailyCost` | Chi phí LE theo ngày | `vendorCost`, `mlCost`, `costAmount` |
| `User` | Tài khoản | Có cả `role` (legacy string: SUPER_ADMIN/ADMIN/EDITOR/VIEWER/MANAGER/OPERATOR) + `roleId` (RBAC FK) + 3 cờ legacy `permDataInput/permDataConfirm/permAdmin` |
| `Role` / `Permission` / `RolePermission` | RBAC | `Role.isSystem` không cho sửa/xoá |
| `OperationLog` | Nhật ký thao tác | `userId` (String?), `action`, `module`, `targetType`, `targetId`, `detail`. **PK dùng format inline `opl_<timestamp>_<random>`** (không dùng `generateShortId()`). |

### 4.2 Cấu trúc bảng `DailyInput` (trung tâm)

```prisma
model DailyInput {
  id                 String   @id          // di_<adSiteId>_<YYYYMMDD>
  recordDate         DateTime              // UTC midnight
  adSiteId           String
  qty                Int       default(0)   // CPM/CPA qty
  unitPriceSnapshot  Decimal?              // snapshot giá tại thời điểm nhập
  amount1            Decimal   default(0)   // CPS
  amount2            Decimal   default(0)   // CPS
  ratioSnapshot      Decimal?              // CPS
  rebateAmount       Decimal   default(0)   // (legacy field, có thể không dùng)
  rebateRateSnapshot Decimal   default(0)   // snapshot tỷ lệ hoàn CPM
  revenue            Decimal   default(0)   // **revenue đã tính sẵn, không tính lại**
  status             String    default("unconfirmed")  // unconfirmed | confirmed | quarantined
  note               String?               // LƯU Ý: `note` (không phải `notes`)
  createdBy          String?
  createdAt          DateTime  default(now())
  updatedAt          DateTime  @updatedAt

  // Quarantine
  quarantineBatchId  String?
  quarantinedAt      DateTime?
  quarantinedBy      String?
  quarantineReason   String?

  @@unique([recordDate, adSiteId])
}
```

> **Nguyên tắc vàng**: `DailyInput.revenue` là **single source of truth**. Mọi báo cáo, settlement, profit **đều đọc trực tiếp từ cột này**, không tính lại. Công thức chỉ chạy tại thời điểm `save` (lưu batch).

### 4.3 Sơ đồ quan hệ rút gọn

```
AdType ──< UpstreamAdType >── Upstream ──< AdSite ──< AdSiteDownstream >── Downstream
   │                                │           │                              │
   │                                │           │                              └─< DownstreamPeriod
   │                                │           ├─< AdSiteRebateRate (lịch sử hoàn CPM)
   │                                │           └─< AdSiteEvent
   │                                │
   │                                ├──< DailyInput (theo ngày)
   │                                │           │
   │                                │           └─< DailyInputQuarantineRecord >── DailyInputQuarantineBatch
   │                                │
   └─< MediaAdOrder >──── Downstream   (đơn QC gắn với downstream, KHÔNG gắn AdSite)
   │
   └─< owner (Upstream? — Nhà QC sở hữu AdType, nullable)
```

---

## 5. Bảo mật & Phân quyền (RBAC)

### 5.1 Xác thực

- Đăng nhập `POST /api/auth/login` → server trả `{ success, data: { token, user } }`.
- Token là JWT (HS256) với payload `{ sub: String, username, role }`, TTL mặc định **7 ngày** (`JWT_EXPIRES_IN`).
- Mọi request sau đính kèm `Authorization: Bearer <token>`. Middleware `requireAuth`:
  1. Verify token (`payload.sub` phải là **string** — sau migration đổi ID sang String).
  2. `getUserById(payload.sub)` để nạp lại user mới nhất từ DB (kèm `permissions` từ `RolePermission`).
  3. Gán `req.authUser`.
- Trong production: `/api/auth/login` được rate-limit 5 req / 15 phút.
- Khi deploy production, **phải đặt `JWT_SECRET`** (mặc định dev sẽ log warning).

### 5.2 Vai trò hệ thống (`User.role`)

`UserRole` enum (frontend `bffTypes.ts`):

| Role | Mô tả | Thực tế trong code |
|---|---|---|
| `SUPER_ADMIN` | Bypass mọi permission check | ✅ Có |
| `ADMIN` | Legacy admin — full quyền trừ `system.config` | ✅ Có |
| `MANAGER` | (danh sách) | **KHÔNG có code path nào dùng** — chỉ khai báo trong enum |
| `EDITOR` | Nhập liệu (qua `perm_data_input`) | ✅ Có |
| `OPERATOR` | (danh sách) | ✅ Có (seed từ bootstrap-admin.ts) |
| `VIEWER` | Read-only | ✅ Có |

> Trong `requirePermission.ts` chỉ check `role === 'SUPER_ADMIN'`. Các role khác phải có `permissions` (RBAC) hoặc fallback theo `permDataInput/permDataConfirm/permAdmin`.

### 5.3 Phân quyền chi tiết

Có **3 lớp** phân quyền chạy song song (`requirePermission`):

**Lớp 1 — RBAC đầy đủ (ưu tiên):**
- Bảng `Permission` chứa các key dạng `module.action` (vd: `dataEntry.create`, `report.read`).
- `Role` ↔ `Permission` qua bảng `RolePermission`.
- `User.roleId` FK → `Role`. Nếu `roleId` set + có permission → pass.
- Admin có thể edit permission của role (trừ `Role.isSystem`).

**Lớp 2 — Legacy fallback (backward-compat):**
- Bảng `User` có 3 cờ boolean: `permDataInput`, `permDataConfirm`, `permAdmin`.
- Nếu `roleId` null hoặc permission không tìm thấy, map key sang cờ:

| Permission key | Cờ legacy |
|---|---|
| `dataEntry.create` | `permDataInput` |
| `dataEntry.confirm` | `permDataConfirm` |
| `dataEntry.unconfirm` | `permAdmin` |
| `advertiser.create / update / delete` | `permAdmin` |
| `media.create / update / delete` | `permAdmin` |
| `adId.create / update / delete` | `permAdmin` |
| `mediaId.create / update / delete` | `permAdmin` |
| `user.create / update` | `permAdmin` |
| `masterData.hardDelete` | `permAdmin` |
| `report.read` | `permAdmin` |
| `settlement.read` | `permAdmin` |
| `oplog.read` | `permAdmin` |
| `quarantine.execute / restore` | `permAdmin` |
| `role.update` | `permAdmin` |

> **Lưu ý**: permission keys `adOrder.*` đã bị **XÓA** sau khi drop bảng AdOrder. Tương tự `mediaAdOrder.*` cũng KHÔNG có trong legacy map (route media-ad-orders đang không gắn permission trong `mediaAdOrderRouter.ts` — đây là điểm cần xem lại).

**Lớp 3 — SUPER_ADMIN bypass:** `role === 'SUPER_ADMIN'` thì luôn pass.

### 5.4 Bảo mật bổ sung

- `helmet()` cho header an toàn.
- `cors({ origin: true, credentials: true })` — chấp nhận mọi origin (chỉ dùng khi dev, cần thắt chặt khi prod).
- Password hash bằng `bcrypt` (mặc định 10 rounds).
- Script seed: `backend/scripts/bootstrap-admin.ts` — chạy bằng `npm run bootstrap:admin` tạo 3 user mặc định (`admin/localdev-admin-123`, `operator`, `viewer`).

---

## 6. API & Routing

> Tất cả trả về JSON dạng `{ success: boolean, data?, error?, code? }`. Frontend dùng `unwrapData()` để extract `data` (xem `frontend/src/lib/bffApi.ts:unwrapData`).

### 6.1 Auth (mount `/api/auth`, không cần token cho login)
- `POST /api/auth/login` — body `{ username, password }` → `{ success, data: { token, user } }`. Rate-limit 5 req/15 phút (chỉ production).
- `GET  /api/auth/me` — cần `requireAuth` → trả `AuthUser`.

### 6.2 User / Role / Yiyi (mount `/api`)
- `GET /api/users` — list (cần `user.update`)
- `POST /api/users` — create (cần `user.create`)
- `PUT /api/users/:id` — update (cần `user.update`)
- `POST /api/users/:id/reset-password` — reset password (cần `user.update`)
- `GET /api/roles` — list roles (cần `role.update`)
- `GET /api/permissions` — list permissions (cần `role.update`)
- `PUT /api/roles/:id/permissions` — update (cần `role.update`)
- `GET /api/yiyi-data?date=YYYY-MM-DD` — 4 dòng (channel qty)
- `GET /api/yiyi-data/monthly?year&month` — 31 dòng/tháng
- `POST /api/yiyi-data/batch` — body `{ date, items: [{channel, qty}, ...], pricing?: { unitPrice, profitUnitPrice } }`

### 6.3 BFF (mount `/api/bff`)

| Prefix | Method | Permission / Middleware |
|---|---|---|
| `/advertisers` | CRUD | **KHÔNG có middleware** (cả list/create/update/delete đều public — cần xem lại) |
| `/ad-types` | CRUD | `requireAuth` (không gắn `requirePermission` cụ thể) |
| `/ad-ids` | CRUD | **KHÔNG có middleware** (cả list/create/update/delete đều public — cần xem lại) |
| `/media` | CRUD (legacy) | **KHÔNG có middleware** (route ẩn khỏi menu nhưng vẫn public) |
| `/media-ids` | CRUD | **KHÔNG có middleware** (read-only — `delete` throw ConflictError) |
| `/media-ad-orders` | CRUD | **KHÔNG có middleware** |
| `/downstreams` | CRUD | `requireAuth` (không gắn permission cụ thể) |
| `/data-entry/advertisers` | GET | `requireAuth` |
| `/data-entry/advertisers/batch` | POST | `requireAuth` + `dataEntry.create` |
| `/data-entry/advertisers/confirm-batch` | POST | `requireAuth` + `dataEntry.confirm` |
| `/data-entry/advertisers/:id/unconfirm` | PUT | `requireAuth` + `dataEntry.unconfirm` |
| `/data-entry/media/*` | (tương tự advertisers) | tương tự |
| `/reports/advertisers` | GET | `requireAuth` + `report.read` |
| `/reports/media` | GET | `requireAuth` + `report.read` |
| `/reports/total-profit` | GET | `requireAuth` + `report.read` |
| `/reports/order-profit` | GET | `requireAuth` + `report.read` |
| `/settlement/advertisers` | GET | `requireAuth` + `settlement.read` |
| `/settlement/media` | GET | `requireAuth` + `settlement.read` |
| `/dashboard/monthly` | GET | `requireAuth` + `report.read` |
| `/daily-input/quarantine` | POST (quarantine) | `requireAuth` + `quarantine.execute` |
| `/daily-input/quarantine/:batchId/restore` | POST | `requireAuth` + `quarantine.restore` |
| `/daily-input/quarantine` | GET (list batches) | `requireAuth` + `quarantine.execute` |
| `/daily-input/quarantine/:batchId/records` | GET | `requireAuth` + `quarantine.execute` |
| `/oplog` | GET | `requireAuth` + `oplog.read` |
| `/hard-delete/{advertisers,ad-types,ad-ids,media,media-ad-orders,media-ids}/:id` | DELETE | `requireAuth` + `masterData.hardDelete` |
| `/hard-delete/{advertisers,ad-types,ad-ids,media}/:id/dependencies` | GET | `requireAuth` (không gắn permission) |

### 6.4 Health
- `GET /health` — kiểm tra server sống

### 6.5 Sai lệch giữa frontend và backend

| Frontend gọi | Backend thực tế | Trạng thái |
|---|---|---|
| `/api/bff/reports/advertiser` (số ít) | `/api/bff/reports/advertisers` (số nhiều) | ❌ Mismatch — cần fix frontend |
| `/api/bff/reports/media` | `/api/bff/reports/media` | ✅ Khớp |
| `/api/bff/quarantine` | `/api/bff/daily-input/quarantine` | ❌ Mismatch — frontend sẽ luôn 404 |
| `/api/bff/quarantine/:id/restore` | `/api/bff/daily-input/quarantine/:batchId/restore` | ❌ Mismatch |
| `/api/roles/permissions` | `/api/permissions` | ❌ Mismatch |
| `/api/users/:id` PUT | (có) | ✅ Khớp |

---

## 7. Luồng nghiệp vụ chính

### 7.1 Vòng đời một bản ghi `DailyInput`

```
                         (1) save batch
   ─────────────────►  unconfirmed  ──────► (2) confirm batch  ──────►  confirmed
   chưa có              ▲   │                                                │
                         │   │ (3) unconfirm                                  │ (4) quarantine
                         │   ▼                                                ▼
                       sửa lại                                            quarantined
                                                                              │
                                                                              │ (5) restore
                                                                              ▼
                                                                           confirmed
                                                                              │
                                                                              │ (6) hard delete block
                                                                              ▼
                                                                       (giữ nguyên DB,
                                                                        ẩn khỏi báo cáo)
```

**(1) Save batch** (`POST /api/bff/data-entry/{advertisers,media}/batch`)
- Validate input theo `billingMethod` (xem §8.1).
- Với CPM: tự resolve `rebateRate` qua `resolveRebateRate(adSiteId, recordDate)`.
- Tính `revenue` qua `calculateRevenue()`.
- Tìm bản ghi hiện tại theo `@@unique([recordDate, adSiteId])`:
  - Không có → `create` (status mặc định `unconfirmed`, id = `di_<adSiteId>_<YYYYMMDD>`).
  - Có + `status='confirmed'` → **bỏ qua**, log lỗi "cannot be edited".
  - Có + `status='quarantined'` → **bỏ qua**, log lỗi.
  - Có + `status='unconfirmed'` → `update`.

**(2) Confirm batch** (`POST /api/bff/data-entry/{advertisers,media}/confirm-batch`)
- Body: `{ date: string, adSiteIds: string[] }` (id là String).
- Trong transaction:
  - Tìm tất cả `DailyInput` của (recordDate, adSiteIds[]) với `status='unconfirmed'`.
  - Nếu rỗng → return.
  - Update tất cả sang `confirmed`.
  - Ghi `OperationLog` action `CONFIRM_ADVERTISER` / `CONFIRM_MEDIA`.

**(3) Unconfirm** (`PUT /api/bff/data-entry/{advertisers,media}/:id/unconfirm`)
- `id` là String.
- Chỉ chấp nhận nếu `status='confirmed'`, đưa về `unconfirmed`.
- Ghi `OperationLog` action `UNCONFIRM_*`.
- **Không thể unconfirm** khi đang `quarantined` (cần restore trước).

**(4) Quarantine** (`POST /api/bff/daily-input/quarantine`)
- Body advertiser: `{ advertiserId: string, startDate, endDate, reason }`.
- Body media: `{ adSiteId: string, startDate, endDate, reason }`.
- Trong transaction:
  - Tìm tất cả `DailyInput` confirmed trong khoảng ngày.
  - Tạo `DailyInputQuarantineBatch` (scopeType: advertiser/media).
  - Tạo `DailyInputQuarantineRecord` cho từng bản ghi (snapshot `statusBefore`, `revenueSnapshot`).
  - Update mỗi bản ghi → `status='quarantined'`, set `quarantineBatchId`, `quarantinedAt`, `quarantinedBy`, `quarantineReason`.
  - Ghi `OperationLog` action `QUARANTINE_*`.

**(5) Restore** (`POST /api/bff/daily-input/quarantine/:batchId/restore`)
- Trong transaction:
  - Kiểm tra batch tồn tại, chưa `restoredAt`, có records.
  - Với mỗi record snapshot, update `DailyInput` về `status=record.statusBefore` (thường là `confirmed`).
  - Update batch với `restoredAt`, `restoredBy`.
  - Ghi `OperationLog` action `RESTORE_QUARANTINE_BATCH`.

### 7.2 Thiết lập master data (Admin)

1. **AdType**: tạo đơn QC (chỉ cần `name` + tùy chọn `upstreamId`, `notes`, `status`). Tên phải duy nhất toàn hệ thống (case-insensitive). Theo docx mục 1.2: form có dropdown Nhà QC, textarea Ghi chú, dropdown Trạng thái.
2. **Upstream (Advertiser)**: tạo nhà quảng cáo, set `defaultAdType` (FK tới `AdType.id`). Có thể thêm các loại QC phụ qua bảng `UpstreamAdType`.
3. **AdSite (ID quảng cáo)**: tạo ID QC, gắn `upstreamId`, set `billingMethod` (CPM/CPS/CPA), `currentUnitPrice` / `currentRatio`, `isActive`, `isArchived`, `rebateRate` (fallback khi không có `AdSiteRebateRate`). Nếu muốn áp dụng hoàn CPM theo kỳ → tạo `AdSiteRebateRate` với `startDate`/`endDate`.
4. **Downstream**: tạo đối tác phân phối, set `downstreamType` (ML/LE/YIYI). Tạo `DownstreamPeriod` để set `pctHal` + `unitPrice` theo kỳ. Có thể tạo `DailyDownstreamRate` để override theo ngày cụ thể. **API nhận `payoutRate` nhưng no-op** (giữ để tương thích).
5. **AdSiteDownstream (MediaId)**: ghép (AdSite, Downstream). Có thể set `customPrice` (ưu tiên cao nhất), `pctHal`, `mediaAdTypeId`, `mediaIdName`, `status`. **`delete` throw ConflictError** — không cho xoá để bảo toàn lịch sử báo cáo.
6. **MediaAdOrder**: tạo đơn hàng QC gắn với `(downstreamId, adTypeId)`. `seq` auto-increment theo cặp; `name` mặc định `<adType.name>-<seq padded 3>`, phải duy nhất toàn hệ thống (case-insensitive).

### 7.3 Hard delete vs Soft delete

> Hệ thống dùng **soft delete làm mặc định** cho hầu hết entity. Chỉ `DELETE /api/bff/hard-delete/{entityType}/:id` mới thực sự xoá row (và chỉ khi không có constraint).

**Soft delete (mặc định qua các endpoint CRUD):**

| Entity | Hành vi delete | File |
|---|---|---|
| `Upstream` (advertiser) | set `status='inactive'` | `advertiser.write.service.ts:109-115` |
| `AdSite` (adId) | set `status='inactive'` | `adId.write.service.ts:109-119` |
| `AdSite` (media, legacy) | set `isArchived=true` | `media.write.service.ts:77-83` |
| `MediaAdOrder` | set `status='inactive'` (không giải phóng `seq`) | `mediaAdOrder.write.service.ts:85-93` |
| `Downstream` | Nếu không có ref → `prisma.downstream.delete`. Có ref (mediaIds/periods/dailyRates) → set `status='inactive'` | `downstream.write.service.ts:193-211` |
| `AdSiteDownstream` (MediaId) | **throw ConflictError** — không cho xoá | `mediaId.write.service.ts:127-130` |

**Hard delete** (`DELETE /api/bff/hard-delete/{entityType}/:id`, permission `masterData.hardDelete`):

| Entity | Quy tắc |
|---|---|
| `advertisers/:id` | Nếu có `DailyInput` (mọi trạng thái) → **block** + gợi ý `quarantine` theo advertiser. Nếu có `AdSite` / `AdSiteDownstream` / `AdSiteRebateRate` / `AdSiteEvent` → block, gợi ý xoá con trước. |
| `ad-types/:id` | Tương tự advertiser; nếu có dữ liệu tài chính → block + gợi ý quarantine theo từng advertiser/media. |
| `ad-ids/:id` (= `AdSite`) | Nếu có `DailyInput` → block + gợi ý `quarantine` theo media. Nếu có junction/rebate/event → block. |
| `media/:id` (legacy) | Tương tự `ad-ids`. |
| `media-ad-orders/:id` | Cho phép xoá trực tiếp (chỉ ghi log). |
| `media-ids/:id` (= `AdSiteDownstream`) | Cho phép xoá trực tiếp (chỉ ghi log). |

Mỗi thao tác hard delete (cả thành công lẫn block) đều ghi `OperationLog` action `HARD_DELETE` / `HARD_DELETE_BLOCKED` với snapshot đầy đủ trong cùng transaction.

---

## 8. Công thức tính tiền & lợi nhuận

### 8.1 Tính revenue (`calculateRevenue`)

| `billingMethod` | Công thức |
|---|---|
| **CPM** | `revenue = qty * unitPrice / 1000` (không rebate) |
| **CPM + rebate** | `revenue = qty * unitPrice / 1000 - qty * rebateRate` |
| **CPS** | `revenue = (amount1 + amount2) * ratio` |
| **CPA** | `revenue = qty * unitPrice` |

> `RATIO` (alias cũ) → tự động chuẩn hoá thành `CPS` (xem `normalizeBillingMethod()` trong `revenue.service.ts`).

### 8.2 Resolve `rebateRate` cho CPM (`resolveRebateRate`)

Ưu tiên từ cao xuống thấp:
1. **`AdSiteRebateRate`** đang hiệu lực (`startDate <= recordDate <= endDate` hoặc `endDate=null`), lấy row có `startDate` mới nhất.
2. **Fallback `AdSite.rebateRate`** (Float, trên schema `AdSite` — vẫn còn).
3. Không có → `null` (không hoàn).

> ⚠️ Tài liệu cũ ghi "đã chuyển sang `AdSiteRebateRate`" nhưng **code vẫn dùng `AdSite.rebateRate` làm fallback** (`rebate.service.ts:49-58`). Nếu muốn bỏ hẳn `AdSite.rebateRate` cần migration + sửa service.

### 8.3 Resolve payout rate cho cost (`resolveDownstreamRate`)

Áp dụng **cho từng (AdSite, Downstream) junction** đang active:

1. **`AdSiteDownstream.customPrice`** — giá riêng cho cặp (nếu > 0).
2. **`DailyDownstreamRate.effectiveRate`** — giá theo ngày.
3. **`DownstreamPeriod.unitPrice`** — giá theo kỳ (active trên `recordDate`).
4. **`Downstream.payoutRate`** — fallback cuối (column có thể không tồn tại trên schema hiện tại — chỉ fallback nếu cast được).
5. **Không tìm được → THROW Error** (`payout.service.ts:67-135`).

> ⚠️ Tài liệu cũ ghi "Fallback cuối (an toàn) — trả `0` thay vì throw". Code hiện tại **throw** — `aggregateDownstreamCost` sẽ catch lỗi và push vào `errors[]`, KHÔNG làm fail cả batch. Từng bản ghi fail sẽ có cost = 0 và được liệt kê trong `result.errors`.

### 8.4 Tính cost cho từng bản ghi (`calculateCost`)

Với `shareRatio = DownstreamPeriod.pctHal` (chuẩn hoá về [0,1]; null/missing → 1.0):

| `billingMethod` | Công thức cost |
|---|---|
| CPM | `cost = (qty * rate / 1000) * shareRatio` |
| CPA | `cost = qty * rate * shareRatio` |
| CPS | `cost = (amount1 + amount2) * rate * shareRatio` |

Cost được **làm tròn 2 chữ số thập phân**. Với mỗi AdSite có nhiều active downstream, cost được **cộng dồn** (mỗi junction đóng góp 1 khoản).

### 8.5 Chuẩn hoá `pctHal` (`normalizePctHal`)

| Input | Kết quả |
|---|---|
| `null` / `undefined` / không phải số | `1.0` (100%) |
| `< 0` | `0` |
| `0 <= x <= 1` | giữ nguyên (làm tròn 3 số) |
| `> 1` | chia 100 rồi cap 1.0 (tương thích dữ liệu cũ nhập % kiểu `80`) |

### 8.6 Tính lợi nhuận (`calculateProfit`)

```
grossProfit = revenue - cost           (làm tròn 2)
tax         = grossProfit > 0 ? grossProfit * 0.06 : 0   ← hard-code 6%, lỗ thì = 0
profit      = grossProfit - tax         (làm tròn 2)
profitRate  = profit / revenue          (làm tròn 2, 0 nếu revenue=0)
```

> **Tax rate 6%** hiện là hằng số trong `payout.service.ts` (`TAX_RATE = 0.06`). Khi lợi nhuận âm, thuế = 0 (không hoàn thuế).

### 8.7 Cộng cost yiyi (đặc thù)

Trong `getTotalProfit`, sau khi cộng cost từ các downstream, hệ thống cộng thêm **yiyiCost** cho mỗi ngày:

```
yiyiCost(ngày) = ((yy-02-01 + yy-02-02 + yy-02-03 + yy-02-04) / 1000) * (unitPrice + profitUnitPrice)
```

Mỗi ngày chỉ cộng 1 lần (dùng `yiyiAppliedDates` Set để tránh cộng trùng khi có nhiều group cùng ngày).

### 8.8 Snapshot

Các cột `*Snapshot` trên `DailyInput` (unitPriceSnapshot, ratioSnapshot, rebateRateSnapshot, revenue) **lưu giá trị tại thời điểm nhập**. Điều này đảm bảo:
- Sửa `AdSite.currentUnitPrice` sau này **không ảnh hưởng** dữ liệu lịch sử.
- Mọi báo cáo đọc từ snapshot, kết quả **ổn định theo thời gian**.

---

## 9. Trạng thái bản ghi & Vòng đời dữ liệu

### 9.1 Bảng chuyển trạng thái `DailyInput`

| Từ \ Sang | unconfirmed | confirmed | quarantined |
|---|---|---|---|
| (mới) | ✅ save batch | ⛔ | ⛔ |
| unconfirmed | ✅ save batch (update) | ✅ confirm batch | ⛔ |
| confirmed | ✅ unconfirm | ✅ (không đổi) | ✅ quarantine |
| quarantined | ⛔ (cần restore trước) | ✅ restore → confirmed | ⛔ (cần restore trước) |

### 9.2 Status hiển thị UI

- `unconfirmed` ⇄ UI gọi là `pending` (chưa duyệt, có thể sửa) — UI render text "pending" trong cột Status
- `confirmed` (đã duyệt, khoá)
- `quarantined` (cách ly, ẩn khỏi báo cáo mặc định)

### 9.3 Quy tắc lọc trong báo cáo

| Loại báo cáo | Mặc định | Lọc tuỳ chọn |
|---|---|---|
| Advertiser Report | `status='confirmed'` và `status != 'quarantined'` | `?status=unconfirmed|pending|all` |
| Media Report | tương tự | tương tự |
| Total Profit / Order Profit | `status='confirmed'` (cố định) | không cho chọn status |
| Settlement | `status='confirmed'` (cố định) | không cho chọn status |
| Dashboard | `status='confirmed'` (cố định) | không cho chọn status |
| Data Entry list | (xem param `status`) | mặc định `all` (trừ quarantined) |

### 9.4 Loại trừ test

Hai biến `TEST_UPSTREAM_NAMES = ['百战-bz']` và `TEST_AD_SITE_NAMES = ['TestCPM', 'TestCPS']` được loại trừ khỏi total-profit và order-profit.

---

## 10. Khu cách ly (Quarantine)

### 10.1 Mục đích

Khi phát hiện dữ liệu nghi sai (nhập nhầm số, đối tác báo sai traffic, …), cần **ẩn** khỏi báo cáo để không làm sai lệch lợi nhuận, **nhưng không xoá** để giữ audit trail.

### 10.2 Mô hình dữ liệu

```
DailyInputQuarantineBatch (1) ──< (N) DailyInputQuarantineRecord
                                            │
                                            └─── dailyInputId → DailyInput
```

Mỗi batch chứa:
- `scopeType`: `advertiser` (cách ly theo upstream) hoặc `media` (cách ly theo AdSite).
- `startDate` / `endDate`: khoảng ngày áp dụng.
- `recordCount` / `totalRevenue`: tổng số bản ghi và tổng revenue.
- `restoredAt` / `restoredBy`: thời điểm khôi phục (null = chưa khôi phục).
- Mỗi record lưu `statusBefore` (= `'confirmed'` thông thường) và `revenueSnapshot` (revenue tại thời điểm cách ly).

### 10.3 Tính chất

- **Soft quarantine**: `DailyInput` không bị xoá, chỉ chuyển `status` → `quarantined` và set các trường `quarantine*`.
- **Reversible**: Restore đưa `status` về `statusBefore` (= `confirmed`).
- **One-time restore**: Mỗi batch chỉ restore được 1 lần (kiểm tra `restoredAt !== null`).
- **Transaction atomicity**: Toàn bộ (cập nhật DailyInput + tạo batch/record + ghi OperationLog) chạy trong 1 transaction. Nếu log lỗi → rollback toàn bộ.
- **Không ảnh hưởng revenue đã lưu**: `revenue` trên `DailyInput` giữ nguyên; chỉ `status` thay đổi.

### 10.4 Workflow

```
   Phát hiện nghi sai                Xử lý xong
          │                                │
          ▼                                ▼
   POST /quarantine  ──►  DailyInput  ──►  POST /:batchId/restore
   (advertiser|media)    status='quarantined'  (1 lần duy nhất)
                              │
                              └──► Báo cáo mặc định BỎ QUA (status != 'quarantined')
```

---

## 11. Hard Delete & Toàn vẹn dữ liệu

> **Phần này chỉ nói về hard delete** (xoá row thật). Soft delete (mặc định cho hầu hết entity) đã được trình bày trong §7.3.

### 11.1 Nguyên tắc

- **Không bao giờ xoá cứng** dữ liệu đã có `DailyInput` liên quan → dùng `quarantine` thay thế.
- Mọi hard-delete đều kiểm tra ràng buộc:
  - **Có dữ liệu tài chính** (`DailyInput` confirmed/unconfirmed/quarantined) → block, gợi ý `quarantine`.
  - **Có dữ liệu liên kết** (children) → block, gợi ý xoá con trước hoặc archive.
- Thao tác block / thành công đều ghi `OperationLog` với snapshot.

### 11.2 Mã lỗi trả về

| Code | Ý nghĩa | Hành động UI |
|---|---|---|
| `NOT_FOUND` | Không tìm thấy bản ghi | Toast thông báo |
| `ENTITY_HAS_FINANCIAL_DATA` | Có DailyInput liên quan | Hiện nút "Đi tới Cách ly" |
| `ENTITY_HAS_DEPENDENCIES` | Có AdSite / AdSiteDownstream / … | Hiện danh sách con cần xoá trước |

### 11.3 Transaction

- Mỗi thao tác hard-delete thành công chạy trong transaction với OperationLog. Nếu log lỗi → rollback xoá.

---

## 12. Báo cáo & Dashboard

### 12.1 Advertiser Report (`GET /api/bff/reports/advertisers`)

- Trả về **từng dòng DailyInput** (không gộp), sử dụng `revenue` đã lưu.
- Mặc định chỉ `status='confirmed'`, loại bỏ `quarantined`.
- Có thể lọc: `?date=YYYY-MM-DD` hoặc `?startDate&endDate`, `?advertiserId`, `?adTypeCode`, `?status`.
- ⚠️ Frontend hiện đang gọi `/reports/advertiser` (số ít) — cần sửa thành `/reports/advertisers` (xem §6.5).

### 12.2 Media Report (`GET /api/bff/reports/media`)

- Tương tự advertiser nhưng trả về 1 dòng cho mỗi (DailyInput, AdSiteDownstream junction).
- Có cột `shareRatio` (resolve từ `DownstreamPeriod.pctHal` theo đúng `(downstreamId, recordDate)`, chuẩn hoá qua `normalizePctHal()`, fallback `1.0` nếu không có period active) và `actualReceived = receivable * shareRatio` (làm tròn 3 số).
- Lọc tương tự + `?mediaId` (Upstream.id).

> ✅ `getMediaReport` batch-fetch tất cả `DownstreamPeriod` của các downstream liên quan (giới hạn theo cửa sổ ngày của report, tránh N+1), gom theo `downstreamId` rồi tìm period active trên từng `recordDate` — dùng cùng logic `pctHal` với `aggregateDownstreamCost` (`payout.service.ts`). Hard-code `payoutRate = 0.8` cũ đã được gỡ bỏ.

### 12.3 Total Profit (`GET /api/bff/reports/total-profit`)

- Group theo **(recordDate, Upstream, billingMethod)**.
- `revenue` = SUM `DailyInput.revenue`.
- `cost` = tổng cost từ tất cả active downstream của các DailyInput trong group + `yiyiCost` (nếu ngày đó có yiyi, mỗi ngày cộng 1 lần qua `yiyiAppliedDates` Set).
- Áp dụng `calculateProfit()` → trả `{ revenue, cost, grossProfit, tax, profit, profitRate, recordCount }`.

### 12.4 Order Profit (`GET /api/bff/reports/order-profit`)

- Group theo **(recordDate, AdType, Upstream, billingMethod)** — tương tự total-profit nhưng tách theo AdType.
- **Hiện KHÔNG cộng yiyiCost** (chỉ cộng downstream cost).
- Trả `{ ..., adTypeCode, adTypeName }`. Lưu ý: `orderId`/`orderName` đều trả `null` vì cấu trúc hiện tại group theo `adType.id` chứ không theo MediaAdOrder.

### 12.5 Dashboard Monthly (`GET /api/bff/dashboard/monthly?year&month`)

- Tái sử dụng `getTotalProfit()` cho toàn tháng, sau đó cộng dồn:
  - `monthly.revenue / cost / grossProfit / tax / profit` (= tổng các ngày)
  - `monthly.profitRate = profit / revenue` (trả 0 nếu revenue=0)
  - `monthly.recordCount`
- `daily` mảng = kết quả `getTotalProfit` từng ngày.

### 12.6 Settlement

- **Advertiser** (`GET /api/bff/settlement/advertisers`): group theo (advertiser, adType), `totalAmount = SUM(DailyInput.revenue)`. Không tính cost.
- **Media** (`GET /api/bff/settlement/media`): group theo (media, adType), `revenue = SUM(DailyInput.revenue)`, `cost` = aggregateDownstreamCost, áp dụng `calculateProfit`. Có thêm cột `downstreamName` (concat các `downstreamType` của junction).
- Lọc theo `period=YYYY-MM` (tính cả tháng, dùng `Date.UTC(year, month-1, 1)` → `Date.UTC(year, month, 0)`).
- `advertiserId` / `mediaId` filter là **String** (sau khi đổi ID sang String).

### 12.7 Yiyi Report (`GET /api/yiyi-data/monthly?year&month`)

- Trả 31 dòng (1 dòng/ngày), mỗi dòng có 4 kênh `yy-02-01..04` + `unit_price` + `profit_unit_price` (mặc định 2 và 1 nếu chưa set).
- Frontend dùng `api/yiyiApi.ts` (không qua `bffApi.ts`) vì endpoint mount ở `/api`, không phải `/api/bff`.

---

## 13. Module Yiyi

### 13.1 Mô hình

- 4 kênh cố định: `yy-02-01`, `yy-02-02`, `yy-02-03`, `yy-02-04`.
- Bảng `YiyiDailyData(channel, qty)` unique theo `(recordDate, channel)`.
- Bảng `YiyiDailyPricing` unique theo `recordDate` (1 dòng/ngày), cột `unitPrice` (mặc định 2) + `profitUnitPrice` (mặc định 1).

### 13.2 API

- `GET /api/yiyi-data?date=YYYY-MM-DD` → 4 dòng (qty=0 nếu thiếu).
- `GET /api/yiyi-data/monthly?year&month` → 31 dòng/tháng.
- `POST /api/yiyi-data/batch` body `{ date, items: [{channel, qty}, ...], pricing?: { unitPrice, profitUnitPrice } }`.

### 13.3 Cách tính yiyi cost

Trong `profitReport.service.ts`:
```
yiyiCost(ngày) = sum(qty 4 kênh) / 1000 * (unitPrice + profitUnitPrice)
```
Mỗi ngày chỉ cộng 1 lần vào total profit (dùng `Set<date>` để dedupe).

### 13.4 Lưu ý

- `YiyiData` page nằm trong sidebar mục "Nhập liệu".
- `YiyiReport` page nằm trong sidebar mục "Báo cáo".
- Frontend dùng `frontend/src/api/yiyiApi.ts` (riêng biệt, không qua `bffApi.ts`).

---

## 14. Nhật ký thao tác (OperationLog)

### 14.1 Cấu trúc

```
OperationLog {
  id         String   // opl_<timestamp>_<random6>  (inline format, KHÔNG dùng generateShortId)
  userId     String?  // null nếu system
  username   String?
  action     String   // CONFIRM_ADVERTISER | UNCONFIRM_MEDIA | QUARANTINE_* | RESTORE_* | HARD_DELETE | HARD_DELETE_BLOCKED | CREATE_MASTER_DATA | UPDATE_MASTER_DATA | DELETE_MASTER_DATA
  module     String   // dataEntry | quarantine | masterData
  targetType String?  // DailyInput | DailyInputQuarantineBatch | advertiser | adType | adSite | adId | downstream | mediaAdOrder | mediaId
  targetId   String?  // id hoặc danh sách id (csv)
  detail     String?  // JSON stringify (hoặc text ngắn cho dataEntry/quarantine)
  createdAt  DateTime
}
```

> ⚠️ Trong `quarantine.service.ts` PK được tạo qua `generateShortId()` (6-char alphanumeric), trong khi `advertiserBatch.service.ts` / `mediaBatch.service.ts` / `hardDelete.service.ts` dùng format inline `opl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`. Hai format tồn tại song song — cần thống nhất.

### 14.2 Action thường gặp

| Module | Action | Trigger |
|---|---|---|
| `dataEntry` | `CONFIRM_ADVERTISER` / `CONFIRM_MEDIA` | confirm batch |
| `dataEntry` | `UNCONFIRM_ADVERTISER` / `UNCONFIRM_MEDIA` | unconfirm |
| `quarantine` | `QUARANTINE_ADVERTISER` / `QUARANTINE_MEDIA` | tạo batch |
| `quarantine` | `RESTORE_QUARANTINE_BATCH` | restore |
| `masterData` | `HARD_DELETE` | xoá cứng thành công |
| `masterData` | `HARD_DELETE_BLOCKED` | xoá cứng bị block |
| `masterData` | `CREATE_ADVERTISER` / `UPDATE_*` / `DELETE_*` | CRUD master data |

### 14.3 Truy vấn

`GET /api/bff/oplog` (yêu cầu `oplog.read` hoặc `permAdmin`) — trang System.

---

## 15. Frontend — Cấu trúc & Routing

### 15.1 Stack

- React 19 + Vite 6 + TypeScript 5.8.
- State global: `AppContext` (user, page hiện tại, lang, permission checker).
- Không dùng Redux/Zustand; mỗi page tự quản lý state + gọi API qua `lib/bffApi.ts`.
- i18n đơn giản qua `lib/i18n.ts` (3 ngôn ngữ: `zh` mặc định, `vi`, `en`).

### 15.2 Luồng đăng nhập

1. `App.tsx` kiểm tra `localStorage[token]`. Nếu không có → render `<LoginPage />`.
2. Login submit → gọi `POST /api/auth/login` → nhận `data: { token, user }` (qua `unwrapData()`) → lưu `token` vào localStorage + dispatch `BFF_AUTH_TOKEN_CHANGED_EVENT`.
3. Sau login, `App.tsx` gọi `getCurrentUser()` (`GET /api/auth/me`) để lấy `AuthUser` mới nhất (kèm `permissions` từ RBAC).
4. Render `<AppProvider>` bao ngoài `<MainContent>`.

### 15.3 Sidebar & Permission

- Cấu trúc menu định nghĩa trong `lib/data.ts` (mảng `menu`).
- Mỗi page key ánh xạ sang permission key qua `PAGE_PERMISSION_MAP` trong `Sidebar.tsx`.
- `AppContext.can(permissionKey)`:
  1. `role='SUPER_ADMIN'` → true.
  2. `permissions.includes(key)` → true.
  3. Fallback theo `role='ADMIN'` / `perm_admin` (trừ `system.config`).
  4. Fallback theo `perm_data_input` (cho `dataEntry.read` / `dataEntry.create`).
  5. Fallback theo `perm_data_confirm` (cho `dataEntry.confirm`).
  6. Ngược lại → false (read-only).
- Mỗi nhóm menu (`mAdvertiserMgmt`, `mTrafficMgmt`, `mDataEntry`, …) tự động ẩn nếu tất cả children đều bị filter.

### 15.4 Nhóm menu chính

| Key menu | Icon | Children | Quyền |
|---|---|---|---|
| `mAdvertiserMgmt` | 📢 | AdvertiserList, AdTypeMgmt, AdIdMgmt | `advertiser.read` / `adId.read` / `role.update` |
| `mTrafficMgmt` | 📡 | DownstreamMgmt, MediaAdOrderMgmt, MediaIdMgmt | `media.read` |
| `mDataEntry` | 📥 | AiEntry (locked), AdvEntry, MediaDataMgmt, YiyiEntry | `dataEntry.read` |
| `mDataQuery` | 📊 | TotalProfit, OrderProfit, AdvQuery, MediaQuery, YiyiReport | `report.read` |
| `mSettlement` | 🧾 | AdvSettlement, MediaSettlement | `settlement.read` |
| `mOpLog` | 📋 | (single) | `auditLog.read` |
| `mSystemAdmin` | ⚙️ | UserManagement, RoleManagement, QuarantineMgmt | `user.read` / `role.read` / `quarantine.execute` |

> Menu `pMediaMgmt` (legacy) **bị ẩn** khỏi sidebar nhưng route vẫn tồn tại để tương thích ngược (xem `lib/data.ts`).
> Menu `pAdOrderMgmt` (cũ) **đã bị xoá** sau khi drop bảng AdOrder.

### 15.5 Các page quan trọng

| Page | File | Chức năng chính |
|---|---|---|
| Login | `Login.tsx` | Form đăng nhập |
| AdvertiserList | `Advertiser.tsx` | CRUD Upstream (advertiser) |
| AdIdMgmt | `Advertiser.tsx` | CRUD AdSite (gắn upstream + adType + billingMethod) |
| AdTypeMgmt | `AdTypeMgmt.tsx` | CRUD AdType (form 7 cột theo docx mục 1.2: STT, Nhà QC, Tên đơn QC, Số link, Ghi chú, Trạng thái, Thao tác) |
| DownstreamMgmt | `DownstreamMgmt.tsx` | CRUD Downstream + DownstreamPeriod |
| MediaAdOrderMgmt | `Media.tsx` | CRUD MediaAdOrder |
| MediaIdMgmt | `Media.tsx` | CRUD AdSiteDownstream (cascade Advertiser → AdSite) |
| AdvEntry | `DataEntry.tsx` | Bảng nhập liệu advertiser: ô rate + traffic + settlement → save batch → confirm |
| MediaDataMgmt | `DataEntry.tsx` | Bảng nhập liệu media (tương tự, có cột shareRatio) |
| AiEntry | `DataEntry.tsx` | **LOCKED** — hiển thị "featureLocked" (chưa implement) |
| TotalProfit / OrderProfit | `Reports.tsx` | Bảng lợi nhuận + filter theo tháng |
| AdvQuery / MediaQuery | `Reports.tsx` | Bảng truy vấn dòng dữ liệu |
| YiyiReport | `YiyiReport.tsx` | Bảng 31 dòng/tháng |
| AdvSettlement / MediaSettlement | `Settlement.tsx` | Settlement theo tháng |
| QuarantineMgmt | `QuarantineMgmt.tsx` | Tạo batch quarantine + restore + list |
| OpLog | `System.tsx` | Xem nhật ký |
| UserManagement | `UserManagement.tsx` | CRUD user + reset password |
| RoleManagement | `RoleManagement.tsx` | Sửa permission của role |

### 15.6 Đặc điểm UI

- Toàn bộ dùng **CSS thuần** (file `index.css` ở root, dùng CSS variables) + Tailwind utilities cho một số chỗ.
- Sidebar cố định bên trái, topbar cố định trên cùng (logo + user menu + đăng xuất).
- Các bảng dùng component `Table` tự build (sortable, pagination, filter).
- Tất cả giá trị ID trên UI hiển thị là **String** (6-char alphanumeric) thay vì number như trước.

---

## 16. Điểm mở cần xác nhận

| # | Câu hỏi | Tại sao quan trọng | Vị trí trong code |
|---|---|---|---|
| 1 | 3 cách tính tiền (CPM/CPS/CPA) đã đủ chưa, hay sẽ thêm? | Thêm `EntryType` mới → phải sửa `calculateRevenue` + validate + UI | `revenue.service.ts` |
| 2 | Thuế 6% có phải cố định không? | Đang hard-code `TAX_RATE = 0.06` | `payout.service.ts:24` |
| 3 | Lỗ có được trừ thuế không? | Hiện tại `grossProfit < 0` → `tax = 0` | `payout.service.ts:206` |
| 4 | Có cần thêm báo cáo riêng cho từng kênh quảng cáo (SM / 360 / BAIDU_JS) không? | Hiện đã có `adTypeCode` filter; có thể cần thêm dimension | `Reports.tsx` |
| 5 | YiyiCost có cần cộng vào Order Profit không? | Hiện total-profit có, order-profit chưa | `profitReport.service.ts` |
| 6 | ✅ ĐÃ FIX (2026-06-26): `MediaReport.shareRatioNum` đã resolve từ `DownstreamPeriod.pctHal` (qua `normalizePctHal`) thay vì hard-code 0.8 | Đã khớp với logic `aggregateDownstreamCost` | `report.service.ts:getMediaReport` |
| 7 | CORS `origin: true` trong dev có cần thắt chặt khi prod? | Có thể gây rủi ro nếu public | `app.ts:32` |
| 8 | Nhật ký thao tác cần lưu bao lâu? | Hiện tại giữ vĩnh viễn; có thể cần retention policy | `OperationLog` |
| 9 | Mật khẩu user có cần policy phức tạp (độ dài, ký tự đặc biệt)? | Hiện chỉ bcrypt, không validate | `users/user.service.ts` |
| 10 | `customPrice` trên AdSiteDownstream có cần lịch sử (startDate/endDate) giống rebateRate? | Hiện chỉ 1 giá hiện tại, đổi là đổi hết | `AdSiteDownstream` schema |
| 11 | `pctHal` trên AdSiteDownstream có ý nghĩa gì khi đã có trên DownstreamPeriod? | Có thể để override theo cặp, nhưng hiện code chỉ dùng từ Period | `payout.service.ts:268-277` |
| 12 | `YiyiReport` có cần trộn vào báo cáo lợi nhuận chính không, hay tách riêng? | Hiện chỉ cộng vào total-profit theo công thức `sum(qty)/1000 * (unit+profit)` | `profitReport.service.ts:32-49` |
| 13 | `MANAGER` role có thực sự cần không, hay chỉ enum-only? | Hiện không có code path nào dùng `MANAGER` | `bffTypes.ts:571` (chỉ enum) |
| 14 | `AiEntry` page có nên bị xoá khỏi menu, hay giữ như placeholder? | Hiện tại là placeholder "featureLocked" — chiếm menu slot nhưng không hoạt động | `DataEntry.tsx:146` |
| 15 | `AdSiteEvent` table có thực sự được dùng? | Schema có nhưng không thấy code path sử dụng | `AdSiteEvent` model |
| 16 | `AdSite.rebateRate` (Float) còn dùng không hay đã thay thế hoàn toàn bằng `AdSiteRebateRate`? | Doc nói "đã chuyển" nhưng code vẫn dùng làm fallback | `rebate.service.ts:49-58` |
| 17 | Router `/advertisers`, `/ad-ids`, `/media`, `/media-ids`, `/media-ad-orders` KHÔNG có `requireAuth` middleware — đây là bug hay cố ý? | Có thể truy cập dữ liệu nhạy cảm khi chưa đăng nhập | `advertiser.router.ts`, `adId.router.ts`, `media.router.ts`, `mediaId.router.ts`, `mediaAdOrder.router.ts` |
| 18 | Frontend `bffApi.ts` gọi `/reports/advertiser` (số ít) nhưng backend mount `/reports/advertisers` (số nhiều) → 404 | Advertiser Report không load được | `bffApi.ts:384` vs `report.router.ts:8` |
| 19 | Frontend `bffApi.ts` gọi `/quarantine` nhưng backend mount `/daily-input/quarantine` | Toàn bộ Quarantine không hoạt động | `bffApi.ts:440-449` vs `quarantine.router.ts:13-16` |
| 20 | Frontend `bffApi.ts` gọi `/roles/permissions` nhưng backend mount `/permissions` | Permission list 404 | `bffApi.ts:432` vs `role.router.ts:8` |
| 21 | `OperationLog.id` dùng 2 format song song (`generateShortId()` cho quarantine vs inline `opl_<ts>_<rand>` cho dataEntry/hardDelete) | Khó đối chiếu, cần thống nhất | `quarantine.service.ts:115` vs `advertiserBatch.service.ts:213` |
| 22 | `resolveDownstreamRate` throw → `aggregateDownstreamCost` catch lỗi và push vào `errors[]`. Có muốn trả `errors` qua response cho client biết? | Hiện `total-profit` / `order-profit` / `settlement` không expose errors ra ngoài | `payout.service.ts:67-135, 238-315` |

---

## 17. Lịch sử thay đổi lớn

### 2026-06-26: MediaReport shareRatio resolve từ DownstreamPeriod.pctHal
- **Gỡ hard-code `payoutRate = 0.8`** trong `getMediaReport` (`report.service.ts`). Thay bằng resolve `shareRatio` từ `DownstreamPeriod.pctHal` theo `(downstreamId, recordDate)`, chuẩn hoá qua `normalizePctHal()` (fallback `1.0`).
- Batch-fetch periods 1 lần theo cửa sổ ngày của report (tránh N+1), gom theo `downstreamId` rồi match period active từng ngày — cùng logic với `aggregateDownstreamCost`.
- Đổi tên param `payoutRate` → `shareRatioNum` trong `makeReportMediaRow` cho đúng ngữ nghĩa.
- Verify: `tsc --noEmit` sạch.

### 2026-06-26: Routes plural, Quarantine route đổi, AdSite.rebateRate xác nhận
- **Routes đổi sang số nhiều**: `/data-entry/advertiser` → `/data-entry/advertisers`, `/data-entry/media/confirm` → `/data-entry/media/confirm-batch`, `/data-entry/advertiser/confirm` → `/data-entry/advertisers/confirm-batch`, `/reports/advertiser` → `/reports/advertisers`, `/settlement/advertiser` → `/settlement/advertisers`.
- **Quarantine routes**: `/api/bff/quarantine` → `/api/bff/daily-input/quarantine`.
- **`resolveDownstreamRate` đổi từ "trả 0" → "throw"** khi không match rate. `aggregateDownstreamCost` catch lỗi, push vào `errors[]`.
- **`AdSite.rebateRate` (Float) xác nhận vẫn còn** trên schema — làm fallback khi không có `AdSiteRebateRate` đang hiệu lực.
- **`Downstream.payoutRate` API field no-op**: service validate nhưng không lưu.
- **Default delete chuyển sang soft delete** cho hầu hết entity (advertiser, adId, mediaAdOrder, downstream khi có ref, mediaId luôn throw).
- **`OperationLog.id` có 2 format song song** (xem §16 #21).
- **Phát hiện frontend↔backend route mismatch** (xem §16 #18-20) — đây là bug cần fix.

### 2026-06-24: Drop bảng AdOrder, mở rộng AdType
- **Drop bảng `AdOrder`** (migration `20260626000000_drop_ad_order_expand_ad_type`).
- **Mở rộng `AdType`** thêm 3 field:
  - `upstreamId: String?` (FK → Upstream, nullable) — Nhà QC sở hữu đơn QC.
  - `notes: String?` — ghi chú.
  - `status: String @default("active")` — active / inactive.
- **`MediaAdOrder` scope theo `(downstreamId, adTypeId, seq)`** (KHÔNG gắn với AdSite). Có `name` duy nhất toàn hệ thống.
- **Xoá folder `bff/ad-orders/`** + route `/api/bff/ad-orders/*` (thay bằng `/api/bff/media-ad-orders/`).
- **Đổi tất cả PK sang `String`** (6-char alphanumeric, generateShortId()).
- **Sửa `requirePermission.ts`**: bỏ permission keys `adOrder.*`.
- **Sửa `mappers.ts`**: bỏ `mapAdOrder`, `adOrder: { include: { adType: true } }` → `defaultAdType: { include: { adType: true } }`.
- **Mở rộng `AdTypeMgmt.tsx`** theo docx mục 1.2: 7 cột, form dropdown Nhà QC, dropdown Trạng thái.
- **Sửa cascade `MediaIdMgmt`**: bỏ Advertiser → AdOrder → AdSite, giữ Advertiser → AdSite (qua AdType).
- **Sửa toàn bộ frontend**: `bffApi.ts` bỏ 5 hàm `listAdOrders/createAdOrder/...`; thêm `MediaAdOrder` CRUD.
- **Sửa 30+ lỗi TypeScript** do đổi `id: number` → `id: string` trên khắp schema.
- **Build thành công**: backend `tsc` sạch, frontend `tsc` sạch.
- **Test end-to-end**: login admin → dashboard → list 11 advertisers OK.

### Planned (xem §16)
- TODO: sửa frontend↔backend route mismatch (§16 #18-20).
- TODO: thêm `requireAuth` cho các router public (§16 #17).
- TODO: thống nhất `OperationLog.id` format (§16 #21).
- TODO: validate password policy.
- TODO: AiEntry page — implement hoặc bỏ khỏi menu.
- TODO: CORS hardening cho production.

