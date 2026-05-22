# Advertiser/AdOrder/AdId Backend Decision Brief

Date: 2026-05-21
Status: **DECISION REQUIRED** — awaiting business/backend confirmation

---

## 1. Executive Summary

### Đã implement được
| # | Requirement | Implementation |
|---|-------------|----------------|
| 1.1 | Advertiser search mở rộng | Search array đã thêm `contact, phone, email, notes` trong `Advertiser.tsx:183-189` |
| 1.2 | AdOrder filter theo advertiser | Thêm `advFilter && row.advId !== Number(advFilter)` trong `AdOrderMgmt visibleRows` |
| 1.5 | AdId label | Đã dùng `t('adId')` = "ID quảng cáo" — label đúng từ đầu |
| 1.5 | AdId RATIO rate % display | `formatMgmtRate('RATIO', 0.12)` → `"12.0%"` trong `Advertiser.tsx:62-70` |

### Bị block bởi backend/data model
| # | Blocker | Root Cause |
|---|---------|-----------|
| 1.1 | Advertiser search phone/email/notes | `Upstream` model không có `contact/phone/email/notes` columns → data always `null` |
| 1.4 | AdOrder edit/delete | `AdOrder` là virtual (derived từ `AdType`), không có table riêng → POST/PUT/DELETE trả 501 |
| 1.6 | AdId edit/delete | `AdId/AdSite` BFF controller trả 501 với message "create Media instead" |

### Vì sao bị block
1. **Advertiser:** Prisma schema `Upstream` (prisma/schema.prisma:28) chỉ có `id, adTypeId, name, status, createdAt, updatedAt` — không có contact/phone/email/notes. Mapper (`advertiser.mapper.ts`) hardcode trả về `null` cho 4 fields này.

2. **AdOrder:** Backend `adOrder.controller.ts` thiết kế nguyên tắc "AdOrder is VIRTUAL/READ-ONLY - derived from AdType". `GET /api/bff/ad-orders` query trực tiếp `prisma.adType.findMany()` và map sang BFF. Không có Prisma model `AdOrder`. Tất cả POST/PUT/DELETE → 501.

3. **AdId:** Backend `adId.controller.ts` thiết kế nguyên tắc "AdId is READ-ONLY lookup over AdSite". Message tại các endpoint POST/PUT/DELETE: "Independent AdId creation is not supported. Create Media instead." AdSite được quản lý thông qua Media flow.

### Quyết định cần business/backend xác nhận
1. Advertiser — có cần thêm contact/phone/email/notes vào Upstream model không?
2. AdOrder — có nên trở thành persistent entity (có table riêng + CRUD) hay giữ virtual read-only?
3. AdId — có nên cho CRUD trực tiếp trên AdSite hay chỉ qua Media flow?

---

## 2. Advertiser Contact Fields Decision

### Current State

**Prisma Schema (`prisma/schema.prisma:28`):**
```prisma
model Upstream {
  id        Int       @id @default(autoincrement())
  adTypeId  Int
  name      String
  status    String    @default("active")
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  adType   AdType    @relation(fields: [adTypeId], references: [id])
  adSites  AdSite[]
  @@index([adTypeId])
  @@index([adTypeId, status])
}
```

**Frontend BFFAdvertiser (`bffTypes.ts:61-70`):**
```typescript
export interface Advertiser {
  id: number;
  name: string;
  contact: string | null;   // always null
  phone: string | null;     // always null
  email: string | null;     // always null
  notes: string | null;     // always null
  status: EntityStatus;
  adTypeCode?: string;
}
```

**Mapper (`advertiser.mapper.ts:43-54`):**
```typescript
export function mapUpstreamToAdvertiser(upstream: UpstreamRaw): BFFAdvertiser {
  return {
    id: upstream.id,
    name: upstream.name,
    contact: null,  // hardcoded null
    phone: null,    // hardcoded null
    email: null,    // hardcoded null
    notes: null,    // hardcoded null
    status: upstream.status as 'active' | 'inactive',
    adTypeCode: upstream.adType?.code,
  };
}
```

**Current frontend search (`Advertiser.tsx:183-189`):**
```typescript
return [
  row.name,
  row.adTypeCode,
  row.contact,      // null — never matches
  row.phone,       // null — never matches
  row.email,       // null — never matches
  row.notes,       // null — never matches
  row.status,
].some(value => normalizeText(value).includes(keyword));
```

**PDF requirement (v4 image 1.1):**
> "Tại trang Quản lý nhà quảng cáo, ô tìm kiếm hiện chưa thể tìm theo số điện thoại, email và ghi chú."

