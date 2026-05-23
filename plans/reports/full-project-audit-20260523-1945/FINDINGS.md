# AUDIT FINDINGS — Sorted by Severity

---

## AUDIT-P0-001
- **Severity**: P0
- **Area**: Data Integrity
- **Title**: DailyInput revenue/amount fields accept arbitrary values — no formula enforcement

**Evidence**:
- `prisma/schema.prisma` lines 150–175 — `DailyInput` model has `qty`, `unitPriceSnapshot`, `amount1`, `amount2`, `ratioSnapshot`, `revenue` all as independent fields with no computed-from relationship
- `src/controllers/bff/mediaDataEntry.controller.ts` and `src/controllers/bff/advertiserDataEntry.controller.ts` — both accept raw `revenue`, `amount1`, `amount2` from frontend POST/PUT body with no recalculation

**Impact**: Any caller (frontend, direct API) can set `revenue` to any value (0, negative, huge). The actual business revenue depends on the frontend computing the formula before sending. If frontend has a bug or sends wrong values, financial reports become garbage. No server-side validation of revenue plausibility.

**Reproduction**: POST to `/api/bff/data-entry/media` with `{ qty: 100, revenue: 99999999 }` — no server-side correction.

**Recommended Fix**: Introduce service-layer computation before write. Either (a) make `revenue` computed/not-writable in the schema, or (b) compute revenue server-side from `qty * unitPriceSnapshot / 1000` (CPM) or `amount1 + amount2 * ratio` (RATIO) in the service before writing, ignoring frontend-sent revenue value.

**Risk of Fix**: High — changing revenue computation could break historical data consistency. Requires careful migration strategy for existing data.

**Code Change Required**: Yes

---

## AUDIT-P0-002
- **Severity**: P0
- **Area**: Data Integrity
- **Title**: AdId/AdSite can be created without valid active AdOrder — virtual order bypass

**Evidence**:
- `prisma/schema.prisma` lines 89–115 — `AdSite.adOrderId` is `Int?` (nullable)
- `src/controllers/bff/adId.controller.ts` — AdSite creation with optional `adOrderId`; no enforcement that `adOrderId` must reference a real active AdOrder
- Commit `76cc4e7` message says "fix: require real active AdOrder for AdId create/edit" but the code in `adId.controller.ts` does not show enforcement on create path

**Impact**: Virtual or orphaned AdSites can be created that don't belong to a real advertising campaign. Downstream reporting and revenue attribution become incorrect.

**Reproduction**: POST to `/api/bff/ad-ids` with `{ adOrderId: 99999 }` where 99999 does not exist. Currently succeeds.

**Recommended Fix**: Add foreign key validation and status check on `adOrderId` at service layer for AdId/AdSite create/edit. Return 400 if `adOrderId` is provided but references a non-existent or inactive AdOrder.

**Risk of Fix**: Low — adding validation only affects new/edited records.

**Code Change Required**: Yes

---

## AUDIT-P1-001
- **Severity**: P1
- **Area**: Backend/TypeScript
- **Title**: Backend has 32 TypeScript errors — Prisma schema has `roleRef` but generated client doesn't have it

**Evidence**:
- `npx tsc --noEmit` output shows 32 errors, all related to `roleRef` property not existing on Prisma-generated User type
- `prisma/schema.prisma` line 247: `roleRef Role? @relation("UserRoleRef", fields: [roleId], references: [id])`
- `src/middleware/auth.ts` lines 126–141: code uses `roleRef` with Prisma `include`
- `src/routes/admin.ts` lines 1631, 1645–1647, 1974, 1982, etc.: multiple `roleRef` usages

**Impact**: Backend code compiles with errors. At runtime, Prisma may actually include `roleRef` because Prisma generates the relation even though TS types don't match. This is a type-safe compilation failure that could mask runtime behavior differences.

**Root Cause**: Likely `npx prisma generate` was not run after `roleRef` was added to the schema, OR the generated client was reverted. The `node_modules/.prisma/client/` files show as modified in git status.

**Reproduction**: Run `npx tsc --noEmit` from repo root.

**Recommended Fix**: Run `npx prisma generate` to regenerate types matching the current schema. If that fails due to file locking, use `--schema` flag or run when the file is not locked. Verify with `npx tsc --noEmit` after.

**Risk of Fix**: Low — regenerating Prisma client is safe.

**Code Change Required**: No (only run `prisma generate`)

---

