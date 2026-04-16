"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const auth_js_1 = require("../middleware/auth.js");
const prisma_js_1 = __importDefault(require("../prisma.js"));
const date_js_1 = require("../utils/date.js");
const router = (0, express_1.Router)();
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
const handleValidation = (req, res, next) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ success: false, error: errors.array()[0].msg });
        return;
    }
    next();
};
// ============================================================
// GET /api/dashboard/le?month=YYYY-MM
// ============================================================
router.get("/le", auth_js_1.requireAuth, [
    (0, express_validator_1.query)("month").notEmpty().withMessage("month is required").matches(/^\d{4}-(0[1-9]|1[0-2])$/).withMessage("month must be YYYY-MM"),
], handleValidation, async (req, res) => {
    try {
        const isOfficialView = req.user?.perm_admin === true;
        const monthStr = req.query.month;
        const [year, month] = monthStr.split("-").map(Number);
        const days = getDaysInMonth(year, month);
        const { gte: startOfMonth, lt: endOfMonth } = (0, date_js_1.getBusinessMonthRange)(year, month);
        const leDownstream = await prisma_js_1.default.downstream.findFirst({
            where: {
                downstreamType: "LE",
                adTypeId: 1, // SM
                status: "active",
            },
            include: {
                adSites: {
                    include: {
                        adSite: {
                            include: {
                                upstream: {
                                    select: { name: true },
                                },
                            },
                        },
                    },
                },
            },
            orderBy: { id: "asc" },
        });
        const linkedSites = (leDownstream?.adSites ?? [])
            .map((item) => item.adSite)
            .sort((a, b) => {
            const upstreamCompare = a.upstream.name.localeCompare(b.upstream.name);
            if (upstreamCompare !== 0)
                return upstreamCompare;
            return a.name.localeCompare(b.name);
        });
        const siteIds = linkedSites.map((site) => site.id);
        const siteNames = linkedSites.map((site) => site.name);
        // Fetch all linked LE-SM daily inputs for the month
        const dailyInputs = await prisma_js_1.default.dailyInput.findMany({
            where: {
                recordDate: { gte: startOfMonth, lt: endOfMonth },
                status: isOfficialView ? "confirmed" : undefined,
                adSiteId: siteIds.length > 0 ? { in: siteIds } : undefined,
                adSite: {
                    upstream: {
                        adTypeId: 1, // SM
                        status: "active",
                    },
                },
            },
            include: {
                adSite: {
                    include: { upstream: { select: { name: true } } },
                },
            },
        });
        // Fetch all LE daily costs for the month
        const leCosts = await prisma_js_1.default.lEDailyCost.findMany({
            where: {
                recordDate: { gte: startOfMonth, lt: endOfMonth },
            },
        });
        const leCostMap = new Map(leCosts.map((cost) => {
            const vendorCost = Number(cost.vendorCost ?? 0);
            const mlCost = Number(cost.mlCost ?? 0);
            const legacyTotalCost = Number(cost.costAmount ?? 0);
            const hasBreakdown = vendorCost !== 0 || mlCost !== 0;
            return [
                (0, date_js_1.formatBusinessDate)(cost.recordDate),
                {
                    vendorCost: hasBreakdown ? vendorCost : legacyTotalCost,
                    mlCost: hasBreakdown ? mlCost : 0,
                    totalCost: hasBreakdown ? vendorCost + mlCost : legacyTotalCost,
                },
            ];
        }));
        // Build per-day rows
        const results = [];
        for (const date of days) {
            const { gte: startOfDay, lt: endOfDay } = (0, date_js_1.getBusinessDayRange)(date);
            const dayInputs = dailyInputs.filter((inp) => {
                const rd = new Date(inp.recordDate);
                return rd >= startOfDay && rd < endOfDay;
            });
            // SM revenue and ad site breakdown
            const upstreamBreakdown = {};
            let smRevenue = 0;
            for (const inp of dayInputs) {
                const name = inp.adSite.name;
                const rev = Number(inp.revenue);
                smRevenue += rev;
                upstreamBreakdown[name] = (upstreamBreakdown[name] ?? 0) + rev;
            }
            const leRevenue = smRevenue * 0.9;
            const downstreamCosts = leCostMap.get(date) ?? { vendorCost: 0, mlCost: 0, totalCost: 0 };
            const taxRate = 0.06;
            const tax = leRevenue * taxRate;
            const profit = leRevenue - tax - downstreamCosts.totalCost;
            const profitRate = leRevenue > 0 ? profit / leRevenue : 0;
            results.push({
                date,
                smRevenue,
                leRevenue,
                taxRate,
                tax,
                vendorCost: downstreamCosts.vendorCost,
                mlCost: downstreamCosts.mlCost,
                totalCost: downstreamCosts.totalCost,
                profit,
                profitRate,
                upstreamBreakdown,
            });
        }
        // Total row
        const totalSmRevenue = results.reduce((s, r) => s + r.smRevenue, 0);
        const totalLeRevenue = results.reduce((s, r) => s + r.leRevenue, 0);
        const totalVendorCost = results.reduce((s, r) => s + r.vendorCost, 0);
        const totalMlCost = results.reduce((s, r) => s + r.mlCost, 0);
        const totalCost = results.reduce((s, r) => s + r.totalCost, 0);
        const totalTax = results.reduce((s, r) => s + r.tax, 0);
        const totalProfit = results.reduce((s, r) => s + r.profit, 0);
        const totalProfitRate = totalLeRevenue > 0 ? totalProfit / totalLeRevenue : 0;
        const totalUpstreamBreakdown = {};
        for (const r of results) {
            for (const [k, v] of Object.entries(r.upstreamBreakdown)) {
                totalUpstreamBreakdown[k] = (totalUpstreamBreakdown[k] ?? 0) + v;
            }
        }
        const totalRow = {
            date: "TOTAL",
            smRevenue: totalSmRevenue,
            leRevenue: totalLeRevenue,
            taxRate: 0.06,
            tax: totalTax,
            vendorCost: totalVendorCost,
            mlCost: totalMlCost,
            totalCost,
            profit: totalProfit,
            profitRate: totalProfitRate,
            upstreamBreakdown: totalUpstreamBreakdown,
            isTotal: true,
        };
        res.json({
            success: true,
            data: {
                upstreamNames: siteNames,
                rows: [...results, totalRow],
            },
        });
    }
    catch (err) {
        console.error("GET /api/dashboard/le error:", err);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
});
// ============================================================
// POST /api/dashboard/le/cost
// Body: { date: string, vendorCost?: number, mlCost?: number, costAmount?: number }
// ============================================================
router.post("/le/cost", async (req, res) => {
    try {
        const { date, vendorCost: rawVendorCost, mlCost: rawMlCost, costAmount, } = req.body;
        if (!date ||
            (typeof rawVendorCost !== "number" &&
                typeof rawMlCost !== "number" &&
                typeof costAmount !== "number")) {
            res.status(400).json({
                success: false,
                error: "date and at least one of vendorCost, mlCost, costAmount are required",
            });
            return;
        }
        const vendorCost = typeof rawVendorCost === "number"
            ? rawVendorCost
            : typeof costAmount === "number"
                ? costAmount
                : 0;
        const mlCost = typeof rawMlCost === "number" ? rawMlCost : 0;
        const totalCost = vendorCost + mlCost;
        const recordDate = (0, date_js_1.getBusinessDateAtHour)(date, 12);
        const record = await prisma_js_1.default.lEDailyCost.upsert({
            where: { recordDate },
            update: {
                vendorCost,
                mlCost,
                costAmount: totalCost,
            },
            create: {
                recordDate,
                vendorCost,
                mlCost,
                costAmount: totalCost,
            },
        });
        res.json({ success: true, data: record });
    }
    catch (err) {
        console.error("POST /api/dashboard/le/cost error:", err);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
});
exports.default = router;
