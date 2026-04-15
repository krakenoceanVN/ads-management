# Ad Management System - Complete Architecture Analysis

## 1. BACKEND ARCHITECTURE

**Tech Stack:** Node.js + Express + Prisma (SQLite) + TypeScript

### API Endpoints

| Route | Method | Purpose | Auth |
|-------|--------|---------|------|
| `/api/auth/login` | POST | User login, returns JWT | Public |
| `/api/auth/me` | GET | Get current user info | Required |
| `/api/daily-input` | GET | Get daily input rows for date+ad_type | Required |
| `/api/daily-input/batch` | POST | Batch save daily inputs | perm_data_input |
| `/api/daily-input/:id/confirm` | POST | Confirm a record | perm_data_confirm |
| `/api/daily-input/:id/unconfirm` | POST | Unconfirm a record | perm_data_confirm |
| `/api/daily-input/:id` | DELETE | Delete unconfirmed record | perm_data_input |
| `/api/dashboard/monthly` | GET | Monthly summary with cost/revenue/profit | Required |
| `/api/admin/upstreams` | GET/POST | List/Create upstreams | perm_admin |
| `/api/admin/upstreams/:id` | PUT/DELETE | Update/Delete upstream | perm_admin |
| `/api/admin/ad-sites` | GET/POST | List/Create ad sites | perm_admin |
| `/api/admin/ad-sites/:id` | PUT/DELETE | Update/Delete ad site | perm_admin |
| `/api/admin/ad-sites/:id/price` | PUT | Update CPM price or RATIO | perm_admin |
| `/api/admin/ad-sites/:id/downstream-price` | PUT | Set custom downstream prices | perm_admin |
| `/api/admin/downstreams` | GET/POST/PUT/DELETE | CRUD downstreams | perm_admin |
| `/api/admin/downstream-periods` | GET | List all periods | perm_admin |
| `/api/admin/downstream-periods/:id` | PUT/DELETE | Update/Delete period | perm_admin |
| `/api/downstream/:id/periods` | GET/POST | Get/Create periods for downstream | perm_admin |
| `/api/admin/ad-types` | GET | List ad types | perm_admin |
| `/api/users` | GET/POST | List/Create users | perm_admin |
| `/api/users/:id` | PUT/DELETE | Update/Delete user | perm_admin |

### Database Schema (Prisma Models)

```
AdType (id, code: SM|360|BAIDU_JS, name)
  └── Upstream (id, adTypeId, name, status)
        └── AdSite (id, upstreamId, name, billingMethod: CPM|RATIO, currentUnitPrice, currentRatio, status)
              ├── DailyInput (id, recordDate, adSiteId, qty, unitPriceSnapshot, amount1, amount2, ratioSnapshot, revenue, status, createdBy)
              └── AdSiteDownstream (id, adSiteId, downstreamId, customPrice) [junction]

Downstream (id, adTypeId, downstreamType: ML|LE|YIYI, payoutRate, status)
  └── DownstreamPeriod (id, downstreamId, pctHal, unitPrice, startDate, endDate, createdBy)

User (id, username, passwordHash, permDataInput, permDataConfirm, permAdmin, status)
```

### Authentication/Authorization

- **JWT tokens** with 8-hour expiry, stored in `localStorage`
- Three permission flags: `perm_data_input`, `perm_data_confirm`, `perm_admin`
- Middleware `requireAuth` verifies token; `requirePermission` checks specific flag
- 401 interceptor on frontend clears token and redirects to login

---

## 2. FRONTEND ARCHITECTURE

**Tech Stack:** React 18 + Vite + TanStack Query v5 + Ant Design + React Router v6

### Page Structure & Routing

```
/login                          → LoginPage (public)
/                                → AppLayout (protected shell)
  /dashboard/sm|360|baidu|other → DashboardPage (monthly revenue/cost/profit)
  /input/sm|360|baidu|other      → DailyInputPage (data entry tables)
  /upstream/sm|360|baidu|other   → UpstreamDashboardPage
  /downstream                    → DownstreamPage (list)
  /downstream/:id                → DownstreamSitesPage (per-site UV data)
  /admin                         → AdminPage (5-tab: AdSites/Upstreams/Downstreams/Periods/Users)
```

### State Management

- **TanStack Query** for all server state with 30s staleTime
- Local component state (`useState`) for UI drafts (dirty state in input tables)
- Token stored in `localStorage` via `axios` interceptor

### API Calling Patterns

```typescript
// TanStack Query usage
useQuery({
  queryKey: ['daily-input', 'SM', date, search],
  queryFn: () => api.get('/api/daily-input', { params: { date, ad_type, search } })
})

useMutation({
  mutationFn: (payload) => api.post('/api/daily-input/batch', payload),
  onSuccess: () => qc.invalidateQueries({ queryKey: ['daily-input', ...] })
})
```

---

## 3. CORE BUSINESS FLOWS

### Daily Data Input Flow

1. User selects date + ad type on `/input/{type}` page
2. Backend returns all active AdSites for that ad type, LEFT JOINED with any existing `DailyInput` records for that date
3. Frontend displays table grouped by upstream name
4. For **CPM billing (SM)**: user enters `qty` (impressions) and optionally overrides `unit_price` (admin only)
5. For **RATIO billing (360/Baidu)**: user enters `amount1` + `amount2`, ratio is applied
6. Revenue is calculated on frontend live: `qty * price` (CPM) or `(amount1 + amount2) * ratio` (RATIO)
7. On save, batch POST to `/api/daily-input/batch` with all dirty rows
8. Backend recalculates revenue using stored snapshot prices (or overrides)
9. **Cannot edit confirmed records** - API returns 409 error

