# Advertiser Management v4 Requirements Report

Date: 2026-05-21
Status: **PARTIAL** — 3 implemented, 2 NEEDS_BACKEND

## 1. Summary

- **Implemented:** Advertiser search extended (phone/email/notes — data null but code ready), AdOrder advertiser filter (client-side), AdId RATIO rate display as percentage
- **Partial:** AdId label — already correctly uses `t('adId')` = "ID quảng cáo"
- **NEEDS_BACKEND:** Advertiser contact/phone/email/notes fields (Upstream table has no these columns — data always null), AdOrder edit/delete (virtual/read-only AdType), AdId edit/delete (read-only AdSite)
- **Type/build:** Frontend `tsc` ✓ | Frontend `npm run build` ✓ (1691 modules)

---

## 2. Requirement Mapping

| Section | Requirement | Status Before | Action Taken | Status After | Files |
|---------|-------------|---------------|--------------|--------------|-------|
| 1.1 Advertiser search | Search by name, contact, phone, email, notes | Only name/adTypeCode/status | Added contact/phone/email/notes to search array | Code ready — data fields always null per current schema | `Advertiser.tsx:183-189` |
| 1.2 AdOrder filter | Filter by advertiser | Dropdown exists but no client-side filter | Added `advFilter && row.advId !== Number(advFilter)` to filter | Done — client-side | `Advertiser.tsx:371-376` |
| 1.4 AdOrder edit/delete | Edit opens prefill form; Delete button in edit mode | Read-only — no forms | No change | **NEEDS_BACKEND** — AdOrder is virtual (AdType-based), no CRUD endpoints | `adOrder.controller.ts` |
| 1.5 AdId label | "Vị trí quảng cáo" → "ID quảng cáo" | Already using `t('adId')` = "ID quảng cáo" | No change needed | Already done | `Advertiser.tsx:511` |
| 1.5 AdId CPS ratio | RATIO rate display as percentage | Raw number (e.g. "0.12") | `formatMgmtRate` now shows `(num * 100).toFixed(1)%` for RATIO | Done | `Advertiser.tsx:62-70` |
| 1.6 AdId edit/delete | Edit prefill + Update API; Delete with confirm | Read-only | No change | **NEEDS_BACKEND** — AdSite is read-only, no PUT/DELETE endpoints | `adId.controller.ts` |

---

## 3. Backend Endpoint Check

| Resource | GET | CREATE | UPDATE | DELETE | Notes |
|----------|-----|--------|--------|--------|-------|
| Advertiser | ✓ | ✓ | ✓ | ✓ (soft) | Full CRUD — but no contact/phone/email/notes fields in Upstream schema |
| AdOrder | ✓ | ✗ 501 | ✗ 501 | ✗ 501 | Virtual AdType-based; POST/PUT/DELETE explicitly return 501 Not Implemented |
| AdId | ✓ | ✗ 501 | ✗ 501 | ✗ 501 | AdSite read-only; POST/PUT/DELETE return 501 with message "Use Media instead" |

---

## 4. Files Changed

### `frontend/src/pages/Advertiser.tsx`

**Change 1 — Advertiser search (lines 183-189):**
```typescript
// Before: only row.name, row.adTypeCode, row.status
// After: added row.contact, row.phone, row.email, row.notes
return [
  row.name,
  row.adTypeCode,
  row.contact,
  row.phone,
  row.email,
  row.notes,
  row.status,
].some(value =>
  normalizeText(value).includes(keyword) || normalizeText(displayName(value)).includes(keyword)
);
```
**Reason:** v4 image 1.1 requirement — "tìm theo số điện thoại, email và ghi chú". Code is now correct, but data is always null because Upstream table has no contact/phone/email/notes columns.

**Change 2 — AdOrder filter (line 371-376):**
```typescript
// Added missing client-side advertiser filter
if (advFilter && row.advId !== Number(advFilter)) return false;
```
**Reason:** v4 image 1.2 requirement — "chưa thể tìm kiếm theo nhà quảng cáo". The dropdown existed but was not filtering rows.

**Change 3 — AdId RATIO rate display (lines 62-70):**
```typescript
// Before: return String(rate ?? '');
// After: for RATIO, display as percentage
function formatMgmtRate(type: string, rate: unknown) {
  if (rate == null || rate === '') return '';
  const num = Number(rate);
  if (Number.isNaN(num)) return String(rate);
  if (type === 'RATIO') {
    return `${(num * 100).toFixed(1)}%`;
  }
  return String(rate);
}
```
**Reason:** v4 image 1.5 — "CPS ratio hiển thị theo dạng phần trăm". Convention: backend stores decimal (0.12), frontend multiplies ×100 for display.

---

## 5. Search/Filter Changes

