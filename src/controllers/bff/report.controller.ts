/**
 * BFF Reports Controller
 * Handles report endpoints for frontend (advertiser/media perspective)
 * 
 * Uses DailyInput.revenue as source of truth.
 * Do NOT recalculate CPM/RATIO/SM Rebate.
 * Do NOT use rebateRate for payout.
 * Do NOT use HTTP loopback to old routes.
 */

import { Router, Request, Response } from "express";
import { query, validationResult } from "express-validator";
import { Prisma } from "@prisma/client";
import prisma from "../../prisma.js";
import { requireAuth, requirePermission } from "../../middleware/auth.js";
import { AdTypeCode } from "../../types/index.js";
import { getBusinessDayRange, getBusinessMonthRange, getBusinessDateRange, getDaysInMonth, getDaysInRange } from "../../utils/date.js";
import { calculateCostBreakdown, calculateCostBreakdownMonthly } from "../../services/mlPayout.service.js";
import { mapDailyInputToAdvertiserEntry, mapDailyInputToMediaEntry } from "../../mappers/bff/dataEntry.mapper.js";

const router = Router();

const handleValidation = (req: Request, res: Response, next: Function) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ success: false, error: errors.array()[0].msg });
        return;
    }
    next();
};

// ============================================================
// GET /api/bff/reports/advertisers
// Query: date (YYYY-MM-DD or YYYY-MM), OR startDate + endDate (for range)
// advertiserId (optional), adTypeCode (optional), status (optional)
// Returns advertiser-side report rows with receivable (DailyInput.revenue)
// ============================================================
router.get(
    "/advertisers",
    requireAuth,
    requirePermission("report.read"),
    [
        query("date").optional().isISO8601(),
        query("startDate").optional().isISO8601(),
        query("endDate").optional().isISO8601(),
        query("advertiserId").optional().isInt().toInt(),
        query("adTypeCode").optional().isString(),
        query("status").optional().isIn(["confirmed", "unconfirmed", "pending", "all"]),
    ],
    handleValidation,
    async (req: Request, res: Response) => {
        try {
            const { date: dateStr, startDate, endDate, advertiserId, adTypeCode, statusFilter } = req.query as {
                date?: string;
                startDate?: string;
                endDate?: string;
                advertiserId?: number;
                adTypeCode?: string;
                statusFilter?: string;
            };

            let gte: Date, lt: Date;

            if (startDate && endDate) {
                ({ gte, lt } = getBusinessDateRange(startDate, endDate));
            } else if (dateStr) {
                const isMonthRange = dateStr.length === 7;
                if (isMonthRange) {
                    const [year, month] = dateStr.split("-").map(Number);
                    ({ gte, lt } = getBusinessMonthRange(year, month));
                } else {
                    ({ gte, lt } = getBusinessDayRange(dateStr));
                }
            } else {
                res.status(400).json({ success: false, error: "date or startDate+endDate is required" });
                return;
            }

            const baseWhere: Prisma.DailyInputWhereInput = {
                recordDate: { gte, lt },
            };

            let adSiteFilter: Prisma.AdSiteWhereInput | undefined;
            if (advertiserId && adTypeCode) {
                adSiteFilter = { upstreamId: advertiserId, upstream: { adType: { code: adTypeCode } } };
            } else if (advertiserId) {
                adSiteFilter = { upstreamId: advertiserId };
            } else if (adTypeCode) {
                adSiteFilter = { upstream: { adType: { code: adTypeCode } } };
            }

            const where: Prisma.DailyInputWhereInput = adSiteFilter
                ? { ...baseWhere, adSite: adSiteFilter }
                : baseWhere;

            if (statusFilter === "all") {
                // status=all means return all records (no filter)
            } else if (statusFilter === "pending") {
                where.status = "unconfirmed";
            } else if (statusFilter) {
                where.status = statusFilter;
            } else {
                // Default: only confirmed records
                where.status = "confirmed";
            }

            const records = await prisma.dailyInput.findMany({
                where,
                include: {
                    adSite: {
                        include: {
                            upstream: { include: { adType: true } },
                            adOrder: { include: { adType: true } },
                        },
                    },
                },
                orderBy: [
                    { recordDate: "asc" },
                    { adSite: { name: "asc" } },
                ],
            });

            const rows = records.map((r) =>
                mapDailyInputToAdvertiserEntry(r, adTypeCode || "360")
            );

            res.json({ success: true, data: rows });
        } catch (err: any) {
            console.error("GET /api/bff/reports/advertisers error:", err);
            res.status(500).json({ success: false, error: "Internal server error" });
        }
    }
);