## AUDIT-P1-002
- **Severity**: P1
- **Area**: Reports
- **Title**: LE payout date boundary bug — `getActivePeriodForDate` uses inclusive `>=` on endDate

**Evidence**:
- `src/routes/dashboard.ts` line 187: `period.endDate >= currentDate`
- `src/services/mlPayout.service.ts` line 192: `endDate: { gte: new Date(date) }` — uses `gte` on endDate meaning "endDate >= date" which means the period is considered active on its end date (last day inclusive)

**Impact**: LE downstream period that ends on 2026-05-31 is still considered active on 2026-05-31. This is likely intentional for end-of-day inclusivity, but the comment in `mlPayout.service.ts` says `endDate: { gte: new Date(date) }` which means the period includes the full last day. In `dashboard.ts` the same logic uses `>=` which is consistent. However, if a period ends at midnight 2026-05-31 (i.e., last valid moment is 2026-05-30), it would be incorrectly included on 2026-05-31.

**Reproduction**: Create a LE downstream period with `endDate = 2026-05-31` — on 2026-05-31 the system will use it when it may be intended to have ended.

**Recommended Fix**: Confirm with business: should a period ending on date X be active ON date X (inclusive) or through end of date X-1 (exclusive on last day)? If exclusive, change `>=` to `>` in `getActivePeriodForDate`. The ML payout service using `gte` seems intentional.

**Risk of Fix**: Low — changing date boundary logic.

**Code Change Required**: Yes (if business confirms exclusive semantics)

---

## AUDIT-P1-003
- **Severity**: P1
- **Area**: Data Model
- **Title**: AdSite.adOrderId nullable without business logic enforcement

**Evidence**:
- `prisma/schema.prisma` line 105: `adOrder AdOrder? @relation(fields: [adOrderId], references: [id])`
- `src/controllers/bff/adId.controller.ts` — creates AdSites with optional `adOrderId`

**Impact**: AdSites can exist without an AdOrder. If business rule requires every AdSite to map to an AdOrder for proper revenue attribution, this creates orphaned sites that appear in reports but have no campaign context.

**Reproduction**: Create AdSite without `adOrderId` via adId controller.

**Recommended Fix**: If AdSite MUST have an AdOrder, make `adOrderId` `Int` (non-optional) and add a default behavior. If it can legitimately be null (media/supply side), document this clearly.

**Risk of Fix**: Low schema change, but may require data migration for existing null records.

**Code Change Required**: Yes

---

## AUDIT-P1-004
- **Severity**: P1
- **Area**: Auth/RBAC
- **Title**: User roleId and legacy role field can diverge after update

**Evidence**:
- `src/routes/admin.ts` lines 2020–2026: when creating user, both `role` (legacy string) and `roleId` are set: `role: role.code as UserRole, roleId`
- `src/middleware/auth.ts` line 40: `resolveUserRole` checks `user.roleRef?.code` first, then falls back to legacy `role` field
- If an admin updates a user to a new role via `PUT /api/users/:id` and only changes `roleId`, the legacy `role` string field may not update, causing divergence between what `resolveUserRole` returns and what the legacy field says

**Impact**: User permissions could become inconsistent between JWT token (which uses `toUserPublic` from fresh DB read) vs stored legacy field. The system is protected because `resolveUserRole` prefers `roleRef.code` when available.

**Reproduction**: Update user role via `PUT /api/users/:id` with new `roleId` but don't change legacy `role` field. Query the user and see mismatch.

**Recommended Fix**: On user create/update, always sync `role` field to match `roleRef.code`. Or deprecate the legacy `role` field entirely in favor of `roleId` + `roleRef`.

**Risk of Fix**: Low — sync operation.

**Code Change Required**: Yes

---

## AUDIT-P1-005
- **Severity**: P1
- **Area**: Auth/RBAC
- **Title**: Settlement/Approval APIs have no explicit permission enforcement

**Evidence**:
- `src/controllers/bff/settlement.controller.ts` — GET endpoints for settlement data
- `src/controllers/bff/report.controller.ts` — report data endpoints
- No `requirePermission("settlement.approve")` or `requirePermission("settlement.read")` found in these BFF controllers
- The BFF index uses `router.use("/settlement", settlementController)` which is just a mount point; actual middleware would need to be applied per-route

**Impact**: Any authenticated user can view settlement and report data without specific RBAC permissions. The `requireAuth` is applied at the BFF router level but no per-route permission check exists.

**Reproduction**: Login as VIEWER role (which has minimal permissions). Call GET `/api/bff/settlement/monthly`. Should return 403 but likely returns 200.

