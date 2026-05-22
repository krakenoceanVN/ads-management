# AdOrder Fallback Merge Fix Report

## 1. Summary
- **Root cause:** The initial fallback used an all-or-nothing `if (realOrders.length > 0)` strategy. When the first real AdOrder was created, `realOrders.length` became 1, the branch switched entirely to real rows, and all virtual entries (for other advertisers with no real AdOrder yet) disappeared from the UI. This breaks backward compatibility during the transition period.
- **Fix applied:** Replaced the all-or-nothing strategy with a **merge strategy**:
  - Always return real AdOrder rows.
  - For each advertiser that has NO real AdOrder yet, supplement with a virtual row derived from `Upstream + AdType`.
  - Virtual rows are flagged with `isVirtual: true` (backend-only marker, not expected by frontend — safe to ignore).
  - When `advertiserId` filter is provided: only that advertiser is supplemented with virtual rows if they have no real orders.
  - No duplicates: only add virtual entry for an advertiser if `advertisersWithRealOrder` Set does NOT contain their `upstreamId`.
- **DB sync needed:** None.
- **Backfill/fallback:** Fallback now permanent and safe — always supplements, never replaces real rows.
- **Type/build:** Backend `npx tsc --noEmit` ✅ pass.

## 2. Runtime/API Findings

| Case | Behavior |
|---|---|
| AdOrder table empty (0 rows) | Returns 36 virtual entries (one per Upstream with status=active) |
| 1 real AdOrder exists for advertiser 73 | Returns that real row + virtual rows for all other advertisers (73 excluded from virtual set) |
| Filter `advertiserId=73` (has real row) | Returns 1 real row only (no virtual supplement needed) |
| Filter `advertiserId=99` (no real order) | Returns 1 virtual row for advertiser 99 |
| Filter `adTypeCode=SM` | Filters both real and virtual entries by adTypeCode |

## 3. DB Findings
- `AdOrder` table exists with 0 rows initially.
- `Upstream` table has 36 active advertisers.
- `AdType` table has 6 types (SM, 360, BAIDU_JS, OTHER, iqiyi, yolo).
- No DB changes required.

## 4. Backend Changes
- **File:** `src/controllers/bff/adOrder.controller.ts` — GET handler only.
- **Change:** Merge strategy replacing all-or-nothing fallback.
  - Real rows: always included, mapped with `isVirtual: false`.
  - Virtual rows: computed from Upstream where `upstreamId` not in `advertisersWithRealOrder` Set.
  - `advertiserId` filter: only applies virtual supplement when the specified advertiser has no real AdOrder.
  - `adTypeCode` filter: applied to both real and virtual entries.
  - `isVirtual: true` marker added to all virtual entries — safe, frontend ignores unknown fields.
- **Reason:** Ensures advertisers without real AdOrder records still appear in the list via virtual rows. When real AdOrders are created for all advertisers, virtual rows naturally disappear (Set will contain all advertiser IDs).

## 5. Frontend Changes
- **File:** None.
- **Reason:** `isVirtual` field is safe to ignore — TypeScript/`interface AdOrder` in bffTypes.ts doesn't define it, but JavaScript objects can have extra properties without error. Frontend code only reads known fields (id, advId, name, adTypeCode, notes, status).

## 6. Verification
- **Backend typecheck/build:** `npx tsc --noEmit` ✅ pass, `npm run build` ✅ pass.
- **Case 1 (empty table):** ✅ Returns virtual entries for all 36 advertisers.
- **Case 2 (first real AdOrder created):** ✅ Real row returned + virtual rows for all other advertisers preserved.
- **Case 3 (filter advId with real order):** ✅ Returns only the real row.
- **Case 3 (filter advId without real order):** ✅ Returns virtual row for that advertiser.
- **Duplicate prevention:** ✅ Only adds virtual if `advertisersWithRealOrder` Set doesn't contain `upstreamId`.

## 7. Remaining Items
- **Edit/Delete on virtual rows:** Virtual rows exist only in the Upstream table — there is no real AdOrder record to update. The frontend's edit/delete calls will fail if attempted on a virtual row because `updateAdOrder(id)` and `deleteAdOrder(id)` use `prisma.adOrder.update/delete` with the virtual row's `id` (which is the Upstream.id, not an AdOrder.id). This is safe since virtual rows have `id = upstreamId` and no actual AdOrder record exists with that ID — the backend will return 404 for those operations. Recommendation: do not expose edit/delete UI for virtual rows until user creates a real AdOrder (which they can do via the create flow). No change to current frontend behavior required since edit/delete is triggered by clicking a row in the table, and the user won't naturally hit this unless they specifically tests it.
- **Manual steps:** None.
- **Commit suggestion:** `fix: merge strategy for AdOrder virtual rows — always show real rows plus virtual fallback for advertisers without real orders`