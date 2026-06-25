/**
 * Phase 3B/3C: Media Data Entry Write Service
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
export interface MediaBatchItem {
    adSiteId: string;
    recordDate: string;
    qty?: number;
    unitPrice?: string | number;
    amount1?: string | number;
    amount2?: string | number;
    ratio?: string | number;
    note?: string;
}
export interface MediaBatchResult {
    success: boolean;
    saved: number;
    updated: number;
    skipped: number;
    errors: string[];
}
export declare function saveMediaBatch(items: MediaBatchItem[], userId: string): Promise<MediaBatchResult>;
export declare function confirmMediaBatch(recordDate: string, adSiteIds: string[], userId: string): Promise<{
    success: boolean;
    confirmed: number;
    errors: string[];
}>;
export declare function unconfirmMedia(id: string, userId: string): Promise<{
    success: boolean;
    id: string;
    previousStatus: string;
    newStatus: string;
}>;
//# sourceMappingURL=mediaBatch.service.d.ts.map