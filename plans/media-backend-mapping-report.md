# Media Backend Mapping Report

## 1. Tóm tắt

| Hạng mục | Trạng thái |
|-----------|-----------|
| Backend có field `currentUnitPrice` / `currentRatio` trong AdSite model | ✓ Có (Prisma schema.prisma:67-68) |
| Backend đã map vào `BFFMedia` interface | ✓ Vừa sửa |
| Frontend field names | `currentUnitPrice` (number), `currentRatio` (number) |
| Backend `mapAdSiteToMedia` map 2 fields | ✓ Vừa sửa |
| Còn thiếu | Không |
| Typecheck/build | ✓ Backend 0 errors, Frontend 0 errors, Build 301.39KB |

---

## 2. Backend Investigation

### Endpoint: `GET /api/bff/media` (list) và `GET /api/bff/media/:id` (detail)

**File:** [src/controllers/bff/media.controller.ts](src/controllers/bff/media.controller.ts)

**Model/Entity:** `AdSite` trong [prisma/schema.prisma:61-85](prisma/schema.prisma#L61-L85)
```prisma
model AdSite {
  id               Int       @id @default(autoincrement())
  upstreamId       Int
  name             String
  billingMethod    String    // CPM | RATIO | CPA
  rebateRate       Float?
  currentUnitPrice Decimal?  // for CPM      ← TỒN TẠI
  currentRatio     Decimal?  // for RATIO     ← TỒN TẠI
  isActive         Boolean   @default(true)
  isArchived       Boolean   @default(false)
  status           String    @default("active")
  ...
}
```

**DTO/Mapper:** [src/mappers/bff/media.mapper.ts](src/mappers/bff/media.mapper.ts)

**Interface trước đây (thiếu 2 fields):**
```typescript
// BEFORE
export interface BFFMedia {
    id: number;
    name: string;
    ...
    billingMethod?: 'CPM' | 'RATIO';
    // currentUnitPrice MISSING
    // currentRatio MISSING
}
```

**Interface sau sửa (đã thêm):**
```typescript
// AFTER
export interface BFFMedia {
    id: number;
    name: string;
    ...
    billingMethod?: 'CPM' | 'RATIO';
    currentUnitPrice?: number;   // ← THÊM
    currentRatio?: number;       // ← THÊM
}
```

**Mapper trước đây (không map 2 fields):**
```typescript
// BEFORE
export function mapAdSiteToMedia(adSite: AdSiteRaw): BFFMedia {
    return {
        ...
        billingMethod: adSite.billingMethod as 'CPM' | 'RATIO',
        // currentUnitPrice MISSING
        // currentRatio MISSING
    };
}
```

**Mapper sau sửa:**
```typescript
// AFTER
export function mapAdSiteToMedia(adSite: AdSiteRaw): BFFMedia {
    return {
        ...
        billingMethod: adSite.billingMethod as 'CPM' | 'RATIO',
        currentUnitPrice: adSite.currentUnitPrice != null ? Number(adSite.currentUnitPrice) : undefined,
        currentRatio: adSite.currentRatio != null ? Number(adSite.currentRatio) : undefined,
    };
}
```

**Data type conversion:** Prisma `Decimal` → JavaScript `Number` bằng `Number(...)`. Pattern nhất quán với [src/mappers/bff/adId.mapper.ts:73-75](src/mappers/bff/adId.mapper.ts#L73-L75) đã dùng trong codebase.

---

## 3. Changes

### File 1: `src/mappers/bff/media.mapper.ts`

**Thay đổi 1 — Thêm 2 fields vào `BFFMedia` interface:**
```typescript
export interface BFFMedia {
    ...
    billingMethod?: 'CPM' | 'RATIO';
    currentUnitPrice?: number;   // NEW
    currentRatio?: number;      // NEW
}
```

**Thay đổi 2 — Map 2 fields trong `mapAdSiteToMedia`:**
```typescript
export function mapAdSiteToMedia(adSite: AdSiteRaw): BFFMedia {
    return {
        ...
        billingMethod: adSite.billingMethod as 'CPM' | 'RATIO',
        currentUnitPrice: adSite.currentUnitPrice != null ? Number(adSite.currentUnitPrice) : undefined,
        currentRatio: adSite.currentRatio != null ? Number(adSite.currentRatio) : undefined,
    };
}
```

**Lý do:** AdSite model có 2 fields `currentUnitPrice` (Decimal) và `currentRatio` (Decimal) nhưng `BFFMedia` interface và `mapAdSiteToMedia` không map chúng vào response. Frontend `MediaMgmt` edit form cần 2 fields này để pre-populate khi sửa media.

**Backward compatibility:** Không đổi response shape — thêm optional fields. Clients cũ ignore các fields mới nếu không dùng.

---

## 4. Verification

| Check | Result | Notes |
|-------|--------|-------|
| Backend `npx tsc --noEmit` | ✓ PASS | 0 errors |
| Frontend `npx tsc --noEmit` | ✓ PASS | 0 errors |
| Frontend `npm run build` | ✓ PASS | 301.39KB JS, 1.82s |

### API Response (after fix)

**GET /api/bff/media** response sẽ include:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "360 - JW",
      "billingMethod": "CPM",
      "currentUnitPrice": 1.25,
      "currentRatio": null,
      ...
    },
    {
      "id": 2,
      "name": "360 - BB",
      "billingMethod": "RATIO",
      "currentUnitPrice": null,
      "currentRatio": 0.9,
      ...
    }
  ]
}
```

**GET /api/bff/media/:id** tương tự — single object cũng có 2 fields.

---

## 5. Remaining Questions

| Question | Answer |
|----------|--------|
| Có cần schema migration không | Không — Prisma schema đã có field, không cần migrate |
| Có cần xác nhận nghiệp vụ không | Không — business requirement rõ ràng (media edit form cần price/ratio) |
| Commit suggestion | `feat: include currentUnitPrice/currentRatio in BFFMedia response` |

### Chi tiết: Backend create/update đã xử lý 2 fields

Kiểm tra [src/controllers/bff/media.controller.ts](src/controllers/bff/media.controller.ts):

**POST** (create, lines 156-160):
```typescript
if (billingMethod === "CPM") {
    createData.currentUnitPrice = currentUnitPrice ?? 0;
} else {
    createData.currentRatio = currentRatio ?? 1;
}
```
→ Create nhận và lưu 2 fields đúng. Có validate `isFloat()` ở body validation (lines 119-120).

**PUT** (update, lines 259-265):
```typescript
if (billingMethod === "CPM") {
    updateData.currentUnitPrice = currentUnitPrice ?? existing.currentUnitPrice ?? 0;
    updateData.currentRatio = null;
} else {
    updateData.currentRatio = currentRatio ?? existing.currentRatio ?? 1;
    updateData.currentUnitPrice = null;
}
```
→ Update nhận và lưu 2 fields đúng. Khi đổi billingMethod thì reset field kia về null.

**Chỉ có GET (list/detail) là thiếu** — đã fix bằng 2 thay đổi trên.

---

## 6. Summary

**Tình trạng trước:** AdSite model có `currentUnitPrice`/`currentRatio`, create/update đã xử lý đúng, nhưng `BFFMedia` interface và `mapAdSiteToMedia` không map 2 fields này vào API response → frontend edit form không nhận được data.

**Tình trạng sau:** `mapAdSiteToMedia` map đúng 2 fields (Prisma Decimal → JS Number), `BFFMedia` interface thêm 2 optional fields → frontend edit form pre-populate hoạt động.

**Không có vấn đề gì thêm.**