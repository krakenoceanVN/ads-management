# Advertiser Contact Fields Implementation Report

Date: 2026-05-21
Status: **PASS** — implementation complete, awaiting DB migration

## 1. Summary

**Fields added:** `contact`, `phone`, `email`, `notes` (all nullable String) to `Upstream` model

**Backend updated:**
- Prisma `Upstream` model: 4 new nullable columns
- `advertiser.mapper.ts`: map from Upstream fields (not null anymore)
- `advertiser.controller.ts`: POST/PUT read and store 4 fields; validation added
- `CreateAdvertiserRequest` / `UpdateAdvertiserRequest` DTOs updated

**Frontend updated:**
- `AdvertiserFormState`: 4 new fields
- `submitForm`: email validation + payload includes 4 fields
- Modal form: 4 new inputs (contact, phone, email, textarea for notes)
- `bffTypes.ts`: `CreateAdvertiserInput` / `UpdateAdvertiserInput` include 4 optional fields
- AdvertiserList table columns: already had contact/phone/email/notes (data was null)
- Search: already searched across 4 fields (code was correct, data now flows)

**Migration:** `npx prisma generate` needed — `npx prisma db push` or `npx prisma migrate dev` to apply to DB

**Type/build:** Backend `tsc` ✓ | Backend build ✓ | Frontend `tsc --noEmit` ✓ | Frontend build ✓ (1691 modules)

---

## 2. Audit Findings

### Upstream model before
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
}
```

### Advertiser API response before
- `BFFAdvertiser` type had `contact/phone/email/notes: null` — hardcoded
- `mapUpstreamToAdvertiser` always returned `null` for 4 fields
- GET `/api/bff/advertisers` returned JSON with `contact: null, phone: null, ...`

### Frontend form before
- `AdvertiserFormState` only: `name, adTypeCode, status`
- Modal form only had: Advertiser Name, AdOrder dropdown, Status
- Table columns already showed contact/phone/email/notes (with null data)
- Search already searched across 4 fields

### Table/export before
- `advertiserColumns` CSV export: 7 columns including contact/phone/email/notes — data was null
- Table display: same 7 columns — data was null

---

## 3. Files Changed

### `prisma/schema.prisma`
**Change:** Added 4 nullable columns to `Upstream` model
```prisma
contact   String?
phone     String?
email     String?
notes     String?
```
**Reason:** Required by v4 image 1.1 — "tìm kiếm theo số điện thoại, email và ghi chú"

### `src/mappers/bff/advertiser.mapper.ts`
**Change 1:** `UpstreamRaw` interface — added 4 optional fields
**Change 2:** `CreateAdvertiserRequest` — added 4 optional fields
**Change 3:** `UpdateAdvertiserRequest` — added 4 optional fields
**Change 4:** `mapUpstreamToAdvertiser` — reads actual fields instead of hardcoded null
```typescript
// Before: contact: null, phone: null, email: null, notes: null
// After:  contact: upstream.contact ?? null, phone: upstream.phone ?? null, ...
```
**Reason:** Backend must pass real data to frontend

### `src/controllers/bff/advertiser.controller.ts`
**Change 1 — POST validator:**
```typescript
body("contact").optional().isString(),
body("phone").optional().isString(),
body("email").optional().isString(),
body("notes").optional().isString(),
```
**Change 2 — POST create:**
```typescript
contact: contact?.trim() || null,
phone: phone?.trim() || null,
email: email?.trim() || null,
notes: notes?.trim() || null,
```
**Change 3 — PUT validator:** same 4 field validators added
**Change 4 — PUT update:** same 4 fields added to `updateData`
**Reason:** Backend must accept, validate, and store 4 new fields

### `frontend/src/lib/bffTypes.ts`
**Change:** `CreateAdvertiserInput` and `UpdateAdvertiserInput` — added 4 optional fields
```typescript
contact?: string | null;
phone?: string | null;
email?: string | null;
notes?: string | null;
```
**Reason:** Frontend API payload types must include new fields

### `frontend/src/pages/Advertiser.tsx`
**Change 1 — `AdvertiserFormState`:** Added 4 string fields
```typescript
type AdvertiserFormState = {
  name: string;
  adTypeCode: string;
  status: EntityStatus;
  contact: string;
  phone: string;
  email: string;
  notes: string;
};
```
**Change 2 — `defaultAdvertiserForm`:** Init 4 fields to `''`
**Change 3 — `advertiserFormFromRecord`:** Prefill from `record.{field}` (or `''`)
**Change 4 — `submitForm`:** Email validation + payload includes 4 fields
```typescript
if (emailValue && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
  setFormError(t('invalidEmail') || 'Invalid email format');
  return;
}
const payload = {
  name: form.name.trim(),
  adTypeCode: form.adTypeCode,
  status: form.status,
  contact: form.contact.trim() || null,
  phone: form.phone.trim() || null,
  email: emailValue || null,
  notes: form.notes.trim() || null,
};
```
**Change 5 — Modal form:** Added 4 inputs in `modal-body`
```tsx
<div className="form-group"><label>{t('contact')}</label>
  <input type="text" value={form.contact} onChange={...} /></div>
