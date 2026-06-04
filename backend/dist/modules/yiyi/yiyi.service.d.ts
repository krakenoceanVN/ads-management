/**
 * Phase 6A: Yiyi Data Service
 *
 * Handles GET daily, GET monthly, and POST batch for Yiyi data.
 * Not under /api/bff — mounted directly at /api/yiyi-data
 *
 * Fixed channels: yy-02-01, yy-02-02, yy-02-03, yy-02-04
 *
 * GET daily: returns all 4 channels for a date, qty=0 if missing
 * GET monthly: returns all days of the month with channel data
 * POST batch: upserts YiyiDailyData (channel qty) and YiyiDailyPricing (pricing)
 */
export declare const YIYI_CHANNELS: readonly ["yy-02-01", "yy-02-02", "yy-02-03", "yy-02-04"];
export type YiyiChannel = typeof YIYI_CHANNELS[number];
export interface YiyiDailyRow {
    channel: string;
    qty: number;
    unitPrice?: number;
    profitUnitPrice?: number;
}
export interface YiyiMonthlyRow {
    date: string;
    unit_price: number;
    profit_unit_price: number;
    'yy-02-01': number;
    'yy-02-02': number;
    'yy-02-03': number;
    'yy-02-04': number;
}
export interface BatchItem {
    channel: string;
    qty: number;
    unitPrice?: number;
    profitUnitPrice?: number;
}
export declare function getYiyiDaily(date: string): Promise<YiyiDailyRow[]>;
export declare function getYiyiMonthly(year: number, month: number): Promise<YiyiMonthlyRow[]>;
export interface BatchResult {
    savedData: number;
    savedPricing: boolean;
    errors: string[];
}
export declare function saveYiyiBatch(date: string, items: BatchItem[], pricing?: {
    unitPrice?: number;
    profitUnitPrice?: number;
}): Promise<BatchResult>;
//# sourceMappingURL=yiyi.service.d.ts.map