### Dashboard Aggregation Logic

For each day in the selected month:
1. Group confirmed `DailyInput` records by `adSiteId`, sum revenue
2. Map each `adSiteId` back to its upstream name → produce `upstream_breakdown`
3. **ML payout** = `totalRevenue * 0.8` (or period's payoutRate if set)
4. For **SM only**: also calculate LE payout + yiyi payout
5. **Tax** = `(revenue - cost) * 0.06`
6. **Profit** = `revenue - cost - tax`
7. Append a "TOTAL" row summing all daily values

### Confirmation Flow

- **unconfirmed** → **confirmed**: User with `perm_data_confirm` clicks "Confirm" button on a row
- **confirmed** → **unconfirmed**: Same user clicks "Unconfirm"
- **Once confirmed**: record cannot be edited or deleted (backend enforces this)
- Daily inputs are only aggregated into dashboard if `status = confirmed`

### Admin Management Flows

- **Upstreams/Downstreams/AdSites**: Standard CRUD with active/inactive toggle
- **AdSites** have a billing method (CPM or RATIO) which determines which price fields are used
- **Downstream Periods**: Created with `start_date`. When a new period starts, the previous period's `end_date` is auto-set to day before. Periods with `endDate = NULL` are "current"
- **Users**: Created with three boolean permissions; passwords hashed with bcrypt

---

## 4. DATA MODEL RELATIONSHIPS

```
AdType (1) → (N) Upstream (1) → (N) AdSite (1) → (N) DailyInput
                                           ↘
                                            AdSiteDownstream → Downstream (1) → (N) DownstreamPeriod
```

### How Billing Methods Work

**CPM (SM type)**:
- `qty` = number of impressions/UV
- `unit_price_snapshot` = price per 1000 impressions (stored at input time)
- Revenue = `qty * unit_price_snapshot`
- Example: qty=10000, price=15 → revenue=150,000

**RATIO (360/Baidu type)**:
- `amount1` + `amount2` = base amounts (revenue figures)
- `ratio_snapshot` = multiplier applied (stored at input time)
- Revenue = `(amount1 + amount2) * ratio_snapshot`
- Example: amount1=50000, amount2=30000, ratio=0.4 → revenue=32,000

### Revenue/Cost/Profit Calculation Chain

```
DailyInput.revenue (from input, confirmed)
    ↓
Dashboard sums confirmed revenue → upstream_breakdown
    ↓
ML Payout = revenue * 0.8 (or downstream's payoutRate)
    ↓
For SM only:
  - LE Payout = (revenue * 0.9) - tax(6%) - ML_cost
  - yiyi Payout = qty * 2 / 1000
    ↓
Total Cost = ML + LE + yiyi (SM) or just ML (other types)
    ↓
Tax = (revenue - cost) * 0.06
    ↓
Profit = revenue - cost - tax
```

---

## 5. KEY BUSINESS RULES

### Edit vs Lock Rules

| Condition | Can Edit? | Can Delete? | Can Confirm? |
|-----------|----------|------------|--------------|
| `status = unconfirmed` | Yes | Yes | Yes (if has perm) |
| `status = confirmed` | No | No | N/A |
| Future date input | Blocked at API level | - | - |

### Period Pricing Logic

- When creating a new `DownstreamPeriod` for a downstream, the system:
  1. Rejects if `start_date` overlaps with an existing period
  2. Automatically closes the current active period (sets `endDate = start_date - 1 day`)
  3. Creates the new period with `endDate = NULL` (meaning "current")
- Prices are looked up by finding the period where `startDate <= targetDate AND (endDate IS NULL OR endDate >= targetDate)`

### Snapshot Price Preservation

When daily input is saved:
- **CPM**: stores `unitPriceSnapshot` (either from `currentUnitPrice` or an override). This snapshot is used for revenue calculation and remains fixed even if the site price changes later.
- **RATIO**: stores `ratioSnapshot` similarly. If `amount1` or `amount2` is entered without a ratio override, uses the current site's ratio.

### Permission Summary

| Permission | Grants Access To |
|------------|-----------------|
| `perm_data_input` | POST /api/daily-input/batch, DELETE daily-input/:id |
| `perm_data_confirm` | POST /api/daily-input/:id/confirm, /unconfirm |
| `perm_admin` | All admin CRUD endpoints, price updates, user management |

---

## 6. KEY FILE PATHS

### Backend
- `d:/Download/manager/kko/ad-management/src/index.ts` - Express app entry
- `d:/Download/manager/kko/ad-management/src/routes/admin.ts` - Admin/user/auth routes
- `d:/Download/manager/kko/ad-management/src/routes/dailyInput.ts` - Data input CRUD
- `d:/Download/manager/kko/ad-management/src/routes/dashboard.ts` - Monthly aggregation
- `d:/Download/manager/kko/ad-management/src/services/mlPayout.service.ts` - Cost calculation logic
- `d:/Download/manager/kko/ad-management/prisma/schema.prisma` - Full data model

### Frontend
- `d:/Download/manager/kko/ad-management/ads-management/src/App.tsx` - Route definitions
- `d:/Download/manager/kko/ad-management/ads-management/src/components/daily-input/SmInputTable.tsx` - CPM input table
- `d:/Download/manager/kko/ad-management/ads-management/src/pages/DashboardPage.tsx` - Monthly summary view
- `d:/Download/manager/kko/ad-management/ads-management/src/pages/AdminPage.tsx` - 5-tab admin panel