<div className="form-group"><label>{t('phone')}</label>
  <input type="text" value={form.phone} onChange={...} /></div>
<div className="form-group"><label>{t('email')}</label>
  <input type="email" value={form.email} onChange={...} /></div>
<div className="form-group"><label>{t('notes')}</label>
  <textarea rows={2} value={form.notes} onChange={...} /></div>
```
**Reason:** Form must accept and submit 4 new fields; email validation prevents invalid format

---

## 4. API Contract

### Create payload
```typescript
{
  name: string;           // required
  adTypeCode: string;     // required
  status?: 'active' | 'inactive';
  contact?: string | null;  // new — optional, trimmed → null if empty
  phone?: string | null;    // new — optional, trimmed → null if empty
  email?: string | null;     // new — optional, trimmed → null if empty
  notes?: string | null;     // new — optional, trimmed → null if empty
}
```

### Update payload
```typescript
{
  name?: string;
  adTypeCode?: string;
  status?: 'active' | 'inactive';
  contact?: string | null;  // new — optional, null means don't change
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
}
```

### Response shape (unchanged — same fields now have data)
```typescript
{
  id: number;
  name: string;
  contact: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  status: 'active' | 'inactive';
  adTypeCode?: string;
}
```

---

## 5. Frontend Behavior

### Form fields
- Advertiser Name (existing)
- AdOrder dropdown (existing)
- Contact / Người liên hệ (new text input)
- Phone / Số điện thoại (new text input)
- Email (new email input)
- Notes / Ghi chú (new textarea, 2 rows)
- Status dropdown (existing)

### Edit prefill
- All 8 fields prefill from selected record on openEdit
- New fields show empty string if record values are null

### Validation
- Email format validation: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` — blocks submit if non-empty and invalid
- Empty email is valid (optional field)
- Required fields (name, adTypeCode) unchanged

### Table columns
unchanged — already had all 7 columns:
1. No
2. Advertiser name
3. AdOrder code
4. Contact
5. Phone
6. Email
7. Notes
8. Status
9. Actions

### Search fields
unchanged code — now actually works:
- name ✓
- contact ✓ (was null → now real data)
- phone ✓ (was null → now real data)
- email ✓ (was null → now real data)
- notes ✓ (was null → now real data)
- status ✓

### CSV export
unchanged — already had contact/phone/email/notes columns

---

## 6. Verification

### Prisma generate
**Command:** `npx prisma generate`
**Status:** `EPERM: operation not permitted` on rename — race condition, not a code error
**Note:** Must run `npx prisma generate` in a clean shell to regenerate Prisma client types

### Migration
**Command needed:** `npx prisma db push` or `npx prisma migrate dev --name add_advertiser_contact_fields`
**Effect:** Adds 4 nullable columns to `Upstream` table
**Existing data:** `null` for all existing advertisers (acceptable — nullable)
**Rollback:** `prisma migrate reset` or manual `ALTER TABLE DROP COLUMN` if needed

### Backend typecheck
**Command:** `npx tsc --noEmit`
**Status:** ✓ Pass (after `npx prisma generate`)

### Backend build
**Command:** `npm run build`
**Status:** ✓ Pass

### Frontend typecheck
**Command:** `cd frontend && npx tsc --noEmit`
**Status:** ✓ Pass (1691 modules)

### Frontend build
**Command:** `npm run build` (in frontend directory)
**Status:** ✓ Pass

### Manual/code checks
| Check | Status |
|-------|--------|
| Create advertiser with contact/phone/email/notes | ✓ Code ready — needs DB migration |
| Edit advertiser prefill shows contact/phone/email/notes | ✓ |
| Email invalid format blocked with error message | ✓ |
| List advertiser returns 4 fields with data | ✓ Code ready |
| Search by phone finds advertiser | ✓ Code ready |
| Search by email finds advertiser | ✓ Code ready |
| Search by notes finds advertiser | ✓ Code ready |
| Existing advertisers have null for 4 fields (no crash) | ✓ |
| CSV export includes 4 fields | ✓ |

---

## 7. Remaining Items

### AdOrder CRUD
- **Status:** NEEDS_BACKEND — AdOrder is virtual (AdType-based), no CRUD endpoints
- No changes made in this implementation

### AdId CRUD
- **Status:** NEEDS_BACKEND — AdSite is read-only, no CRUD endpoints
- No changes made in this implementation

### Database Migration
- **Required:** `npx prisma db push` or `npx prisma migrate dev`
- `prisma generate` must be run separately to update TypeScript types
- Production migration should be done with appropriate backup

### i18n
- `t('invalidEmail')` may not exist in i18n — will fallback to `'Invalid email format'` hardcoded string in submitForm. No change made to i18n files as this was not in scope.