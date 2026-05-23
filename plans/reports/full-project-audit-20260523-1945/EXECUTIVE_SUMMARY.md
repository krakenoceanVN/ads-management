# Project Audit Report — 2026-05-23

## Overall Verdict: **PASS WITH RISKS**

The project has significant business logic correctness issues (especially in daily input revenue/amount computation), an incomplete RBAC migration that causes 32 TypeScript errors in the backend, and several data integrity concerns. However, the frontend builds cleanly, the schema is valid, and the RBAC model itself is sound. Production deployment is **NOT recommended** until P0 and P1 issues are resolved.

---

## Top 10 Risks

| # | Risk | Severity | Area |
|---|------|----------|------|
| 1 | DailyInput revenue/amount fields accept arbitrary values — no formula enforcement | P0 | Data Integrity |
| 2 | AdId/AdSite can be created without valid active AdOrder — virtual order bypass | P0 | Data Integrity |
| 3 | Backend has 32 TypeScript errors — `roleRef` references on Prisma-generated types | P1 | Backend/TypeScript |
| 4 | LE payout date range bug — `getActivePeriodForDate` uses `>=` on endDate | P1 | Reports |
| 5 | AdSite `adOrderId` nullable without business logic enforcement | P1 | Data Model |
| 6 | User roleId and legacy role field can diverge after update | P1 | Auth/RBAC |
| 7 | Settlement/Approval APIs have no explicit permission enforcement | P1 | Auth |
| 8 | Dashboard monthly route uses `defaultingDownstream` from undefined import | P2 | Backend |
| 9 | `requireWriteAccess` does not use RBAC permission — checks legacy `VIEWER` only | P2 | Auth |
| 10 | AdId controller uses `requirePermission("perm_admin")` instead of RBAC key | P2 | Auth |

---

## Production Readiness Summary

| Check | Status |
|-------|--------|
| Prisma schema valid | ✅ PASS |
| Frontend TypeScript | ✅ PASS (0 errors) |
| Frontend build | ✅ PASS (337 KB) |
| Backend TypeScript | ❌ FAIL (32 errors) |
| Auth/RBAC integrity | ⚠️ INCOMPLETE |
| Report formula correctness | ⚠️ AUDITED — ISSUES FOUND |
| Data integrity (schema) | ⚠️ AUDITED — ISSUES FOUND |

---

## Recommended Next Action

Fix in priority order:
1. **P0**: Resolve the revenue/amount field computation in DailyInput data entry — determine who computes `revenue`, `amount1`, `amount2` and enforce it in the service layer.
2. **P1**: Fix all 32 TypeScript backend errors (regenerate Prisma client with `--no-generate` or add proper type overrides).
3. **P1**: Audit and enforce AdOrder validity requirement in AdId/AdSite creation flows.
4. **P1**: Verify and fix the LE payout date boundary bug.

All fixes must be verified with `npx prisma validate`, `npx tsc --noEmit` (backend), and `npm run build` (frontend) before any commit.