### Gap Analysis
| Field | Backend Support | Frontend Search | Data |
|-------|-----------------|-----------------|------|
| name | ✓ | ✓ | actual data |
| contact | ✗ | ✓ | always null |
| phone | ✗ | ✓ | always null |
| email | ✗ | ✓ | always null |
| notes | ✗ | ✓ | always null |

Frontend code đã sẵn sàng nhưng không có data để search.

### Option A: Thêm contact/phone/email/notes vào Upstream model

**Pros:**
- Giải quyết triệt để requirement v4 1.1
- Backend Advertiser CRUD đã đầy đủ — chỉ cần extend model
- Không ảnh hưởng DataEntry, Reports, Settlement vì Upstream chỉ dùng làm advertiser reference

**Cons:**
- Cần Prisma migration — phải carefully handle với production data
- Backend Advertiser mapper cần đọc `req.body.contact/phone/email/notes` từ request và tạo/cập nhật upstream record
- Frontend AdvertiserList form cần thêm input fields cho 4 giá trị mới (create + edit)

**Backend changes:**
1. `prisma/schema.prisma`: Thêm 4 columns vào `Upstream`:
   ```prisma
   contact  String?
   phone    String?
   email    String?
   notes    String?
   ```
2. `advertiser.controller.ts`: Đọc `contact, phone, email, notes` từ `req.body` trong POST/PUT
3. `advertiser.mapper.ts`: Map thực sự từ upstream data thay vì hardcoded null
4. `CreateAdvertiserRequest` / `UpdateAdvertiserRequest`: Thêm 4 optional fields

**Frontend changes:**
1. `Advertiser.tsx` — `AdvertiserFormState` thêm 4 fields; form thêm 4 input; API payload gửi đủ fields
2. `bffTypes.ts` — `CreateAdvertiserInput` / `UpdateAdvertiserInput` thêm optional fields

**Migration needed:**
- Yes — Prisma migration thêm 4 nullable columns vào `Upstream`
- Dữ liệu cũ: các record hiện tại sẽ có `null` cho 4 fields mới (acceptable vì nullable)
- Risk thấp — chỉ thêm columns, không sửa data existing

**Risk:** Low — columns nullable, không có data-dependent migration

**Recommendation:** **YES** — đây là extension đơn giản, low-risk, giải quyết đúng requirement. Không ảnh hưởng entities khác.

---

### Option B: Không thêm fields, ẩn/bỏ search fields không có data

**Pros:**
- Không cần backend changes
- Tránh confusion khi user search mà không ra kết quả vì data null

**Cons:**
- Vi phạm requirement v4 1.1 — "tìm theo phone/email/notes"
- User feedback tiêu cực — feature bị half-implemented
- Search fields đã thêm vào code nhưng không hoạt động — confusing cho developer sau

**Backend changes:** None

**Frontend changes:** Loại bỏ `contact, phone, email, notes` khỏi search array (revert về code cũ)

**Migration needed:** None

**Risk:** N/A — không làm gì

**Recommendation:** **NO** — Không nên ẩn requirement đã implement. Nếu không làm backend thì nên giữ code search nhưng đánh dấu rõ "search not available — backend pending".

---

### Option C: Lấy contact info từ nguồn khác (không có sẵn trong hệ thống)

**Pros:**
- Không cần thay đổi Upstream model

**Cons:**
- Không có nguồn dữ liệu contact/phone/email/notes ở đâu trong hệ thống hiện tại
- Không có related table chứa thông tin này

**Backend changes:** Phụ thuộc vào nguồn dữ liệu mới

**Frontend changes:** N/A

**Migration needed:** N/A

**Risk:** N/A

**Recommendation:** **NO** — Không có alternative data source. Upstream là logical place cho advertiser contact info.

---

### Decision Summary: Advertiser Contact Fields

| Option | Description | Backend | Migration | Risk | Recommendation |
|--------|-------------|---------|-----------|------|----------------|
| A | Add columns to Upstream | Advertiser controller + mapper | Prisma add 4 nullable columns | Low | **YES — Recommended** |
| B | Hide/disable search fields | None | None | N/A | No |
| C | Source from elsewhere | N/A | N/A | N/A | No |

**Recommended: Option A.** Simple schema extension, nullable columns, low migration risk. Solves the requirement correctly.

---

## 3. AdOrder CRUD Decision

### Current State

**Prisma:** Không có model `AdOrder`. Chỉ có `AdType` (loại quảng cáo như SM, 360, BAIDU_JS) và `AdSite` (ID quảng cáo).

