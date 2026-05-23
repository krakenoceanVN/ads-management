# NEXT FIX PROMPT

This prompt is for a coding agent to fix ONLY the confirmed audit issues. Do not fix other things. Do not refactor unrelated code. Do not change business logic unless explicitly required by the fix.

---

## Context

This is a TypeScript/Node/Express/Prisma/React ad management system. The audit identified several issues that need fixing before production.

**Hard rules:**
- Do NOT commit.
- Do NOT push.
- Do NOT modify report/calculation formulas (only fix TYPE ERRORS in calculation code if any).
- Do NOT modify RBAC auth logic (only fix PERMISSION CHECK gaps).
- Do NOT delete user/business data.
- After each fix, verify: `npx prisma validate && npx tsc --noEmit && cd frontend && npx tsc --noEmit && npm run build`

---

## Fix Group 1 — P0: Critical Data Integrity

### FIX-1: DailyInput revenue formula enforcement

**File**: `src/controllers/bff/mediaDataEntry.controller.ts` and `src/controllers/bff/advertiserDataEntry.controller.ts`

**Problem**: The data entry endpoints accept `revenue`, `amount1`, `amount2` directly from the frontend body without server-side recalculation. Any caller can set revenue to arbitrary values.

**Fix approach**: For each data entry create/update, BEFORE writing to DB, compute `revenue` server-side based on `billingMethod`:
- If `CPM`: `revenue = qty * unitPriceSnapshot / 1000` (use `unitPriceSnapshot` from the request body or look up from `adSite.currentUnitPrice`)
- If `RATIO`: `revenue = (amount1 + amount2) * ratioSnapshot`
- If `CPA`: revenue is the settlement amount (keep as-is or validate)

Override the revenue field with the computed value before writing. Log a warning if the frontend-sent revenue differs from the computed revenue by more than 0.01 (floating point tolerance).

**Risk**: This is a behavioral change — existing records with manually-set wrong revenue won't be corrected. Only new/edited records will be corrected.

**Required**: Yes

---

### FIX-2: AdId/AdSite adOrderId validation

**File**: `src/controllers/bff/adId.controller.ts`

**Problem**: AdSite can be created with an `adOrderId` that references a non-existent or inactive AdOrder.

**Fix approach**: In the create AdId flow (POST /api/bff/ad-ids), if `adOrderId` is provided in the request body:
1. Look up the AdOrder by `adOrderId`
2. If not found, return 400 with "AdOrder not found"
3. If found but `status !== 'active'`, return 400 with "AdOrder is not active"
4. If valid, proceed

Also check in the update (PUT /api/bff/ad-ids/:id) for the same validation.

**Risk**: Low — validation only

**Required**: Yes

---

## Fix Group 2 — P1: TypeScript / Prisma Client Regeneration

### FIX-3: Regenerate Prisma client to fix 32 TypeScript errors

**Problem**: `npx tsc --noEmit` shows 32 errors because `roleRef` is used in code but the Prisma-generated TypeScript types don't include it. The schema has `roleRef` defined but the types are stale.

**Fix approach**:
1. Run `npx prisma generate` — if Windows file lock error occurs, try: `npx prisma generate --schema=prisma/schema.prisma`
2. If still locked, close any process using `node_modules/.prisma/client/query_engine-windows.dll.node` and retry
3. After generate, run `npx tsc --noEmit` — should show 0 errors

**IMPORTANT**: Do NOT run `prisma db push` or `prisma migrate` — only `prisma generate` (which updates types, not schema).

**Risk**: Low — regenerating client types

**Required**: Yes

---

## Fix Group 3 — P1: Permission Check Gaps

### FIX-4: Add permission checks to BFF controllers

**Files**: `src/controllers/bff/settlement.controller.ts`, `src/controllers/bff/report.controller.ts`, `src/controllers/bff/advertiser.controller.ts`, `src/controllers/bff/media.controller.ts`, `src/controllers/bff/mediaDataEntry.controller.ts`, `src/controllers/bff/advertiserDataEntry.controller.ts`, `src/controllers/bff/downstream.controller.ts`

