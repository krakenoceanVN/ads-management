"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
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
router.get("/le", [
    (0, express_validator_1.query)("month").notEmpty().withMessage("month is required").matches(/^\d{4}-(0[1-9]|1[0-2])$/).withMessage("month must be YYYY-MM"),
], handleValidation, async (req, res) => {
    try {
        const monthStr = req.query.month;
        const [year, month] = monthStr.split("-").map(Number);
        const days = getDaysInMonth(year, month);
        const { gte: startOfMonth, lt: endOfMonth } = (0, date_js_1.getBusinessMonthRange)(year, month);
        // Fetch all SM confirmed daily inputs for the month
        const dailyInputs = await prisma_js_1.default.dailyInput.findMany({
            where: {
                recordDate: { gte: startOfMonth, lte: endOfMonth },
                status: "confirmed",
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
        const leCostMap = new Map(leCosts.map((c) => [(0, date_js_1.formatBusinessDate)(c.recordDate), c.costAmount]));
        // Collect all upstream names
        const upstreamNames = new Set();
        for (const inp of dailyInputs) {
            if (inp.adSite.upstream.name)
                upstreamNames.add(inp.adSite.upstream.name);
        }
        const sortedUpstreams = Array.from(upstreamNames).sort();
        // Build per-day rows
        const results = [];
        for (const date of days) {
            const { gte: startOfDay, lt: endOfDay } = (0, date_js_1.getBusinessDayRange)(date);
            const dayInputs = dailyInputs.filter((inp) => {
                const rd = new Date(inp.recordDate);
                return rd >= startOfDay && rd < endOfDay;
            });
            // SM revenue and upstream breakdown
            const upstreamBreakdown = {};
            let smRevenue = 0;
            for (const inp of dayInputs) {
                const name = inp.adSite.upstream.name;
                const rev = Number(inp.revenue);
                smRevenue += rev;
                upstreamBreakdown[name] = (upstreamBreakdown[name] ?? 0) + rev;
            }
            const leRevenue = smRevenue * 0.9;
            const cost = leCostMap.get(date) ?? 0;
            const tax = (leRevenue - cost) * 0.06;
            const profit = leRevenue - cost - tax;
            const profitRate = leRevenue > 0 ? profit / leRevenue : 0;
            results.push({
                date,
                smRevenue,
                leRevenue,
                cost,
                tax,
                profit,
                profitRate,
                upstreamBreakdown,
            });
        }
        // Total row
        const totalSmRevenue = results.reduce((s, r) => s + r.smRevenue, 0);
        const totalLeRevenue = results.reduce((s, r) => s + r.leRevenue, 0);
        const totalCost = results.reduce((s, r) => s + r.cost, 0);
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
            cost: totalCost,
            tax: totalTax,
            profit: totalProfit,
            profitRate: totalProfitRate,
            upstreamBreakdown: totalUpstreamBreakdown,
            isTotal: true,
        };
        res.json({
            success: true,
            data: {
                upstreamNames: sortedUpstreams,
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
// Body: { date: string, costAmount: number }
// ============================================================
router.post("/le/cost", async (req, res) => {
    try {
        const { date, costAmount } = req.body;
        if (!date || typeof costAmount !== "number") {
            res.status(400).json({ success: false, error: "date and costAmount are required" });
            return;
        }
        const recordDate = (0, date_js_1.getBusinessDateAtHour)(date, 12);
        const record = await prisma_js_1.default.lEDailyCost.upsert({
            where: { recordDate },
            update: { costAmount },
            create: { recordDate, costAmount },
        });
        res.json({ success: true, data: record });
    }
    catch (err) {
        console.error("POST /api/dashboard/le/cost error:", err);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
});
exports.default = router;
