# Verify Audit Contradictions Before Commit

**Date:** 2026-05-22
**Branch:** 110526
**Scope:** READ-ONLY verification of audit findings against source code

---

## Executive summary

| Severity | Count | Description |
|---|---|---|
| P0 | 1 | `adOrderId` is optional in both frontend form and backend validation — violates business rule "creating AdId must require choosing AdOrder" |
| P1 | 1 | Virtual AdOrder id uses `upstream.id` — potential collision with real AdOrder numeric id on frontend create-link flow |
| P2 | 0 | — |
| P3 | 3 | Confirm batch skips silently; payoutRate validation gap (admin only); ratio constraint only validated on backend |

**Safe to commit current changes?** NO — P0 must be addressed before commit.

---

## Q1 — AdId create requires AdOrder?

### Evidence

**Frontend form (`frontend/src/pages/Advertiser.tsx` lines 678–822):**
```typescript
// line 678
function defaultAdIdForm(): AdIdFormState {
  return { advertiserId: '', adOrderId: '', slot: '', ... };
}

// line 685
function adIdFormFromRecord(record: AdId): AdIdFormState {
  return {
    advertiserId: String(record.advertiserId),
    adOrderId: record.adOrderId ? String(record.adOrderId) : '',  // empty string = null
    ...
  };
}

// line 791–805 — submitForm
if (!form.advertiserId || !form.slot.trim()) { /* only checks advertiserId and slot */ }
const payload: CreateAdIdInput | UpdateAdIdInput = {
  advertiserId: Number(form.advertiserId),
  adOrderId: form.adOrderId ? Number(form.adOrderId) : null,  // null if empty
  slot: form.slot.trim(),
  ...
};
```

**Backend validation (`src/controllers/bff/adId.controller.ts` line 138):**
```typescript
body("adOrderId").optional().isInt(),  // ← OPTIONAL
```

**Backend Prisma create (`src/controllers/bff/adId.controller.ts` lines 167–169):**
```typescript
if (adOrderId) {
    data.adOrder = { connect: { id: adOrderId } };
}
// No else — adOrderId is silently skipped, AdSite created with adOrderId = null
```

**TypeScript type (`frontend/src/lib/bffTypes.ts` line 179–188):**
```typescript
export interface CreateAdIdInput {
  advertiserId: number;
  adOrderId?: number | null;  // ← OPTIONAL
  slot: string;
  type: 'CPM' | 'RATIO' | 'CPA';
  ...
}
```

### Finding

**CONFIRMED — This is a P0 contradiction.**

The business rule states: "Creating new AdId should require selecting AdOrder."

Reality:
- `adOrderId` is **optional** in frontend form (no validation)
- `adOrderId` is **optional** in backend `body("adOrderId").optional().isInt()` validation
- API silently creates `AdSite` with `adOrderId = null` when not provided
- Frontend `submitForm` only validates `advertiserId` and `slot` — does NOT validate `adOrderId` is set

A user can create an AdId without linking to any AdOrder by:
1. Opening create form
2. Selecting advertiser
3. Leaving AdOrder dropdown empty
4. Submitting → succeeds

### Severity: P0

Business rule violation. AdIds created without AdOrder will:
- Not appear in DataEntry AdOrder filter (filtered by `adOrderId`)
- Have `adOrderId = null` in DB
- Break the "AdId must link to AdOrder" data integrity

### Recommended fix

**Frontend:** Add validation in `submitForm`:
```typescript
if (!form.adOrderId) {
  setFormError(t('adOrderRequired'));
  return;
}
```

**Backend:** Change validation to required:
```typescript
body("adOrderId").notEmpty().isInt(),  // Required, not optional
```

---

## Q2 — Virtual AdOrder id convention

### Evidence

**Virtual AdOrder creation (`src/controllers/bff/adOrder.controller.ts` lines 82–99):**
```typescript
for (const u of upstreams) {
    const key = `${u.id}:${u.adType.code}`;
    if (!realKeys.has(key)) {
        const entry = {
            id: u.id,          // ← Virtual id = upstream.id
            advId: u.id,
            name: u.adType.name,
            adTypeCode: u.adType.code,
            notes: null,
            status: u.status,
            isVirtual: true,
        };
        result.push(entry);
    }
}
```

