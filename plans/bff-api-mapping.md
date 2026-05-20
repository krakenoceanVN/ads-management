# BFF API Endpoints Mapping Table (REVISED v2)
# Backend-For-Frontend Adapter Layer Design

**Strategy**: Keep old backend untouched, build BFF layer to translate between new frontend domain and old backend domain.

**Revision notes**: Corrected based on 10 critical issues identified by user.

---

## Domain Mapping Summary

| Frontend Entity | Maps To Old Model | Notes |
|-----------------|-------------------|-------|
| Advertiser | Upstream | 1:1 mapping (demand side = traffic buyer) |
| AdOrder | **VIRTUAL/READ-ONLY** | No direct table; GET-only derived list from AdId grouping |
| AdId | AdSite | ID-based lookup preferred; slot string fallback with ambiguity check |
| Media | AdSite | Supply side |
| MediaOrder | **VIRTUAL/READ-ONLY** | No direct table |
| MediaId | AdSite + Downstream | ID-based lookup; shareRatio from Downstream.payoutRate |
| DataEntryRow (Advertiser) | DailyInput | Via AdSite lookup by ID |
| DataEntryRow (Media) | DailyInput | Via AdSite lookup by ID |
| EntryType ('CPM'/'CPA'/'CPS') | billingMethod ('CPM'/'RATIO') | **Explicit mapping required** - see below |

### Frontend Type → Backend billingMethod Mapping

| Frontend EntryType | Backend billingMethod | Notes |
|---|---|---|
| CPM | CPM | Direct map |
| CPA | **VALIDATION ERROR** | CPA not supported in old backend - return 400 with message |
| CPS | **VALIDATION ERROR** | CPS not supported in old backend - return 400 with message |

**Rationale**: Old backend only supports `CPM` and `RATIO`. CPA/CPS require validation error if frontend sends these types.

---

## BFF API Endpoints Mapping Table

### Module 1: Advertiser CRUD

| Frontend Need | BFF Endpoint | BFF Controller | Maps To Old Model | Existing Service / Existing Workflow | Request Mapping | Response Mapping | Risk / Notes |
|---|---|---|---|---|---|---|---|
| List advertisers | `GET /api/bff/advertisers` | `advertiser.controller.ts` | `Upstream` | Prisma query | — | `Upstream[]` → `Advertiser[]` (id, name, contact: null, phone: null, email: null, notes: null, status) | contact/phone/email/notes not in Upstream schema → return null |
| Create advertiser | `POST /api/bff/advertisers` | `advertiser.controller.ts` | `Upstream` | Prisma `upstream.create()` | `{ name, adTypeCode: required, status? }` | Created Upstream → Advertiser shape | **adTypeCode REQUIRED** - no default. If missing, return 400 validation error |
| Update advertiser | `PUT /api/bff/advertisers/:id` | `advertiser.controller.ts` | `Upstream` | Prisma `upstream.update()` | `{ name?, adTypeCode?, status? }` | Updated Upstream → Advertiser shape | Same field limitation |
| Delete advertiser (soft) | `DELETE /api/bff/advertisers/:id` | `advertiser.controller.ts` | `Upstream` | Prisma `upstream.update()` (status='inactive') | — | Success message | Soft delete only. Check for existing DailyInput before allowing |

---

### Module 2: Media CRUD

| Frontend Need | BFF Endpoint | BFF Controller | Maps To Old Model | Existing Service / Existing Workflow | Request Mapping | Response Mapping | Risk / Notes |
|---|---|---|---|---|---|---|---|
| List media | `GET /api/bff/media` | `media.controller.ts` | `AdSite` | Prisma query | — | `AdSite[]` → `Media[]` (id, name, contact: null, phone: null, email: null, notes: null, status) | contact/phone/email/notes not in AdSite schema → return null |
| Create media | `POST /api/bff/media` | `media.controller.ts` | `AdSite` | Prisma `adSite.create()` | `{ name, upstreamId: required, billingMethod: required, status? }` | Created AdSite → Media shape | **upstreamId REQUIRED** - no default. **billingMethod REQUIRED** - no default. If missing, return 400 validation error |
| Update media | `PUT /api/bff/media/:id` | `media.controller.ts` | `AdSite` | Prisma `adSite.update()` | `{ name?, upstreamId?, billingMethod?, status? }` | Updated AdSite → Media shape | Same validation requirements |
| Delete media (soft) | `DELETE /api/bff/media/:id` | `media.controller.ts` | `AdSite` | Prisma `adSite.update()` (isArchived=true) | — | Success message | Check for existing DailyInput before allowing |

