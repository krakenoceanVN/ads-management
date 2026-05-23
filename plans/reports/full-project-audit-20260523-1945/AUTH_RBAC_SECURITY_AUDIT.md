# AUTH / RBAC / SECURITY AUDIT

## JWT Authentication

**File**: `src/middleware/auth.ts`

### Token Structure
- JWT payload only contains `{ id: number }` — minimal payload
- User data is fetched from DB on every authenticated request via `requireAuth`
- JWT secret from `JWT_SECRET` env variable
- Token expiry: NOT validated in `jwt.verify` — the library may or may not enforce `exp` claim if present

**Risk**: If a token is compromised, there's no short expiry enforced. Tokens may be long-lived. The `exp` claim if present in the token is NOT validated by the current code because `jwt.verify` is called without options that enforce expiry, AND the payload only contains `id` — likely no `exp` claim is even set on token creation. **Needs confirmation: how is JWT expiry handled?**

### Token Storage
- Frontend stores token in `localStorage` under key `bff_auth_token`
- Sent as `Authorization: Bearer <token>` header
- `StorageEvent` listener on `BFF_AUTH_TOKEN_CHANGED_EVENT` for cross-tab sync
- `BFF_AUTH_TOKEN_INVALID_EVENT` for server-initiated logout

**Risk**: `localStorage` is vulnerable to XSS attacks. HttpOnly cookies would be safer but require server-side token management.

---

## Permission Resolution

### `resolveUserRole` — auth.ts lines 38-47
```typescript
if (user.roleRef?.code) return user.roleRef.code as UserRole
if (user.role === 'VIEWER') return 'VIEWER'
if (user.permAdmin || user.role === 'ADMIN') return 'ADMIN'
return 'EDITOR'
```

**Risk**: The legacy fallback prefers `role === 'ADMIN'` (string check) over `permAdmin` boolean. This means a user with `role='SUPER_ADMIN'` and `permAdmin=false` would resolve to 'EDITOR' (the else branch). However `hasPermission` checks `role === 'SUPER_ADMIN'` first, so actual auth is protected. But `resolveUserRole` is used for display and in `toUserPublic`.

**Actual risk**: A user whose `roleRef.code` is null/undefined (no RBAC role) but has `role='ADMIN'` would resolve to 'ADMIN' via legacy fallback. This is the intended design but creates dual-path resolution.

### `hasPermission` — auth.ts lines 69-73
```typescript
if (!user) return false
if (user.role === 'SUPER_ADMIN') return true
return user.permissions?.includes(permissionKey) ?? false
```

**Risk**: `hasPermission` doesn't call `resolveUserRole`. It directly checks `user.role === 'SUPER_ADMIN'` and `user.permissions`. If `user.role` is stale (e.g., set to 'EDITOR' but `user.roleRef.code` is 'ADMIN'), `hasPermission` would use the stale `user.role`. However `hasPermission` is only used when `user` is set by `requireAuth` which fetches fresh from DB with `roleRef`.

---

## SUPER_ADMIN Protections

### Backend (admin.ts lines 1644-1652)
```typescript
if (existing.roleRef?.code === 'SUPER_ADMIN') {
  const superAdminCount = await prisma.user.count({
    where: { status: 'active', roleRef: { code: 'SUPER_ADMIN' } },
  })
  if (superAdminCount <= 1) {
    res.status(400).json({ success: false, error: "Cannot disable the last SUPER_ADMIN" })
    return
  }
}
```

**Correct**: Prevents disabling the last SUPER_ADMIN.

### Backend (admin.ts lines 1638-1641)
```typescript
if (req.user!.id === userId) {
  res.status(400).json({ success: false, error: "Cannot disable yourself" })
  return
}
```

**Correct**: Prevents self-disable.

### Frontend (UserManagement.tsx lines 160-163)
```typescript
if (canDisable && r.status === 'active' && !isSelf && ...
```

**Correct**: Frontend also checks `!isSelf` before showing disable button.

### Frontend (UserManagement.tsx lines 178-180)
```typescript
if (canDisable && r.status === 'active' && isSelf && (
  <span style={{ color: 'var(--text-sub)', fontSize: '11px' }}>{t('cannotDisableSelf')}</span>
)}
```

**Correct**: Shows explanatory text for self-disable case.

---

## Role Update Protection

### Backend (admin.ts lines 170-185)
```typescript
if (r.code === 'SUPER_ADMIN') {
  return <span>🔒 {t('locked')}</span>
}
```