**Backend controller (`adOrder.controller.ts`):**
```typescript
// GET — derives from AdType
const adTypes = await prisma.adType.findMany({ orderBy: { name: "asc" } });
const adOrders = mapAdTypesToAdOrders(adTypes, advId);

// POST → 501
res.status(501).json({ error: "AdOrder is virtual/read-only. POST not supported." });

// PUT → 501
res.status(501).json({ error: "AdOrder is virtual/read-only. PUT not supported." });

// DELETE → 501
res.status(501).json({ error: "AdOrder is virtual/read-only. DELETE not supported." });
```

**Frontend (`AdOrderMgmt`):** Read-only table, không có form create/edit/delete.

**PDF requirement (v4 image 1.4):**
> "Khi bấm nút chỉnh sửa thì chỉ mở chức năng tạo mới đơn quảng cáo, không chỉnh sửa được đơn quảng cáo hiện có. Trong chức năng chỉnh sửa còn thiếu nút xóa."

### Tại sao AdOrder đang virtual

Theo comment trong `adOrder.controller.ts`:
> "AdOrder is VIRTUAL/READ-ONLY - derived from AdType (category/formula metadata)"

Lý do thiết kế có thể:
- AdOrder (đơn quảng cáo) được hiểu là loại campaign/ad-type, không phải individual entity
- AdType định nghĩa billing formula (CPM/CPA/RATIO), không có data rows riêng
- DataEntry thực tế nhập theo Advertiser (Upstream) + AdId (AdSite), không theo AdOrder riêng

Tuy nhiên, PDF v4 1.2/1.4 yêu cầu AdOrder là entity riêng có thể edit/delete.

### Gap Analysis
| Operation | Backend Status | Frontend Status | v4 Requirement |
|-----------|----------------|-----------------|----------------|
| List | ✓ GET works | ✓ Read-only table | ✓ |
| Create | ✗ 501 | No form | ✗ Blocked |
| Edit | ✗ 501 | No form | ✗ Blocked |
| Delete | ✗ 501 | No form | ✗ Blocked |

### Option A: Giữ read-only virtual AdOrder (không làm gì thêm)

**Pros:**
- Không cần backend changes
- Duy trì kiến trúc hiện tại — đơn giản
- AdOrder đang là metadata/category, không phải data entity thật

**Cons:**
- Không đáp ứng được v4 1.2/1.4 requirement
- AdOrderMgmt không có create/edit/delete form
- Business expectation từ PDF không match implementation
- Nếu Advertiser muốn "sửa tên đơn quảng cáo" → không làm được

**Backend/schema changes:** None

**Frontend changes:** None — hoặc disable edit/delete buttons, show tooltip "not supported"

**Migration impact:** None

**DataEntry/Reports impact:** Không ảnh hưởng — DataEntry dùng AdSite (AdId) chứ không dùng AdOrder trực tiếp

**Risk:** Low — kiến trúc không đổi

**Recommendation:** **NO** — Không đáp ứng requirement. Business đã expect edit/delete functionality từ PDF.

---

### Option B: Tạo persistent AdOrder entity (bảng mới + CRUD)

**Pros:**
- Giải quyết triệt để v4 1.2/1.4
- AdOrder thực sự là entity riêng — có thể tạo, đặt tên, sửa, xóa riêng
- Có thể lưu notes riêng cho mỗi AdOrder
- Tách biệt AdOrder (entity riêng) khỏi AdType (chỉ là category/billing formula)

**Cons:**
- Schema migration — tạo bảng mới `AdOrder`
- Cần xác định relationship: AdOrder ↔ Advertiser (1:n), AdOrder ↔ AdType (n:1 hay 1:1), AdOrder ↔ AdId (1:n)
- Backend cần đồng bộ: khi tạo AdSite (AdId) mới, cần chọn AdOrder — nhưng hiện tại DataEntry chọn advertiser + adId, không chọn AdOrder
- Reports/DataEntry có thể cần thay đổi nếu dùng AdOrder làm filter
- Nếu AdOrder được xóa → AdId references xử lý thế nào?

**Backend/schema changes:**
1. Prisma: Tạo model `AdOrder`:
   ```prisma
   model AdOrder {
     id           Int       @id @default(autoincrement())
     upstreamId   Int       // advertiser FK
     adTypeId    Int       // AdType FK
     name        String
     notes       String?
     status      String    @default("active")
     createdAt   DateTime  @default(now())
     updatedAt   DateTime  @updatedAt
     upstream    Upstream  @relation(...)
     adType      AdType    @relation(...)
     adSites     AdSite[]
   }
   ```
