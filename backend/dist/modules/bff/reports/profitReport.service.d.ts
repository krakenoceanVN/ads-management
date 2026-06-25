/**
 * Profit Report Service
 *
 * Implements:
 * - GET total-profit: daily aggregated profit across upstreams
 * - GET order-profit: per-order profit report
 *
 * Revenue always from DailyInput.revenue (no recalculation).
 * Cost calculated via payout.service aggregateDownstreamCost().
 * Tax applied per confirmed rules.
 */
export declare function computeYiyiCost(year: number, month: number): Promise<{
    totalYiyiCost: number;
    yiyiByDate: Map<string, number>;
}>;
export interface TotalProfitParams {
    date?: string;
    startDate?: string;
    endDate?: string;
    advertiserId?: string;
    upstreamId?: string;
    adTypeCode?: string;
}
export interface TotalProfitRow {
    date: string;
    upstreamId: string;
    upstream: string;
    billingMethod: string;
    qty: number;
    revenue: number;
    cost: number;
    grossProfit: number;
    tax: number;
    profit: number;
    profitRate: number;
    recordCount: number;
}
export declare function getTotalProfit(params: TotalProfitParams): Promise<TotalProfitRow[]>;
export interface OrderProfitParams {
    date?: string;
    startDate?: string;
    endDate?: string;
    advertiserId?: string;
    upstreamId?: string;
    adTypeCode?: string;
}
export interface OrderProfitRow {
    date: string;
    orderId: number | null;
    orderName: string | null;
    adTypeCode: string | null;
    adTypeName: string | null;
    upstreamId: string;
    upstream: string;
    billingMethod: string;
    qty: number;
    revenue: number;
    cost: number;
    grossProfit: number;
    tax: number;
    profit: number;
    profitRate: number;
    recordCount: number;
}
export declare function getOrderProfit(params: OrderProfitParams): Promise<OrderProfitRow[]>;
//# sourceMappingURL=profitReport.service.d.ts.map