// ============================================================
// GET /api/bff/reports/media
// Query: date (YYYY-MM-DD or YYYY-MM), OR startDate + endDate (for range)
// mediaId (optional), adTypeCode (optional), status (optional)
// Returns media-side report rows with receivable and actualReceived
// ============================================================
router.get(
    "/media",
    requireAuth,
    requirePermission("report.read"),
    [
        query("date").optional().isISO8601(),
        query("startDate").optional().isISO8601(),
        query("endDate").optional().isISO8601(),
        query("mediaId").optional().isInt().toInt(),
        query("adTypeCode").optional().isString(),
        query("status").optional().isIn(["confirmed", "unconfirmed", "pending", "all"]),
    ],
    handleValidation,
    async (req: Request, res: Response) => {
        try {
            const { date: dateStr, startDate, endDate, mediaId, adTypeCode, statusFilter } = req.query as {
                date?: string;
                startDate?: string;
                endDate?: string;
                mediaId?: number;
                adTypeCode?: string;
                statusFilter?: string;
            };

            let gte: Date, lt: Date;

            if (startDate && endDate) {
                ({ gte, lt } = getBusinessDateRange(startDate, endDate));
            } else if (dateStr) {
                const isMonthRange = dateStr.length === 7;
                if (isMonthRange) {
                    const [year, month] = dateStr.split("-").map(Number);
                    ({ gte, lt } = getBusinessMonthRange(year, month));
                } else {
                    ({ gte, lt } = getBusinessDayRange(dateStr));
                }
            } else {
                res.status(400).json({ success: false, error: "date or startDate+endDate is required" });
                return;
            }

            const baseWhere: Prisma.DailyInputWhereInput = {
                recordDate: { gte, lt },
            };

            let adSiteFilter: Prisma.AdSiteWhereInput | undefined;
            if (mediaId && adTypeCode) {
                adSiteFilter = { id: mediaId, upstream: { adType: { code: adTypeCode } } };
            } else if (mediaId) {
                adSiteFilter = { id: mediaId };
            } else if (adTypeCode) {
                adSiteFilter = { upstream: { adType: { code: adTypeCode } } };
            }

            const where: Prisma.DailyInputWhereInput = adSiteFilter
                ? { ...baseWhere, adSite: adSiteFilter }
                : baseWhere;

            if (statusFilter === "all") {
                // status=all means return all records (no filter)
            } else if (statusFilter === "pending") {
                where.status = "unconfirmed";
            } else if (statusFilter) {
                where.status = statusFilter;
            } else {
                // Default: only confirmed records
                where.status = "confirmed";
            }

            const records = await prisma.dailyInput.findMany({
                where,
                include: {
                    adSite: {
                        include: {
                            upstream: { include: { adType: true } },
                            adOrder: { include: { adType: true } },
                            downstreams: {
                                include: { downstream: true },
                            },
                        },
                    },
                },
                orderBy: [
                    { recordDate: "asc" },
                    { adSite: { name: "asc" } },
                ],
            });

            const rows = await Promise.all(
                records.map(async (r) => {
                    let shareRatio: number | null = null;
                    const downstream = r.adSite.downstreams.find((ds) => ds.downstream.status === "active");
                    if (downstream) {
                        shareRatio = Number(downstream.downstream.payoutRate);
                    }
                    return mapDailyInputToMediaEntry(r, shareRatio, adTypeCode || "SM");
                })
            );

            res.json({ success: true, data: rows });
        } catch (err: any) {
            console.error("GET /api/bff/reports/media error:", err);
            res.status(500).json({ success: false, error: "Internal server error" });
        }
    }
);