---

### Module 3: AdOrder Handling (VIRTUAL/READ-ONLY)

| Frontend Need | BFF Endpoint | BFF Controller | Maps To Old Model | Existing Service / Existing Workflow | Request Mapping | Response Mapping | Risk / Notes |
|---|---|---|---|---|---|---|---|
| List ad orders | `GET /api/bff/ad-orders` | `adOrder.controller.ts` | Virtual (derived from AdId grouping) | Query AdIds group by orderId | `?advId=` filter | AdOrder[] derived from AdId table | Backend has no AdOrder table → derive from existing AdId data |
| Create ad order | `POST /api/bff/ad-orders` | `adOrder.controller.ts` | **NOT IMPLEMENTED** | — | — | **501 Not Implemented** | Old backend has no AdOrder table. Return 501 with message |
| Update ad order | `PUT /api/bff/ad-orders/:id` | `adOrder.controller.ts` | **NOT IMPLEMENTED** | — | — | **501 Not Implemented** | Same |
| Delete ad order | `DELETE /api/bff/ad-orders/:id` | `adOrder.controller.ts` | **NOT IMPLEMENTED** | — | — | **501 Not Implemented** | Same |

---

### Module 4: AdId Handling

| Frontend Need | BFF Endpoint | BFF Controller | Maps To Old Model | Existing Service / Existing Workflow | Request Mapping | Response Mapping | Risk / Notes |
|---|---|---|---|---|---|---|---|
| List adIds | `GET /api/bff/ad-ids` | `adId.controller.ts` | `AdSite` | Prisma query | `?advId=&orderId=&type=` | AdId[] from AdSite matching | Lookup by adSite.id (preferred) or by name if slot provided |
| Get adId | `GET /api/bff/ad-ids/:id` | `adId.controller.ts` | `AdSite` | Prisma `adSite.findUnique()` | — | Single AdSite → AdId shape | ID-based lookup - no ambiguity |
| Create adId | `POST /api/bff/ad-ids` | `adId.controller.ts` | `AdSite` | Prisma `adSite.create()` | `{ slot: required, type: required, rate: required, advId, orderId, notes? }` | Created AdSite → AdId shape | **slot and type REQUIRED**. type must be 'CPM' (RATIO → validation error). rate maps to currentUnitPrice |
| Update adId | `PUT /api/bff/ad-ids/:id` | `adId.controller.ts` | `AdSite` | Prisma `adSite.update()` | `{ slot?, type?, rate?, notes? }` | Updated AdSite → AdId shape | type='CPM' only - CPA/CPS return 400 |

---

### Module 5: MediaId Handling