2. BFF `adOrder.controller.ts`: Implement GET (filter by advertiserId), POST, PUT, DELETE — thay vì derive từ AdType
3. Frontend `AdOrderMgmt`: Thêm form create/edit/delete
4. DataEntry có thể cần chọn AdOrder khi tạo AdSite — phụ thuộc business logic

**Frontend changes:**
1. `AdOrderMgmt`: Thêm `openCreate`, `openEdit`, `removeRecord` functions
2. `bffApi.ts`: Thêm `createAdOrder`, `updateAdOrder`, `deleteAdOrder` calls
3. `bffTypes.ts`: Thêm `CreateAdOrderInput`, `UpdateAdOrderInput`

**Migration impact:**
- Tạo bảng mới `AdOrder` — migration đơn giản
- Dữ liệu cũ: cần migrate existing AdType-based records sang AdOrder table hoặc generate initial AdOrder records per advertiser/adType
- AdId/AdSite hiện tại cần có `adOrderId` reference — có thể cần backfill

**DataEntry/Reports impact:**
- DataEntry: Cần xác định user chọn AdOrder ở step nào — có thể cần UI change
- Reports: AdOrder filter đang dùng client-side cascade — không bị ảnh hưởng nếu API vẫn trả về adTypeCode/name

**Risk:**
- Medium-high — thay đổi kiến trúc data model, cần migration + data backfill
- Cần business quyết định: AdOrder ↔ AdType relationship là 1:1 (mỗi AdOrder chỉ thuộc 1 AdType) hay n:1?

**Recommendation:** **YES IF** — business cần AdOrder là entity thật, có thể rename/edit/delete riêng. Cần đồng thuận về data model trước khi implement.

---

### Option C: Map AdOrder CRUD vào AdType (dùng AdType làm AdOrder)

**Pros:**
- Không cần schema migration — dùng existing AdType table
- GET đã hoạt động — chỉ cần implement POST/PUT/DELETE trên AdType
- Backend đã có `prisma.adType.findMany()` → có thể dùng `create/update/delete`

**Cons:**
- AdType "360", "SM", "BAIDU_JS" là system-level categories, không nên sửa/xóa tùy ý
- Xóa AdType → ảnh hưởng tất cả advertisers dùng adType đó
- Nhiều advertisers có thể share cùng AdType — không nên cho edit riêng
- Khái niệm "AdOrder" (per-advertiser order) khác với "AdType" (system category)

**Backend/schema changes:**
1. `adOrder.controller.ts`: POST/PUT/DELETE → gọi `prisma.adType.create/update/delete` thay vì return 501
2. Cần thêm field `upstreamId` vào AdType nếu muốn per-advertiser — nhưng AdType hiện là shared/system

**Frontend changes:** Tương tự Option B nhưng gọi AdType API

**Migration impact:** Không có migration nhưng có data model confusion — AdType không phải AdOrder

**Risk:** High — confuse data model. AdType là system-level enum, không phải per-advertiser order.

**Recommendation:** **NO** — AdType không phù hợp làm AdOrder vì:
1. AdType là shared system category (nhiều advertisers cùng dùng)
2. Edit/delete AdType ảnh hưởng cross-tenant
3. AdType không có `upstreamId` — không thể filter by advertiser

---

### Decision Summary: AdOrder CRUD

| Option | Description | Schema | Migration | Risk | Recommendation |
|--------|-------------|--------|-----------|------|----------------|
| A | Giữ virtual read-only | None | None | Low | No — vi phạm v4 requirement |
| B | Tạo AdOrder table riêng + CRUD | New `AdOrder` model | Migration + data migration | Medium | **YES IF** business cần entity riêng |
| C | Map CRUD vào AdType | Dùng AdType | None | High | No — data model confusion |

**Recommended: Option B with business clarification.** Cần xác định:
1. AdOrder ↔ Advertiser: 1:n hay n:n?
2. AdOrder ↔ AdType: 1:1 (mỗi AdOrder chỉ thuộc 1 loại) hay 1:many?
3. Khi xóa AdOrder → AdId references xử lý thế nào?

---

## 4. AdId CRUD Decision

### Current State

**Prisma Schema:**
- `AdSite` = demand-side ad slot (ID quảng cáo)
- `AdSite.name` = slot/ad ID string
- `AdSite.currentUnitPrice` = CPM rate
- `AdSite.currentRatio` = RATIO rate
- `AdSite.billingMethod` = 'CPM' | 'RATIO'

