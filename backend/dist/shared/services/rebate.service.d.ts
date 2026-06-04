/**
 * Rebate rate resolution service.
 *
 * Priority for CPM rebate:
 * 1. Active AdSiteRebateRate for the recordDate
 *    (startDate <= recordDate AND (endDate IS NULL OR endDate >= recordDate))
 *    Latest startDate wins when multiple match
 * 2. Fallback: AdSite.rebateRate (Float)
 * 3. None: returns null (no rebate)
 */
export interface RebateRateResult {
    rate: number | null;
    source: 'AdSiteRebateRate' | 'AdSite.rebateRate' | null;
}
/**
 * Resolve the effective rebate rate for an AdSite on a given recordDate.
 */
export declare function resolveRebateRate(adSiteId: number, recordDate: Date): Promise<RebateRateResult>;
//# sourceMappingURL=rebate.service.d.ts.map