**AdId POST backend (`src/controllers/bff/adId.controller.ts` lines 167–169):**
```typescript
if (adOrderId) {
    data.adOrder = { connect: { id: adOrderId } };
}
```

**Frontend AdId form (`frontend/src/pages/Advertiser.tsx` lines 858–895):**
```tsx
// AdOrder dropdown for filter (line 858)
<select value={orderFilter} onChange={e => setOrderFilter(e.target.value)}>
  <option value="">{t('selectAdOrder')}</option>
  {orderOptions.map(o => <option key={o.id} value={o.id}>{displayName(o.name)}</option>)}
</select>

// AdOrder dropdown in create/edit form (line 894)
<select value={form.adOrderId} onChange={e => setForm(prev => ({ ...prev, adOrderId: e.target.value }))}>
```

**DataEntry filter (`frontend/src/pages/DataEntry.tsx` lines 197, 207, 210):**
```typescript
&& (!filters.second || (row.adOrderCode ?? row.adOrder) === filters.second)
const adOrderOptions = uniqueOptions(scopedRows.map(row => row.adOrderCode ?? row.adOrder).filter(Boolean));
const filteredByOrder = filters.second ? filteredByAdvertiser.filter(row => (row.adOrderCode ?? row.adOrder) === filters.second) : filteredByAdvertiser;
```

### Finding

**POTENTIAL COLLISION — Severity P1**

1. **Virtual AdOrder id convention:**
   - Virtual AdOrder: `id = upstream.id` (real numeric upstream id)
   - Real AdOrder: `id` = auto-increment primary key (starts from 1, unrelated to upstream.id)
   - `isVirtual: true` distinguishes them

2. **Collision scenario:**
   - Suppose upstream.id = 5 (real upstream id)
   - This upstream has NO real AdOrder for "SM"
   - Virtual AdOrder for SM gets `id = 5, isVirtual = true`
   - Now a real AdOrder with numeric PK = 5 exists in the DB (different record)
   - Frontend dropdown uses `o.id` as both value AND as reference
   - Frontend filter uses `o.id` as value to compare against `filters.second`

3. **DataEntry safe:** Uses `row.adOrderCode ?? row.adOrder` (string comparison), NOT id → safe
4. **Reports page:** After the fix, uses `orderCodeForAdvRow` (business code string) → safe
5. **AdId form create/edit:** When user selects an AdOrder from dropdown to link, the value sent is `adOrderId = Number(form.adOrderId)`. If user picks virtual entry (id=upstream.id), the backend receives numeric id. If that id happens to match a real AdOrder's PK, wrong AdOrder would be linked.

**Virtual exclusion in DataEntry:** No explicit filter for `isVirtual` in DataEntry. DataEntry loads rows from DailyInput (which have real adSite records), not from the adOrders list. The `adOrderCode` comes from `adSite.adOrder?.adType?.code` fallback. So DataEntry is safe.

### Severity: P1

Potential id collision if user intentionally selects a virtual entry from the AdOrder dropdown when creating an AdId. The `isVirtual` flag is returned in the API response but the frontend dropdown doesn't use it for filtering.

### Recommended fix

**Option A (UI):** Filter out virtual entries from the AdOrder dropdown in AdIdMgmt create/edit form:
```typescript
{orderOptions.filter(o => !o.isVirtual).map(o => <option key={o.id} value={o.id}>...
```

**Option B (Backend):** Change virtual AdOrder id convention to never collide:
```typescript
// Use negative or offset id
id: -u.id  // negative = virtual marker
```

---

## Q3 — adOrder field type/meaning

### Evidence

**Backend mapper (`src/mappers/bff/dataEntry.mapper.ts` lines 139–155):**
```typescript
return {
    id: record.id,
    date: formatBusinessDate(record.recordDate),
    advertiser: record.adSite.upstream.name,        // string display name
    advertiserId: record.adSite.upstream.id,       // numeric
    adOrder: record.adSite.adOrder?.name ?? '',    // ← STRING: real AdOrder.name (e.g. "SM")
    adOrderId: record.adSite.adOrder?.id ?? null,  // ← NUMERIC: real AdOrder PK
    adOrderCode: record.adSite.adOrder?.adType?.code ?? record.adSite.upstream.adType.code,
    // ← STRING: business code (e.g. "SM", "360")
    ...
};
```