**Backend (`adId.controller.ts`):**
```typescript
// GET — read-only lookup over AdSite
const adSites = await prisma.adSite.findMany({
  where,
  include: { upstream: { include: { adType: true } } },
});

// POST → 501
res.status(501).json({ error: "AdId POST not implemented. ... Create Media instead." });

// PUT → 501
res.status(501).json({ error: "AdId PUT not implemented. Use PUT /api/bff/media/:id for updates." });

// DELETE → 501
res.status(501).json({ error: "AdId delete not implemented. Use DELETE /api/bff/media/:id for soft archive." });
```

**Frontend (`AdIdMgmt`):** Read-only table, không có form create/edit/delete.

**Message "Create Media instead" nghĩa là:**
- Media = supply-side entity (dáng ký kênh quảng cáo)
- Media flow: Media → MediaAdOrder → MediaId (media slot) được tạo qua Media management
- AdId (demand-side) chỉ được tạo gián tiếp khi có Media record tương ứng
- AdSite (AdId) được link vào Media thông qua `MediaAdOrder` junction

**PDF requirement (v4 image 1.6):**
> "Khi bấm nút chỉnh sửa thì chỉ mở chức năng tạo mới ID quảng cáo, không chỉnh sửa được ID quảng cáo hiện có. Trong chức năng chỉnh sửa còn thiếu nút xóa."

### Gap Analysis
| Operation | Backend Status | Frontend Status | v4 Requirement |
|-----------|----------------|-----------------|----------------|
| List | ✓ GET works | ✓ Read-only table | ✓ |
| Create | ✗ 501 (message: "create Media instead") | No form | ✗ Blocked |
| Edit | ✗ 501 (message: "use PUT /api/bff/media/:id") | No form | ✗ Blocked |
| Delete | ✗ 501 (message: "use DELETE /api/bff/media/:id") | No form | ✗ Blocked |

### Option A: Giữ AdId read-only, quản lý qua Media flow

**Pros:**
- Duy trì kiến trúc hiện tại — AdId chỉ là lookup
- Media flow đã có CRUD — Media, MediaAdOrder, MediaId
- Tách biệt demand-side (AdId) và supply-side (MediaId) — logical separation
- Backend đã có message rõ ràng: "create Media instead"

**Cons:**
- Không đáp ứng v4 1.6 requirement — user không edit/delete AdId trực tiếp
- User phải vào Media management để tạo/sửa AdId — confusing UX
- Nếu AdId data sai → phải tìm Media record tương ứng để sửa
- PDF v4 1.5/1.6 thể hiện AdId có thể edit/delete riêng

**Backend/schema changes:** None

**Frontend changes:** Có thể thêm hint/troubleshooting UI khi user click edit AdId: "AdId được quản lý thông qua Media"

**Migration impact:** None

**DataEntry/Reports impact:**
- DataEntry: AdId được chọn khi nhập dữ liệu — nếu AdId read-only, dữ liệu correct phụ thuộc vào Media management accuracy
- Reports: Không ảnh hưởng — reports dùng `DailyInput.revenue` source of truth

**Risk:** Low — architecture không đổi

**Recommendation:** **POSSIBLE** — Nếu business chấp nhận "AdId chỉ quản lý qua Media flow", thì frontend nên:
1. Disable edit/delete buttons on AdIdMgmt table
2. Add explanatory text: "ID quảng cáo được tạo và quản lý thông qua Quản lý Media"
3. Link sang Media management page

---

### Option B: Cho CRUD trực tiếp trên AdId/AdSite

**Pros:**
- Giải quyết triệt để v4 1.6 requirement
- User có thể edit/delete AdId trực tiếp trên AdIdMgmt page
- Đơn giản hóa UX — không cần navigate sang Media page
- AdSite đã có đầy đủ fields: name (slot), currentUnitPrice, currentRatio, billingMethod, status

**Cons:**
- BFF controller hiện tại return 501 cho POST/PUT/DELETE — cần re-implement
- Cần xác định: khi edit AdId → có cần update Media record tương ứng không?
- AdId/AdSite đang được quản lý qua Media flow — CRUD trực tiếp có thể conflict với Media management
- Dangling reference: nếu AdId bị xóa → DailyInput references xử lý thế nào?

**Backend/schema changes:**
1. `adId.controller.ts`: Implement POST, PUT, DELETE cho `AdSite`
2. Có thể cần soft-delete (set `isArchived = true`) thay vì hard delete để preserve DailyInput references
3. Cần xử lý Media ↔ AdSite relationship khi AdSite updated/deleted

**Frontend changes:**
1. `AdIdMgmt`: Thêm `openCreate`, `openEdit`, `removeRecord` functions
2. Form fields: advertiser (dropdown), adOrder (dropdown), slot, type (CPM/RATIO), rate, notes, status
3. `bffApi.ts`: Thêm `createAdId`, `updateAdId`, `deleteAdId` calls

