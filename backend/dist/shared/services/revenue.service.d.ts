/**
 * Shared revenue calculation service.
 * All financial formulas live here — controllers call calculateRevenue().
 *
 * CPM:  baseRevenue = qty * unitPrice / 1000
 *       if rebateRate present: revenue = baseRevenue - (qty * rebateRate)
 *       else: revenue = baseRevenue
 * CPS:  revenue = (amount1 + amount2) * ratio
 * CPA:  revenue = qty * unitPrice
 */
export type BillingMethod = 'CPM' | 'CPS' | 'CPA';
export interface RevenueInput {
    billingMethod: string;
    qty?: number | null;
    unitPrice?: string | number | null;
    amount1?: string | number | null;
    amount2?: string | number | null;
    ratio?: string | number | null;
    /** CPM rebate rate (decimal, e.g. 0.001 for 0.1%). Omit for no rebate. */
    rebateRate?: number | null;
}
export declare function normalizeBillingMethod(m: string): BillingMethod;
export declare function calculateRevenue(input: RevenueInput): number;
export declare function buildRevenuePayload(input: RevenueInput): number;
//# sourceMappingURL=revenue.service.d.ts.map