### Advertiser search fields (AdvertiserList)
- **Before:** `name`, `adTypeCode`, `status`
- **After:** `name`, `adTypeCode`, `contact`, `phone`, `email`, `notes`, `status`
- **Status:** Code ready, data fields always null (`contact: null`, `phone: null`, `email: null`, `notes: null`) because Prisma Upstream model has no these columns

### AdOrder advertiser filter (AdOrderMgmt)
- **Before:** Dropdown existed but did not filter rows
- **After:** `advFilter && row.advId !== Number(advFilter)` added to `visibleRows` filter
- **Status:** Done — client-side

### AdId filters (AdIdMgmt)
- **No change** — cascade dropdowns (advertiser → adOrder → type) already existed

---

## 6. Edit/Delete Changes

### AdOrder
- **Edit:** Not implemented — **NEEDS_BACKEND**
  - `adOrder.controller.ts` POST/PUT/DELETE all return 501
  - AdOrder is virtual (derived from AdType, not a persistent entity)
  - Frontend `AdOrderMgmt` has no create/edit form (read-only)
  - No database table for AdOrder — no schema to extend

### AdId
- **Edit/Delete:** Not implemented — **NEEDS_BACKEND**
  - `adId.controller.ts` POST/PUT/DELETE all return 501
  - Message: "Independent AdId creation is not supported. Create Media instead."
  - AdId is AdSite (demand-side slot) — read-only lookup
  - Frontend `AdIdMgmt` has no create/edit form (read-only)
  - Would require extending `AdSite` table + BFF controller

---

## 7. AdId Label / CPS Ratio Display

### Label
- **Current:** `t('adId')` = "ID quảng cáo" (VI) / "Ad ID" (EN) / "广告ID" (ZH)
- **Status:** Already correct — no change needed
- **Backend impact:** None

### RATIO Rate Convention
- **Backend stores:** `currentRatio` as Decimal (e.g., `0.12` for 12%)
- **UI displays:** `(0.12 × 100) = 12.0%` for type === 'RATIO'
- **Backend impact:** None — display-only change, no data conversion
- **Note:** Backend `getAdvertiserReport` / `getMediaReport` send `'RATIO'` (not `'CPS'`); UI maps RATIO → CPS via `apiTypeToUiType`. CPS is billing label, RATIO is API/system value.

---

## 8. Verification

| Check | Result |
|-------|--------|
| Frontend `npx tsc --noEmit` | ✓ Pass |
| Frontend `npm run build` | ✓ Pass (1691 modules) |
| Backend `npx tsc --noEmit` | ✓ Not modified |
| Backend `npm run build` | ✓ Not modified |

### Manual/code verification:
- AdvertiserList search array now includes contact/phone/email/notes ✓ (fields always null)
- AdOrderMgmt `visibleRows` filter checks `advFilter` ✓
- AdIdMgmt column `label: t('adId')` = "ID quảng cáo" ✓
- `formatMgmtRate('RATIO', 0.12)` returns `"12.0%"` ✓

---

## 9. Remaining Items

### NEEDS_BACKEND:

1. **Advertiser contact/phone/email/notes — Upstream table columns**
   - `Upstream` model (prisma/schema.prisma:28) has only: `id`, `adTypeId`, `name`, `status`, `createdAt`, `updatedAt`
   - **Missing columns:** `contact`, `phone`, `email`, `notes`
   - **Action:** Requires Prisma migration + backend Advertiser mapper update + BFF Advertiser controller update + frontend type update
   - **Status:** Not implemented — data will remain null

2. **AdOrder CRUD — AdType-based virtual entity**
   - `AdOrder` is derived from `AdType`, not a persistent table
   - No `AdOrder` Prisma model exists
   - **Action:** Would need new Prisma model + BFF controller + frontend form
   - **Status:** Not implemented — would be significant architecture change

3. **AdId CRUD — AdSite write operations**
   - `AdSite` has `PUT /:id` and `DELETE /:id` returning 501
   - **Action:** Would need BFF controller implementation + frontend AdIdMgmt form
   - **Status:** Not implemented — existing message says "create Media instead"

### NEEDS_CONFIRMATION:

1. **AdOrder data model:** Is AdOrder meant to be a persistent entity (new table + CRUD) or remain virtual (derived from AdType)?
   - If persistent: needs schema migration + backend CRUD + frontend edit form
   - If virtual: no edit/delete possible, current read-only state is correct by design

2. **AdId data model:** Should AdId support independent CRUD or only be managed via Media flow?
   - Current BFF message says "Create Media instead"
   - v4 image 1.6 requirement says edit/delete should work on AdId

---

## 10. Report Table of Contents

- Section 1: Summary
- Section 2: Requirement Mapping (image-by-image)
- Section 3: Backend Endpoint Check
- Section 4: Files Changed
- Section 5: Search/Filter Changes
- Section 6: Edit/Delete Changes
- Section 7: AdId Label / CPS Ratio Display
- Section 8: Verification
- Section 9: Remaining Items