**Migration impact:**
- Không cần schema change — AdSite table đã có đủ fields
- Soft-delete: thêm `isArchived` column nếu muốn preserve historical data
- Dữ liệu cũ: không cần migration

**DataEntry/Reports impact:**
- DataEntry: AdId list dùng cho dropdown — nếu AdId có thể edit trực tiếp, danh sách update tự động
- Reports: Không ảnh hưởng — source of truth là `DailyInput.revenue`

**Risk:**
- Medium — Cần xác định relationship với Media. Nếu Media record đang reference AdSite, khi sửa AdSite có cần sync Media không?
- Soft-delete requirement: hard delete AdSite có thể break DailyInput foreign key

**Recommendation:** **YES IF** — business cho phép CRUD trực tiếp. Cần xác định:
1. Soft-delete hay hard-delete khi xóa AdId?
2. AdId update có ảnh hưởng Media record không?

---

### Option C: Tạo entity AdId riêng (tách khỏi AdSite)

**Pros:**
- AdId và AdSite có thể evolve độc lập
- Clear separation: AdId = business entity, AdSite = database/persistence layer
- Không ảnh hưởng đến Media flow hiện tại

**Cons:**
- Thêm layer of indirection — complexity cao hơn
- Cần xác định AdId = AdSite hay AdId wrap AdSite
- Nếu AdId = AdSite → Option B đã giải quyết
- Nếu AdId ≠ AdSite → 2 entities cho 1 concept, confusing

**Backend/schema changes:**
1. Tạo model `AdId` riêng hoặc dùng existing `AdSite` nhưng expose qua `AdId` BFF layer
2. Nếu dùng AdSite: Option B đủ
3. Nếu tách: cần mapping layer AdId ↔ AdSite

**Frontend changes:** Tương tự Option B

**Migration impact:** Phụ thuộc vào design

**Risk:** High — unnecessary abstraction if AdId just wraps AdSite

**Recommendation:** **NO** — Không có lý do đủ mạnh để tách. AdSite đã đủ để represent AdId. Option B là đủ.

---

### Decision Summary: AdId CRUD

| Option | Description | Schema | Migration | Risk | Recommendation |
|--------|-------------|--------|-----------|------|----------------|
| A | Giữ read-only, quản lý qua Media | None | None | Low | Possible — nếu business chấp nhận Media flow |
| B | CRUD trực tiếp trên AdSite | AdSite đã có đủ fields | Soft-delete col nếu cần | Medium | **YES IF** business cần direct CRUD |
| C | Tạo AdId entity riêng | N/A | N/A | High | No — unnecessary abstraction |

**Recommended: Option B (CRUD trực tiếp)** với:
1. Soft-delete (`isArchived = true`) thay vì hard delete — preserve DailyInput references
2. Cập nhật Media relationship khi AdId changed (nếu Media đang reference AdSite)
3. Frontend: Add hint "AdId có thể edit trực tiếp" — không cần vào Media page

---

## 5. Recommended Path

### Quick Fix (Frontend only — không làm backend)

Nếu business không sẵn sàng cho backend changes:

| # | Issue | Quick Fix |
|---|-------|-----------|
| 1.1 | Advertiser search phone/email/notes | Giữ code search hiện tại, thêm note trong UI: "Tìm kiếm theo phone/email/notes đang chờ backend hỗ trợ" |
| 1.4 | AdOrder edit/delete | Disable edit/delete buttons, tooltip: "AdOrder hiện chỉ đọc" |
| 1.6 | AdId edit/delete | Disable edit/delete buttons, tooltip: "ID quảng cáo được quản lý thông qua Quản lý Media" |

**Ưu điểm:** Không làm gì sai, clear communication với user
**Nhược điểm:** Không đáp ứng v4 requirement đầy đủ

---

### Backend Phase (nếu business approve)

**Thứ tự triển khai an toàn:**

**Phase 1 — Advertiser contact fields (LOW RISK)**
- Task: Thêm 4 nullable columns vào Upstream
- Backend: Advertiser controller + mapper update
- Frontend: AdvertiserList form thêm 4 fields
- Testing: Tạo advertiser mới với contact info, search thử
- Rollback: Drop columns nếu có vấn đề

**Phase 2 — AdId CRUD (MEDIUM RISK)**
- Task: Implement POST/PUT/DELETE trên AdSite
- Backend: adId.controller.ts re-implement CRUD + soft-delete
- Frontend: AdIdMgmt thêm form + edit/delete buttons
- Testing: Edit AdId, delete AdId (soft-delete check), verify DailyInput không bị broken
- Rollback: Revert controller endpoints to 501

