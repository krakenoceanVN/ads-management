# Full Dynamic AdType Architecture Plan

## Current State

### Working
- ✅ **DailyInput** - Works with dynamic AdTypes via API query `adType: { code: adTypeCode }`
- ✅ **Menu/Layout** - Dynamic tabs built from API data
- ✅ **Catch-all routes** - `/input/:adType`, `/dashboard/:adType`, `/upstream/:adType`

### Not Working / Hardcoded
- ❌ **AD_TYPE_ID_MAP** (`src/utils/constants.ts`) - Only 4 hardcoded AdTypes
- ❌ **UPSTREAM_COLUMNS / DOWNSTREAM_COLUMNS** (`DashboardPage.tsx`, `UpstreamDashboardPage.tsx`) - Only 4 AdTypes
- ❌ **Frontend AdTypeCode type** (`ads-management/src/types/index.ts`) - Union type limited to 4 values
- ❌ **Dashboard API** - Uses `AD_TYPE_ID_MAP` which returns undefined for new AdTypes

---

## Problem Analysis

### Issue 1: AD_TYPE_ID_MAP is Hardcoded
```typescript
// src/utils/constants.ts
export const AD_TYPE_ID_MAP: Record<AdTypeCode, number> = {
  SM: 1,
  "360": 2,
  BAIDU_JS: 3,
  OTHER: 4,
}
```
**Problem:** Dashboard APIs use `AD_TYPE_ID_MAP[adTypeCode]` to query by `adTypeId`. For new AdTypes, this returns `undefined`.

**Solution:** Query AdType ID from database at runtime instead of using a static map.

### Issue 2: Column Definitions are Hardcoded
```typescript
// DashboardPage.tsx
const DOWNSTREAM_COLUMNS: Record<string, { key: string; label: string }[]> = {
  SM: [], '360': [], BAIDU_JS: [], OTHER: [],
}
```
**Problem:** Column definitions (ML, LE labels) are hardcoded per AdType.

**Solution:** Store column configuration in database (AdType table or separate config table) or derive from downstream data.

### Issue 3: Frontend AdTypeCode Type is Limited
```typescript
// ads-management/src/types/index.ts
export type AdTypeCode = 'SM' | '360' | 'BAIDU_JS' | 'OTHER'
```
**Problem:** TypeScript won't accept new AdType codes at compile time.

**Solution:** Change to `string` type and use runtime validation.

---

## Solution 1: Database-Driven AdType ID Lookup

### Backend Changes

#### File: `src/routes/dashboard.ts`

**Current (line 226-227):**
```typescript
const adTypeCode = req.query.ad_type as AdTypeCode
const adTypeId = AD_TYPE_ID_MAP[adTypeCode]
```

**Should be:**
```typescript
const adTypeCode = req.query.ad_type as string

// Look up AdType from database
const adType = await prisma.adType.findUnique({
  where: { code: adTypeCode },
  select: { id: true }
})
if (!adType) {
  return res.status(400).json({ success: false, error: "Invalid ad_type" })
}
const adTypeId = adType.id
```

Apply same change to line 447.

#### File: `src/routes/leDashboard.ts`

Check lines 77-78, 120-121 - hardcoded `adTypeId: 1` for SM:
```typescript
adTypeId: 1, // SM - should query from database
```

---

## Solution 2: Dynamic Column Configuration

### Option A: Store in AdType Table (Simple)
Add columns config to existing AdType table:
```prisma
model AdType {
  id        Int       @id
  code      String    @unique
  name      String
  // Add new fields:
  upstreamColumns  String? // JSON array, e.g. '["ml_80","le"]'
  downstreamColumns String? // JSON array, e.g. '[{"key":"ml_80","label":"ML"},{"key":"le","label":"LE"}]'
  // OR use a separate JSON column:
  config    Json?     // Flexible config object
}
```

### Option B: Query from Downstream Data (No Schema Change)
Columns are derived from what downstreams exist for the AdType:
```typescript
const downstreams = await prisma.downstream.findMany({
  where: { adTypeId },
  select: { downstreamType: true, payoutRate: true }
})
// Build columns from downstream types: ML, LE, YIYI, etc.
```

### Option C: Keep Hardcoded but Add to Constants (Quick Fix)
Add new AdTypes to constants when created via Admin UI (requires code change).

