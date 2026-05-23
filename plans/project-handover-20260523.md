# Project Handover Document — Ad Management System (KrakenOcean)

## Project Overview

**Name:** Ad Management Server
**Type:** Full-stack web application (Node.js/Express backend + React frontend)
**Database:** PostgreSQL via Prisma ORM
**Key Technologies:** TypeScript, Express, React, Prisma Client v6, JWT auth, bcrypt

---

## Current Branch & Commit

- **Branch:** `110526`
- **Latest commit:** `561da7b` — `feat: add RBAC layer — UserManagement, RoleManagement, permission-based UI, audit logs, and safe RBAC seed`
- **Main branch:** `main`

---

## Project Structure

```
d:\Download\manager\kko\150426\ads-management\
├── prisma/
│   ├── schema.prisma          # Database schema (PostgreSQL)
│   ├── seed.ts                # Demo seed (DESTRUCTIVE — not for production)
│   └── seed-rbac.ts          # RBAC-only safe seed (idempotent)
├── src/
│   ├── index.ts               # Express app entry point
│   ├── prisma.ts              # Prisma client singleton
│   ├── middleware/
│   │   └── auth.ts           # JWT auth middleware, permission system
│   ├── routes/
│   │   └── admin.ts           # All API routes (auth, users, roles, ad-sites, downstreams, etc.)
│   ├── services/
│   │   └── operationLog.service.ts  # Audit logging
│   ├── controllers/bff/       # BFF pattern controllers
│   ├── mappers/bff/           # Data mappers (BFF layer)
│   ├── workflows/             # Business workflows
│   ├── utils/                 # Utilities (date, calculations, constants, rateLimit, env)
│   └── types/index.ts         # Shared TypeScript types
└── frontend/
    └── src/
        ├── App.tsx            # Root component, token management
        ├── AppContext.tsx     # React context: i18n, page routing, can() permission
        ├── components/
        │   ├── Sidebar.tsx    # Sidebar navigation, permission-filtered
        │   └── Topbar.tsx     # Top bar
        ├── pages/
        │   ├── Advertiser.tsx # Advertiser management, AdOrder, AdId management
        │   ├── Media.tsx       # Media management, MediaAdOrder, MediaId
        │   ├── DataEntry.tsx   # AI Entry, Adv Entry, Media Data Mgmt
        │   ├── Reports.tsx     # TotalProfit, OrderProfit, AdvQuery, MediaQuery
        │   ├── Settlement.tsx  # Advertiser & Media settlement
        │   ├── System.tsx      # Operation Log page
        │   ├── Login.tsx       # Login page
        │   ├── UserManagement.tsx   # NEW: User CRUD with RBAC
        │   └── RoleManagement.tsx   # NEW: Role & permission editor
        └── lib/
            ├── bffApi.ts      # All API call functions
            ├── bffTypes.ts    # Shared TypeScript interfaces
            ├── data.ts        # i18n text data
            ├── i18n.ts        # Localization helpers
            └── featureFlags.ts # Feature flag system (FALLBACK_PAGE, isPageEnabled, etc.)
```

---

## Database Schema (Prisma)

### Core Business Models

| Model | Description |
|---|---|
| `AdType` | Ad type codes: SM, 360, BAIDU_JS |
| `Upstream` | Upstream media companies |
| `AdOrder` | Per-advertiser order/campaign linked to upstream |
| `AdSite` | Ad placement site, has billingMethod (CPM/RATIO), currentUnitPrice, currentRatio |
| `AdSiteDownstream` | Junction: which downstreams (ML/LE/YIYI) are linked to an AdSite |
| `AdSiteRebateRate` | Rebate windows per AdSite (start/end date, rate) |
| `AdSiteEvent` | Events: CREATED, PAUSED, RESUMED, DIED, NOTE |
| `DailyInput` | Daily traffic/revenue records, status: unconfirmed/confirmed |
| `Downstream` | Downstream types: ML, LE, YIYI with payoutRate |
| `DownstreamPeriod` | Effective payout periods per downstream |
| `DailyDownstreamRate` | Daily effective rate overrides |
| `YiyiDailyData` | Yiyi-specific daily data |
| `YiyiDailyPricing` | Yiyi pricing config |
| `LEDailyCost` | LE daily cost data |