**Phase 3 — AdOrder CRUD (HIGHER RISK)**
- Task: Tạo bảng AdOrder + CRUD
- Backend: New Prisma model + adOrder.controller.ts CRUD
- Frontend: AdOrderMgmt thêm form + edit/delete buttons
- Migration: Migrate existing AdType data sang AdOrder
- Testing: CRUD operations + DataEntry integration
- Rollback: Drop AdOrder table, revert controller (nếu migration reversible)

---

### Những việc KHÔNG NÊN làm

1. **Không nên map AdOrder → AdType (Option C AdOrder)** — Data model confusion, AdType là system shared enum
2. **Không nên hard-delete AdId** — Sẽ break DailyInput references
3. **Không nên tạo entity AdId riêng (Option C AdId)** — Unnecessary abstraction
4. **Không nên rush migration mà không test** — Upstream và AdOrder migrations cần careful review
5. **Không nên implement edit/delete mà không có backend** — Frontend edit/delete buttons không hoạt động nếu API trả 501

---

## 6. Questions for Business

### Question 1: Advertiser Contact Fields
**Nhà quảng cáo có cần lưu contact/phone/email/notes không?**

Context: Upstream model hiện không có fields này. Search đã thêm vào frontend nhưng data always null.

- Nếu **YES** → Phase 1: add columns to Upstream
- Nếu **NO** → Keep current state (search fields không hoạt động, acceptable until data available)

---

### Question 2: AdOrder Data Model
**Đơn quảng cáo là entity thật hay chỉ là nhóm/type derived?**

Context: AdOrder hiện virtual, derived từ AdType (SM, 360...). Nếu là entity thật:
- Cần tạo bảng riêng
- Mỗi Advertiser có danh sách AdOrder riêng
- AdOrder có thể có notes riêng

- Nếu **Entity thật** → Option B AdOrder
- Nếu **Chỉ là derived type** → Option A (giữ read-only)

---

### Question 3: AdId CRUD
**ID quảng cáo có được tạo/sửa/xóa trực tiếp không?**

Context: Hiện tại AdId/AdSite chỉ read-only, message nói "create Media instead". v4 1.6 requirement muốn edit/delete trực tiếp.

- Nếu **YES — direct CRUD** → Option B AdId
- Nếu **NO — chỉ qua Media** → Option A AdId (giữ read-only)

---

### Question 4: Historical Data on Delete
**Nếu xóa AdOrder/AdId thì dữ liệu lịch sử xử lý thế nào?**

Context: DailyInput records reference AdSite (AdId) và có thể reference AdOrder. Nếu xóa:
- Soft-delete (set inactive/archived) — preserve references, DailyInput không bị broken
- Hard-delete — Cần migration để nullify references hoặc cascade delete → mất lịch sử data

**Recommendation:** Soft-delete for both AdOrder and AdId — preserve historical data integrity.

---

### Question 5: AdId ↔ Media Relationship
**AdId có liên kết với Media như thế nào?**

Context: Backend message nói "create Media instead" và "use PUT /api/bff/media/:id for updates". Cần hiểu:
- AdId (AdSite) và MediaId (MediaAdOrder → MediaId) là cùng một cái entity từ 2 phía?
- Hay AdId là demand-side, MediaId là supply-side — hoàn toàn tách biệt?
- Khi edit AdId có cần sync Media record không?

**Recommendation:** Xác định trước khi implement AdId CRUD — tránh conflict giữa 2 management pages.

---

### Question 6: Soft Delete Requirement
**Có cần soft delete không?**

Context: Upstream (Advertiser) khi xóa mà có DailyInput references → soft delete (set `status = inactive`). AdOrder và AdId nên làm tương tự.

- Nếu **YES** → Thêm `isArchived` column cho AdSite, `status = 'inactive'` cho AdOrder
- Nếu **NO** → Hard delete với appropriate referential integrity handling

---

## 7. Implementation Plan Per Decision

### Nếu chọn Option A (Recommended) cho Advertiser Contact Fields

**Backend:**
1. Tạo Prisma migration: ` ALTER TABLE "Upstream" ADD COLUMN "contact" TEXT, ADD COLUMN "phone" TEXT, ADD COLUMN "email" TEXT, ADD COLUMN "notes" TEXT; `
2. Update `advertiser.mapper.ts` — map `upstream.contact/phone/email/notes` thay vì hardcoded null
3. Update `advertiser.controller.ts` POST/PUT — đọc `req.body.contact/phone/email/notes`
4. Update `CreateAdvertiserRequest` / `UpdateAdvertiserRequest` types