**Correct**: RoleManagement frontend shows locked indicator for SUPER_ADMIN.

### Backend (RoleManagement.tsx)
No explicit server-side guard preventing SUPER_ADMIN role modification. The frontend prevents the button but a direct API call to `PUT /api/roles/:id/permissions` with `id` of SUPER_ADMIN role would succeed unless there's server-side logic.

**Need to verify**: Does `PUT /api/roles/:id/permissions` check if `role.code === 'SUPER_ADMIN'` and reject?

Looking at the admin.ts route — I don't see an explicit check in the role update handler. The permission is checked (`role.update`) but SUPER_ADMIN's role could be modified if someone has `role.update` permission. This is a security gap.

---

## Missing Permission Checks

### BFF Settlement/Report Controllers
As noted in ROUTE_API_AUDIT — no `requirePermission` calls in settlement or report controller routes. Any authenticated user can view all settlement data.

**Severity**: P1 — data exposure to unauthorized users.

---

## Password Security

### Password Hashing (admin.ts line 2019)
```typescript
const passwordHash = await bcrypt.hash(password, 10)
```

- Uses `bcrypt` with cost factor 10 — acceptable minimum
- Minimum 8 characters enforced on both frontend and backend
- No password complexity requirements (no uppercase, numbers, symbols required)

**Gap**: No password history, no complexity requirements, no breach database checking.

---

## CORS Configuration

**File**: `src/index.ts` lines 18-27
```typescript
origin: (origin, callback) => {
  if (!origin || origin.startsWith("http://localhost:")) {
    callback(null, true)
  } else {
    callback(new Error("Not allowed by CORS"))
  }
}
```

**Risk**: In production, if the app is served from a different origin than `localhost`, CORS will block all requests. The origin check is very permissive for localhost but blocks everything else. If deployed behind a reverse proxy that sets `X-Forwarded-For`, the original origin is lost.

**Recommended Fix**: Either use a whitelist of allowed origins from env, or configure CORS to use the same proxy-based origin resolution.

---

## Rate Limiting

**File**: `src/utils/rateLimit.ts`
Rate limiting is implemented (`rateLimit.ts` exists) but not applied to any routes in `src/index.ts`. The rate limiter exists but is not in use.

**Impact**: Login endpoint is not rate-limited. Brute force attacks on login are possible.

---

## Input Validation

### Legacy `requirePermission` (auth.ts lines 149-171)
```typescript
if (perm in req.user && typeof req.user[perm as keyof UserPublic] === 'boolean') {
  if (!req.user[perm as keyof UserPublic]) {
    res.status(403).json({ success: false, error: 'Permission denied' })
    return
  }
} else {
  if (!hasPermission(req.user, perm)) {
```

The dual-path check allows both legacy boolean flags (`perm_data_input`, `perm_data_confirm`, `perm_admin`) AND RBAC permission strings. However:
- The `perm in req.user` check uses TypeScript `keyof UserPublic` — if a legacy flag is passed that isn't in `UserPublic`, it falls through to RBAC key check
- `perm_admin` IS in `UserPublic` as `perm_admin: boolean` — so legacy `perm_admin` check works
- `perm_data_input` IS in `UserPublic` as `perm_data_input: boolean`
- `perm_data_confirm` IS in `UserPublic` as `perm_data_confirm: boolean`

**No issue found** — the dual-path is correctly implemented.

---

## Token Invalidation on Role Change

When an admin changes a user's role via `PUT /api/users/:id`, the user's current JWT token remains valid until expiry. The updated permissions won't take effect until the user re-logs in.

**Risk**: If a user's access is revoked, they retain access until token expires. This is standard for stateless JWT but means revocation is not immediate.

**No fix recommended** without implementing token blacklisting, which adds complexity.

---

## Frontend `can()` Function

**File**: `frontend/src/AppContext.tsx`

The `can()` function checks:
1. `SUPER_ADMIN` — full access (line not seen but confirmed from summary)
2. RBAC permissions array
3. Legacy ADMIN role → full access (except system.config)
4. Legacy `perm_data_input` → maps to `dataEntry.read/create`
5. Legacy `perm_data_confirm` → maps to `dataEntry.confirm`

**Risk**: The `can()` function is purely frontend. A malicious user could modify the JS state in browser devtools to grant themselves permissions. All actual security must be enforced on the backend, which it mostly isn't for BFF routes.