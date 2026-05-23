# Báo cáo kỹ thuật — Module Quản trị Tài khoản, Vai trò và Phân quyền

**Date:** 2026-05-23
**Branch:** 110526
**Tác giả:** Claude Code audit
**Mục đích:** Cung cấp thông tin đầy đủ để AI khác implement module RBAC

---

## 1. Tổng quan kiến trúc project

### 1.1 Backend
- **Framework:** Express.js 4.x (`express`)
- **Runtime:** Node.js với TypeScript (`tsx watch`)
- **ORM:** Prisma 6.x (`@prisma/client`) — kết nối PostgreSQL
- **Validation:** `express-validator`
- **Auth:** JWT (`jsonwebtoken`) + `bcrypt` để hash password
- **Entry point:** [src/index.ts](src/index.ts)
- **Cấu trúc folder backend:**
  ```
  src/
    index.ts                    # Entry point, mount tất cả router
    prisma.ts                  # Prisma client singleton
    middleware/
      auth.ts                  # requireAuth, requirePermission, requireWriteAccess
    routes/
      admin.ts                 # Admin routes (ad-sites, upstreams, downstreams, users, auth)
      bff/                     # BFF adapter layer
        index.ts               # Mount BFF routers
        advertiser.controller.ts
        media.controller.ts
        adOrder.controller.ts
        adId.controller.ts
        mediaId.controller.ts
        downstream.controller.ts
        advertiserDataEntry.controller.ts
        mediaDataEntry.controller.ts
        report.controller.ts
        settlement.controller.ts
        operationLog.controller.ts
      dailyInput.ts
      dashboard.ts
      yiyiData.ts
      leDashboard.ts
    services/
      operationLog.service.ts  # createOperationLog
    types/
      index.ts                # Shared TypeScript types (UserPublic, UserRole, etc.)
    utils/
      date.ts
      calculations.ts
      constants.ts
  ```

### 1.2 Frontend
- **Framework:** React 18 + Vite 6 (`vite`)
- **State:** React Context (`AppContext`)
- **Styling:** CSS thuần + CSS variables, một số Tailwind-like utilities
- **i18n:** Có — [frontend/src/lib/i18n.ts](frontend/src/lib/i18n.ts)
- **Entry point:** [frontend/src/main.tsx](frontend/src/main.tsx)
- **Cấu trúc folder frontend:**
  ```
  frontend/src/
    main.tsx                   # React entry
    App.tsx                    # Root component, token check, routing
    AppContext.tsx             # Global context (lang, page, t(), modal, etc.)
    index.css                  # Global styles
    components/
      Sidebar.tsx              # Left navigation + user info
      Topbar.tsx               # Breadcrumb + lang switcher + logout
    pages/
      Login.tsx               # LoginPage
      Advertiser.tsx           # Advertiser management
      DataEntry.tsx           # AI Entry + AdvEntry + MediaDataMgmt
      Reports.tsx             # TotalProfit, OrderProfit, AdvQuery, MediaQuery
      Settlement.tsx          # AdvSettlement, MediaSettlement
      System.tsx              # OpLog (operation log)
    lib/
      bffApi.ts               # BFF API client (fetch wrapper)
      bffTypes.ts             # TypeScript types cho API data
      i18n.ts                 # i18n translations
      data.ts                 # Menu structure, initialDb
      featureFlags.ts         # FEATURE_FLAGS, visibleMenu
  ```

### 1.3 Database
- **PostgreSQL** (theo `datasource db.provider = "postgresql"` trong schema.prisma)
- **File seed:** [prisma/seed.ts](prisma/seed.ts) — tạo dữ liệu mẫu + user admin/editor

---

## 2. Auth hiện tại

### 2.1 Auth đã có thật

