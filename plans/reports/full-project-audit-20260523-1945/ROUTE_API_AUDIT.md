# ROUTE API AUDIT

## Route Inventory — Admin Backend Routes (src/routes/admin.ts)

### User Management

| Method | Path | Auth | Permission | Input Validation | Risk Notes |
|--------|------|------|-------------|-------------------|-------------|
| GET | /api/users | ✅ requireAuth | `user.read` (via requirePermission) | — | Returns all users with roleRef include |
| POST | /api/users | ✅ requireAuth | `user.create` | username, password(min 8), roleId | Password hashed with bcrypt |
| PUT | /api/users/:id | ✅ requireAuth | `user.update` | password(optional,min 8), roleId(optional), status | Sync issue: legacy role field not synced |
| DELETE | /api/users/:id | ✅ requireAuth | `user.disable` | — | Soft-disable only; self-disable blocked; last SUPER_ADMIN blocked |
| POST | /api/users/:id/reset-password | ✅ requireAuth | `user.resetPassword` | newPassword(min 8) | Uses bcrypt hash |

### Role Management

| Method | Path | Auth | Permission | Input Validation | Risk Notes |
|--------|------|------|-------------|-------------------|-------------|
| GET | /api/roles | ✅ requireAuth | none | — | Publicly accessible? No requirePermission call found |
| PUT | /api/roles/:id/permissions | ✅ requireAuth | `role.update` | permissionKeys[] | Updates RolePermission; SUPER_ADMIN role cannot be edited |

### AdSite Management

| Method | Path | Auth | Permission | Input Validation | Risk Notes |
|--------|------|------|-------------|-------------------|-------------|
| PUT | /api/ad-sites/:id/price | ✅ requireAuth | `perm_admin` (legacy) + requireWriteAccess | new_unit_price or new_ratio | Uses legacy `requirePermission("perm_admin")` instead of RBAC key |

### BFF Routes (src/routes/bff/index.ts)

| Method | Path | Controller | Auth | Permission | Risk Notes |
|--------|------|------------|------|-------------|-------------|
| GET | /api/bff/advertisers | advertiserController | requireAuth | **NONE** | All advertiser endpoints lack permission check |
| POST | /api/bff/advertisers | advertiserController | requireAuth | **NONE** | |
| PUT | /api/bff/advertisers/:id | advertiserController | requireAuth | **NONE** | |
| DELETE | /api/bff/advertisers/:id | advertiserController | requireAuth | **NONE** | |
| GET | /api/bff/media | mediaController | requireAuth | **NONE** | Media (AdSite) list without permission |
| GET | /api/bff/ad-orders | adOrderController | requireAuth | **NONE** | Virtual/derived AdOrders — read only |
| GET | /api/bff/ad-ids | adIdController | requireAuth | `perm_admin` (legacy) | Uses legacy permission key |
| POST | /api/bff/ad-ids | adIdController | requireAuth | `perm_admin` (legacy) | adOrderId validation gap |
| PUT | /api/bff/ad-ids/:id | adIdController | requireAuth | `perm_admin` (legacy) | |
| GET | /api/bff/media-ids | mediaIdController | requireAuth | **NONE** | |
| GET | /api/bff/downstreams | downstreamController | requireAuth | **NONE** | Read-only lookup |
| GET | /api/bff/data-entry/advertisers | advertiserDataEntryController | requireAuth | **NONE** | No permission check |
| POST | /api/bff/data-entry/advertisers | advertiserDataEntryController | requireAuth | **NONE** | Revenue not recalculated server-side |
| GET | /api/bff/data-entry/media | mediaDataEntryController | requireAuth | **NONE** | No permission check |
| POST | /api/bff/data-entry/media | mediaDataEntryController | requireAuth | **NONE** | Revenue not recalculated server-side |
| GET | /api/bff/reports/* | reportController | requireAuth | **NONE** | Report data accessible to any authenticated user |
| GET | /api/bff/settlement/* | settlementController | requireAuth | **NONE** | Settlement data accessible to any authenticated user |
| GET | /api/bff/operation-logs | operationLogController | requireAuth | **NONE** | |

### Dashboard Routes (src/routes/dashboard.ts)

| Method | Path | Auth | Permission | Risk Notes |
|--------|------|------|-------------|-------------|
| GET | /api/dashboard/monthly | requireAuth | none | Revenue computation relies on pre-set `revenue` field |
| GET | /api/dashboard/downstream-monthly | requireAuth | none | `DEFAULT_DOWNSTREAM_PRICES` undefined; uses undefined fallback |

### Daily Input Routes (src/routes/dailyInput.ts)

| Method | Path | Auth | Permission | Risk Notes |
|--------|------|------|-------------|-------------|
| GET | /api/daily-input | requireAuth | none | Used by some legacy frontend flow |

### Yiyi Data Routes (src/routes/yiyiData.ts)

| Method | Path | Auth | Permission | Risk Notes |
|--------|------|------|-------------|-------------|
| various | /api/yiyi-data/* | requireAuth | none visible | |

---

## Critical Gaps

1. **BFF controllers have NO per-route `requirePermission` calls** — every BFF endpoint is accessible to any authenticated user. The only exceptions are adId controller which uses legacy `perm_admin`.

2. **POST /api/bff/ad-ids** accepts `adOrderId` without validating it references a real active AdOrder.

3. **Data entry controllers** accept revenue/amount values from frontend without server-side recalculation.

4. **GET /api/roles** has no `requirePermission` call — role list is accessible to any authenticated user.