| Frontend Need | BFF Endpoint | BFF Controller | Maps To Old Model | Existing Service / Existing Workflow | Request Mapping | Response Mapping | Risk / Notes |
|---|---|---|---|---|---|---|---|
| List mediaIds | `GET /api/bff/media-ids` | `mediaId.controller.ts` | `AdSite` + `Downstream` | Prisma query with join | `?mediaId=&orderId=&type=` | MediaId[] from AdSite + shareRatio from Downstream | Lookup by adSite.id. shareRatio from Downstream.payoutRate via AdSiteDownstream |
| Get mediaId | `GET /api/bff/media-ids/:id` | `mediaId.controller.ts` | `AdSite` + `Downstream` | Prisma query with join | — | AdSite + Downstream → MediaId shape | ID-based lookup |
| Create mediaId | `POST /api/bff/media-ids` | `mediaId.controller.ts` | `AdSite` (+ Downstream link) | Prisma `adSite.create()` + `adSiteDownstream.create()` | `{ slot: required, type: required, rate: required, shareRatio: required, mediaId, orderId, notes? }` | Created AdSite + linked Downstream | **slot, type, rate, shareRatio REQUIRED**. shareRatio stored in Downstream.payoutRate via adSiteDownstream. type='CPM' only |
| Update mediaId | `PUT /api/bff/media-ids/:id` | `mediaId.controller.ts` | `AdSite` + `Downstream` | Prisma `adSite.update()` + downstream link update | `{ slot?, type?, rate?, shareRatio?, notes? }` | Updated AdSite + Downstream | shareRatio → Downstream.payoutRate update |

---

### Module 6: DataEntryRow Create/Update/List

| Frontend Need | BFF Endpoint | BFF Controller | Maps To Old Model | Existing Service / Existing Workflow | Request Mapping | Response Mapping | Risk / Notes |
|---|---|---|---|---|---|---|---|
| List advertiser entry rows | `GET /api/bff/data-entry/advertisers` | `dataEntry.controller.ts` | `DailyInput` via `AdSite` | `GET /api/daily-input` (existing workflow) | `?date=&adSiteId=&status=` | `DailyInput[]` → `AdvertiserEntryRow[]` | **Use adSiteId for lookup** - not string-based filter. adSiteId must come from lookup by advertiser name |
| Create/update advertiser entry | `POST /api/bff/data-entry/advertisers/batch` | `dataEntry.controller.ts` | `DailyInput` | `POST /api/daily-input/batch` (existing workflow) | `{ date: required, adTypeCode: required, rows: [{ adSiteId: required, rate, traffic, settlement }] }` | `{ saved, errors }` | **adSiteId REQUIRED** - no name-based lookup in batch. Frontend must resolve advertiser/adId to adSiteId first. rate → unitPriceSnapshot for CPM only |
| Confirm advertiser entry | `POST /api/bff/data-entry/advertisers/confirm-batch` | `dataEntry.controller.ts` | `DailyInput` | `POST /api/daily-input/confirm-batch` (existing workflow) | `{ ids: number[] }` | `{ updated: count }` | ids = DailyInput.id |
| List media entry rows | `GET /api/bff/data-entry/media` | `dataEntry.controller.ts` | `DailyInput` via `AdSite` | `GET /api/daily-input` (existing workflow) | `?date=&adSiteId=&status=` | `DailyInput[]` → `MediaEntryRow[]` | Same - use adSiteId lookup |
| Create/update media entry | `POST /api/bff/data-entry/media/batch` | `dataEntry.controller.ts` | `DailyInput` | `POST /api/daily-input/batch` (existing workflow) | `{ date: required, adTypeCode: required, rows: [{ adSiteId: required, rate, traffic, settlement, dataCoefficient, shareRatio }] }` | `{ saved, errors }` | **adSiteId REQUIRED**. dataCoefficient → stored as note or separate field (NOT rebateRate). shareRatio → used for actualReceived calculation after fetch |
| Confirm media entry | `POST /api/bff/data-entry/media/confirm-batch` | `dataEntry.controller.ts` | `DailyInput` | `POST /api/daily-input/confirm-batch` (existing workflow) | `{ ids: number[] }` | `{ updated: count }` | ids = DailyInput.id |

---

### Module 7: Confirm / Unconfirm Flow