**Backend:**
- Đăng nhập: `POST /api/auth/login` → trong [src/routes/admin.ts:2119-2198](src/routes/admin.ts#L2119)
  - Body: `{ username, password }`
  - Response: `{ success: true, token, user: UserPublic }`
  - Rate limit: 10 attempts / 15 phút / IP+username (via `createMemoryRateLimiter`)
  - JWT expires: 8h
- Lấy current user: `GET /api/auth/me` → trong [src/routes/admin.ts:2204-2233](src/routes/admin.ts#L2204)
- Backend middleware auth: [src/middleware/auth.ts](src/middleware/auth.ts)

**Frontend:**
- Login page: [frontend/src/pages/Login.tsx](frontend/src/pages/Login.tsx)
- Token storage: `localStorage.getItem('token')` — key `BFF_AUTH_TOKEN_STORAGE_KEY = 'token'`
- Gọi API login: `login()` trong [frontend/src/lib/bffApi.ts:152](frontend/src/lib/bffApi.ts#L152)
- Token parsing: `getUsernameFromToken()` trong [frontend/src/lib/bffApi.ts:88](frontend/src/lib/bffApi.ts#L88) — decode JWT payload để lấy username

### 2.2 User model hiện tại

Prisma model `User` trong [prisma/schema.prisma:235-246](prisma/schema.prisma#L235):

```prisma
model User {
  id               Int       @id @default(autoincrement())
  username         String    @unique
  passwordHash     String
  role             String    @default("EDITOR") // ADMIN | EDITOR | VIEWER
  permDataInput    Boolean   @default(false)
  permDataConfirm  Boolean   @default(false)
  permAdmin        Boolean   @default(false)
  status           String    @default("active") // active | inactive
  lastLoginAt      DateTime?
  createdAt        DateTime  @default(now())
}
```

**TypeScript types** trong [src/types/index.ts:195-205](src/types/index.ts#L195):
```typescript
export type UserRole = "ADMIN" | "EDITOR" | "VIEWER"
export interface UserPublic {
  id: number
  username: string
  role: UserRole
  perm_data_input: boolean
  perm_data_confirm: boolean
  perm_admin: boolean
  status: UserStatus
  last_login_at?: Date
  created_at: Date
}
```

### 2.3 Auth middleware

[src/middleware/auth.ts](src/middleware/auth.ts):
- `requireAuth` — verify JWT, gắn `req.user = UserPublic`
- `requirePermission(perm)` — check `req.user[perm] === true` cho `perm_data_input | perm_data_confirm | perm_admin`
- `requireWriteAccess` — reject VIEWER role với 403

### 2.4 Seed users

[prisma/seed.ts:198-223](prisma/seed.ts#L198):
| Username | Password | Role | permDataInput | permDataConfirm | permAdmin |
|---|---|---|---|---|---|
| `admin` | `admin123` | ADMIN | true | true | true |
| `editor` | `editor123` | EDITOR | true | false | false |

### 2.5 Frontend auth state

- Token được lưu trong `localStorage` key `'token'`
- App.tsx check: `if (!token) return <LoginPage />` → nếu không có token → login page
- Sidebar hiện tại **hard-code** `t('roleAdmin')` cho mọi user — chưa đọc role thực tế
- `AppContext` **không lưu user info** — chỉ có token, lang, page, modal

---

## 3. Admin/current account hiện tại

### 3.1 Admin account trong seed

- Username: `admin` / password: `admin123` — ADMIN role, full permissions
- Username: `editor` / password: `editor123` — EDITOR role, chỉ permDataInput = true

### 3.2 Role hiện tại

Hệ thống định nghĩa 3 roles: `ADMIN | EDITOR | VIEWER` (trong cả backend lẫn frontend types).

### 3.3 Hard-coded quyền admin ở Frontend

**[frontend/src/components/Sidebar.tsx:71](frontend/src/components/Sidebar.tsx#L71):**
```tsx
<div className="sb-role">{t('roleAdmin')}</div>
```
→ **hard-coded label** `roleAdmin` cho tất cả user, không phân biệt role.

### 3.4 Các chỗ phân biệt role

Backend kiểm tra:
- `requirePermission('perm_admin')` — check boolean `req.user.perm_admin`
- `requireWriteAccess` — reject nếu `req.user.role === 'VIEWER'`

Frontend **không** kiểm tra role ở mức UI — không ẩn/hiện menu theo role.

---

## 4. Database/Prisma schema

### 4.1 Tất cả model hiện tại

| Model | File:Line | Mô tả |
|---|---|---|
| `AdType` | [prisma/schema.prisma:14](prisma/schema.prisma#L14) | Loại quảng cáo (SM, 360, BAIDU_JS, OTHER) |
| `Upstream` | [prisma/schema.prisma:29](prisma/schema.prisma#L29) | Nhà quảng cáo (demand side) |
| `AdOrder` | [prisma/schema.prisma:52](prisma/schema.prisma#L52) | Đơn quảng cáo cho mỗi upstream×adType |
| `AdSite` | [prisma/schema.prisma:89](prisma/schema.prisma#L89) | Ad slot (vị trí quảng cáo) |
| `AdSiteRebateRate` | [prisma/schema.prisma:71](prisma/schema.prisma#L71) | Tỷ lệ rebate SM CPM |
| `AdSiteEvent` | [prisma/schema.prisma:117](prisma/schema.prisma#L117) | Sự kiện AdSite (CREATED, PAUSED, RESUMED, DIED, NOTE) |
| `AdSiteDownstream` | [prisma/schema.prisma:133](prisma/schema.prisma#L133) | Junction AdSite ↔ Downstream |
| `DailyInput` | [prisma/schema.prisma:150](prisma/schema.prisma#L150) | Dữ liệu ngày (doanh thu, qty, giá) |
| `Downstream` | [prisma/schema.prisma:180](prisma/schema.prisma#L180) | Hạ nguồn (ML, LE, YIYI) |
| `DownstreamPeriod` | [prisma/schema.prisma:200](prisma/schema.prisma#L200) | Period của downstream (pctHal, unitPrice) |
| `DailyDownstreamRate` | [prisma/schema.prisma:219](prisma/schema.prisma#L219) | Tỷ giá downstream theo ngày |
| **`User`** | [prisma/schema.prisma:235](prisma/schema.prisma#L235) | Tài khoản người dùng |
| `YiyiDailyData` | [prisma/schema.prisma:251](prisma/schema.prisma#L251) | Dữ liệu ngày Yiyi |
| `YiyiDailyPricing` | [prisma/schema.prisma:261](prisma/schema.prisma#L261) | Pricing Yiyi |
| `LEDailyCost` | [prisma/schema.prisma:272](prisma/schema.prisma#L272) | Chi phí LE |
| `OperationLog` | [prisma/schema.prisma:284](prisma/schema.prisma#L284) | Log thao tác |

### 4.2 Model liên quan đến User/Auth

- **`User`** — đã có đầy đủ: username, passwordHash, role, permDataInput, permDataConfirm, permAdmin, status, lastLoginAt, createdAt
- **Không có** model: `Role`, `Permission`, `RolePermission`, `Account`
- **Không có** relation giữa User và OperationLog (OperationLog có `userId Int?` nhưng không phải FK)

### 4.3 Enum/status hiện tại

- `role`: `"ADMIN" | "EDITOR" | "VIEWER"` (User model, String)
- `status` (User): `"active" | "inactive"`
- `status` (Upstream/AdSite/Downstream): `"active" | "inactive"`
- `status` (DailyInput): `"unconfirmed" | "confirmed"`

### 4.4 Migration

Chưa xác định — không có folder `prisma/migrations/` trong cấu trúc. Database có thể đang dùng `prisma db push` hoặc có migrations riêng.

---

## 5. Backend routes hiện tại

### 5.1 Route groups

**File: [src/index.ts](src/index.ts)**
```
/api/daily-input    → dailyInputRouter
/api/dashboard      → dashboardRouter
/api                → adminRouter      ← chứa auth/users/admin
/api                → yiyiDataRouter
/api/bff            → bffRouter        ← BFF adapter layer
```

### 5.2 Auth routes

**File: [src/routes/admin.ts:2119](src/routes/admin.ts#L2119)**

| Method | Path | Middleware | Mô tả |
|---|---|---|---|
| POST | `/api/auth/login` | — | Login |
| GET | `/api/auth/me` | `requireAuth` | Current user info |

### 5.3 User management routes

**File: [src/routes/admin.ts](src/routes/admin.ts)**

| Method | Path | Middleware | Mô tả |
|---|---|---|---|
| GET | `/api/users` | `requireAuth, requirePermission('perm_admin')` | List all users |
| POST | `/api/users` | `requireAuth, requireWriteAccess, requirePermission('perm_admin')` | Create user |
| PUT | `/api/users/:id` | `requireAuth, requireWriteAccess, requirePermission('perm_admin')` | Update user |
| DELETE | `/api/users/:id` | `requireAuth, requireWriteAccess, requirePermission('perm_admin')` | Delete user |

### 5.4 Admin routes (AdSite, Upstream, Downstream management)

**File: [src/routes/admin.ts](src/routes/admin.ts)**

| Method | Path | Middleware | Cần perm gì |
|---|---|---|---|
| GET | `/api/admin/ad-sites` | `requireAuth` | — |
| GET | `/api/admin/downstreams` | `requireAuth` | — |
| GET | `/api/admin/downstream-periods` | `requireAuth` | — |
| GET | `/api/admin/ad-sites/:id/rebates` | `requireAuth, requirePermission('perm_admin')` | perm_admin |
| POST | `/api/admin/ad-sites/:id/rebates` | `requireAuth, requireWriteAccess, requirePermission('perm_admin')` | perm_admin |
| PUT | `/api/admin/ad-sites/:id/rebates/:rebateId` | `requireAuth, requireWriteAccess, requirePermission('perm_admin')` | perm_admin |
| DELETE | `/api/admin/ad-sites/:id/rebates/:rebateId` | `requireAuth, requireWriteAccess, requirePermission('perm_admin')` | perm_admin |
| POST | `/api/admin/ad-sites/:id/rebates/recalculate` | `requireAuth, requireWriteAccess, requirePermission('perm_admin')` | perm_admin |
| GET | `/api/admin/ad-types` | `requireAuth, requirePermission('perm_admin')` | perm_admin |
| POST | `/api/admin/ad-types` | `requireAuth, requireWriteAccess, requirePermission('perm_admin')` | perm_admin |
| PUT | `/api/admin/ad-types/:id` | `requireAuth, requireWriteAccess, requirePermission('perm_admin')` | perm_admin |
| DELETE | `/api/admin/ad-types/:id` | `requireAuth, requireWriteAccess, requirePermission('perm_admin')` | perm_admin |
| POST | `/api/admin/ad-sites` | `requireAuth, requireWriteAccess, requirePermission('perm_admin')` | perm_admin |
| PUT | `/api/admin/ad-sites/:id` | `requireAuth, requireWriteAccess, requirePermission('perm_admin')` | perm_admin |
| PUT | `/api/admin/ad-sites/:id/toggle-active` | `requireAuth, requireWriteAccess, requirePermission('perm_admin')` | perm_admin |
| PUT | `/api/admin/ad-sites/:id/toggle-archive` | `requireAuth, requireWriteAccess, requirePermission('perm_admin')` | perm_admin |
| DELETE | `/api/admin/ad-sites/:id` | `requireAuth, requireWriteAccess, requirePermission('perm_admin')` | perm_admin |
| POST | `/api/admin/downstreams` | `requireAuth, requireWriteAccess, requirePermission('perm_admin')` | perm_admin |
| PUT | `/api/admin/downstreams/:id` | `requireAuth, requireWriteAccess, requirePermission('perm_admin')` | perm_admin |
| DELETE | `/api/admin/downstreams/:id` | `requireAuth, requireWriteAccess, requirePermission('perm_admin')` | perm_admin |
| GET | `/api/admin/upstreams` | `requireAuth, requirePermission('perm_admin')` | perm_admin |
| POST | `/api/admin/upstreams` | `requireAuth, requireWriteAccess, requirePermission('perm_admin')` | perm_admin |
| PUT | `/api/admin/upstreams/:id` | `requireAuth, requireWriteAccess, requirePermission('perm_admin')` | perm_admin |
| DELETE | `/api/admin/upstreams/:id` | `requireAuth, requireWriteAccess, requirePermission('perm_admin')` | perm_admin |
| POST | `/api/admin/downstream-rates` | `requireAuth, requireWriteAccess, requirePermission('perm_admin')` | perm_admin |
| GET | `/api/admin/downstream-rates` | `requireAuth` | — |

### 5.5 BFF Routes

**File: [src/routes/bff/index.ts](src/routes/bff/index.ts)**

| Router | Path | Protected by |
|---|---|---|
| `advertiserController` | `/api/bff/advertisers` | `requireAuth` — via BFF controllers |
| `mediaController` | `/api/bff/media` | `requireAuth` |
| `adOrderController` | `/api/bff/ad-orders` | `requireAuth` |
| `adIdController` | `/api/bff/ad-ids` | `requireAuth` |
| `mediaIdController` | `/api/bff/media-ids` | `requireAuth` |
| `downstreamController` | `/api/bff/downstreams` | `requireAuth` |
| `advertiserDataEntryController` | `/api/bff/data-entry/advertisers` | `requireAuth, requirePermission('perm_data_input')` |
| `mediaDataEntryController` | `/api/bff/data-entry/media` | `requireAuth, requirePermission('perm_data_input')` |
| `reportController` | `/api/bff/reports` | `requireAuth` (reports default to confirmed) |
| `settlementController` | `/api/bff/settlement` | `requireAuth` |
| `operationLogController` | `/api/bff/operation-logs` | `requireAuth` |

### 5.6 Routes quan trọng cần bảo vệ thêm

Khi implement RBAC, các route sau **chưa có kiểm tra permission chi tiết**:

- `GET /api/admin/ad-sites` — chỉ `requireAuth`, mọi user đều xem được
- `GET /api/admin/downstreams` — chỉ `requireAuth`
- `GET /api/admin/downstream-periods` — chỉ `requireAuth`
- `GET /api/admin/downstream-sites/:downstreamId/inputs` — chỉ `requireAuth`
- `GET /api/admin/downstream-rates` — chỉ `requireAuth`
- Tất cả BFF route controllers — chỉ `requireAuth` (không có per-method permission)

---

## 6. Frontend routes/UI

### 6.1 Menu/Sidebar

**File:** [frontend/src/components/Sidebar.tsx](frontend/src/components/Sidebar.tsx)
**Menu data:** [frontend/src/lib/data.ts](frontend/src/lib/data.ts) — biến `menu`

```typescript
export const menu = [
  { key: 'mAdvertiserMgmt', icon: '📢', children: ['pAdvertiserList', 'pAdOrderMgmt', 'pAdIdMgmt'] },
  { key: 'mTrafficMgmt', icon: '📡', children: ['pMediaMgmt', 'pMediaAdOrderMgmt', 'pMediaIdMgmt'] },
  { key: 'mDataEntry', icon: '📥', children: ['pAiEntry', 'pAdvEntry', 'pMediaDataMgmt'] },
  { key: 'mDataQuery', icon: '📊', children: ['pTotalProfit', 'pOrderProfit', 'pAdvQuery', 'pMediaQuery'] },
  { key: 'mSettlement', icon: '🧾', children: ['pAdvSettlement', 'pMediaSettlement'] },
  { key: 'mOpLog', icon: '📋', single: true },
];
```

**Visibility:** [frontend/src/lib/featureFlags.ts](frontend/src/lib/featureFlags.ts) — `visibleMenu` filtered by `FEATURE_FLAGS.settlement`

### 6.2 Frontend routing

- **Không có react-router** — dùng `currentPage` state trong `AppContext`
- Page rendering: [frontend/src/App.tsx](frontend/src/App.tsx) — `switch(currentPage)` map đến component
- Transitions: component unmount remount khi chuyển page

### 6.3 Trang hiện có

| Page Key | Component | File |
|---|---|---|
| `pAdvertiserList` | AdvertiserList | [frontend/src/pages/Advertiser.tsx](frontend/src/pages/Advertiser.tsx) |
| `pAdOrderMgmt` | AdOrderMgmt | cùng file |
| `pAdIdMgmt` | AdIdMgmt | cùng file |
| `pMediaMgmt` | MediaMgmt | [frontend/src/pages/Media.tsx](frontend/src/pages/Media.tsx) |
| `pMediaAdOrderMgmt` | MediaAdOrderMgmt | cùng file |
| `pMediaIdMgmt` | MediaIdMgmt | cùng file |
| `pAiEntry` | AiEntry | [frontend/src/pages/DataEntry.tsx](frontend/src/pages/DataEntry.tsx) |
| `pAdvEntry` | AdvEntry | cùng file |
| `pMediaDataMgmt` | MediaDataMgmt | cùng file |
| `pTotalProfit` | TotalProfit | [frontend/src/pages/Reports.tsx](frontend/src/pages/Reports.tsx) |
| `pOrderProfit` | OrderProfit | cùng file |
| `pAdvQuery` | AdvQuery | cùng file |
| `pMediaQuery` | MediaQuery | cùng file |
| `pAdvSettlement` | AdvSettlement | [frontend/src/pages/Settlement.tsx](frontend/src/pages/Settlement.tsx) |
| `pMediaSettlement` | MediaSettlement | cùng file |
| `mOpLog` | OpLog | [frontend/src/pages/System.tsx](frontend/src/pages/System.tsx) |
| Login | LoginPage | [frontend/src/pages/Login.tsx](frontend/src/pages/Login.tsx) |

### 6.4 i18n

- **File:** [frontend/src/lib/i18n.ts](frontend/src/lib/i18n.ts)
- 3 ngôn ngữ: `zh`, `vi`, `en`
- Key dùng cho label: `'roleAdmin'`, `'confirmed'`, `'pendingConfirm'`, etc.

### 6.5 Cơ chế ẩn/hiện menu theo role

**Hiện tại: KHÔNG CÓ** — Sidebar render tất cả menu items, không kiểm tra role.

### 6.6 User info display

[frontend/src/components/Sidebar.tsx:67-72](frontend/src/components/Sidebar.tsx#L67):
```tsx
<div className="sb-user">
  <div className="sb-avatar">{getUsernameFromToken().charAt(0).toUpperCase()}</div>
  <div>
    <div className="sb-username">{getUsernameFromToken()}</div>
    <div className="sb-role">{t('roleAdmin')}</div>  // ← hard-coded!
  </div>
</div>
```

→ Chỉ hiện username từ JWT, role label hard-coded là "roleAdmin" (Administrator).

---

## 7. Permission matrix đề xuất

### 7.1 Module.action permission

Dựa trên hệ thống hiện tại, đề xuất permission sau:

| Permission | Mô tả | Backend routes | Frontend UI |
|---|---|---|---|
| `user.read` | Xem danh sách users | `GET /api/users` | Menu/User management page |
| `user.create` | Tạo user mới | `POST /api/users` | Button "New User" |
| `user.update` | Sửa user | `PUT /api/users/:id` | Edit user button |
| `user.delete` | Xóa user | `DELETE /api/users/:id` | Delete button |
| `user.disable` | Vô hiệu hóa user | `PUT /api/users/:id` (status) | Disable/enable toggle |
| `advertiser.read` | Xem advertiser | BFF `GET /api/bff/advertisers` | AdvertiserList page |
| `advertiser.create` | Tạo advertiser | BFF `POST /api/bff/advertisers` | New advertiser button |
| `advertiser.update` | Sửa advertiser | BFF `PUT /api/bff/advertisers/:id` | Edit button |
| `advertiser.delete` | Xóa advertiser | BFF `DELETE /api/bff/advertisers/:id` | Delete button |
| `adOrder.read` | Xem ad orders | BFF `GET /api/bff/ad-orders` | AdOrderMgmt page |
| `adOrder.create` | Tạo ad order | BFF `POST /api/bff/ad-orders` | New ad order button |
| `adOrder.update` | Sửa ad order | BFF `PUT /api/bff/ad-orders/:id` | Edit button |
| `adOrder.delete` | Xóa ad order | BFF `DELETE /api/bff/ad-orders/:id` | Delete button |
| `adId.read` | Xem ad IDs | BFF `GET /api/bff/ad-ids` | AdIdMgmt page |
| `adId.create` | Tạo ad ID | BFF `POST /api/bff/ad-ids` | New ad ID button |
| `adId.update` | Sửa ad ID | BFF `PUT /api/bff/ad-ids/:id` | Edit button |
| `adId.delete` | Xóa/archive ad ID | BFF `DELETE /api/bff/ad-ids/:id` | Delete button |
| `media.read` | Xem media | BFF `GET /api/bff/media` | MediaMgmt page |
| `media.create` | Tạo media | BFF `POST /api/bff/media` | New media button |
| `media.update` | Sửa media | BFF `PUT /api/bff/media/:id` | Edit button |
| `media.delete` | Xóa media | BFF `DELETE /api/bff/media/:id` | Delete button |
| `dataEntry.read` | Xem data entry | BFF `GET /api/bff/data-entry/*` | Data entry pages |
| `dataEntry.create` | Nhập dữ liệu | BFF `POST /api/bff/data-entry/*` | Save button |
| `dataEntry.confirm` | Xác nhận dữ liệu | BFF `POST /api/bff/data-entry/*/confirm` | Confirm button |
| `report.read` | Xem báo cáo | BFF `GET /api/bff/reports/*` | Reports pages |
| `report.export` | Export CSV | Trong page | Export button |
| `settlement.read` | Xem settlement | BFF `GET /api/bff/settlement/*` | Settlement pages |
| `auditLog.read` | Xem operation log | `GET /api/bff/operation-logs` | OpLog page |
| `system.config` | Sửa cấu hình hệ thống | Các route admin/ad-* khác | Admin settings page |

### 7.2 Mapping vào middleware hiện tại

Middleware hiện tại dùng 3 permission flags boolean:
- `perm_data_input` — cho phép nhập dữ liệu
- `perm_data_confirm` — cho phép xác nhận dữ liệu
- `perm_admin` — full admin access

Có thể giữ nguyên 3 flag hoặc mở rộng thành RBAC đầy đủ.

---

## 8. Role mặc định đề xuất

### 8.1 SUPER_ADMIN (superadmin)

- **Mô tả:** Toàn quyền hệ thống, không bị giới hạn. Dùng cho owner/cto.
- **Permissions:** Tất cả mọi quyền
- **Backend:** `role = 'SUPER_ADMIN'` hoặc check `user.id === 1` (user đầu tiên)
- **UI:** Thấy tất cả menu, thấy user management, audit log

### 8.2 ADMIN (admin)

- **Mô tả:** Quản trị hệ thống. Có thể quản lý advertisers, media, ad orders, ad IDs, downstream, users.
- **Permissions:**
  - advertiser: read, create, update, delete
  - media: read, create, update, delete
  - adOrder: read, create, update, delete
  - adId: read, create, update, delete
  - dataEntry: read, create, confirm
  - report: read, export
  - settlement: read
  - auditLog: read
  - user: read (không tạo/xóa với SUPER_ADMIN)
- **Backend:** `role = 'ADMIN'` → `perm_admin = true`
- **UI:** Không thấy user management (nếu tách riêng), thấy tất cả menu quản lý

### 8.3 MANAGER (manager)

- **Mô tả:** Quản lý nghiệp vụ. Có thể nhập và xác nhận dữ liệu, xem báo cáo.
- **Permissions:**
  - advertiser: read, create (không delete)
  - adOrder: read, create (không delete)
  - adId: read, create (không delete)
  - media: read, create (không delete)
  - dataEntry: read, create, confirm
  - report: read, export
  - settlement: read
- **Backend:** `role = 'MANAGER'` → `perm_data_input = true, perm_data_confirm = true, perm_admin = false`
- **UI:** Không thấy menu quản trị (ad-sites, ad-types, downstreams), không thấy user management

### 8.4 OPERATOR (operator)

- **Mô tả:** Nhân viên nhập liệu. Chỉ nhập dữ liệu, không xác nhận.
- **Permissions:**
  - dataEntry: read, create (không confirm)
  - report: read
  - advertisement: read
  - media: read
- **Backend:** `role = 'OPERATOR'` → `perm_data_input = true, perm_data_confirm = false, perm_admin = false`
- **UI:** Chỉ thấy menu data entry và report

### 8.5 VIEWER (viewer)

- **Mô tả:** Chỉ xem, không sửa gì.
- **Permissions:**
  - report: read
  - advertisement: read
  - media: read
- **Backend:** `role = 'VIEWER'` → `requireWriteAccess` block tất cả write
- **UI:** Chỉ thấy menu reports (read-only), không thấy edit/create button

---

## 9. Rủi ro khi implement

### 9.1 File nhạy cảm — dễ làm vỡ hệ thống

- **[src/middleware/auth.ts](src/middleware/auth.ts)** — Thay đổi sai sẽ disable auth toàn bộ hệ thống
- **[src/routes/admin.ts](src/routes/admin.ts)** — Thay đổi sai middleware chain sẽ open security holes
- **[prisma/schema.prisma](prisma/schema.prisma)** — Thay đổi User model không tươ thích sẽ break production data
- **[src/index.ts](src/index.ts)** — Mounting sai router

### 9.2 Phụ thuộc giả định admin hiện tại

- **Seed admin hard-coded:** [prisma/seed.ts:198-210](prisma/seed.ts#L198) — tạo admin/admin123
- **Sidebar role hard-coded:** [frontend/src/components/Sidebar.tsx:71](frontend/src/components/Sidebar.tsx#L71) — `t('roleAdmin')` cho mọi user
- **Frontend AppContext** không lưu user role — chỉ có token
- **Frontend không check permissions** ở UI level — chỉ backend enforce

### 9.3 Route chưa được bảo vệ

Những route sau **chỉ có `requireAuth`**, mọi authenticated user đều truy cập được:

- `GET /api/admin/ad-sites` — danh sách ad sites
- `GET /api/admin/downstreams` — downstream
- `GET /api/admin/downstream-periods` — periods
- `GET /api/admin/downstream-sites/:downstreamId/inputs` — inputs
- `GET /api/admin/downstream-rates` — rates
- Tất cả BFF routes — chỉ `requireAuth`, không per-method permission

### 9.4 Chỗ cần audit log

Hiện tại `createOperationLog` đã được gọi trong:
- `src/routes/admin.ts` — login success/failed, ad-sites events, user create/delete
- `src/services/operationLog.service.ts` — best-effort, không throw

Khi implement RBAC, cần log thêm:
- Phân quyền user/role
- Thay đổi permissions
- Login/Logout
- DELETE user
- Thay đổi role của user khác

### 9.5 Thay đổi cần migration database

- **Thêm bảng `Role`** (id, name, description, isSystem)
- **Thêm bảng `Permission`** (id, key, description)
- **Thêm bảng `RolePermission`** (roleId, permissionKey)
- **Thay đổi bảng `User`** — có 2 lựa chọn:
  - Option A: Giữ nguyên User model, thêm `roleId` FK (đề xuất)
  - Option B: Xóa các cột `permDataInput`, `permDataConfirm`, `permAdmin`, thay bằng `roleId`
- **Seed bảng Role/Permission** mới

### 9.6 Thay đổi có thể ảnh hưởng dữ liệu cũ

- Nếu thay đổi `User.role` từ string (ADMIN/EDITOR/VIEWER) sang `roleId` FK → cần migrate dữ liệu
- Nếu xóa `permDataInput/permDataConfirm/permAdmin` columns → cần migrate sang Role/Permission
- User đang active: cần assign default role khi migrate

---

## 10. Kế hoạch implement theo phase

### Phase 1 — Backend foundation (không có UI)

**Mục tiêu:** Cơ sở hạ tầng RBAC backend, chưa cần UI phức tạp.

1. **Database migrations:**
   - Tạo bảng `Role`: id, name, description, isSystem, createdAt
   - Tạo bảng `Permission`: id, key (unique), description, createdAt
   - Tạo bảng `RolePermission`: roleId, permissionKey (PK composite)
   - Thêm `roleId` vào `User` model (nullable, FK)
   - Giữ nguyên các trường `permDataInput/permDataConfirm/permAdmin` để backward compatibility

2. **Seed script cập nhật:**
   - Seed các role: SUPER_ADMIN, ADMIN, MANAGER, OPERATOR, VIEWER
   - Seed các permission keys
   - Seed RolePermission cho mỗi role
   - Cập nhật user `admin` có `roleId` = SUPER_ADMIN
   - Cập nhật user `editor` có `roleId` = OPERATOR

3. **Backend middleware nâng cấp:**
   - Nâng cấp `requirePermission` trong [src/middleware/auth.ts](src/middleware/auth.ts) để check permission key
   - Thêm `requireRole(roles[])` middleware
   - Cập nhật `toUserPublic` để include role permissions

4. **User management API nâng cấp:**
   - Cập nhật `GET /api/users` — trả về role info
   - Cập nhật `POST /api/users` — gán roleId
   - Cập nhật `PUT /api/users/:id` — cập nhật roleId
   - Thêm `GET /api/roles` (public for frontend dropdown)
   - Thêm `GET /api/permissions` (public for frontend display)

**Không touch:** Frontend, không tạo UI mới, không sửa bussiness logic.

### Phase 2 — Frontend UI (user/role management)

**Mục tiêu:** UI quản lý người dùng và vai trò, ẩn/hiện menu theo permission.

1. **AppContext nâng cấp:**
   - Lưu `user.role`, `user.permissions` vào context khi login
   - Thêm helper: `can(permissionKey): boolean`

2. **User management page:**
   - Tạo `frontend/src/pages/UserManagement.tsx`
   - List users, create/edit/delete/disable user
   - Gán role cho user
   - Thêm route key: `pUserManagement`

3. **Role management page:**
   - Tạo `frontend/src/pages/RoleManagement.tsx`
   - List roles, view permissions per role
   - Thêm route key: `pRoleManagement`

4. **Sidebar nâng cấp:**
   - Ẩn/hiện menu items dựa trên `can(permissionKey)`
   - Hiện user role thực tế (không còn hard-coded "roleAdmin")

5. **Button/control visibility:**
   - Thêm `can('advertiser.create')` check trước render New Advertiser button
   - Áp dụng cho tất cả create/edit/delete buttons

6. **Cập nhật menu:**
   - Thêm `pUserManagement`, `pRoleManagement` vào menu data

### Phase 3 — Audit log + security improvements

**Mục tiêu:** Hoàn thiện bảo mật, audit trail.

1. **Audit log nâng cấp:**
   - Log khi user được tạo/sửa/xóa
   - Log khi role được gán/thay đổi
   - Log khi permissions bị thay đổi
   - Thêm module "UserManagement" và "RoleManagement"

2. **Password management:**
   - Thêm `POST /api/users/:id/reset-password` — super admin reset password
   - Thêm `PUT /api/users/me/password` — user đổi password của mình
   - Backend validation: password tối thiểu 8 ký tự

3. **User lockout:**
   - Sau 5 lần login thất bại liên tiếp → khóa user 15 phút
   - `isActive = false` khi locked (hoặc thêm `lockedUntil` field)

4. **Session management:**
   - Thêm `POST /api/auth/logout` — invalidate token phía server (optional, dùng blacklist)
   - Token rotation: khi refresh token → revoke old token

5. **Deprecate legacy permission flags:**
   - Sau khi RBAC hoàn toàn, loại bỏ `permDataInput`, `permDataConfirm`, `permAdmin` columns
   - Hoặc giữ để backward compatibility nếu cần

---

## 11. File cần sửa khi implement

### 11.1 Database/Prisma

| File | Thay đổi |
|---|---|
| [prisma/schema.prisma](prisma/schema.prisma) | Thêm Role, Permission, RolePermission models; thêm roleId vào User |
| [prisma/seed.ts](prisma/seed.ts) | Seed roles, permissions, role_permissions |

### 11.2 Backend - Auth & Middleware

| File | Thay đổi |
|---|---|
| [src/middleware/auth.ts](src/middleware/auth.ts) | Thêm `requirePermission(key)` với RBAC check, `requireRole(roles[])` |
| [src/routes/admin.ts](src/routes/admin.ts) | Cập nhật user CRUD, thêm roles/permissions endpoints |
| [src/types/index.ts](src/types/index.ts) | Thêm Role, Permission types |

### 11.3 Backend - Services

| File | Thay đổi |
|---|---|
| [src/services/operationLog.service.ts](src/services/operationLog.service.ts) | Thêm LogModule "UserManagement", "RoleManagement" |

### 11.4 Frontend - Core

| File | Thay đổi |
|---|---|
| [frontend/src/AppContext.tsx](frontend/src/AppContext.tsx) | Lưu user.role, user.permissions; thêm `can()` helper |
| [frontend/src/App.tsx](frontend/src/App.tsx) | Thêm page routing cho UserManagement, RoleManagement |
| [frontend/src/lib/bffApi.ts](frontend/src/lib/bffApi.ts) | Thêm API calls cho roles, permissions |

### 11.5 Frontend - Pages

| File | Thay đổi |
|---|---|
| [frontend/src/pages/UserManagement.tsx](frontend/src/pages/UserManagement.tsx) | **MỚI** — user CRUD UI |
| [frontend/src/pages/RoleManagement.tsx](frontend/src/pages/RoleManagement.tsx) | **MỚI** — role permissions UI |
| [frontend/src/components/Sidebar.tsx](frontend/src/components/Sidebar.tsx) | Ẩn/hiện menu theo `can()`, hiện role thực |
| [frontend/src/lib/data.ts](frontend/src/lib/data.ts) | Thêm menu items cho user/role management |
| [frontend/src/lib/i18n.ts](frontend/src/lib/i18n.ts) | Thêm i18n keys cho user/role management |

### 11.6 Các file KHÔNG cần sửa (ngoại trừ để preserve fix gần đây)

- [frontend/src/pages/Reports.tsx](frontend/src/pages/Reports.tsx) — **KHÔNG SỬA** (preserve recent date picker fix)
- [frontend/src/index.css](frontend/src/index.css) — chỉ sửa nếu cần thêm date picker CSS
- Business logic files (controllers, services, workflows) — **KHÔNG SỬA**
- BFF controllers — **KHÔNG SỬA** trừ khi cần thêm permission check
- [src/routes/dailyInput.ts](src/routes/dailyInput.ts) — **KHÔNG SỬA**
- [src/routes/dashboard.ts](src/routes/dashboard.ts) — **KHÔNG SỬA**

---

## 12. Checklist hoàn thành

### Phase 1 — Backend foundation

- [ ] Schema migration chạy thành công (Role, Permission, RolePermission tables)
- [ ] Seed tạo đúng 5 roles và permissions
- [ ] `GET /api/roles` trả về danh sách roles
- [ ] `GET /api/permissions` trả về danh sách permissions
- [ ] `requirePermission(key)` hoạt động đúng cho existing protected routes
- [ ] `requireRole(roles[])` hoạt động đúng
- [ ] User admin (id=1) vẫn login được sau migration
- [ ] Backend TypeScript compile không lỗi (`npx tsc --noEmit`)
- [ ] Backend build thành công

### Phase 2 — Frontend UI

- [ ] Login → token được lưu, `AppContext` có `user.role`
- [ ] `can('advertiser.create')` → `false` với VIEWER role
- [ ] Sidebar ẩn menu items không có permission
- [ ] UserManagement page: list users hiển thị đúng role
- [ ] UserManagement page: create user → chọn role
- [ ] UserManagement page: edit user → thay đổi role
- [ ] UserManagement page: delete user (không xóa cứng — set inactive hoặc confirm dialog)
- [ ] RoleManagement page: list roles với permissions
- [ ] Button New/Edit/Delete ẩn đúng theo role
- [ ] Frontend TypeScript compile không lỗi
- [ ] Frontend build thành công
- [ ] i18n: label cho user/role management pages đầy đủ ZH/VI/EN

### Phase 3 — Audit + Security

- [ ] OperationLog ghi nhận CREATE/UPDATE/DELETE user
- [ ] OperationLog ghi nhận thay đổi role
- [ ] `POST /api/users/:id/reset-password` hoạt động (super admin only)
- [ ] `PUT /api/users/me/password` hoạt động
- [ ] User bị khóa sau 5 lần login thất bại
- [ ] Backend TypeScript compile không lỗi
- [ ] Frontend TypeScript compile không lỗi
- [ ] Backend build thành công
- [ ] Frontend build thành công

### Không được làm

- [ ] Không xóa user bằng hard delete (chỉ set status = 'inactive')
- [ ] Không commit migration đã chạy vào git nếu production đang chạy
- [ ] Không sửa financial formulas (DailyInput revenue, mlPayout)
- [ ] Không sửa mlPayout.service.ts
- [ ] Không sửa Reports.tsx (preserve recent fix)

---

## 13. Ghi chú quan trọng

### 13.1 Backward compatibility

User model hiện tại có 3 boolean columns: `permDataInput`, `permDataConfirm`, `permAdmin`. Khi implement RBAC đầy đủ:
- **Đề xuất:** Giữ nguyên 3 columns, thêm `roleId` nullable. Dùng logic: `effective_perms = role.permissions UNION permDataInput/permDataConfirm/permAdmin` (OR). Sau đó phase 3 loại bỏ 3 columns.
- **Hoặc:** Thay thế hoàn toàn 3 columns bằng `roleId`, cần migrate data trước.

### 13.2 SUPER_ADMIN vs ADMIN

Seed hiện tại tạo `admin` là ADMIN. Khi thêm SUPER_ADMIN role, cần quyết định:
- Ai là SUPER_ADMIN đầu tiên? → Có thể dùng user id=1 hoặc thêm flag `isSuperAdmin: true` trong User model.
- Hoặc ADMIN đầu tiên tạo ra được SUPER_ADMIN → cần cơ chế bootstrap.

### 13.3 Route protection gaps

Nhiều route hiện tại **chỉ có `requireAuth`**, không có `requirePermission`. Trước mắt nên:
- Giữ nguyên cho Phase 1 (vì chỉ thay đổi schema, chưa thay đổi route logic)
- Bổ sung `requirePermission` khi implement Phase 2 cho BFF routes

### 13.4 Frontend không có React Router

Hệ thống dùng `currentPage` state string-based routing thay vì React Router. Khi thêm UserManagement/RoleManagement pages:
- Thêm key vào `menu` trong `data.ts`
- Thêm case vào `switch(pageKey)` trong `App.tsx`
- Thêm i18n keys trong `i18n.ts`

### 13.5 JWT payload

JWT hiện tại lưu `UserPublic` object là payload. Khi decode token ở frontend (`getUsernameFromToken`), chỉ parse username. Cần cập nhật `getUsernameFromToken` hoặc thêm helper `getUserFromToken()` để lấy đầy đủ user info.

### 13.6 Password hashing

Đang dùng `bcrypt` với cost factor mặc định (10). OK cho production nhưng có thể consider `bcryptjs` nếu cần pure JS.