### RBAC Models (v6 — added in recent commit)

| Model | Description |
|---|---|
| `User` | User accounts with `roleId` FK to Role (new field added to existing model) |
| `Role` | Roles: SUPER_ADMIN, ADMIN, MANAGER, OPERATOR, EDITOR, VIEWER (all isSystem=true except future custom roles) |
| `Permission` | Permission definitions with unique `key` (camelCase, e.g. `user.read`, `dataEntry.create`) |
| `RolePermission` | Junction table linking Role ↔ Permission |

### Operation Log

| Model | Description |
|---|---|
| `OperationLog` | Audit log: userId, username, action, module, targetType, targetId, detail, createdAt |

---

## RBAC System (v6 — Implemented in commit 561da7b)

### Roles

| Role | Code | Description |
|---|---|---|
| Super Administrator | `SUPER_ADMIN` | All permissions, cannot be modified or deleted |
| Administrator | `ADMIN` | All except `system.config` |
| Manager | `MANAGER` | Advertiser, AdOrder, AdId, Media, DataEntry (read/create/update/confirm), Report, Settlement, AuditLog |
| Operator | `OPERATOR` | Read + write for DataEntry, no confirm |
| Editor | `EDITOR` | Read-only + DataEntry write |
| Viewer | `VIEWER` | Read-only all modules |

### Permissions (camelCase naming)

**User Management:** `user.read`, `user.create`, `user.update`, `user.disable`, `user.resetPassword`

**Role Management:** `role.read`, `role.update`, `permission.read`

**Advertiser:** `advertiser.read`, `advertiser.create`, `advertiser.update`, `advertiser.delete`

**AdOrder:** `adOrder.read`, `adOrder.create`, `adOrder.update`, `adOrder.delete`

**AdId:** `adId.read`, `adId.create`, `adId.update`, `adId.delete`

**Media:** `media.read`, `media.create`, `media.update`, `media.delete`

**Data Entry:** `dataEntry.read`, `dataEntry.create`, `dataEntry.update`, `dataEntry.confirm`, `dataEntry.delete`

**Reports:** `report.read`, `report.export`

**Settlement:** `settlement.read`, `settlement.approve`

**Audit Log:** `auditLog.read`

**System:** `system.config`

### SUPER_ADMIN Protection Rules

