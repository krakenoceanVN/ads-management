/**
 * Phase 4B1/4B2: Settlement Service
 *
 * Advertiser settlement:
 * - confirmed DailyInput only
 * - exclude quarantined
 * - amount = SUM(DailyInput.revenue)
 * - group by advertiser / upstream
 * - DailyInput.revenue is source of truth (no recalculation)
 * - No payout rate logic
 *
 * Media settlement (Phase 4B2):
 * - confirmed DailyInput only
 * - exclude quarantined
 * - one row per media (upstream); revenue counted ONCE per DailyInput
 * - cost = SUM(resolved downstream costs) for all active downstreams of that media
 * - grossProfit = revenue - cost
 * - tax = grossProfit > 0 ? grossProfit * 0.06 : 0
 * - profit = grossProfit - tax
 * - profitRate = profit / revenue
 * - Revenue always from DailyInput.revenue (no recalculation)
 */
export interface AdvertiserSettlementParams {
    period?: string;
    advertiserId?: number;
    adTypeCode?: string;
}
export interface AdvertiserSettlementRow {
    advertiserId: number;
    advertiser: string;
    adTypeCode: string | null;
    adTypeName: string | null;
    totalAmount: number;
    recordCount: number;
}
export declare function getAdvertiserSettlement(params: AdvertiserSettlementParams): Promise<AdvertiserSettlementRow[]>;
export interface MediaSettlementParams {
    period?: string;
    mediaId?: number;
    adTypeCode?: string;
}
export interface MediaSettlementRow {
    mediaId: number;
    media: string;
    adTypeCode: string | null;
    adTypeName: string | null;
    downstreamName: string | null;
    revenue: number;
    cost: number;
    grossProfit: number;
    tax: number;
    profit: number;
    profitRate: number;
    recordCount: number;
}
export declare function getMediaSettlement(params: MediaSettlementParams): Promise<MediaSettlementRow[]>;
//# sourceMappingURL=settlement.service.d.ts.map