| Frontend Need | BFF Endpoint | BFF Controller | Maps To Old Model | Existing Service / Existing Workflow | Request Mapping | Response Mapping | Risk / Notes |
|---|---|---|---|---|---|---|---|
| Confirm rows | `POST /api/bff/data-entry/confirm-batch` | `dataEntry.controller.ts` | `DailyInput` | `POST /api/daily-input/confirm-batch` (existing workflow) | `{ ids: number[], type: 'advertiser'|'media' }` | `{ updated: count }` | type determines which DailyInput records to confirm. IDs must be valid DailyInput.id |
| Unconfirm row | `PUT /api/bff/data-entry/:id/unconfirm` | `dataEntry.controller.ts` | `DailyInput` | `PUT /api/daily-input/:id/unconfirm` (existing workflow) | `{ id: required }` | `{ success, data }` | Admin-only permission |
| Reopen confirmed row | `POST /api/bff/data-entry/:id/reopen` | `dataEntry.controller.ts` | `DailyInput` | `PUT /api/daily-input/:id/unconfirm` | `{ id: required }` | `{ success, message }` | Maps to unconfirm |

---

### Module 8: Reports / Calculated Data Endpoints

| Frontend Need | BFF Endpoint | BFF Controller | Maps To Old Model | Existing Service / Existing Workflow | Request Mapping | Response Mapping | Risk / Notes |
|---|---|---|---|---|---|---|---|
| Advertiser query (adv query) | `GET /api/bff/reports/advertisers` | `report.controller.ts` | `DailyInput` aggregate | Aggregate `DailyInput` by recordDate + adSiteId | `?date=&adSiteId=&status=` | AdvQueryRow[] with **DailyInput.revenue as source of truth** | **receivable = DailyInput.revenue** (already calculated with SM rebate). Frontend display calculation is for display only, not stored |
| Media query | `GET /api/bff/reports/media` | `report.controller.ts` | `DailyInput` + `Downstream` | Aggregate `DailyInput` + join Downstream for shareRatio | `?date=&adSiteId=&status=` | MediaQueryRow[] with receivable + actualReceived | **receivable = DailyInput.revenue**. **actualReceived = DailyInput.revenue * shareRatio** (shareRatio from Downstream.payoutRate). BFF calculates, not modifies stored data |
| Total profit report | `GET /api/bff/reports/total-profit` | `report.controller.ts` | `DailyInput` aggregate by adType | Aggregate `DailyInput.revenue` by adType.code | `?month=&date=` | TotalProfitRow[] | **revenue = sum(DailyInput.revenue)** - source of truth |
| Order profit report | `GET /api/bff/reports/order-profit` | `report.controller.ts` | `DailyInput` + `DownstreamPeriod` | Aggregate upstream/downstream breakdown | `?month=&date=` | OrderProfitRow[] | **profit = sum(DailyInput.revenue)**. Cost from DownstreamPeriod payout calculation |

---

### Module 9: Settlement Endpoints

| Frontend Need | BFF Endpoint | BFF Controller | Maps To Old Model | Existing Service / Existing Workflow | Request Mapping | Response Mapping | Risk / Notes |
|---|---|---|---|---|---|---|---|
| Advertiser settlement list | `GET /api/bff/settlement/advertisers` | `settlement.controller.ts` | `DailyInput` aggregate | Aggregate `DailyInput.revenue` by Upstream per month | `?startDate=&endDate=&upstreamId=` | SettlementRow[] (period, advertiser, amount, status) | **amount = sum(DailyInput.revenue)** where upstreamId matches |
| Media settlement list | `GET /api/bff/settlement/media` | `settlement.controller.ts` | `DailyInput` + `Downstream` aggregate | Aggregate `DailyInput.revenue * shareRatio` by AdSite/Downstream per month | `?startDate=&endDate=&adSiteId=` | SettlementRow[] (period, media, amount, status) | **amount = sum(DailyInput.revenue * shareRatio)** |

---

## Key Corrections Applied

### ✅ Correction 1: No hardcoded adTypeId = 1
- Create advertiser requires `adTypeCode` in request
- If missing → 400 validation error

### ✅ Correction 2: No hardcoded defaultUpstreamId
- Create media requires `upstreamId` in request
- If missing → 400 validation error

### ✅ Correction 3: No hardcoded billingMethod = 'CPM'
- Create media requires `billingMethod` in request
- If missing → 400 validation error