**Problem**: These BFF controllers have no `requirePermission` calls. Any authenticated user can access them.

**Fix approach**: For each controller, identify the appropriate permission key from the RBAC permission list (check `prisma/seed-rbac.ts` for the full list). Add `requirePermission('<key>')` to each route:
- Settlement read: `settlement.read`
- Settlement approve: `settlement.approve`
- Reports: `report.read`
- Report export: `report.export`
- Advertiser create: `advertiser.create`
- Media (AdSite) create: `media.create`
- Data entry: `dataEntry.create` and `dataEntry.confirm`
- Downstream read: `downstream.read` (if exists) or `media.read`

If a specific permission key doesn't exist for a controller, use the most closely matching existing key. If NONE match (e.g., no downstream read permission), add a comment noting this gap.

The BFF routers are mounted with `requireAuth` already. You need to add per-route `requirePermission` calls INSIDE each controller method or via a middleware wrapper.

**Alternative simpler approach**: If per-route middleware is complex, add a `requirePermission` check at the top of each controller's request handler method.

**Risk**: Low — adding auth middleware

**Required**: Yes

---

### FIX-5: Fix SUPER_ADMIN role update protection

**File**: `src/routes/admin.ts` (role update route — find the PUT /api/roles/:id/permissions handler)

**Problem**: No server-side guard prevents modifying SUPER_ADMIN role's permissions. Frontend hides the button but API call would succeed.

**Fix approach**: In the PUT /api/roles/:id/permissions handler:
1. Look up the role by id
2. If `role.code === 'SUPER_ADMIN'`, return 403 with "Cannot modify SUPER_ADMIN role"
3. Proceed otherwise

**Risk**: Low — adding auth check

**Required**: Yes

---

### FIX-6: Sync legacy role field on user update

**File**: `src/routes/admin.ts` (PUT /api/users/:id route)

**Problem**: When updating a user's `roleId`, the legacy `role` string field may not be synced, causing divergence.

**Fix approach**: In the user update handler, after validating the new roleId:
1. Get the role by new roleId
2. Update BOTH `role: role.code` AND `roleId` in the user update data
3. This ensures both legacy and RBAC fields stay in sync

**Risk**: Low — adding field sync

**Required**: Yes

---

## Fix Group 4 — P2: Smaller Fixes

### FIX-7: Define DEFAULT_DOWNSTREAM_PRICES in constants.ts

**File**: `src/utils/constants.ts` and `src/routes/dashboard.ts` line 582

**Problem**: `DEFAULT_DOWNSTREAM_PRICES` is imported from constants but not defined there. When a downstream period isn't found, the fallback silently uses `undefined` → 0 payout.

**Fix approach**:
1. Add `DEFAULT_DOWNSTREAM_PRICES: Record<string, number> = {}` to `constants.ts` (empty record as safe default)
2. OR replace the fallback at line 582 with a hardcoded default like `price > 0 ? price : 0`

**Risk**: None

**Required**: No (P2 — low risk)

---

### FIX-8: Change adId controller to use RBAC permission keys

**File**: `src/controllers/bff/adId.controller.ts`

**Problem**: Uses `requirePermission("perm_admin")` (legacy) instead of RBAC `adId.create/update` keys.

**Fix approach**: Change to `requirePermission("adId.create")` for create route and `requirePermission("adId.update")` for update route.

**Risk**: Low — changing permission key

**Required**: No (P2)

---

## Verification Steps (run after EACH fix group)

```bash
# 1. Validate schema
npx prisma validate

# 2. Backend TypeScript
npx tsc --noEmit

# 3. Frontend TypeScript
cd frontend && npx tsc --noEmit

# 4. Frontend build
npm run build
```

All must pass (0 errors) before declaring fixes complete.

---

## Final Report Required

After all fixes are applied, provide a summary in Vietnamese:
- Which fixes were applied
- Which were skipped (P2 items not fixed)
- Exact output of verification commands
- Final git status --short