// ============================================================
// GET /api/bff/reports/total-profit
// Query: date (YYYY-MM-DD or YYYY-MM), adTypeCode (optional)
// Returns total profit report with revenue, cost, tax, profit
// ============================================================
router.get(
    "/total-profit",
    requireAuth,
    requirePermission("report.read"),
    [
        query("date").optional().isISO8601(),
        query("startDate").optional().isISO8601(),
        query("endDate").optional().isISO8601(),
        query("adTypeCode").optional().isString(),
    ],
    handleValidation,
    async (req: Request, res: Response) => {
        try {
            const { date: dateStr, startDate, endDate, adTypeCode } = req.query as {
                date?: string;
                startDate?: string;
                endDate?: string;
                adTypeCode?: string;
            };
            const adType = (adTypeCode as AdTypeCode) || "SM";

            if (startDate && endDate) {
                const { gte, lt } = getBusinessDateRange(startDate, endDate);
                const gteYear = gte.getUTCFullYear();
                const gteMonth = gte.getUTCMonth() + 1;
                const ltYear = lt.getUTCFullYear();
                const ltMonth = lt.getUTCMonth() + 1;

                const results: {
                    date: string;
                    revenue: number;
                    ml_payout: number;
                    le_payout?: number;
                    yiyi_payout?: number;
                    cost: number;
                    tax: number;
                    profit: number;
                    profit_rate: number;
                }[] = [];
                let total = { revenue: 0, ml_payout: 0, le_payout: 0, yiyi_payout: 0, cost: 0, tax: 0, profit: 0 };

                const iterateMonths = (startYear: number, startMonth: number, endYear: number, endMonth: number) => {
                    const months: [number, number][] = [];
                    let y = startYear, m = startMonth;
                    while (y < endYear || (y === endYear && m <= endMonth)) {
                        months.push([y, m]);
                        m++;
                        if (m > 12) { m = 1; y++; }
                    }
                    return months;
                };

                const months = iterateMonths(gteYear, gteMonth, ltYear, ltMonth);
                for (const [y, mo] of months) {
                    const rangeStart = mo === gteMonth ? gte : getBusinessMonthRange(y, mo).gte;
                    const rangeEnd = mo === ltMonth ? lt : getBusinessMonthRange(y, mo).lt;
                    const breakdownMap = await calculateCostBreakdownMonthly(y, mo, adType, prisma, { gte: rangeStart, lt: rangeEnd });
                    for (const [day, breakdown] of breakdownMap) {
                        results.push({
                            date: day,
                            revenue: breakdown.revenue,
                            ml_payout: breakdown.ml_payout,
                            le_payout: breakdown.le_payout,
                            yiyi_payout: breakdown.yiyi_payout,
                            cost: breakdown.cost,
                            tax: breakdown.tax,
                            profit: breakdown.profit,
                            profit_rate: breakdown.profit_rate,
                        });
                        total.revenue += breakdown.revenue;
                        total.ml_payout += breakdown.ml_payout;
                        total.le_payout += breakdown.le_payout ?? 0;
                        total.yiyi_payout += breakdown.yiyi_payout ?? 0;
                        total.cost += breakdown.cost;
                        total.tax += breakdown.tax;
                        total.profit += breakdown.profit;
                    }
                }
                const profit_rate = total.revenue > 0 ? total.profit / total.revenue : 0;
                results.push({ date: `${startDate}-${endDate}-total`, ...total, profit_rate });
                res.json({ success: true, data: results });
                return;
            }

            if (!dateStr) {
                res.status(400).json({ success: false, error: "date or startDate+endDate is required" });
                return;
            }

            const isMonthRange = dateStr.length === 7;

            if (isMonthRange) {
                const [year, month] = dateStr.split("-").map(Number);

                const breakdownMap = await calculateCostBreakdownMonthly(year, month, adType as AdTypeCode, prisma);
                const days = getDaysInMonth(year, month);

                const results: {
                    date: string;
                    revenue: number;
                    ml_payout: number;
                    le_payout?: number;
                    yiyi_payout?: number;
                    cost: number;
                    tax: number;
                    profit: number;
                    profit_rate: number;
                }[] = [];

                let monthlyTotal = {
                    revenue: 0,
                    ml_payout: 0,
                    le_payout: 0,
                    yiyi_payout: 0,
                    cost: 0,
                    tax: 0,
                    profit: 0,
                    profit_rate: 0,
                };

                for (const day of days) {
                    const breakdown = breakdownMap.get(day);
                    if (breakdown) {
                        results.push({
                            date: day,
                            revenue: breakdown.revenue,
                            ml_payout: breakdown.ml_payout,
                            le_payout: breakdown.le_payout,
                            yiyi_payout: breakdown.yiyi_payout,
                            cost: breakdown.cost,
                            tax: breakdown.tax,
                            profit: breakdown.profit,
                            profit_rate: breakdown.profit_rate,
                        });
                        monthlyTotal.revenue += breakdown.revenue;
                        monthlyTotal.ml_payout += breakdown.ml_payout;
                        monthlyTotal.le_payout += breakdown.le_payout ?? 0;
                        monthlyTotal.yiyi_payout += breakdown.yiyi_payout ?? 0;
                        monthlyTotal.cost += breakdown.cost;
                        monthlyTotal.tax += breakdown.tax;
                        monthlyTotal.profit += breakdown.profit;
                    } else {
                        results.push({
                            date: day,
                            revenue: 0,
                            ml_payout: 0,
                            cost: 0,
                            tax: 0,
                            profit: 0,
                            profit_rate: 0,
                        });
                    }
                }

                monthlyTotal.profit_rate = monthlyTotal.revenue > 0
                    ? monthlyTotal.profit / monthlyTotal.revenue
                    : 0;

                results.push({
                    date: `${dateStr}-total`,
                    ...monthlyTotal,
                });

                res.json({ success: true, data: results });
            } else {
                const breakdown = await calculateCostBreakdown(dateStr, adType as AdTypeCode, prisma);
                res.json({
                    success: true,
                    data: [{
                        date: dateStr,
                        revenue: breakdown.revenue,
                        ml_payout: breakdown.ml_payout,
                        le_payout: breakdown.le_payout,
                        yiyi_payout: breakdown.yiyi_payout,
                        cost: breakdown.cost,
                        tax: breakdown.tax,
                        profit: breakdown.profit,
                        profit_rate: breakdown.profit_rate,
                    }],
                });
            }
        } catch (err: any) {
            console.error("GET /api/bff/reports/total-profit error:", err);
            res.status(500).json({ success: false, error: "Internal server error" });
        }
    }
);

