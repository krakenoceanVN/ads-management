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
/**
 * Calculate total Yiyi cost for a given date range.
 * yiyiCost = SUM(dayTraffic / 1000 * (unitPrice + profitUnitPrice))
 * where dayTraffic = yy-02-01 + yy-02-02 + yy-02-03 + yy-02-04
 *
 * Yiyi is a standalone source (YiyiDailyData/YiyiDailyPricing), NOT in DailyInput.
 * Added as downstream YIYI cost for SM profit report Excel parity.
 */
export declare function computeYiyiCost(year: number, month: number): Promise<{
    totalYiyiCost: number;
    yiyiByDate: Map<string, number>;
}>;
export interface TotalProfitParams {
    date?: string;
    startDate?: string;
    endDate?: string;
    advertiserId?: number;
    upstreamId?: number;
    adTypeCode?: string;
}
export interface TotalProfitRow {
    date: string;
    upstreamId: number;
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
    advertiserId?: number;
    upstreamId?: number;
    adTypeCode?: string;
}
export interface OrderProfitRow {
    date: string;
    orderId: number | null;
    orderName: string | null;
    upstreamId: number;
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