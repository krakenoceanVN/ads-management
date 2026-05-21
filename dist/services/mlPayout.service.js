"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateCostBreakdownMonthly = calculateCostBreakdownMonthly;
exports.calculateMLPayout = calculateMLPayout;
exports.calculateLEPayout = calculateLEPayout;
exports.calculateYiyiPayout = calculateYiyiPayout;
exports.calculateCostBreakdown = calculateCostBreakdown;
const date_js_1 = require("../utils/date.js");
const constants_js_1 = require("../utils/constants.js");
const calculations_js_1 = require("../utils/calculations.js");
const yiyiPricing_service_js_1 = require("./yiyiPricing.service.js");
/** Convert "YYYY-MM-DD" → { startOfDay, endOfDay } in business TZ */
function dateRange(dateStr) {
    return (0, date_js_1.getBusinessDayRange)(dateStr);
}
/**
 * Optimized: calculate monthly cost breakdown in 3 queries total (vs 30*7 queries).
 * Uses Prisma groupBy to fetch all daily aggregates in bulk, then computes in-memory.
 */
async function calculateCostBreakdownMonthly(year, month, adTypeCode, prisma) {
    const adTypeId = constants_js_1.AD_TYPE_ID_MAP[adTypeCode];
    const { gte, lt } = (0, date_js_1.getBusinessMonthRange)(year, month);
    // 1. Batch: confirmed DailyInput aggregates grouped by date, per adTypeId
    const revenueByDate = await prisma.dailyInput.groupBy({
        by: ["recordDate"],
        where: {
            recordDate: { gte, lt },
            status: "confirmed",
            adSite: {
                isArchived: false,
                upstream: {
                    adTypeId,
                    status: "active",
                },
            },
        },
        _sum: { revenue: true, qty: true },
    });
    // Build lookup maps
    const revenueMap = new Map();
    const qtyMap = new Map();
    for (const row of revenueByDate) {
        const dateStr = (0, date_js_1.formatBusinessDate)(row.recordDate);
        revenueMap.set(dateStr, Number(row._sum.revenue ?? 0));
        qtyMap.set(dateStr, Number(row._sum.qty ?? 0));
    }
    // 2. Batch: all active downstream periods for the month
    const downstreamPeriods = await prisma.downstreamPeriod.findMany({
        where: {
            downstream: { adTypeId, status: "active" },
            startDate: { lte: lt },
            OR: [{ endDate: null }, { endDate: { gte: gte } }],
        },
        include: { downstream: true },
        orderBy: { startDate: "desc" },
    });
    const mlPeriod = downstreamPeriods.find((p) => p.downstream.downstreamType === "ML");
    const lePeriod = downstreamPeriods.find((p) => p.downstream.downstreamType === "LE");
    const mlRate = Number(mlPeriod?.downstream.payoutRate ?? calculations_js_1.DEFAULT_ML_PAYOUT_RATE);
    const leRate = Number(lePeriod?.downstream.payoutRate ?? calculations_js_1.DEFAULT_LE_PAYOUT_RATE);
    const leUnitPrice = Number(lePeriod?.unitPrice ?? calculations_js_1.DEFAULT_LE_UNIT_PRICE);
    // 3. Batch: all yiyi daily data for the month
    const yiyiByDate = new Map();
    if (adTypeCode === "SM") {
        const yiyiRecords = await prisma.yiyiDailyData.findMany({
            where: { recordDate: { gte, lt } },
        });
        for (const rec of yiyiRecords) {
            const dateStr = (0, date_js_1.formatBusinessDate)(rec.recordDate);
            yiyiByDate.set(dateStr, (yiyiByDate.get(dateStr) ?? 0) + rec.qty);
        }
        const pricing = await (0, yiyiPricing_service_js_1.getYiyiDailyPricing)(`${year}-${String(month).padStart(2, "0")}-01`, prisma);
        const days = (0, date_js_1.getDaysInMonth)(year, month);
        const results = new Map();
        for (const dayStr of days) {
            const totalRevenue = revenueMap.get(dayStr) ?? 0;
            const totalQty = qtyMap.get(dayStr) ?? 0;
            const uv = yiyiByDate.get(dayStr) ?? totalQty;
            const mlPayout = (0, calculations_js_1.calculateMlPayoutAmount)(totalRevenue, mlRate);
            const leRevenue = (0, calculations_js_1.calculateLeRevenueFromSmRevenue)(totalRevenue, leRate);
            const leMlCost = (0, calculations_js_1.calculateUnitPricePayout)(totalQty, leUnitPrice);
            const leTax = (0, calculations_js_1.calculateTaxOnMargin)(leRevenue, leMlCost);
            const lePayout = (0, calculations_js_1.calculateNetProfit)(leRevenue, leMlCost, leTax);
            const yiyiPayout = (0, calculations_js_1.calculateYiyiAmount)(uv, pricing.unitPrice);
            const cost = (0, calculations_js_1.calculateSmServiceCost)(mlPayout, lePayout, yiyiPayout);
            const tax = (0, calculations_js_1.calculateTaxOnMargin)(totalRevenue, cost);
            const profit = (0, calculations_js_1.calculateNetProfit)(totalRevenue, cost, tax);
            const profit_rate = (0, calculations_js_1.calculateProfitRate)(profit, totalRevenue);
            results.set(dayStr, {
                revenue: totalRevenue,
                ml_payout: mlPayout,
                le_payout: lePayout,
                yiyi_payout: yiyiPayout,
                cost,
                tax,
                profit,
                profit_rate,
            });
        }
        return results;
    }
    // Non-SM: just ML payout
    const results = new Map();
    for (const [dateStr, totalRevenue] of revenueMap) {
        const mlPayout = (0, calculations_js_1.calculateMlPayoutAmount)(totalRevenue, mlRate);
        const cost = mlPayout;
        const tax = (0, calculations_js_1.calculateTaxOnMargin)(totalRevenue, cost);
        const profit = (0, calculations_js_1.calculateNetProfit)(totalRevenue, cost, tax);
        const profit_rate = (0, calculations_js_1.calculateProfitRate)(profit, totalRevenue);
        results.set(dateStr, {
            revenue: totalRevenue,
            ml_payout: mlPayout,
            cost,
            tax,
            profit,
            profit_rate,
        });
    }
    return results;
}
// ============================================================
// ML Payout — ALL ad types, ALWAYS ×0.8
// ============================================================
async function calculateMLPayout(date, adTypeCode, prisma) {
    const adTypeId = constants_js_1.AD_TYPE_ID_MAP[adTypeCode];
    // 1. Sum confirmed revenue for this ad_type on this date
    const result = await prisma.dailyInput.aggregate({
        where: {
            recordDate: dateRange(date),
            status: "confirmed",
            adSite: {
                isArchived: false,
                upstream: {
                    adTypeId: adTypeId,
                    status: "active",
                },
            },
        },
        _sum: { revenue: true },
    });
    const totalRevenue = result._sum.revenue ?? 0;
    // 2. Get ML downstream period active on this date
    const downstream = await prisma.downstreamPeriod.findFirst({
        where: {
            downstream: {
                adTypeId: adTypeId,
                downstreamType: "ML",
                status: "active",
            },
            startDate: { lte: new Date(date) },
            OR: [
                { endDate: null },
                { endDate: { gte: new Date(date) } },
            ],
        },
        include: { downstream: true },
        orderBy: { startDate: "desc" },
    });
    // 3. ML payout = total × payout_rate (always 0.8)
    const payoutRate = Number(downstream?.downstream.payoutRate ?? calculations_js_1.DEFAULT_ML_PAYOUT_RATE);
    const mlPayout = (0, calculations_js_1.calculateMlPayoutAmount)(Number(totalRevenue), payoutRate);
    return {
        total_revenue: Number(totalRevenue),
        ml_payout: mlPayout,
        payout_rate: Number(payoutRate),
    };
}
// ============================================================
// LE Payout — SM ONLY
// LE payout = SM_revenue × payout_rate - tax(net) - ML_cost
// tax = (LE_revenue - ML_cost) × 0.06
// ML_cost = SM_qty × unit_price / 1000
// ============================================================
async function calculateLEPayout(date, smUpstreamRevenue, prisma) {
    // 1. Get LE downstream period
    const lePeriod = await prisma.downstreamPeriod.findFirst({
        where: {
            downstream: {
                adTypeId: constants_js_1.AD_TYPE_ID_MAP.SM,
                downstreamType: "LE",
                status: "active",
            },
            startDate: { lte: new Date(date) },
            OR: [
                { endDate: null },
                { endDate: { gte: new Date(date) } },
            ],
        },
        include: { downstream: true },
        orderBy: { startDate: "desc" },
    });
    // LE revenue from upstream
    const lePayoutRate = Number(lePeriod?.downstream.payoutRate ?? calculations_js_1.DEFAULT_LE_PAYOUT_RATE);
    const leRevenue = (0, calculations_js_1.calculateLeRevenueFromSmRevenue)(smUpstreamRevenue, lePayoutRate);
    // 2. Get total SM qty for ML cost calculation
    const qtyResult = await prisma.dailyInput.aggregate({
        where: {
            recordDate: dateRange(date),
            status: "confirmed",
            adSite: {
                isArchived: false,
                upstream: {
                    adTypeId: constants_js_1.AD_TYPE_ID_MAP.SM,
                    status: "active",
                },
            },
        },
        _sum: { qty: true },
    });
    const totalQty = qtyResult._sum.qty ?? 0;
    const mlUnitPrice = Number(lePeriod?.unitPrice ?? calculations_js_1.DEFAULT_LE_UNIT_PRICE);
    const leMlCost = (0, calculations_js_1.calculateUnitPricePayout)(Number(totalQty), mlUnitPrice);
    // 3. Tax = (revenue - ML_cost) × 0.06, then LE = revenue - tax - ML_cost
    const leTax = (0, calculations_js_1.calculateTaxOnMargin)(leRevenue, leMlCost);
    return (0, calculations_js_1.calculateNetProfit)(leRevenue, leMlCost, leTax);
}
// ============================================================
// yiyi Payout — SM ONLY
// Priority: YiyiDailyData if available, else fallback to UV from DailyInput
// Formula: SUM(qty across channels) × unit_price / 1000
// ============================================================
async function calculateYiyiPayout(dateStr, totalUV, prisma) {
    const { gte: startOfDay, lt: endOfDay } = dateRange(dateStr);
    const pricing = await (0, yiyiPricing_service_js_1.getYiyiDailyPricing)(dateStr, prisma);
    const yiyiRecords = await prisma.yiyiDailyData.findMany({
        where: {
            recordDate: { gte: startOfDay, lt: endOfDay },
        },
    });
    if (yiyiRecords.length > 0) {
        const totalQty = yiyiRecords.reduce((s, r) => s + r.qty, 0);
        return (0, calculations_js_1.calculateYiyiAmount)(totalQty, pricing.unitPrice);
    }
    // Fallback: use UV from DailyInput
    return (0, calculations_js_1.calculateYiyiAmount)(totalUV, pricing.unitPrice);
}
async function calculateCostBreakdown(date, adTypeCode, prisma) {
    const mlResult = await calculateMLPayout(date, adTypeCode, prisma);
    const { total_revenue, ml_payout } = mlResult;
    let lePayout;
    let yiyiPayout;
    if (adTypeCode === "SM") {
        // For SM: LE payout uses SM upstream revenue (sum of all upstream revenues)
        lePayout = await calculateLEPayout(date, total_revenue, prisma);
        // yiyi = total UV × 2/1000 — UV is the sum of qty for SM
        // (qty represents UV/impressions in SM billing)
        const uvResult = await prisma.dailyInput.aggregate({
            where: {
                recordDate: dateRange(date),
                status: "confirmed",
                adSite: {
                    isArchived: false,
                    upstream: {
                        adTypeId: constants_js_1.AD_TYPE_ID_MAP.SM,
                        status: "active",
                    },
                },
            },
            _sum: { qty: true },
        });
        yiyiPayout = await calculateYiyiPayout(date, Number(uvResult._sum.qty ?? 0), prisma);
    }
    const cost = adTypeCode === "SM"
        ? (0, calculations_js_1.calculateSmServiceCost)(ml_payout, lePayout ?? 0, yiyiPayout ?? 0)
        : ml_payout;
    const tax = (0, calculations_js_1.calculateTaxOnMargin)(total_revenue, cost);
    const profit = (0, calculations_js_1.calculateNetProfit)(total_revenue, cost, tax);
    const profit_rate = (0, calculations_js_1.calculateProfitRate)(profit, total_revenue);
    return {
        revenue: total_revenue,
        ml_payout,
        le_payout: lePayout,
        yiyi_payout: yiyiPayout,
        cost,
        tax,
        profit,
        profit_rate,
    };
}