// ============================================================
// GET /api/bff/reports/order-profit
// Query: date (YYYY-MM-DD or YYYY-MM), adTypeCode (optional)
// Returns order-level profit summary grouped by upstream/advertiser
// ============================================================
router.get(
    "/order-profit",
    requireAuth,
    requirePermission("report.read"),
    [
        query("date").optional().isISO8601(),
        query("startDate").optional().isISO8601(),
        query("endDate").optional().isISO8601(),
        query("adTypeCode").optional().isString(),
    ],
    handleValidation,
    async (req: Request, res: Response) => {
        try {
            const { date: dateStr, startDate, endDate, adTypeCode } = req.query as {
                date?: string;
                startDate?: string;
                endDate?: string;
                adTypeCode?: string;
            };

            let gte: Date, lt: Date;

            if (startDate && endDate) {
                ({ gte, lt } = getBusinessDateRange(startDate, endDate));
            } else if (dateStr) {
                const isMonthRange = dateStr.length === 7;
                if (isMonthRange) {
                    const [year, month] = dateStr.split("-").map(Number);
                    ({ gte, lt } = getBusinessMonthRange(year, month));
                } else {
                    ({ gte, lt } = getBusinessDayRange(dateStr));
                }
            } else {
                res.status(400).json({ success: false, error: "date or startDate+endDate is required" });
                return;
            }

            const where: Prisma.DailyInputWhereInput = {
                recordDate: { gte, lt },
                status: "confirmed",
            };

            if (adTypeCode) {
                where.adSite = { upstream: { adType: { code: adTypeCode } } };
            }

            const records = await prisma.dailyInput.findMany({
                where,
                include: {
                    adSite: {
                        include: {
                            upstream: { include: { adType: true } },
                        },
                    },
                },
            });

            const groupMap = new Map<string, {
                advertiser: string;
                advertiserId: number;
                adTypeCode: string;
                adTypeName: string;
                totalRevenue: number;
                totalQty: number;
                recordCount: number;
            }>();

            for (const record of records) {
                const key = `${record.adSite.upstreamId}-${record.adSite.upstream.adType.code}`;
                const existing = groupMap.get(key);
                if (existing) {
                    existing.totalRevenue += Number(record.revenue);
                    existing.totalQty += Number(record.qty ?? 0);
                    existing.recordCount += 1;
                } else {
                    groupMap.set(key, {
                        advertiser: record.adSite.upstream.name,
                        advertiserId: record.adSite.upstream.id,
                        adTypeCode: record.adSite.upstream.adType.code,
                        adTypeName: record.adSite.upstream.adType.name,
                        totalRevenue: Number(record.revenue),
                        totalQty: Number(record.qty ?? 0),
                        recordCount: 1,
                    });
                }
            }

            const rows = Array.from(groupMap.values())
                .map((g) => ({
                    advertiser: g.advertiser,
                    advertiserId: g.advertiserId,
                    adTypeCode: g.adTypeCode,
                    adTypeName: g.adTypeName,
                    totalRevenue: Math.round(g.totalRevenue * 1000) / 1000,
                    totalQty: g.totalQty,
                    recordCount: g.recordCount,
                }))
                .sort((a, b) => b.totalRevenue - a.totalRevenue);

            res.json({ success: true, data: rows });
        } catch (err: any) {
            console.error("GET /api/bff/reports/order-profit error:", err);
            res.status(500).json({ success: false, error: "Internal server error" });
        }
    }
);

export default router;