---

## Solution 3: Frontend Type Flexibility

### Change AdTypeCode to string:
```typescript
// ads-management/src/types/index.ts
export type AdTypeCode = string  // Accept any string at runtime
```

### Update Record types:
```typescript
// DashboardPage.tsx - use string index
const DOWNSTREAM_COLUMNS: Record<string, { key: string; label: string }[]> = {
  SM: [{ key: 'ml_80', label: 'ML' }, { key: 'le', label: 'LE' }],
  '360': [...],
  // New AdTypes can be added at runtime
}
```

---

## Solution 4: API Endpoint for AdType Config

Create new endpoint:
```
GET /api/admin/ad-types/config
Returns: { [code: string]: { upstreamColumns: string[], downstreamColumns: {...}[] } }
```

Frontend fetches this on app load or when AdType data changes, builds column configs dynamically.

---

## Implementation Phases

### Phase 1: Backend Dynamic Lookup (Critical)
- [ ] Modify `dashboard.ts` to query AdType ID from DB instead of AD_TYPE_ID_MAP
- [ ] Modify `leDashboard.ts` similarly
- [ ] Test with existing AdTypes

### Phase 2: Frontend Type Flexibility
- [ ] Change `AdTypeCode` from union to `string`
- [ ] Update all `as AdTypeCode` casts
- [ ] Ensure `?? []` fallbacks work for unknown AdTypes

### Phase 3: Dynamic Column Config
- [ ] Add optional JSON column to AdType table (or use downstream query)
- [ ] Create `/api/admin/ad-types/config` endpoint
- [ ] Frontend fetches config and builds columns dynamically

### Phase 4: Integration Testing
- [ ] Create new AdType via Admin UI
- [ ] Verify it appears in menu
- [ ] Verify DailyInput works
- [ ] Verify Dashboard works
- [ ] Verify Upstream works

---

## Files to Modify

### Backend (src/)
| File | Changes |
|------|---------|
| `routes/dashboard.ts` | Replace AD_TYPE_ID_MAP with DB lookup |
| `routes/leDashboard.ts` | Replace hardcoded adTypeId: 1 |
| `routes/admin.ts` | Potentially add `/config` endpoint |
| `utils/constants.ts` | Can be deprecated after Phase 1 |
| `prisma/schema.prisma` | Optional: add config JSON column |

### Frontend (ads-management/src/)
| File | Changes |
|------|---------|
| `types/index.ts` | Change `AdTypeCode` to `string` |
| `pages/DashboardPage.tsx` | Update DOWNSTREAM_COLUMNS to string index, add dynamic config |
| `pages/UpstreamDashboardPage.tsx` | Update UPSTREAM_COLUMNS/DOWNSTREAM_COLUMNS similarly |
| `components/layout/AppLayout.tsx` | Already fetches from API - may need minor tweaks |
| `components/daily-input/GenericInputTable.tsx` | Already works - minimal changes |

---

## Testing Checklist

After implementation:
1. [ ] Refresh page with existing AdType (SM) - should work
2. [ ] Navigate to new AdType via menu - should work
3. [ ] Create new AdType "TEST" via Admin UI
4. [ ] Add Upstream for TEST
5. [ ] Add AdSite for TEST upstream
6. [ ] Navigate to /input/test - should show AdSite data
7. [ ] Navigate to /dashboard/test - should show dashboard
8. [ ] Navigate to /upstream/test - should show upstream summary

---

## Risk Assessment

| Phase | Risk | Mitigation |
|-------|------|------------|
| Phase 1 | Dashboard breaks for existing AdTypes | Test thoroughly before deploy |
| Phase 2 | TypeScript errors in many files | Use gradual migration (string type first) |
| Phase 3 | Schema change may need migration | Use optional field, no migration needed |

---

## Time Estimate

- Phase 1: 30 minutes
- Phase 2: 20 minutes  
- Phase 3: 45 minutes (if doing full dynamic config)
- Phase 4: 15 minutes

**Total: ~2 hours**

---

## Alternative: Accept Partial Solution

If full implementation is too complex, accept that:
- **DailyInput** works for all AdTypes ✅
- **Dashboard/Upstream** need manual config entry when new AdType is created

This is a valid tradeoff - DailyInput is the primary data entry point, Dashboard is read-only summary.