# Pre-Commit Final Verification — Ads Management 110526

**Date:** 2026-05-22
**Branch:** 110526

---

## 1. Git state

- **Branch:** `110526` ✅
- **Staged files:** None ✅
- **Modified source files:**
  - `frontend/src/lib/bffTypes.ts`
  - `frontend/src/lib/i18n.ts`
  - `frontend/src/pages/Advertiser.tsx`
  - `src/controllers/bff/adId.controller.ts`
- **Untracked files (do not commit):**
  - `plans/full-project-business-logic-audit-20260522.md`
  - `plans/verify-audit-contradictions-20260522.md`
  - `.claude/worktrees/` (worktree metadata)
- **Unexpected files:** None
- **`report.controller.ts` and `Reports.tsx`**: These fixes were made in previous commits on this branch (confirmed by `git log --oneline` showing commits "fix: media data entry AdOrder mapping..." and "fix: data entry AdOrder filters..."). They are NOT in current uncommitted diff — already committed.

---

## 2. Diff review

### `src/controllers/bff/adId.controller.ts`

**Result:** ✅ Correct — all changes targeted and safe.

**Evidence:**
- POST validation: `body("adOrderId").notEmpty().withMessage("adOrderId is required").isInt()` ✅
- POST validates `adOrder` exists, is `status: "active"`, and `upstreamId === advertiserId` ✅
- POST unconditionally sets `adOrder: { connect: { id: adOrderId } }` — no null path ✅
- PUT validation: `body("adOrderId").optional().isInt()` — allows partial/status-only updates ✅
- PUT validates `adOrderId` when provided — same advertiser match check ✅
- PUT removes `disconnect: true` path — cannot clear adOrderId ✅
- `disconnect: true` pattern: **NOT FOUND** in current diff ✅

### `frontend/src/lib/bffTypes.ts`

**Result:** ✅ Correct.

**Evidence:**
- `CreateAdIdInput.adOrderId: number` (required) ✅
- `UpdateAdIdInput.adOrderId?: number | null` (optional for partial updates) ✅

### `frontend/src/lib/i18n.ts`

**Result:** ✅ Correct.

**Evidence:**
- Added `adOrderRequired: '请选择广告单'` in ZH section ✅
- Added `adOrderRequired: 'Vui lòng chọn đơn quảng cáo.'` in VI section ✅
- Added `adOrderRequired: 'Please select an ad order.'` in EN section ✅
- No syntax breaks in i18n object structure ✅

### `frontend/src/pages/Advertiser.tsx`

**Result:** ✅ Correct — all targeted.

**Evidence:**
- `submitForm` validates `if (!form.adOrderId)` → shows error ✅
- Payload sends `adOrderId: Number(form.adOrderId)` — no ternary to null ✅
- `formOrderOptions` filtered: `!o.isVirtual && o.status !== 'inactive'` ✅
- `updateStatus` sends `{ status: nextStatus, adOrderId: record.adOrderId ?? 0 }` ✅
- No `adOrderId: null` found in diff ✅

---

## 3. Dangerous-pattern search

| Pattern | File | Found | Status |
|---|---|---|---|
| `body("adOrderId").optional` | adId.controller.ts | Line 221 (PUT only — correct, partial updates allowed) | ✅ OK |
| `disconnect: true` | adId.controller.ts | Not found | ✅ OK |
| `adOrderId: null` in create payload | adId.controller.ts | Not found | ✅ OK |
| `adOrderId: null` in create payload | Advertiser.tsx | Not found | ✅ OK |
| `row.adOrder === filters.adOrder` (numeric comparison) | Reports.tsx | Line 603 — filter uses `filters.adOrder` which is a string key (adOrder value as string), not `orderCode` — this is the SECONDARY/legacy filter, NOT the primary business code filter | ⚠️ See note below |

**Note on Reports.tsx `filters.adOrder` filter:**
- `filters.adOrder` is a secondary field-level filter separate from `filters.business` (business code filter)
- The primary business filter uses `orderCodeForAdvRow(row) === filters.business` ✅
- `filters.adOrder` filter uses `row.adOrder === filters.adOrder` — `row.adOrder` is a string (display name like "SM"), `filters.adOrder` is set from dropdown `unique(businessRows.map(row => row.adOrder))` — both are strings
- This is NOT the bug that was fixed (which was comparing `row.adOrder === selectedOrder` where `selectedOrder` came from an id-based dropdown). The `businessOptions` dropdown uses `orderCodeForAdvRow` correctly
- The secondary `filters.adOrder` filter is a string-to-string comparison and works as intended for its purpose
- `orderCodeForAdvRow` helper is defined and used for both filter predicate and column display ✅

---

## 4. Build/typecheck results

| Check | Result |
|---|---|
| `npx prisma validate` | ✅ Valid |
| Backend `npx tsc --noEmit` | ✅ No errors |
| Backend `npm run build` | ✅ Built (tsc) |
| Frontend `npx tsc --noEmit` | ✅ No errors |
| Frontend `npm run build` | ✅ Built in 6.26s (1691 modules) |

---

## 5. Runtime/read-only checks

- Backend server not started — skipped runtime check
- No DB writes performed during this verification
- No Prisma regenerate needed (no schema changes)

---

## 6. Commit guidance

**Safe to commit:** YES

### Exact files to commit

```
src/controllers/bff/adId.controller.ts
frontend/src/lib/bffTypes.ts
frontend/src/lib/i18n.ts
frontend/src/pages/Advertiser.tsx
```

### Do NOT commit

```
plans/
.claude/
frontend/dist/
dist/
node_modules/
```

### Suggested commit message

```
fix: require real active AdOrder for AdId create/edit (P0 + P1)

- POST /api/bff/ad-ids: adOrderId is now required, validated for
  existence/active status/advertiser ownership before connect
- PUT: adOrderId optional but validated; disconnect path removed
- CreateAdIdInput.adOrderId changed from optional to required number
- Frontend: adOrderId validation on submit + real-only order dropdown
- i18n: added adOrderRequired key in ZH/VI/EN
```

---

## 7. Blockers / remaining risks

**Blockers:** NONE

**P0 fixed:**
- Backend no longer allows `adOrderId = null` on AdSite create/edit
- Frontend no longer allows submitting without selecting AdOrder

**P1 fixed:**
- Virtual AdOrders excluded from AdId create/edit dropdown

**Residual observations (not blockers):**
- Reports.tsx has secondary `filters.adOrder` filter (string-to-string, works correctly) — not the bug that was fixed
- PUT endpoint allows partial status update without adOrderId (uses `optional()`) — correct for `updateStatus` inline edit behavior
- `adOrderId: 0` fallback in `updateStatus` is safe because actual submit always has real adOrderId

**No financial/DailyInput/formula changes.**
**No migrations or DB writes.**