**Frontend types (`frontend/src/lib/bffTypes.ts` lines 267–283):**
```typescript
export interface AdvertiserEntryRow {
  id: number;
  date: string;
  advertiser: string;
  advertiserId: number;
  adOrder: string;          // ← STRING display name
  adOrderId: number | null;  // ← NUMERIC id
  adOrderCode: string | null; // ← STRING business code: SM | 360 | BAIDU_JS | OTHER | iqiyi | yolo
  type: EntryType;
  adId: string;
  adIdNum: number;
  ...
}

export interface MediaEntryRow {
  ...
  mediaAdOrder: string;         // ← STRING display name
  mediaAdOrderId: number | null; // ← NUMERIC id
  mediaAdOrderCode: string | null; // ← STRING business code
  ...
}
```

**Reports page filter fix (already applied):**
```typescript
// Before fix: row.adOrder === filters.second (comparing string to string — BUT adOrder is string, filters.second is numeric id string from dropdown value)
// After fix:
const orderCodeForAdvRow = (row: AdvertiserEntryRow) => row.adOrderCode ?? row.adOrder;
&& (!filters.second || orderCodeForAdvRow(row) === filters.second)
```

### Finding

**Audit summary was slightly imprecise — actual state is correct.**

The audit summary said:
> "Reports filter used row.adOrder === selectedOrder (numeric id)"

The actual bug was: filter was comparing `row.adOrder` (string, e.g. "SM") against `filters.second` (which comes from the AdOrder dropdown value — the numeric `o.id` or business code depending on how dropdown is populated).

After the fix, `orderCodeForAdvRow = row.adOrderCode ?? row.adOrder` correctly uses business code string, and `filters.second` is also a business code string from the dropdown `option.value = o.adTypeCode`.

The field definitions are correct and consistent across mapper and frontend types.

### Severity: P2 (already fixed during this session)

The fix is correct. No residual issue.

---

## Q4 — Confirm batch behavior

### Evidence

**Advertiser DataEntry controller (`src/controllers/bff/advertiserDataEntry.controller.ts` lines 248–273):**
```typescript
const ids = [...new Set((req.body.ids as number[]).map(Number).filter(Number.isInteger))];
const result = await prisma.dailyInput.updateMany({
    where: { id: { in: ids }, status: "unconfirmed" },
    data: { status: "confirmed" },
});
createOperationLog({ ... detail: `Confirmed advertiser data entries: count=${result.count}` });
res.json({ success: true, updated: result.count });
```

**Media DataEntry controller (`src/controllers/bff/mediaDataEntry.controller.ts` lines 246–275):** Same pattern — `updateMany` with `status: "unconfirmed"` filter.

**DataEntry frontend (`frontend/src/pages/DataEntry.tsx` lines 297–315 and 565–583):**
```typescript
const confirmAllRows = async () => {
    const pendingRows = visibleRows.filter(row => row.status !== 'confirmed');
    await saveRows(pendingRows);
    // Only confirm rows that have real DailyInput ids (positive); skip generated rows
    const confirmableIds = pendingRows.filter(row => row.id > 0).map(row => row.id);
    if (confirmableIds.length > 0) {
        await confirmAdvertiserEntryBatch(confirmableIds);
    }
    await loadRows();
};
```

**Backend response:** `{ success: true, updated: result.count }` — returns count of records updated (not count of ids sent).

### Finding

**Confirms audit finding — acceptable UX behavior, not a business correctness issue.**

1. **Confirmed records silently skipped:** `updateMany({ id: { in: ids }, status: "unconfirmed" })` — if id is already `confirmed`, Prisma silently skips it. The returned `updated` count reflects only actually-changed rows. This is standard Prisma behavior and is documented.

2. **Generated rows (id < 0) filtered on frontend:** Line 305: `pendingRows.filter(row => row.id > 0)` — frontend explicitly filters out generated rows before calling confirm API. Generated rows have `id = -site.id` (negative), so even if sent to confirm API, the `where: { id: { in: ids } }` would have negative ids that don't exist in DB → silently zero records updated.

