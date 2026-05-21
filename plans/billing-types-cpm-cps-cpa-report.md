# Billing Types Implementation Report: CPM / CPS / CPA

Date: 2026-05-21
Status: Completed

## Summary

Implemented support for 3 independent billing types — CPM, CPS, and CPA — as defined in the business decision brief. CPS is the UI-facing label that maps to the backend's internal `RATIO` type (no schema or data changes).

## Business Rules Applied

| Billing | Formula | UI Label | Backend Value |
|---------|---------|----------|---------------|
| Cost per mille | `rate × settlement / 1000` | CPM | CPM |
| Cost per sale | `settlement × rate(%)` | CPS | RATIO |
| Cost per acquisition | `rate × settlement` | CPA | CPA |

- `adType`/`adTypeCode` describes ad format (banner, video, etc.), NOT billing formula
- Billing formula is determined solely by `billingMethod`
- CPA is independent of `adType = OTHER`
- No schema migration needed (string field already stores values)
- No existing RATIO→CPS data rename

---

## Backend Changes

### 1. Type Definitions

**`src/types/index.ts`**
```typescript
export type BillingMethod = "CPM" | "RATIO" | "CPA"
```

### 2. Mappers

**`src/mappers/bff/dataEntry.mapper.ts`**
- `mapTypeToBillingMethod()`: Added CPA branch
- Error messages updated to list CPM, RATIO, CPA

**`src/mappers/bff/media.mapper.ts`**
- `BFFMedia.billingMethod`: Added `'CPA'`
- `CreateMediaRequest.billingMethod`: Added `'CPA'`
- `UpdateMediaRequest.billingMethod`: Added `'CPA'`
- `mapCreateRequestToAdSiteCreate()`: Accepts CPA, sets no default unitPrice/ratio for CPA
- `mapUpdateRequestToAdSiteUpdate()`: Accepts CPA with appropriate null handling

### 3. Validators

**`src/controllers/bff/media.controller.ts`**
- POST create: `isIn(["CPM", "RATIO", "CPA"])`
- PUT update: `isIn(["CPM", "RATIO", "CPA"])`
- Runtime validation accepts CPA

**`src/controllers/bff/advertiserDataEntry.controller.ts`** and **`mediaDataEntry.controller.ts`**
- Error message updated: `"Only CPM, RATIO, and CPA are supported."`

### 4. Calculations

**`src/utils/calculations.ts`**
```typescript
export function calculateCpaRevenue(rate: number, settlement: number): number {
  return rate * settlement
}
```

**`src/workflows/dailyInputBatch.workflow.ts`**
- CPA branch: `revenue = calculateCpaRevenue(rate, settlement)` where rate comes from `ratio_override` (CPA treats `ratio_override` as the flat rate, not a percentage)
- `ratioSnapshot` now saved for both RATIO and CPA billing methods
- Existing CPM and RATIO branches unchanged

---

## Frontend Changes

### 1. Type Definitions

**`frontend/src/lib/bffTypes.ts`**
```typescript
export type EntryType = 'CPM' | 'RATIO' | 'CPA';
```

Added mapping functions at API boundary:
```typescript
export function uiTypeToApiType(type: EntryType): 'CPM' | 'RATIO' | 'CPA' {
    if (type === 'CPS') return 'RATIO';
    return type;
}

export function apiTypeToUiType(type: 'CPM' | 'RATIO' | 'CPA'): 'CPM' | 'CPS' | 'CPA' {
    if (type === 'RATIO') return 'CPS';
    return type;
}
```

### 2. API Boundary Mapping

**`frontend/src/lib/bffApi.ts`**

All read operations (`listAdvertiserEntries`, `listMediaEntries`, `getAdvertiserReport`, `getMediaReport`) now map backend RATIO → UI CPS.

All write operations (`saveAdvertiserEntryBatch`, `saveMediaEntryBatch`) now map UI CPS → backend RATIO.

### 3. UI Dropdowns

**`frontend/src/pages/Media.tsx`**
- Type dropdown shows: CPM, CPS (not RATIO), CPA
- For CPA, label field shows "rate" (not unitPrice or revenueShare)

**`frontend/src/pages/DataEntry.tsx`**
- `isAllowedEntryType()` accepts CPM, RATIO, and CPA

**`frontend/src/pages/Reports.tsx`**
- Both advertiser and media filter dropdowns show CPM, CPS, CPA (replacing CPM, RATIO)

---

## Data Flow

### Save Flow (Frontend → Backend)
1. User selects "CPS" in UI
2. `bffApi.saveAdvertiserEntryBatch()` calls `uiTypeToApiType('CPS')` → `'RATIO'`
3. Backend receives `type: "RATIO"` in payload
4. `mapTypeToBillingMethod('RATIO')` → `'RATIO'`
5. Workflow uses RATIO branch: `revenue = (amount1 + amount2) × ratio`

### Read Flow (Backend → Frontend)
1. Backend stores `billingMethod = "RATIO"` in DB
2. API returns `type: "RATIO"`
3. `listAdvertiserEntries()` calls `apiTypeToUiType('RATIO')` → `'CPS'`
4. UI displays "CPS" to user

---

## Verification

| Check | Result |
|-------|--------|
| Backend `tsc` | Pass |
| Frontend `vite build` | Pass (1691 modules) |
| CPM calculation | Unchanged |
| RATIO calculation | Unchanged |
| CPA calculation | New: `rate × settlement` |

---

## Files Modified

**Backend:**
- `src/types/index.ts`
- `src/mappers/bff/dataEntry.mapper.ts`
- `src/mappers/bff/media.mapper.ts`
- `src/controllers/bff/media.controller.ts`
- `src/controllers/bff/advertiserDataEntry.controller.ts`
- `src/controllers/bff/mediaDataEntry.controller.ts`
- `src/utils/calculations.ts`
- `src/workflows/dailyInputBatch.workflow.ts`

**Frontend:**
- `frontend/src/lib/bffTypes.ts`
- `frontend/src/lib/bffApi.ts`
- `frontend/src/pages/Media.tsx`
- `frontend/src/pages/DataEntry.tsx`
- `frontend/src/pages/Reports.tsx`