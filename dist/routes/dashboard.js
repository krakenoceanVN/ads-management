"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const mlPayout_service_js_1 = require("../services/mlPayout.service.js");
const prisma_js_1 = __importDefault(require("../prisma.js"));
const date_js_1 = require("../utils/date.js");
const constants_js_1 = require("../utils/constants.js");
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
    const profit = revenue - cost - tax;
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
        profit_rate: revenue > 0 ? profit / revenue : 0,
        upstream_breakdown: upstreamBreakdown,
        upstream_detail_breakdown: finalizedUpstreamDetailBreakdown,
        ml_payout: mlPayout,
        le_payout: lePayout > 0 ? lePayout : undefined,
        yiyi_payout: yiyiPayout > 0 ? yiyiPayout : undefined,
    };
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
// Query: year, month (1-12), ad_type (SM|360|BAIDU_JS)
// ============================================================
router.get("/monthly", [
    (0, express_validator_1.query)("year").notEmpty().withMessage("year is required").isInt({ min: 2020, max: 2100 }).toInt(),
    (0, express_validator_1.query)("month").notEmpty().withMessage("month is required").isInt({ min: 1, max: 12 }).toInt(),
    (0, express_validator_1.query)("ad_type").notEmpty().withMessage("ad_type is required").isIn(["SM", "360", "BAIDU_JS", "OTHER"]),
], handleValidation, async (req, res) => {
    try {
        const year = Number(req.query.year);
        const month = Number(req.query.month);
        const adTypeCode = req.query.ad_type;
        const adTypeId = constants_js_1.AD_TYPE_ID_MAP[adTypeCode];
        const activeUpstreamNames = adTypeCode === "360"
            ? (await prisma_js_1.default.upstream.findMany({
                where: {
                    adTypeId,
                    status: "active",
                },
                select: { name: true },
                orderBy: { name: "asc" },
            })).map((upstream) => upstream.name)
            : [];
        const days = getDaysInMonth(year, month);
        const results = [];
        for (const date of days) {
            const { gte: startOfDay, lt: endOfDay } = (0, date_js_1.getBusinessDayRange)(date);
            // Upstream breakdown — sum revenue by upstream name (confirmed only)
            const upstreamRows = await prisma_js_1.default.dailyInput.groupBy({
                by: ["adSiteId"],
                where: {
                    recordDate: { gte: startOfDay, lt: endOfDay },
                    status: "confirmed",
                    adSite: {
                        isArchived: false,
                        upstream: {
                            adTypeId: adTypeId,
                            status: "active",
                        },
                    },
                },
                _sum: { revenue: true, qty: true },
            });
            const siteIds = upstreamRows.map((r) => r.adSiteId);
            const sites = await prisma_js_1.default.adSite.findMany({
                where: {
                    id: { in: siteIds },
                    isArchived: false,
                },
                include: { upstream: { select: { name: true } } },
            });
            const siteMap = new Map(sites.map((s) => [s.id, s]));
            const upstreamBreakdown = {};
            const upstreamDetailBreakdown = adTypeCode === "360"
                ? Object.fromEntries(activeUpstreamNames.map((name) => [
                    name,
                    { pv: 0, unit_price: 0, amount: 0 },
                ]))
                : {};
            for (const row of upstreamRows) {
                const site = siteMap.get(row.adSiteId);
                if (!site)
                    continue;
                const name = site.upstream.name;
                const amount = Number(row._sum.revenue ?? 0);
                upstreamBreakdown[name] = (upstreamBreakdown[name] ?? 0) + amount;
                if (adTypeCode === "360") {
                    const current = upstreamDetailBreakdown[name] ?? { pv: 0, unit_price: 0, amount: 0 };
                    current.pv += Number(row._sum.qty ?? 0);
                    current.amount += amount;
                    upstreamDetailBreakdown[name] = current;
                }
            }
            const finalizedUpstreamDetailBreakdown = adTypeCode === "360"
                ? finalizeUpstreamDetailBreakdown(upstreamDetailBreakdown)
                : undefined;
            const totalRevenue = Object.values(upstreamBreakdown).reduce((s, v) => s + v, 0);
            // ML payout — all 3 types
            const mlResult = await (0, mlPayout_service_js_1.calculateMLPayout)(date, adTypeCode, prisma_js_1.default);
            const mlPayout = mlResult.ml_payout;
            let cost = mlPayout;
            let lePayout;
            let yiyiPayout;
            if (adTypeCode === "SM") {
                lePayout = await (0, mlPayout_service_js_1.calculateLEPayout)(date, totalRevenue, prisma_js_1.default);
                const uvResult = await prisma_js_1.default.dailyInput.aggregate({
                    where: {
                        recordDate: { gte: startOfDay, lt: endOfDay },
                        status: "confirmed",
                        adSite: {
                            isArchived: false,
                            upstream: {
                                adTypeId: adTypeId,
                                status: "active",
                            },
                        },
                    },
                    _sum: { qty: true },
                });
                const totalUV = Number(uvResult._sum.qty ?? 0);
                yiyiPayout = await (0, mlPayout_service_js_1.calculateYiyiPayout)(date, totalUV, prisma_js_1.default);
                cost = lePayout + yiyiPayout;
            }
            const tax = (totalRevenue - cost) * 0.06;
            const profit = totalRevenue - cost - tax;
            results.push({
                date,
                revenue: totalRevenue,
                cost,
                tax,
                profit,
                profit_rate: totalRevenue > 0 ? profit / totalRevenue : 0,
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
router.get("/downstream-monthly", [
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
        const results = [];
        const periodCache = new Map();
        const dailyRateCache = new Map();
        for (const date of days) {
            const { gte: startOfDay, lt: endOfDay } = (0, date_js_1.getBusinessDayRange)(date);
            // Get all downstream site inputs for this date, filtered by ad_type
            const inputs = await prisma_js_1.default.dailyInput.findMany({
                where: {
                    recordDate: { gte: startOfDay, lt: endOfDay },
                    status: "confirmed",
                    adSite: {
                        isArchived: false,
                        status: "active",
                        downstreams: {
                            some: {
                                downstream: {
                                    adTypeId: adTypeId,
                                    status: "active",
                                },
                            },
                        },
                    },
                },
                include: {
                    adSite: {
                        include: {
                            downstreams: {
                                where: {
                                    downstream: {
                                        adTypeId: adTypeId,
                                        status: "active",
                                    },
                                },
                                include: {
                                    downstream: true,
                                },
                            },
                        },
                    },
                },
            });
            let totalML = 0;
            let totalLE = 0;
            for (const input of inputs) {
                for (const sd of input.adSite.downstreams) {
                    const ds = sd.downstream;
                    if (ds.downstreamType !== "ML" && ds.downstreamType !== "LE")
                        continue;
                    const cacheKey = `${ds.id}:${date}`;
                    let cachedPeriod = periodCache.get(cacheKey);
                    if (!cachedPeriod) {
                        const activePeriod = await prisma_js_1.default.downstreamPeriod.findFirst({
                            where: {
                                downstreamId: ds.id,
                                startDate: { lte: new Date(date) },
                                OR: [{ endDate: null }, { endDate: { gte: new Date(date) } }],
                            },
                            orderBy: { startDate: "desc" },
                        });
                        cachedPeriod = {
                            pctHal: Number(activePeriod?.pctHal ?? 1),
                            unitPrice: Number(activePeriod?.unitPrice ?? constants_js_1.DEFAULT_DOWNSTREAM_PRICES[String(ds.id)] ?? 0),
                        };
                        periodCache.set(cacheKey, cachedPeriod);
                    }
                    // Determine effective price: customPrice in AdSiteDownstream > active DownstreamPeriod > fallback defaults
                    const price = sd.customPrice !== null
                        ? Number(sd.customPrice)
                        : cachedPeriod.unitPrice;
                    if (price <= 0)
                        continue;
                    let effectiveRate = dailyRateCache.get(cacheKey);
                    if (effectiveRate === undefined) {
                        const rateRecord = await prisma_js_1.default.dailyDownstreamRate.findFirst({
                            where: {
                                downstreamId: ds.id,
                                date: { gte: startOfDay, lt: endOfDay },
                            },
                        });
                        effectiveRate = rateRecord ? Number(rateRecord.effectiveRate) : cachedPeriod.pctHal * 100;
                        dailyRateCache.set(cacheKey, effectiveRate);
                    }
                    // Match DownstreamSitesPage calculation: int(qty * rate/100)
                    const adjustedUV = Math.trunc((input.qty ?? 0) * (effectiveRate / 100));
                    const mlValue = adjustedUV * price;
                    if (ds.downstreamType === "ML") {
                        totalML += mlValue;
                    }
                    else if (ds.downstreamType === "LE") {
                        totalLE += mlValue;
                    }
                }
            }
            results.push({
                date,
                ml: totalML,
                ml_80: totalML * 0.8,
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
