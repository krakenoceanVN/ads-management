# AdOrder Load Fix Report

## 1. Summary
- **Root cause:** `GET /api/bff/ad-orders` only queried `prisma.adOrder.findMany()`. The new `AdOrder` table was created and synced to DB, but it contains **0 rows** — no backfill was run. Upstream (advertiser) entities existed in DB but were never migrated to `AdOrder` records. Result: empty array returned, UI shows empty state.
- **Fix applied:** Added fallback in `GET /api/bff/ad-orders` — when `AdOrder` table returns 0 rows, derive virtual `AdOrder` entries from `Upstream` table joined with `AdType`. Each advertiser's upstream IS a virtual ad order entry with its `adTypeCode` as the order name. This preserves backward compatibility while new real AdOrder records get created over time via the CRUD UI.
- **DB sync needed:** No — `npx prisma db push` was already run, table exists with 0 rows.
- **Backfill/fallback:** Fallback active (virtual derivation from Upstream when AdOrder table is empty). Real records will replace fallback once created via CRUD.
- **Type/build:** Backend `npx tsc --noEmit` ✅ pass, `npm run build` ✅ pass.

## 2. Runtime/API Findings
- `GET /api/bff/ad-orders`: returns `{ success: true, data: [...] }` with 36 entries (derived from 36 Upstream rows). Response shape matches frontend `AdOrder` type (fields: id, advId, name, adTypeCode, notes, status).
- `GET /api/bff/ad-orders?advertiserId=73`: returns 1 entry for advertiser ID 73 (the virtual entry derived from Upstream).
- `GET /api/bff/ad-orders?adTypeCode=SM`: filters to only SM-type entries.
- Response shape: `Array<{ id: number, advId: number, name: string, adTypeCode: string, notes: null, status: string }>`
- Backend logs: no errors.

## 3. DB Findings
- `AdOrder` table exists in DB (schema synced via `prisma db push`).
- `AdOrder` rows count: **0** (empty table).
- Old virtual source: `Upstream` table + `AdType` — advertisers in Upstream each have one adType. This was previously used as the virtual source via the `adOrder.mapper.ts` (now replaced by direct controller logic).
- Backfill/fallback decision: Fallback to Upstream+AdType when AdOrder table is empty. This is transparent to frontend — same response shape. When users create real AdOrder records via the CRUD UI, those will be returned instead of the fallback.

## 4. Backend Changes
- **File:** `src/controllers/bff/adOrder.controller.ts`
- **Change:** Added fallback in GET handler — when `prisma.adOrder.findMany()` returns empty array, derive virtual AdOrder entries from `Upstream + AdType` join. Each Upstream becomes a virtual AdOrder entry with `name = adType.name`, `adTypeCode = adType.code`. Filter by `advertiserId` (Upstream.id) and `adTypeCode` works on the fallback too.
- **Reason:** AdOrder table is empty (no backfill performed). Without fallback, GET returns [] and UI shows empty state. Fallback preserves backward compatibility during transition — once real AdOrder records exist, they replace the fallback.

## 5. Frontend Changes
- **File:** None (no frontend changes needed).
- **Reason:** Response shape from fallback matches `AdOrder` interface in frontend — `id`, `advId`, `name`, `adTypeCode`, `notes`, `status`. No field mapping changes required.

## 6. Verification
- **Backend typecheck/build:** `npx tsc --noEmit` ✅ pass, `npm run build` ✅ pass.
- **Frontend typecheck/build:** not modified.
- **API checks:** `GET /api/bff/ad-orders` now returns 36 entries (virtual from Upstream). `GET /api/bff/ad-orders?advertiserId=73` returns 1 entry. Filter and pagination work correctly.
- **UI checks:** Expected to show list of 36 entries in "Quản lý đơn quảng cáo" page. Toolbar, dropdown, search, and export should be functional. Empty state should only show if both AdOrder table and Upstream query return no results.

## 7. Remaining Items
- **Known limitations:** The fallback creates one virtual AdOrder per Upstream (advertiser). If a single advertiser needs multiple AdOrders (e.g., separate SM and 360 campaigns), users must create real AdOrder records via the CRUD UI — the fallback only covers the existing 1-to-1 advertiser→adType relationship.
- **Manual steps:** None required. The fallback is automatic and transparent.
- **Commit suggestion:** `fix: add AdOrder table fallback to Upstream+AdType when table is empty (preserves backward compatibility during transition)`