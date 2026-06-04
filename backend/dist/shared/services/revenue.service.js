"use strict";
/**
 * Shared revenue calculation service.
 * All financial formulas live here — controllers call calculateRevenue().
 *
 * CPM:  baseRevenue = qty * unitPrice / 1000
 *       if rebateRate present: revenue = baseRevenue - (qty * rebateRate)
 *       else: revenue = baseRevenue
 * CPS:  revenue = (amount1 + amount2) * ratio   (RATIO is legacy alias)
 * CPA:  revenue = qty * unitPrice
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeBillingMethod = normalizeBillingMethod;
exports.calculateRevenue = calculateRevenue;
exports.buildRevenuePayload = buildRevenuePayload;
function normalizeBillingMethod(m) {
    if (m === 'RATIO')
        return 'CPS';
    return m;
}
function toNum(v) {
    if (v == null)
        return 0;
    if (typeof v === 'number')
        return v;
    return parseFloat(v) || 0;
}
function calculateRevenue(input) {
    const { billingMethod, qty, unitPrice, amount1, amount2, ratio, rebateRate } = input;
    const bm = normalizeBillingMethod(billingMethod);
    switch (bm) {
        case 'CPM': {
            const q = toNum(qty);
            const p = toNum(unitPrice);
            const baseRevenue = q * p / 1000;
            if (rebateRate != null && rebateRate > 0) {
                const rebateAmount = q * rebateRate;
                return baseRevenue - rebateAmount;
            }
            return baseRevenue;
        }
        case 'CPS': {
            const a1 = toNum(amount1);
            const a2 = toNum(amount2);
            const r = toNum(ratio);
            return (a1 + a2) * r;
        }
        case 'CPA': {
            const q = toNum(qty);
            const p = toNum(unitPrice);
            return q * p;
        }
        default:
            return 0;
    }
}
function buildRevenuePayload(input) {
    return calculateRevenue(input);
}
//# sourceMappingURL=revenue.service.js.map