### ✅ Correction 4: AdOrder = VIRTUAL/READ-ONLY
- GET /api/bff/ad-orders → 200 (derived list)
- POST/PUT/DELETE /api/bff/ad-orders → 501 Not Implemented

### ✅ Correction 5: No LIKE '%slot%' default lookup
- AdId/MediaId lookup uses **ID-based lookup** (preferred)
- If slot-based lookup returns multiple matches → **400 Ambiguity Error**
- Never auto-pick first result

### ✅ Correction 6: dataCoefficient ≠ rebateRate
- dataCoefficient is media-side adjustment coefficient
- rebateRate is legacy SM rebate deduction rate
- These are **different concepts** - do NOT map dataCoefficient to rebateRate

### ✅ Correction 7: shareRatio ≠ rebateRate
- shareRatio from Downstream.payoutRate (media payout)
- rebateRate from AdSiteRebateRate (SM rebate deduction)
- These are **different concepts** - do NOT map shareRatio to rebateRate

### ✅ Correction 8: CPS ≠ RATIO by default
- CPM → CPM (direct map)
- CPA → **400 Validation Error** (not supported)
- CPS → **400 Validation Error** (not supported)

### ✅ Correction 9: Reports use DailyInput.revenue as source of truth
- receivable = DailyInput.revenue
- Do NOT recalculate from raw traffic/rate on read
- Frontend calculation functions are for display-only

### ✅ Correction 10: No encoding contact info into name
- contact/phone/email/notes → return null or ignore on write
- Document clearly in response that these fields are not persisted

---

## File Structure to Create

```
src/
├── controllers/
│   └── bff/
│       ├── advertiser.controller.ts
│       ├── media.controller.ts
│       ├── adOrder.controller.ts      # GET only, POST/PUT/DELETE → 501
│       ├── adId.controller.ts
│       ├── mediaId.controller.ts
│       ├── dataEntry.controller.ts
│       ├── report.controller.ts
│       └── settlement.controller.ts
├── routes/
│   └── bff/
│       ├── index.ts                   # merges all bff routes under /api/bff/*
│       ├── advertiser.routes.ts
│       ├── media.routes.ts
│       ├── adOrder.routes.ts
│       ├── adId.routes.ts
│       ├── mediaId.routes.ts
│       ├── dataEntry.routes.ts
│       ├── report.routes.ts
│       └── settlement.routes.ts
└── mappers/
    └── bff/
        ├── advertiser.mapper.ts
        ├── media.mapper.ts
        ├── adId.mapper.ts
        ├── mediaId.mapper.ts
        ├── dataEntry.mapper.ts
        └── report.mapper.ts
```

---

## Implementation Order (Recommended)

1. **Phase 1**: Advertiser CRUD (simplest mappings, clear validation)
2. **Phase 2**: Media CRUD (with upstreamId required validation)
3. **Phase 3**: AdId / MediaId handling (ID-based lookup, shareRatio from Downstream)
4. **Phase 4**: DataEntryRow create/update (using existing `/api/daily-input/batch`)
5. **Phase 5**: Confirm/unconfirm flow (using existing endpoints)
6. **Phase 6**: Reports (aggregate from DailyInput.revenue)
7. **Phase 7**: Settlement (aggregate from DailyInput.revenue)
8. **Phase 8**: AdOrder GET-only (derived from AdId grouping)

---

## STOP Condition

**Do NOT implement until user says "APPROVE BFF SCHEMA"**

This table is for review. All 10 corrections have been applied.

Key validation rules to remember:
- `adTypeCode` required for Advertiser create
- `upstreamId` required for Media create
- `billingMethod` required for Media create
- `adSiteId` required for DataEntry batch operations
- `type` must be 'CPM' for AdId/MediaId create/update (CPA/CPS = 400)
- AdOrder POST/PUT/DELETE = 501 Not Implemented
- Multiple matches on slot lookup = 400 Ambiguity Error
- dataCoefficient ≠ rebateRate (different concepts)
- shareRatio ≠ rebateRate (different concepts)
- Reports: receivable = DailyInput.revenue (not recalculated)