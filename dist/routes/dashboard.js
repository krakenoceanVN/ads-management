"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const prisma_js_1 = __importDefault(require("../prisma.js"));
const auth_js_1 = require("../middleware/auth.js");
const date_js_1 = require("../utils/date.js");
const constants_js_1 = require("../utils/constants.js");
const calculations_js_1 = require("../utils/calculations.js");
const router = (0, express_1.Router)();
// ============================================================
// Helpers
// ============================================================
function getDaysInMonth(year, month) {
    const days = [];
    const date = new Date(year, month - 1, 1);
    while (date.getMonth() === month - 1) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, "0");
        const d = String(date.getDate()).padStart(2, "0");
        days.push(`${y}-${m}-${d}`);
        date.setDate(date.getDate() + 1);
    }
    return days;
}
function finalizeUpstreamDetailBreakdown(metrics) {
    const result = {};
    for (const [name, metric] of Object.entries(metrics)) {
        const pv = metric.pv ?? 0;
        const amount = metric.amount ?? 0;
        result[name] = {
            pv,
            amount,
            unit_price: pv > 0 ? (amount / pv) * 1000 : 0,
        };
    }
    return result;
}
function buildMonthlyTotal(rows) {
    const revenue = rows.reduce((s, r) => s + r.revenue, 0);
    const cost = rows.reduce((s, r) => s + r.cost, 0);
    const tax = rows.reduce((s, r) => s + r.tax, 0);
    const profit = (0, calculations_js_1.calculateNetProfit)(revenue, cost, tax);
    const mlPayout = rows.reduce((s, r) => s + r.ml_payout, 0);
    const lePayout = rows.reduce((s, r) => s + (r.le_payout ?? 0), 0);
    const yiyiPayout = rows.reduce((s, r) => s + (r.yiyi_payout ?? 0), 0);
    const upstreamBreakdown = {};
    const upstreamDetailBreakdown = {};
    for (const r of rows) {
        for (const [k, v] of Object.entries(r.upstream_breakdown)) {
            upstreamBreakdown[k] = (upstreamBreakdown[k] ?? 0) + v;
        }
        for (const [k, v] of Object.entries(r.upstream_detail_breakdown ?? {})) {
            const current = upstreamDetailBreakdown[k] ?? { pv: 0, unit_price: 0, amount: 0 };
            current.pv += v.pv ?? 0;
            current.amount += v.amount ?? 0;
            upstreamDetailBreakdown[k] = current;
        }
    }
    const finalizedUpstreamDetailBreakdown = Object.keys(upstreamDetailBreakdown).length > 0
        ? finalizeUpstreamDetailBreakdown(upstreamDetailBreakdown)
        : undefined;
    return {
        date: "TOTAL",
        revenue,
        cost,
        tax,
        profit,
        profit_rate: (0, calculations_js_1.calculateProfitRate)(profit, revenue),
        upstream_breakdown: upstreamBreakdown,
        upstream_detail_breakdown: finalizedUpstreamDetailBreakdown,
        ml_payout: mlPayout,
        le_payout: lePayout > 0 ? lePayout : undefined,
        yiyi_payout: yiyiPayout > 0 ? yiyiPayout : undefined,
    };
}
function groupDailyInputsByBusinessDate(inputs) {
    const grouped = new Map();
    for (const input of inputs) {
        const date = (0, date_js_1.formatBusinessDate)(input.recordDate);
        const current = grouped.get(date) ?? [];
        current.push(input);
        grouped.set(date, current);
    }
    return grouped;
}
function groupNumbersByBusinessDate(rows) {
    const grouped = new Map();
    for (const row of rows) {
        const date = (0, date_js_1.formatBusinessDate)(row.recordDate);
        grouped.set(date, (grouped.get(date) ?? 0) + row.value);
    }
    return grouped;
}
function groupPricingByBusinessDate(rows) {
    const grouped = new Map();
    for (const row of rows) {
        grouped.set((0, date_js_1.formatBusinessDate)(row.recordDate), Number(row.unitPrice ?? calculations_js_1.YIYI_DEFAULT_UNIT_PRICE));
    }
    return grouped;
}
function buildPeriodMap(periods) {
    const map = new Map();
    for (const period of periods) {
        const current = map.get(period.downstreamId) ?? [];
        current.push(period);
        map.set(period.downstreamId, current);
    }
    for (const rows of map.values()) {
        rows.sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
    }
    return map;
}
function getActivePeriodForDate(periods, date) {
    if (!periods || periods.length === 0)
        return undefined;
    const currentDate = new Date(date);
    return periods.find((period) => period.startDate <= currentDate &&
        (period.endDate === null || period.endDate >= currentDate));
}
function calculateDownstreamSiteValue(quantity, unitPrice) {
    return quantity * unitPrice;
}
const handleValidation = (req, res, next) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ success: false, error: errors.array()[0].msg });
        return;
    }
    next();
};
// ============================================================
// GET /api/dashboard/monthly
// Query: year, month (1-12), ad_type (SM|360|BAIDU_JS|OTHER)
// ============================================================
router.get("/monthly", auth_js_1.requireAuth, [
    (0, express_validator_1.query)("year").notEmpty().withMessage("year is required").isInt({ min: 2020, max: 2100 }).toInt(),
    (0, express_validator_1.query)("month").notEmpty().withMessage("month is required").isInt({ min: 1, max: 12 }).toInt(),
    (0, express_validator_1.query)("ad_type").notEmpty().withMessage("ad_type is required").isIn(["SM", "360", "BAIDU_JS", "OTHER"]),
], handleValidation, async (req, res) => {
    try {
        const year = Number(req.query.year);
        const month = Number(req.query.month);
        const adTypeCode = req.query.ad_type;
        const adTypeId = constants_js_1.AD_TYPE_ID_MAP[adTypeCode];
        const days = getDaysInMonth(year, month);
        const { gte: startOfMonth, lt: endOfMonth } = (0, date_js_1.getBusinessMonthRange)(year, month);
        const [activeUpstreams, monthlyInputs, mlPeriods, lePeriods, yiyiData, yiyiPricing] = await Promise.all([
            adTypeCode === "360"
                ? prisma_js_1.default.upstream.findMany({
                    where: {
                        adTypeId,
                        status: "active",
                    },
                    select: { name: true },
                    orderBy: { name: "asc" },
                })
                : Promise.resolve([]),
            prisma_js_1.default.dailyInput.findMany({
                where: {
                    recordDate: { gte: startOfMonth, lt: endOfMonth },
                    status: "confirmed",
                    adSite: {
                        isArchived: false,
                        upstream: {
                            adTypeId,
                            status: "active",
                        },
                    },
                },
                select: {
                    recordDate: true,
                    revenue: true,
                    qty: true,
                    adSiteId: true,
                    adSite: {
                        select: {
                            upstream: {
                                select: { name: true },
                            },
                        },
                    },
                },
            }),
            prisma_js_1.default.downstreamPeriod.findMany({
                where: {
                    downstream: {
                        adTypeId,
                        downstreamType: "ML",
                        status: "active",
                    },
                    startDate: { lte: endOfMonth },
                    OR: [{ endDate: null }, { endDate: { gte: startOfMonth } }],
                },
                include: {
                    downstream: {
                        select: { payoutRate: true },
                    },
                },
            }),
            adTypeCode === "SM"
                ? prisma_js_1.default.downstreamPeriod.findMany({
                    where: {
                        downstream: {
                            adTypeId: constants_js_1.AD_TYPE_ID_MAP.SM,
                            downstreamType: "LE",
                            status: "active",
                        },
                        startDate: { lte: endOfMonth },
                        OR: [{ endDate: null }, { endDate: { gte: startOfMonth } }],
                    },
                    include: {
                        downstream: {
                            select: { payoutRate: true },
                        },
                    },
                })
                : Promise.resolve([]),
            adTypeCode === "SM"
                ? prisma_js_1.default.yiyiDailyData.findMany({
                    where: {
                        recordDate: { gte: startOfMonth, lt: endOfMonth },
                    },
                    select: {
                        recordDate: true,
                        qty: true,
                    },
                })
                : Promise.resolve([]),
            adTypeCode === "SM"
                ? prisma_js_1.default.yiyiDailyPricing.findMany({
                    where: {
                        recordDate: { gte: startOfMonth, lt: endOfMonth },
                    },
                    select: {
                        recordDate: true,
                        unitPrice: true,
                    },
                })
                : Promise.resolve([]),
        ]);
        const activeUpstreamNames = activeUpstreams.map((upstream) => upstream.name);
        const inputsByDate = groupDailyInputsByBusinessDate(monthlyInputs);
        const mlPeriodMap = buildPeriodMap(mlPeriods);
        const lePeriodMap = buildPeriodMap(lePeriods);
        const yiyiQtyByDate = groupNumbersByBusinessDate(yiyiData.map((row) => ({ recordDate: row.recordDate, value: row.qty })));
        const yiyiPricingByDate = groupPricingByBusinessDate(yiyiPricing);
        const results = [];
        for (const date of days) {
            const dayInputs = inputsByDate.get(date) ?? [];
            const upstreamBreakdown = {};
            const upstreamDetailBreakdown = adTypeCode === "360"
                ? Object.fromEntries(activeUpstreamNames.map((name) => [
                    name,
                    { pv: 0, unit_price: 0, amount: 0 },
                ]))
                : {};
            let totalRevenue = 0;
            let totalUV = 0;
            for (const row of dayInputs) {
                const upstreamName = row.adSite.upstream.name;
                const amount = Number(row.revenue ?? 0);
                const qty = Number(row.qty ?? 0);
                totalRevenue += amount;
                totalUV += qty;
                upstreamBreakdown[upstreamName] = (upstreamBreakdown[upstreamName] ?? 0) + amount;
                if (adTypeCode === "360") {
                    const current = upstreamDetailBreakdown[upstreamName] ?? { pv: 0, unit_price: 0, amount: 0 };
                    current.pv += qty;
                    current.amount += amount;
                    upstreamDetailBreakdown[upstreamName] = current;
                }
            }
            const finalizedUpstreamDetailBreakdown = adTypeCode === "360"
                ? finalizeUpstreamDetailBreakdown(upstreamDetailBreakdown)
                : undefined;
            const activeMlPeriod = getActivePeriodForDate(mlPeriodMap.values().next().value, date);
            const mlPayoutRate = Number(activeMlPeriod?.downstream.payoutRate ?? calculations_js_1.DEFAULT_ML_PAYOUT_RATE);
            const mlPayout = (0, calculations_js_1.calculateMlPayoutAmount)(totalRevenue, mlPayoutRate);
            let cost = mlPayout;
            let lePayout;
            let yiyiPayout;
            if (adTypeCode === "SM") {
                const activeLePeriod = getActivePeriodForDate(lePeriodMap.values().next().value, date);
                const lePayoutRate = Number(activeLePeriod?.downstream.payoutRate ?? calculations_js_1.DEFAULT_LE_PAYOUT_RATE);
                const leRevenue = (0, calculations_js_1.calculateLeRevenueFromSmRevenue)(totalRevenue, lePayoutRate);
                const mlUnitPrice = Number(activeLePeriod?.unitPrice ?? calculations_js_1.DEFAULT_LE_UNIT_PRICE);
                const leMlCost = (0, calculations_js_1.calculateUnitPricePayout)(totalUV, mlUnitPrice);
                const leTax = (0, calculations_js_1.calculateTaxOnMargin)(leRevenue, leMlCost);
                lePayout = (0, calculations_js_1.calculateNetProfit)(leRevenue, leMlCost, leTax);
                const yiyiQty = yiyiQtyByDate.get(date);
                const yiyiUnitPrice = yiyiPricingByDate.get(date) ?? calculations_js_1.YIYI_DEFAULT_UNIT_PRICE;
                yiyiPayout = (0, calculations_js_1.calculateYiyiAmount)(yiyiQty ?? totalUV, yiyiUnitPrice);
                cost = (0, calculations_js_1.calculateSmDashboardCost)(lePayout, yiyiPayout);
            }
            const tax = (0, calculations_js_1.calculateTaxOnMargin)(totalRevenue, cost);
            const profit = (0, calculations_js_1.calculateNetProfit)(totalRevenue, cost, tax);
            results.push({
                date,
                revenue: totalRevenue,
                cost,
                tax,
                profit,
                profit_rate: (0, calculations_js_1.calculateProfitRate)(profit, totalRevenue),
                upstream_breakdown: upstreamBreakdown,
                upstream_detail_breakdown: finalizedUpstreamDetailBreakdown,
                ml_payout: mlPayout,
                le_payout: lePayout,
                yiyi_payout: yiyiPayout,
            });
        }
        results.push(buildMonthlyTotal(results));
        res.json({ success: true, data: results });
    }
    catch (err) {
        console.error("GET /api/dashboard/monthly error:", err);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
});
// ============================================================
// GET /api/dashboard/downstream-monthly
// Query: year, month (1-12), ad_type (SM|360|BAIDU_JS|OTHER)
// Returns aggregated ML and LE from downstream site inputs
// ============================================================
router.get("/downstream-monthly", auth_js_1.requireAuth, [
    (0, express_validator_1.query)("year").notEmpty().withMessage("year is required").isInt({ min: 2020, max: 2100 }).toInt(),
    (0, express_validator_1.query)("month").notEmpty().withMessage("month is required").isInt({ min: 1, max: 12 }).toInt(),
    (0, express_validator_1.query)("ad_type").notEmpty().withMessage("ad_type is required").isIn(["SM", "360", "BAIDU_JS", "OTHER"]),
], handleValidation, async (req, res) => {
    try {
        const year = Number(req.query.year);
        const month = Number(req.query.month);
        const adTypeCode = req.query.ad_type;
        const adTypeId = constants_js_1.AD_TYPE_ID_MAP[adTypeCode];
        const days = getDaysInMonth(year, month);
        const { gte: startOfMonth, lt: endOfMonth } = (0, date_js_1.getBusinessMonthRange)(year, month);
        const inputs = (await prisma_js_1.default.dailyInput.findMany({
            where: {
                recordDate: { gte: startOfMonth, lt: endOfMonth },
                status: "confirmed",
                adSite: {
                    isArchived: false,
                    status: "active",
                    downstreams: {
                        some: {
                            downstream: {
                                adTypeId,
                                status: "active",
                            },
                        },
                    },
                },
            },
            select: {
                recordDate: true,
                qty: true,
                adSite: {
                    select: {
                        downstreams: {
                            where: {
                                downstream: {
                                    adTypeId,
                                    status: "active",
                                },
                            },
                            select: {
                                customPrice: true,
                                downstream: {
                                    select: {
                                        id: true,
                                        downstreamType: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        }));
        const downstreamIds = [...new Set(inputs.flatMap((input) => input.adSite.downstreams?.map((sd) => sd.downstream.id) ?? []))];
        const [periods, dailyRates] = await Promise.all([
            downstreamIds.length > 0
                ? prisma_js_1.default.downstreamPeriod.findMany({
                    where: {
                        downstreamId: { in: downstreamIds },
                        startDate: { lte: endOfMonth },
                        OR: [{ endDate: null }, { endDate: { gte: startOfMonth } }],
                    },
                    include: {
                        downstream: {
                            select: { payoutRate: true },
                        },
                    },
                })
                : Promise.resolve([]),
            downstreamIds.length > 0
                ? prisma_js_1.default.dailyDownstreamRate.findMany({
                    where: {
                        downstreamId: { in: downstreamIds },
                        date: { gte: startOfMonth, lt: endOfMonth },
                    },
                    select: {
                        downstreamId: true,
                        date: true,
                        effectiveRate: true,
                    },
                })
                : Promise.resolve([]),
        ]);
        const inputsByDate = groupDailyInputsByBusinessDate(inputs);
        const periodMap = buildPeriodMap(periods);
        const dailyRateMap = new Map();
        const activePeriodCache = new Map();
        for (const rate of dailyRates) {
            dailyRateMap.set(`${rate.downstreamId}:${(0, date_js_1.formatBusinessDate)(rate.date)}`, Number(rate.effectiveRate));
        }
        const results = [];
        for (const date of days) {
            const dayInputs = inputsByDate.get(date) ?? [];
            let totalML = 0;
            let totalLE = 0;
            for (const input of dayInputs) {
                for (const sd of input.adSite.downstreams ?? []) {
                    const ds = sd.downstream;
                    if (ds.downstreamType !== "ML" && ds.downstreamType !== "LE")
                        continue;
                    const cacheKey = `${ds.id}:${date}`;
                    let cachedPeriod = activePeriodCache.get(cacheKey);
                    if (!cachedPeriod) {
                        const activePeriod = getActivePeriodForDate(periodMap.get(ds.id), date);
                        cachedPeriod = {
                            pctHal: Number(activePeriod?.pctHal ?? 1),
                            unitPrice: Number(activePeriod?.unitPrice ?? constants_js_1.DEFAULT_DOWNSTREAM_PRICES[String(ds.id)] ?? 0),
                        };
                        activePeriodCache.set(cacheKey, cachedPeriod);
                    }
                    const price = sd.customPrice !== null
                        ? Number(sd.customPrice)
                        : cachedPeriod.unitPrice;
                    if (price <= 0)
                        continue;
                    const effectiveRate = dailyRateMap.get(cacheKey) ??
                        cachedPeriod.pctHal * 100;
                    const adjustedUV = Math.trunc((input.qty ?? 0) * (effectiveRate / 100));
                    const mlValue = calculateDownstreamSiteValue(adjustedUV, price);
                    if (ds.downstreamType === "ML") {
                        totalML += mlValue;
                    }
                    else {
                        totalLE += mlValue;
                    }
                }
            }
            results.push({
                date,
                ml: totalML,
                ml_80: (0, calculations_js_1.applyMl80Rate)(totalML),
                le: totalLE,
            });
        }
        res.json({ success: true, data: results });
    }
    catch (err) {
        console.error("GET /api/dashboard/downstream-monthly error:", err);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
});
exports.default = router;