1. **PUT /api/users/:id** — Cannot modify own account if last SUPER_ADMIN (self-modify block)
2. **PUT /api/users/:id** — Cannot disable self
3. **PUT /api/users/:id** — Cannot demote self if last SUPER_ADMIN
4. **DELETE /api/users/:id** — Cannot disable self
5. **DELETE /api/users/:id** — Cannot disable last SUPER_ADMIN (soft-disable: sets status='inactive')
6. **reset-password** — Does NOT block SUPER_ADMIN (safe operation — doesn't remove privileges)

### Permission Naming Convention

- camelCase: `user.resetPassword`, `dataEntry.create`, `report.read`, `permission.read`
- Backend route path: `/api/users/:id/reset-password` (path uses hyphens, permission key uses camelCase)
- NEVER use hyphens in permission keys (e.g., NOT `user.reset-password`)

---

## Backend API Routes (src/routes/admin.ts)

### Auth Routes

| Method | Path | Auth | Permission | Description |
|---|---|---|---|---|
| POST | `/api/auth/login` | No | — | Login, rate-limited (10 attempts/15min), returns JWT |
| GET | `/api/auth/me` | Yes | — | Returns current user with permissions from DB |

### User Management Routes

| Method | Path | Auth | Permission | Description |
|---|---|---|---|---|
| GET | `/api/users` | Yes | `user.read` | List all users |
| POST | `/api/users` | Yes | `user.create` | Create user (password min 8 chars) |
| PUT | `/api/users/:id` | Yes | `user.update` | Update user (role/status/password), blocks last SUPER_ADMIN modify/demote/disable |
| DELETE | `/api/users/:id` | Yes | `user.disable` | Soft-disable (status='inactive'), blocks self-disable and last SUPER_ADMIN |
| POST | `/api/users/:id/reset-password` | Yes | `user.resetPassword` | Reset password (min 8 chars), safe for SUPER_ADMIN |

### Role Management Routes

| Method | Path | Auth | Permission | Description |
|---|---|---|---|---|
| GET | `/api/roles` | Yes | `role.read` | List all roles with permissions |
| PUT | `/api/roles/:id/permissions` | Yes | `role.update` | Update role permissions (transaction: delete+recreate), SUPER_ADMIN locked |
| GET | `/api/permissions` | Yes | `permission.read` | List all permission definitions |

### Admin Config Routes

| Method | Path | Auth | Permission | Description |
|---|---|---|---|---|
| GET | `/api/admin/ad-types` | Yes | `perm_admin` | List AdTypes |
| POST | `/api/admin/ad-types` | Yes | `perm_admin` + write | Create AdType (manually assigned ID) |
| PUT | `/api/admin/ad-types/:id` | Yes | `perm_admin` + write | Update AdType |
| DELETE | `/api/admin/ad-types/:id` | Yes | `perm_admin` + write | Delete AdType (fails if has upstreams/downstreams) |
| GET | `/api/admin/upstreams` | Yes | `perm_admin` | List upstreams |
| POST | `/api/admin/upstreams` | Yes | `perm_admin` + write | Create upstream |
| PUT | `/api/admin/upstreams/:id` | Yes | `perm_admin` + write | Update upstream |
| DELETE | `/api/admin/upstreams/:id` | Yes | `perm_admin` + write | Delete upstream (fails if has ad sites) |
| GET | `/api/admin/ad-sites` | Yes | — | List ad sites (no permission check) |
| POST | `/api/admin/ad-sites` | Yes | `perm_admin` + write | Create ad site (creates AdSiteEvent) |
| PUT | `/api/admin/ad-sites/:id` | Yes | `perm_admin` + write | Update ad site |
| PUT | `/api/admin/ad-sites/:id/toggle-active` | Yes | `perm_admin` + write | Toggle isActive (creates event) |
| PUT | `/api/admin/ad-sites/:id/toggle-archive` | Yes | `perm_admin` + write | Toggle isArchived (creates DIED/RESUMED event) |
| DELETE | `/api/admin/ad-sites/:id` | Yes | `perm_admin` + write | Delete ad site (fails if has daily inputs, unless ?force=1) |
| GET | `/api/admin/ad-sites/:id/events` | Yes | — | List ad site events |
| POST | `/api/admin/ad-sites/:id/events` | Yes | `perm_admin` + write | Add note event |
| GET | `/api/admin/ad-sites/:id/rebates` | Yes | `perm_admin` | List rebate windows |
| POST | `/api/admin/ad-sites/:id/rebates` | Yes | `perm_admin` + write | Create rebate window (checks overlap) |
| PUT | `/api/admin/ad-sites/:id/rebates/:rebateId` | Yes | `perm_admin` + write | Update rebate window |
| DELETE | `/api/admin/ad-sites/:id/rebates/:rebateId` | Yes | `perm_admin` + write | Delete rebate window |
| POST | `/api/admin/ad-sites/:id/rebates/recalculate` | Yes | `perm_admin` + write | Recalculate revenue for date range |
| PUT | `/api/admin/ad-sites/:id/downstream-price` | Yes | `perm_admin` + write | Set custom price per downstream |
| GET | `/api/admin/ad-sites/:id/reconciliation` | Yes | — | Monthly/daterange reconciliation |
| GET | `/api/admin/downstreams` | Yes | — | List downstreams |
| GET | `/api/admin/downstream-periods` | Yes | — | List downstream periods |
| POST | `/api/admin/downstreams` | Yes | `perm_admin` + write | Create downstream |
| PUT | `/api/admin/downstreams/:id` | Yes | `perm_admin` + write | Update downstream |
| DELETE | `/api/admin/downstreams/:id` | Yes | `perm_admin` + write | Delete downstream |
| PUT | `/api/admin/downstream-periods/:id` | Yes | `perm_admin` + write | Update period |
| DELETE | `/api/admin/downstream-periods/:id` | Yes | `perm_admin` + write | Delete period |
| GET | `/api/admin/downstream-sites/:id/inputs` | Yes | — | Get downstream site inputs (date/month param) |
| POST | `/api/admin/downstream-rates` | Yes | `perm_admin` + write | Set daily downstream rate |
| GET | `/api/admin/downstream-rates` | Yes | — | Get daily downstream rates |
| GET | `/api/downstream/:id/periods` | Yes | `perm_admin` | List periods for downstream |
| POST | `/api/downstream/:id/periods` | Yes | `perm_admin` + write | Create period (closes overlapping period) |
| PUT | `/api/ad-sites/:id/price` | Yes | `perm_admin` + write | Update CPM price or RATIO |

### BFF Routes (src/routes/bff/index.ts)

All BFF routes are mounted at `/api/bff/*` and use the BFF adapter pattern:

- `/api/bff/advertisers` — Advertiser CRUD
- `/api/bff/media` — Media CRUD
- `/api/bff/ad-orders` — AdOrder CRUD
- `/api/bff/ad-ids` — AdId CRUD
- `/api/bff/media-ids` — MediaId CRUD
- `/api/bff/downstreams` — List downstreams
- `/api/bff/data-entry/advertisers` — Advertiser data entry list, batch save, confirm
- `/api/bff/data-entry/media` — Media data entry list, batch save, confirm
- `/api/bff/reports/*` — Report endpoints
- `/api/bff/settlement/*` — Settlement endpoints
- `/api/bff/operation-logs` — Paginated audit logs

---

## Middleware (src/middleware/auth.ts)

### Functions

- `requireAuth` — JWT verification, loads user from DB with roleRef+permissions, sets `req.user`
- `requireRole(...roles)` — Role-based access control
- `requirePermission(perm)` — Checks `user.permissions.includes(perm)` for RBAC keys, or legacy boolean flags
- `requireWriteAccess` — Blocks VIEWER accounts
- `hasPermission(user, permKey)` — SUPER_ADMIN always true, else checks permissions array
- `toUserPublic(user, permissions)` — Maps DB user to API response shape, resolves role from `roleRef.code` with legacy fallback
- `resolveUserRole(user)` — Resolves `roleRef.code` (RBAC) or falls back to legacy role/admin/editor/viewer logic

---

## Frontend Permission System (can function)

Located in `AppContext.tsx` — `can(permissionKey: string): boolean`

### Resolution Order

1. **SUPER_ADMIN** (role or roleCode) → always `true`
2. **RBAC permissions array** → checks `currentUser.permissions?.includes(permissionKey)`
3. **Legacy ADMIN** (role='ADMIN' or perm_admin=true) → true for all except `system.config`
4. **Legacy perm_data_input** → true for `dataEntry.read`, `dataEntry.create`
5. **Legacy perm_data_confirm** → true for `dataEntry.confirm`
6. **Others** → `false`

### Sidebar Permission Filtering

Sidebar filters child menu items per `PAGE_PERMISSION_MAP`:
```typescript
const PAGE_PERMISSION_MAP: Record<string, string> = {
  pAdvertiserList: 'advertiser.read',
  pAdOrderMgmt: 'adOrder.read',
  pAdIdMgmt: 'adId.read',
  pMediaMgmt: 'media.read',
  pMediaAdOrderMgmt: 'media.read',
  pMediaIdMgmt: 'media.read',
  pAiEntry: 'dataEntry.read',
  pAdvEntry: 'dataEntry.read',
  pMediaDataMgmt: 'dataEntry.read',
  pTotalProfit: 'report.read',
  pOrderProfit: 'report.read',
  pAdvQuery: 'report.read',
  pMediaQuery: 'report.read',
  pAdvSettlement: 'settlement.read',
  pMediaSettlement: 'settlement.read',
  mOpLog: 'auditLog.read',
  pUserManagement: 'user.read',
  pRoleManagement: 'role.read',
};
```

- Empty groups (no visible children) are hidden
- Active page auto-expands its group

---

## New Frontend Pages

### UserManagement.tsx

- List users with role badge, status badge, created date
- Create user: username, password (min 8), roleId, status
- Edit user: roleId, status, optional password
- Reset password: new password (min 8)
- All actions gated by `can('user.create')`, `can('user.update')`, `can('user.resetPassword')`
- Soft-disable via edit modal (status toggle)

### RoleManagement.tsx

- List roles: id, code, name, system flag, actions
- Edit role: modal with checkbox grid grouped by module
- SUPER_ADMIN row always disabled (cannot edit)
- Save button only enabled for non-SUPER_ADMIN roles with `can('role.update')`

---

## Seed Scripts

### prisma/seed-rbac.ts (SAFE — idempotent)

**Does NOT touch any business data** — only RBAC tables.

**Flow:**
1. Upsert 6 roles (SUPER_ADMIN, ADMIN, MANAGER, OPERATOR, EDITOR, VIEWER)
2. Upsert 34 permissions (camelCase keys)
3. Upsert RolePermissions linking each role to its allowed permissions
4. Link existing `admin` user → SUPER_ADMIN if roleId not set
5. Link existing `editor` user → OPERATOR if roleId not set

**Run:** `npm run seed:rbac` or `npx tsx prisma/seed-rbac.ts`

### prisma/seed.ts (DESTRUCTIVE demo seed)

**WARNING:** Adds demo business data — DO NOT run on production.

---

## npm Scripts

| Script | Command | Description |
|---|---|---|
| `dev` | `tsx watch src/index.ts` | Start dev server |
| `build` | `tsc` | Build TypeScript to dist/ |
| `start` | `node dist/index.js` | Start production server |
| `seed` | `tsx prisma/seed.ts` | Run demo seed |
| `seed:rbac` | `tsx prisma/seed-rbac.ts` | Run RBAC seed |
| `db:push` | `prisma db push` | Push schema to DB |
| `db:studio` | `prisma studio` | Open Prisma Studio |

---

## Type System Key Types (bffTypes.ts)

### Entry Types

- `EntryType = 'CPM' | 'RATIO' | 'CPA' | 'CPS'`
- `uiTypeToApiType(type)` — CPS (user) → RATIO (backend)
- `apiTypeToUiType(type)` — RATIO (backend) → CPS (user)

### Data Entry Status

- `DataEntryStatus = 'pending' | 'confirmed'`
- `DataEntryStatusParam = DataEntryStatus | 'unconfirmed'`
- `ReportStatusParam = 'confirmed' | 'unconfirmed' | 'pending' | 'all'`

---

## Operation Log

`createOperationLog()` in `operationLog.service.ts` — crash-safe (try/catch, does not throw).

**Logged actions include:** `LOGIN_SUCCESS`, `LOGIN_FAILED`, `DISABLE`, `RESET_PASSWORD`, and all mutating BFF operations.

---

## Feature Flags (lib/featureFlags.ts)

`FEATURE_FLAGS.settlement` controls whether Settlement pages are accessible or fall back to AdvertiserList.

`FALLBACK_PAGE` = `'pAdvertiserList'`

---

## Known Quirks

1. **AdType IDs are manually assigned** in seed (`id: nextId`) — not auto-incrementing seed because AdType codes are referenced externally.
2. **SUPER_ADMIN can reset any password** including own — reset-password doesn't change role/privileges, only hash.
3. **Permission `user.disable`** gates DELETE /api/users/:id — but soft-disable is done via PUT status='inactive'.
4. **RBAC permission keys use camelCase** throughout (e.g., `dataEntry.create`), but HTTP route paths use hyphens (`/api/users/:id/reset-password`).
5. **`requirePermission` checks both legacy boolean flags and RBAC keys** — backward compatible with existing users who have permAdmin/permDataInput/permDataConfirm but no roleRef.

---

## All Backend Middleware Chains (auth pattern)

All mutating routes use chain: `requireAuth → requireWriteAccess → requirePermission(...)`

- `requireWriteAccess` blocks VIEWER accounts at the middleware level
- `requirePermission` then checks the specific permission key

---

## Recent Fix History (relevant to RBAC commit)

- `c63d45f` — fix: correct backend CPM revenue calculation
- `bfb2f84` — feat: add CSV export to management pages
- `9367112` — fix: make createOperationLog crash-safe when Prisma client not generated
- `ddd5172` — Phase 1-2: add BFF adapter layer, audit logs, reports optimization, UAT hardening

---

## What Was Committed in 561da7b (RBAC)

17 files changed, 1672 insertions(+), 171 deletions(-):

```
frontend/src/App.tsx                  |  +42  (token-based auth, getCurrentUser on mount)
frontend/src/AppContext.tsx          | +105  (can() permission function, currentUser state)
frontend/src/components/Sidebar.tsx  |  +77  (permission-filtered children, user avatar)
frontend/src/lib/bffApi.ts           |  +49  (user/role/permission API calls)
frontend/src/lib/bffTypes.ts          |  +62  (RBAC types: UserManagementUser, Role, Permission, etc.)
frontend/src/lib/data.ts              |   +5  (i18n keys)
frontend/src/lib/i18n.ts              |  +58  (localization helpers)
frontend/src/pages/RoleManagement.tsx | +169  (NEW: role permission editor)
frontend/src/pages/UserManagement.tsx | +237  (NEW: user CRUD)
package.json                         |   +1
prisma/schema.prisma                  |  +45  (Role, Permission, RolePermission models + User.roleId)
prisma/seed-rbac.ts                   | +200  (SAFE RBAC seed)
prisma/seed.ts                        | +214  (demo seed with cảnh báo)
src/middleware/auth.ts                |  +67  (toUserPublic, hasPermission, requirePermission, etc.)
src/routes/admin.ts                   | +465  (user/role CRUD routes, SUPER_ADMIN protections)
src/services/operationLog.service.ts |   +6  (minor fix)
src/types/index.ts                    |  +41  (UserPublic with roleRef, permissions array)
```

---

## Not Committed (Untracked / Modified)

- `frontend/src/index.css` — ReportDateRangeField CSS (split start/end inputs styling)
- `plans/*` — Planning/audit documents
- `dist/` — Build artifact (gitignored)
- `node_modules/.prisma/client/` — Generated Prisma client (reverted before commit)

---

## Notes for AI Agent

1. **Do NOT run `npm run seed` on production** — seed.ts is destructive demo data.
2. **RBAC seed is safe** — use `npm run seed:rbac` to re-sync roles/permissions without touching business data.
3. **SUPER_ADMIN is unmodifiable** — the role itself cannot have permissions changed and cannot be deleted.
4. **Self-modify protection** — last SUPER_ADMIN cannot demote/disable/modify themselves.
5. **Reset-password is safe** — does not strip privileges, so SUPER_ADMIN can always reset own password.
6. **Legacy fallback** — users with `permAdmin=true` but no `roleRef` still work via `can()` fallback in AppContext.
7. **OperationLog is crash-safe** — won't throw if Prisma client not generated.
8. **`requireWriteAccess`** runs before `requirePermission` — VIEWERs are blocked before checking specific perms.