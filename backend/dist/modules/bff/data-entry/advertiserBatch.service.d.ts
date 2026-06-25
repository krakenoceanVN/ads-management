/**
 * Phase 3B/3C: Advertiser Data Entry Write Service
 * Handles save batch, confirm batch, unconfirm single.
 *
 * CPM rebate:
 *   baseRevenue = qty * unitPrice / 1000
 *   if rebateRate exists: revenue = baseRevenue - (qty * rebateRate)
 *   else: revenue = baseRevenue
 *
 * Rebate source priority:
 *   1. Active AdSiteRebateRate (startDate <= recordDate <= endDate or endDate=null)
 *      latest startDate wins
 *   2. AdSite.rebateRate (Float)
 *   3. No rebate
 */
export interface AdvertiserBatchItem {
    adSiteId: string;
    recordDate: string;
    qty?: number;
    unitPrice?: string | number;
    amount1?: string | number;
    amount2?: string | number;
    ratio?: string | number;
    note?: string;
}
export interface AdvertiserBatchResult {
    success: boolean;
    saved: number;
    updated: number;
    skipped: number;
    errors: string[];
}
export interface UnconfirmResult {
    success: boolean;
    id: string;
    previousStatus: string;
    newStatus: string;
}
export declare function saveAdvertiserBatch(items: AdvertiserBatchItem[], userId: string): Promise<AdvertiserBatchResult>;
export declare function confirmAdvertiserBatch(recordDate: string, adSiteIds: string[], userId: string): Promise<{
    success: boolean;
    confirmed: number;
    errors: string[];
}>;
export declare function unconfirmAdvertiser(id: string, userId: string): Promise<UnconfirmResult>;
//# sourceMappingURL=advertiserBatch.service.d.ts.map