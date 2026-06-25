/**
 * Centralized Payout / Cost Calculation Service
 *
 * Implements confirmed payout/cost rules:
 * - Only ACTIVE downstreams (downstream.status = 'active') are included in cost
 * - resolveDownstreamRate is PER-DOWNSTREAM: each active junction resolves its own rate
 * - Rate priority for that same downstream:
 *   AdSiteDownstream.customPrice → DailyDownstreamRate.effectiveRate
 *   → DownstreamPeriod.unitPrice → Downstream.payoutRate
 * - pctHal: DownstreamPeriod.pctHal, stored as a decimal ratio in [0,1] (1.0=100%, 0.8=80%)
 * - Cost formulas: CPM / CPA / CPS each with shareRatio multiplier
 * - Tax: grossProfit > 0 ? grossProfit * 0.06 : 0 (clamped to 0 on a loss)
 * - Revenue: always from DailyInput.revenue (no recalculation)
 * - Profit: grossProfit = revenue - cost; net = grossProfit - tax
 * - Rounding: all financial output to 2 decimal places
 *
 * Used by: media settlement, total-profit, order-profit, dashboard
 */
import type { Prisma } from '@prisma/client';
import { type BillingMethod } from './revenue.service';
export declare const TAX_RATE = 0.06;
/**
 * Canonical convention (per schema: `pctHal Decimal @default(1.0)` — "tỷ lệ"):
 * pctHal is stored as a DECIMAL RATIO in [0, 1]  (1.0 = 100%, 0.8 = 80%, 0.5 = 50%).
 *
 * Normalization rules (single, unambiguous convention):
 *   - null/undefined/non-finite → 1.0 (100%, the schema default)
 *   - value < 0                 → 0   (invalid, no share)
 *   - 0 <= value <= 1           → use as-is  (decimal ratio; 0 means 0%)
 *   - value > 1                 → legacy/mis-entered percentage (e.g. 80) → /100, capped at 1.0
 *
 * Note: 1 resolves to 100% (ratio), consistent with the schema default of 1.0.
 */
export declare function normalizePctHal(raw: number | string | Prisma.Decimal | null | undefined): number;
export interface ResolvedRate {
    rate: number;
    source: 'customPrice' | 'DailyDownstreamRate' | 'DownstreamPeriod' | 'Downstream.payoutRate';
}
/**
 * Resolve payout rate for a specific downstream of a given adSite + date.
 * Rate priority for that SAME downstream:
 *   1. AdSiteDownstream.customPrice  (this adSiteId + downstreamId junction)
 *   2. DailyDownstreamRate.effectiveRate  (this downstreamId / date)
 *   3. DownstreamPeriod.unitPrice  (this downstreamId / active on recordDate)
 *   4. Downstream.payoutRate  (this downstreamId / active only)
 * Throws if no rate is found.
 */
export declare function resolveDownstreamRate(adSiteId: string, downstreamId: string, recordDate: Date): Promise<ResolvedRate>;
/**
 * Calculate downstream cost for a single DailyInput record.
 * billingMethod comes from the AdSite (already queried).
 * shareRatio comes from DownstreamPeriod.pctHal.
 *
 * CPM:  cost = qty * rate / 1000 * shareRatio
 * CPA:  cost = qty * rate * shareRatio
 * CPS:  cost = (amount1 + amount2) * rate * shareRatio
 */
export declare function calculateCost(billingMethod: BillingMethod, qty: number, rate: number, shareRatio: number, amount1?: number, amount2?: number): number;
export interface ProfitResult {
    revenue: number;
    cost: number;
    grossProfit: number;
    tax: number;
    profit: number;
    profitRate: number;
}
/**
 * Calculate profit breakdown from pre-aggregated revenue and cost sums.
 */
export declare function calculateProfit(revenue: number, cost: number): ProfitResult;
export interface DailyInputWithSite extends Prisma.DailyInputGetPayload<{
    include: {
        adSite: {
            include: {
                downstreams: {
                    include: {
                        downstream: true;
                    };
                };
            };
        };
    };
}> {
}
export interface CostAggregation {
    totalCost: number;
    unresolvedCount: number;
    errors: string[];
}
/**
 * Aggregate total downstream cost for an array of DailyInput records.
 * Only ACTIVE downstreams are included (downstream.status = 'active').
 * Each active AdSiteDownstream junction resolves its OWN rate via resolveDownstreamRate,
 * then cost is calculated and summed — so multiple active downstreams each contribute
 * their own cost, not a single shared rate.
 * If no active downstream resolves a rate, the record contributes 0 cost.
 */
export declare function aggregateDownstreamCost(inputs: DailyInputWithSite[]): Promise<CostAggregation>;
//# sourceMappingURL=payout.service.d.ts.map