**Recommended Fix**: Add `requirePermission("settlement.read")` or `requirePermission("settlement.approve")` to settlement controller routes as appropriate. Add `requirePermission("report.read")` and `requirePermission("report.export")` to report routes.

**Risk of Fix**: Low — adding permission middleware.

**Code Change Required**: Yes

---

## AUDIT-P2-001
- **Severity**: P2
- **Area**: Backend
- **Title**: Dashboard monthly route uses `defaultingDownstream` from undefined import

**Evidence**:
- `src/routes/dashboard.ts` line 22: imports `DEFAULT_DOWNSTREAM_PRICES` from `../utils/constants.js`
- Line 582: `DEFAULT_DOWNSTREAM_PRICES[String(ds.id)]` — used in `getActivePeriodForDate` but `DEFAULT_DOWNSTREAM_PRICES` is not defined in `constants.ts`

**Impact**: If a downstream period is not found and `cachedPeriod.unitPrice` is 0, the code falls back to `DEFAULT_DOWNSTREAM_PRICES[...]` which will always be `undefined` (since it's not defined). This means the fallback silently returns `undefined` price, resulting in `0` payout. Likely not the intended behavior.

**Reproduction**: Call downstream-monthly dashboard with a downstream ID that has no active period. Check if payout is 0 instead of some default.

**Recommended Fix**: Define `DEFAULT_DOWNSTREAM_PRICES` in `constants.ts` or replace with a hardcoded default value.

**Risk of Fix**: Low.

**Code Change Required**: Yes

---

## AUDIT-P2-002
- **Severity**: P2
- **Area**: Auth
- **Title**: `requireWriteAccess` does not use RBAC permission — checks legacy VIEWER only

**Evidence**:
- `src/middleware/auth.ts` lines 173–185: `requireWriteAccess` only checks `isViewer(req.user)` which returns true only if `user.role === 'VIEWER'`
- It does not check RBAC permission keys like `dataEntry.create`, `adOrder.create`, etc.
- Used in `PUT /api/ad-sites/:id/price` route (admin.ts line 1685) alongside `requirePermission("perm_admin")`

**Impact**: A user with RBAC role OPERATOR (which can write data) would still be blocked by `requireWriteAccess` if their legacy `role` is not 'VIEWER'. The function doesn't use the new RBAC permissions at all.

**Reproduction**: Login as OPERATOR (roleCode='OPERATOR'). Call PUT /api/ad-sites/:id/price — should work based on OPERATOR permissions but `requireWriteAccess` will block it because it only checks legacy VIEWER role.

**Recommended Fix**: Update `requireWriteAccess` to check RBAC permissions OR deprecate it in favor of explicit `requirePermission` calls on each route.

**Risk of Fix**: Medium — changing auth behavior for existing routes.

**Code Change Required**: Yes

---

## AUDIT-P2-003
- **Severity**: P2
- **Area**: Auth
- **Title**: AdId controller uses `requirePermission("perm_admin")` instead of RBAC key

**Evidence**:
- `src/controllers/bff/adId.controller.ts` uses `requirePermission("perm_admin")` — legacy permission key
- The BFF layer's `requirePermission` in `auth.ts` supports both legacy flags and RBAC keys via the dual-path check at lines 156–168

**Impact**: The adId controller is accessible by any user with `perm_admin: true` (legacy ADMIN flag) but NOT by users who have `adId.create` or `adId.update` RBAC permissions. If the system migrates fully to RBAC, this endpoint becomes inaccessible even for users with appropriate adId permissions.

**Reproduction**: Create a user with RBAC role that has `adId.create` permission but no `perm_admin` flag. Try to create an AdId — likely blocked because `requirePermission("perm_admin")` checks the legacy flag.

**Recommended Fix**: Change to `requirePermission("adId.create")` and `requirePermission("adId.update")` for respective routes.

**Risk of Fix**: Low — changing permission key.

**Code Change Required**: Yes

---

## AUDIT-P2-004
- **Severity**: P2
- **Area**: Frontend
- **Title**: BFF API types missing `settlement` module types

**Evidence**:
- `frontend/src/lib/bffTypes.ts` — no `SettlementMonthData`, `SettlementAdvertiserData`, or similar settlement types found
- Settlement controller returns `SettlementMonthData[]` from backend but frontend has no type for it
- `frontend/src/pages/Reports.tsx` and settlement-related pages likely use `any` or incomplete types

**Impact**: Frontend can't properly validate settlement API responses. TypeScript may implicitly fall back to `any`, hiding potential mismatches.

**Reproduction**: Look at frontend settlement page TypeScript usage — likely has type errors or `any` casts.

**Recommended Fix**: Add settlement types to `bffTypes.ts` matching the backend `SettlementMonthData` interface.

**Risk of Fix**: Low — adding types only.

**Code Change Required**: Yes

---

## AUDIT-P2-005
- **Severity**: P2
- **Area**: Data Model
- **Title**: DailyInput has no index on `recordDate + adSiteId + status` for the confirmed-daily query pattern

**Evidence**:
- `prisma/schema.prisma` lines 170–174 — indexes: `[recordDate]`, `[adSiteId]`, `[status]`, `[status, recordDate, adSiteId]`
- The compound index `[status, recordDate, adSiteId]` covers queries like `WHERE status = 'confirmed' AND recordDate = X AND adSiteId = Y` but not in the most selective order
- Dashboard monthly queries filter by `status = 'confirmed'` first, then `recordDate` range, then `adSite` join

**Impact**: Monthly confirmed-daily-input queries at scale may be slow. The current compound index starts with `status` which is good for the confirmed filter, but the query also filters on `adSite.isArchived` and `upstream.adTypeId` which aren't in any compound index.

**Reproduction**: Query `GET /api/dashboard/monthly?year=2026&month=5&ad_type=SM` with 100K+ DailyInput rows — observe query time.

**Recommended Fix**: Consider adding index `[status, recordDate, adSiteId]` if not already optimal, or `[status, recordDate, adSite.isArchived]` for the full filter pattern.

**Risk of Fix**: Low — adding index.

**Code Change Required**: Yes (schema only)

---

## AUDIT-P3-001
- **Severity**: P3
- **Area**: Frontend
- **Title**: AdvertiserDataEntry and MediaDataEntry pages use different dropdown/filtering logic

**Evidence**:
- `src/controllers/bff/advertiserDataEntry.controller.ts` vs `src/controllers/bff/mediaDataEntry.controller.ts` — use different `adTypeFilter` and query approaches
- `frontend/src/pages/DataEntry.tsx` uses two different sub-pages (Advertiser Data Entry and Media Data Entry) with potentially different filtering semantics

**Impact**: Same data could appear in different places with different filters, causing confusion. Not a bug per se, but a maintainability issue.

**Recommended Fix**: Standardize the filtering approach between advertiser and media data entry flows.

**Risk of Fix**: Low.

**Code Change Required**: Optional

---

## AUDIT-P3-002
- **Severity**: P3
- **Area**: Seed
- **Title**: seed-rbac.ts has hardcoded migration logic for 'editor' and 'manager' usernames

**Evidence**:
- `prisma/seed-rbac.ts` lines 189–192: checks for `username: 'editor'` specifically
- `prisma/seed-rbac.ts` lines 180–193: migrates `MANAGER` and `EDITOR` role users to `OPERATOR`

**Impact**: If a user account has username 'editor' but is intentionally an EDITOR role (not the seeded 'editor' user), the migration logic won't catch it. Only users with roleId pointing to MANAGER or EDITOR role are migrated — the legacy 'editor' username case is separate.

**Reproduction**: Create a user with username 'editor2' and role EDITOR — seed won't migrate it.

**Recommended Fix**: The migration logic at lines 180–193 handles users linked to MANAGER/EDITOR roleIds correctly. The username-based link at lines 189–192 is a one-time migration aid. Consider removing the username-based link after confirming it ran successfully in production.

**Risk of Fix**: Low.

**Code Change Required**: Optional

---

## AUDIT-P3-003
- **Severity**: P3
- **Area**: Naming
- **Title**: `__count__` used as Column key in Table.tsx but never rendered

**Evidence**:
- `frontend/src/components/Table.tsx` line 5: `key?: keyof T | '__no__' | '__actions__' | '__count__'`
- `frontend/src/pages/RoleManagement.tsx` line 138: `{ key: '__count__', label: t('permissions'), render: () => null }`
- The `__count__` key is accepted but ignored in the Table rendering logic (no handler for it)

**Impact**: The permissions count column in RoleManagement always renders null. It was presumably intended to show the number of permissions per role. Currently harmless but dead code.

**Recommended Fix**: Either implement `__count__` rendering to show `role.permissions?.length`, or remove the unused column definition.

**Risk of Fix**: None.

**Code Change Required**: Optional