3. **Frontend shows correct count:** The `updated` count is returned and could be displayed.

4. **Business correctness:** Since confirmed records cannot be edited (the workflow protects them), re-confirming a confirmed record is a no-op. The silent skip is appropriate.

### Severity: P3 — Low risk

Acceptable behavior. No fix needed.

---

## Q5 — Downstream payoutRate validation

### Evidence

**BFF downstream controller (`src/controllers/bff/downstream.controller.ts`):** Read-only — GET only, no POST/PUT/DELETE for payoutRate.

**BFF mediaId controller (`src/controllers/bff/mediaId.controller.ts` line 289–291):**
```typescript
if (customPrice !== undefined) {
    (updateData as any).customPrice = customPrice == null ? Prisma.DbNull : customPrice;
}
// payoutRate on Downstream is NEVER updated here
```

**Admin routes (`src/routes/admin.ts` line 1477):**
```typescript
if (payout_rate !== undefined) updateData.payoutRate = payout_rate
```
Admin route has NO range validation on payout_rate.

**Media entry mapper (`src/mappers/bff/dataEntry.mapper.ts` lines 264–267):**
```typescript
const actualReceived =
    shareRatio !== null && receivable !== "" && receivable !== 0
        ? Number((Number(record.revenue) * shareRatio).toFixed(3))
        : null;
```

**shareRatio source (`src/controllers/bff/mediaDataEntry.controller.ts` lines 128–131):**
```typescript
const downstream = site.downstreams.find((ds) => ds.downstream.status === "active");
if (downstream) {
    shareRatio = Number(downstream.downstream.payoutRate);
}
```

**Financial report context:** `actualReceived` is display-only — not stored in any table.

### Finding

**PayoutRate is editable via admin routes only — frontend BFF API does not expose edit.**

1. **Frontend users (via BFF):** Cannot edit payoutRate. BFF `downstream.controller.ts` is GET-only. BFF `mediaId.controller.ts` PUT only updates `customPrice` (on `AdSiteDownstream` junction), not `payoutRate` on `Downstream`.

2. **Admin routes:** Have direct endpoint to update `Downstream.payoutRate` with no range validation. If admin sets `payoutRate = 1.5`, then `actualReceived = revenue * 1.5` would exceed `revenue` (receivable). If `payoutRate = -0.5`, `actualReceived` would be negative.

3. **Impact:** Only affects `actualReceived` display in Media DataEntry and Media Reports. Does not affect stored financial data (`revenue`, `ml_payout`, `cost`, `profit`). Display-only field.

### Severity: P3

Low risk for frontend users. Admin route bypass is a separate concern (admin users are trusted). Recommended fix for admin route:
```typescript
if (payout_rate !== undefined) {
    if (payout_rate < 0 || payout_rate > 1) {
        return res.status(400).json({ success: false, error: "payout_rate must be between 0 and 1" });
    }
    updateData.payoutRate = payout_rate;
}
```

---

## Final commit guidance

### Files safe to commit now

The 3 files modified in this session (already with fixes applied):
- `src/controllers/bff/report.controller.ts` — P0 fix: added adOrder include
- `frontend/src/pages/Reports.tsx` — P0 fix: adOrderCode filter
- `src/mappers/bff/dataEntry.mapper.ts` — type definitions (already correct, no change needed)
- `plans/full-project-business-logic-audit-20260522.md` — audit report

### Files not to commit (must fix first)

- `src/controllers/bff/adId.controller.ts` — P0: backend validation change `body("adOrderId").optional()` → `body("adOrderId").notEmpty()`
- `frontend/src/pages/Advertiser.tsx` — P0: frontend validation in `submitForm` — add `if (!form.adOrderId)` error check

### Must fix before commit? YES

P0 violation: AdId can be created without selecting AdOrder.

### Must fix before production? YES

Same P0 — data integrity issue would create orphan AdIds without AdOrder links, breaking DataEntry filtering and future settlement calculations.

### Summary of required changes

1. **Backend:** `adOrderId` validation → required
2. **Frontend:** Add `adOrderId` required check in AdId create/edit form submit
3. **Optional (P1):** Filter virtual AdOrders from AdId form AdOrder dropdown