**Frontend:**
1. `bffTypes.ts` — `CreateAdvertiserInput` / `UpdateAdvertiserInput` thêm 4 optional string fields
2. `Advertiser.tsx` — `AdvertiserFormState` thêm 4 fields, form thêm 4 inputs

**Testing:**
1. Tạo Advertiser với contact info → verify stored correctly
2. Search với keyword = phone → verify found
3. Search với keyword = email → verify found
4. Update advertiser contact → verify updated
5. Soft delete → verify still in list with inactive status

**Rollback:**
- `prisma migrate rollback` hoặc drop columns manually
- Revert mapper → hardcoded null

---

### Nếu chọn Option B (Recommended) cho AdId CRUD

**Backend:**
1. `adId.controller.ts`:
   - POST: `prisma.adSite.create(...)` — tạo AdSite record
   - PUT: `prisma.adSite.update(...)` — update AdSite
   - DELETE: `prisma.adSite.update({ where: { id }, data: { isArchived: true } })` — soft delete
2. Thêm validation: advertiserId must exist, adTypeCode must valid
3. Handle Media relationship: nếu AdSite đang referenced by MediaAdOrder → confirm before archive

**Frontend:**
1. `AdIdMgmt` state: `editing: AdId | null`, `formOpen: boolean`, `form: AdIdFormState`
2. Form fields: advertiser dropdown, adOrder dropdown, slot, type (CPM/RATIO), rate, notes, status
3. `openEdit(record)`, `openCreate()`, `submitForm()`, `removeRecord()`
4. `bffApi.ts`: `createAdId`, `updateAdId`, `deleteAdId` (soft)

**Migration:**
- Thêm `isArchived Boolean @default(false)` vào AdSite nếu chưa có
- Không cần backfill data

**Testing:**
1. Tạo AdId mới → verify appears in list
2. Edit AdId → verify changes saved
3. Delete AdId → verify soft-deleted (isArchived = true), not in active list
4. Verify DailyInput data không bị broken after soft delete

**Rollback:**
- Revert controller endpoints to 501
- Frontend disable edit/delete buttons

---

### Nếu chọn Option B cho AdOrder CRUD

**Backend:**
1. Tạo Prisma migration — new `AdOrder` model:
   ```prisma
   model AdOrder {
     id         Int       @id @default(autoincrement())
     upstreamId Int       // advertiser FK
     adTypeId   Int       // AdType FK
     name       String
     notes      String?
     status     String    @default("active")
     createdAt  DateTime  @default(now())
     updatedAt  DateTime  @updatedAt
     upstream   Upstream  @relation(fields: [upstreamId], references: [id])
     adType     AdType    @relation(fields: [adTypeId], references: [id])
     adSites    AdSite[]
   }
   ```
2. `adOrder.controller.ts`: Replace virtual derivation with actual CRUD queries
3. Seed/migrate existing AdType data: tạo AdOrder records cho mỗi unique upstream+adType combination

**Frontend:**
1. `AdOrderMgmt`: State + form for create/edit/delete
2. Form fields: advertiser dropdown, adType dropdown, name, notes, status
3. `bffApi.ts`: `createAdOrder`, `updateAdOrder`, `deleteAdOrder`
4. `AdIdMgmt`: AdOrder filter cascade → filter by advertiser → show AdOrders

**Migration:**
- Create new `AdOrder` table
- Seed: for each existing upstream that has AdSites, create AdOrder with adType from those AdSites
- Optionally backfill `adOrderId` on AdSite if needed for foreign key

**Testing:**
1. Create AdOrder → verify in list
2. Edit AdOrder name → verify updated
3. Delete AdOrder → verify soft-deleted, AdIds not affected
4. DataEntry: if AdOrder is selected during AdId creation → verify relationship works

**Rollback:**
- Complex — involves data migration. Should be carefully reviewed before proceeding.
- Recommend: backup before migration, test on staging first.

---

## Summary Table

| Item | Decision Required | Recommended Option | Backend Effort | Migration Risk | Notes |
|------|-----------------|-------------------|----------------|----------------|-------|
| Advertiser contact | YES — cần phone/email/notes? | Option A: Add columns | Low | Low | Simple extension |
| AdOrder CRUD | YES — entity thật hay virtual? | Option B if business confirms | Medium | Medium | New table + CRUD |
| AdId CRUD | YES — direct hay qua Media? | Option B if business confirms | Medium | Low-Medium | AdSite already has fields |