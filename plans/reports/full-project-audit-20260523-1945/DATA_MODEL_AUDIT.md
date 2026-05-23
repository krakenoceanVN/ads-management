# DATA MODEL AUDIT

## Schema Overview

**File**: `prisma/schema.prisma`

The schema defines 15 models covering: AdType, Upstream, AdOrder, AdSite, AdSiteRebateRate, AdSiteEvent, AdSiteDownstream, DailyInput, Downstream, DownstreamPeriod, DailyDownstreamRate, User, Role, Permission, RolePermission, YiyiDailyData, YiyiDailyPricing, LEDailyCost, OperationLog.

---

## User / RBAC Models

### User Model (lines 235-248)
```
id               Int @id
username         String @unique
passwordHash     String
role             String @default("EDITOR")  ← legacy string
permDataInput    Boolean @default(false)    ← legacy
permDataConfirm  Boolean @default(false)    ← legacy
permAdmin        Boolean @default(false)    ← legacy
status           String @default("active") ← soft-disable field
roleId           Int?                       ← FK to Role
roleRef         Role? @relation("UserRoleRef", fields: [roleId], references: [id])
```

**Issues**:
1. `roleId` is nullable — users created before RBAC migration may have no `roleId`. The system handles this via `resolveUserRole` which falls back to legacy `role` string field.
2. `role` field is a free-form string with no enum constraint — can be any value despite defaults being fixed ones.
3. No `lastLoginAt` update trigger in the schema — login updates it manually (handled in auth middleware).
4. No unique constraint on `(username, status)` — but `username` is unique so this is fine.

### Role Model (lines 253-263)
```
id          Int @id
code        String @unique
name        String
description String?
isSystem    Boolean @default(false)
users       User[] @relation("UserRoleRef")
permissions RolePermission[]
```

**Issues**:
1. No validation that `code` matches a specific set of values (SUPER_ADMIN, ADMIN, OPERATOR, VIEWER). A role with code 'HACKER' would be accepted.

### RolePermission Model (lines 282-289)
- Uses `@@id([roleId, permissionId])` composite key — correct.
- `onDelete: Cascade` on both relations — deleting a Role removes all its RolePermissions. Deleting a Permission removes all RolePermissions referencing it.

---

## AdOrder / AdSite Relationship

### AdSite Model (lines 89-115)
```
adOrderId  Int?    ← nullable
adOrder    AdOrder? @relation(fields: [adOrderId], references: [id])
```

**Critical Issue**: `adOrderId` is nullable. Business rule from context states "AdId/AdSite must link to real active AdOrder where required." But the schema allows null. If an AdSite doesn't need an AdOrder (e.g., it's a supply-side media placement not tied to a specific advertiser order), null is correct. If ALL AdSites must have an AdOrder, this should be non-nullable.

**Recommendation**: Determine if AdSite without AdOrder is a valid business case. If not, make non-nullable.

### AdOrder Model (lines 52-69)
- `status` field: `String @default("active")` — "active | inactive" comment
- No `advertiserId` field — AdOrder is linked to Advertiser through Upstream (indirect: AdOrder → Upstream → AdType → advertiser is not directly represented). Wait, let me re-check.

Looking at AdOrder: `upstreamId`, `adTypeId`. No direct Advertiser. The Advertiser appears to be represented by `Upstream.advertiserName` or similar. Let me check if there's an explicit Advertiser model...

Scanning schema: No `Advertiser` model found. The advertiser is likely embedded in `Upstream.name` or similar. This is a significant data model gap if the business needs advertiser-level reporting/filtering.

---

## DailyInput Model (lines 150-175)

```
id                  Int @id
recordDate          DateTime
adSiteId            Int
qty                 Int @default(0)
unitPriceSnapshot   Decimal?
amount1             Decimal @default(0)
amount2             Decimal @default(0)
ratioSnapshot       Decimal?
rebateAmount        Decimal @default(0)
rebateRateSnapshot  Decimal @default(0)
revenue             Decimal @default(0)
status              String @default("unconfirmed")
```

