# FRONTEND FLOW AUDIT

## Page Inventory

| Page | Component | Route/Access | Auth | Permission | Risks |
|------|-----------|--------------|------|-------------|-------|
| Login | Login.tsx | /login | Public | — | Password min 8 chars enforced only in form, not API |
| Advertiser List | Advertiser.tsx | sidebar advertiser | requireAuth | None (BFF has no guard) | Any auth'd user can access |
| AdOrder (Virtual) | Advertiser.tsx | sidebar adOrder | requireAuth | None | Read-only virtual derivation |
| Data Entry (Advertiser) | DataEntry.tsx | sidebar dataEntry | requireAuth | None (BFF has no guard) | Any auth'd user can POST |
| Data Entry (Media) | DataEntry.tsx | sidebar media | requireAuth | None | Any auth'd user can POST |
| Media/List | Media.tsx | sidebar media | requireAuth | None | Read-only, any auth'd user |
| Reports | Reports.tsx | sidebar report | requireAuth | None | Any auth'd user can view reports |
| User Management | UserManagement.tsx | sidebar user | requireAuth | `user.create/update/disable/resetPassword` | Correct RBAC checks |
| Role Management | RoleManagement.tsx | sidebar role | requireAuth | `role.update` | Correct RBAC checks |
| Settlement | AdvSettlement or MediaSettlement | sidebar settlement | requireAuth | None | Any auth'd user can view |

---

## Auth Flow

1. User submits login → POST `/api/bff/auth/login` → returns JWT token
2. Token stored in `localStorage` as `bff_auth_token`
3. `App.tsx` checks for token on mount → if present, calls `getCurrentUser()` → sets `initialCurrentUser`
4. `AppContext` provides `currentUser`, `can()`, `canAny()` to all components
5. `Sidebar` uses `can()` to conditionally render menu items

**Issue**: `can()` is frontend-only. If a menu item is hidden based on `can()`, a user could still navigate directly to the URL if they know it. The backend BFF routes do NOT have per-route `requirePermission` calls, so the backend would still serve the data.

---

## Sidebar Navigation Guard

**File**: `frontend/src/components/Sidebar.tsx`

The sidebar calls `can(requiredPerm)` for each menu group. If `can()` returns false, the group is not rendered. However:
- Direct URL navigation to a hidden page still works (backend has no permission check)
- `PAGE_PERMISSION_MAP` in `data.ts` maps page keys to required permissions

**Issue**: Hiding the sidebar item is cosmetic. The backend serves data to any authenticated user.

---

## BFF API Layer

**File**: `frontend/src/lib/bffApi.ts`

All BFF API calls go through this file. No centralized auth header management — each function manually sets `Authorization: Bearer ${token}`.

**Issue**: If `localStorage` token is cleared but component state isn't reset, stale data could persist. No token refresh mechanism found.

---

## Critical Frontend Flows

### Data Entry Flow
1. User selects date, adType, upstream, adSite, billing method
2. Enters qty/amounts and clicks Save
3. POST to `/api/bff/data-entry/media` or `/api/bff/data-entry/advertisers`
4. Backend accepts `revenue`, `amount1`, `amount2` as-is — no recalculation
5. **Risk**: Frontend computes the revenue formula. If there's a JS bug, wrong values get persisted.

### Report Flow
1. User selects date range, adType
2. GET `/api/bff/reports/daily?dateFrom=X&dateTo=Y&adType=Z`
3. Backend aggregates DailyInput records
4. **Risk**: Report filters by `adTypeId` through the join chain (DailyInput→AdSite→Upstream→AdType). If upstream's adTypeId is wrong, data appears in wrong report.

### Settlement Flow
1. User navigates to settlement page
2. Settlement controller queries DailyInput, aggregates by advertiser/month
3. **Risk**: No explicit `settlement.read` permission guard. Any authenticated user can view.

---

## i18n Keys Missing from bffTypes

The frontend uses translation keys from `i18n.ts`. Key gaps:
- `settlement.*` keys may not exist for all settlement UI labels
- `media.*` keys for media-specific labels
- Report-specific labels

---

## Frontend TypeScript Gaps

**File**: `frontend/src/lib/bffTypes.ts`

Missing types for:
- Settlement response types ( SettlementMonthData, SettlementAdvertiserData)
- OperationLog types
- Some report aggregate types

These likely fall back to `any` or implicit `any`, which TypeScript would flag if `--noEmit` were clean. However `npx tsc --noEmit` in frontend passes cleanly, suggesting either:
1. The types are complete, or
2. Type errors are suppressed

Need to verify with `cd frontend && npx tsc --noEmit` — the output showed no errors, so frontend types appear complete or the errors aren't being caught.

---

## Form Validation

- Login form: username required, password required (no min length on frontend)
- User create/edit: password min 8 chars (frontend + backend both check)
- Data entry: no frontend validation on numeric ranges; backend accepts any values
- Date pickers: no range limit enforcement on frontend

---

## Optimistic UI

The frontend doesn't appear to implement optimistic UI for any critical operations. Save/delete actions wait for server response. This is safe but could be improved for UX.