**Critical Design Issues**:
1. `revenue` is a free field — not computed from qty × unitPriceSnapshot. It can be set arbitrarily.
2. `amount1`, `amount2`, `ratioSnapshot` — these are for RATIO billing method. `revenue` should logically be `(amount1 + amount2) * ratioSnapshot` for RATIO, or `qty * unitPriceSnapshot / 1000` for CPM. But there's no enforcement.
3. `rebateAmount` and `rebateRateSnapshot` — rebate should be computed from `qty * rebateRate`. Not enforced.
4. `@@unique([recordDate, adSiteId])` — each adSite can only have ONE record per day. This prevents double-entry but doesn't prevent the value from being wrong.

**Indexes** (lines 170-174):
```
@@unique([recordDate, adSiteId])
@@index([recordDate])
@@index([adSiteId])
@@index([status])
@@index([status, recordDate, adSiteId])
```

The compound `[status, recordDate, adSiteId]` is good for confirmed-daily queries, but the dashboard monthly query also filters on `adSite.isArchived` and `upstream.adTypeId` which aren't in the compound index.

---

## Downstream Models

### Downstream Model (lines 180-195)
```
id              Int @id
adTypeId        Int
downstreamType  String  // ML | LE | YIYI
payoutRate      Decimal @default(0.8)
status          String @default("active")
```

**Issue**: `downstreamType` is a free string with no enum or constraint. Typo in "YIYI" vs "YI_YI" would silently create a separate downstream.

### DownstreamPeriod Model (lines 200-214)
```
unitPrice     Decimal?
startDate     DateTime
endDate       DateTime?  // NULL = currently active
```

**Issue**: When `endDate` is NULL, the period is currently active. When `endDate` is set, the period ends at the end of that day (inclusive) per the `>=` comparison in `getActivePeriodForDate`.

### DailyDownstreamRate Model (lines 219-230)
```
@@unique([downstreamId, date])
```

Correct unique constraint — one rate per downstream per day.

---

## Cascade Delete Risks

| Model | Child Relations | Delete Behavior |
|-------|----------------|-----------------|
| AdType | Upstream, Downstream | `relation` (no explicit onDelete) |
| Upstream | AdSite, AdOrder | `relation` (no explicit onDelete) |
| AdOrder | AdSite | `relation` (no explicit onDelete) |
| AdSite | DailyInput, AdSiteDownstream, AdSiteEvent | `relation` (no explicit onDelete) |
| Downstream | DownstreamPeriod, DailyDownstreamRate | `relation` (no explicit onDelete) |
| Role | User (via `roleRef`) | `relation` (no explicit onDelete) |
| Role | RolePermission | `onDelete: Cascade` ✅ |
| Permission | RolePermission | `onDelete: Cascade` ✅ |

**RISK**: Deleting an Upstream does NOT cascade to AdOrders or AdSites. This could leave orphaned AdOrders and AdSites. The same applies for AdType → Upstream.

**Recommendation**: Add `onDelete: Cascade` to Upstream→AdOrder, Upstream→AdSite, AdType→Upstream relations to prevent orphaned records on deletion.

---

## Status Field Consistency

| Model | Status Values | Notes |
|-------|--------------|-------|
| User.status | active \| inactive | Used for soft-disable |
| Upstream.status | active \| inactive | |
| AdOrder.status | active \| inactive | |
| AdSite.status | active \| inactive | |
| AdSite.isArchived | Boolean | Separate from status |
| DailyInput.status | unconfirmed \| confirmed | Used for data entry workflow |
| Downstream.status | active \| inactive | |

The status enums are consistent in string form but not enforced at DB level (all are `String` type).

---

## Missing Indexes

1. `DailyInput` — `[status, recordDate, adSiteId]` exists but query pattern `[status, recordDate, adSite.isArchived, upstream.adTypeId]` needs additional indexes or is not covered.
2. `DownstreamPeriod` — `[downstreamId, startDate]` exists, good.
3. `AdSite` — `[upstreamId, isActive, isArchived]` covers the join path used in dashboard queries.