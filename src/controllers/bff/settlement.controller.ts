/**
 * BFF Settlement Controller
 * Handles settlement endpoints for frontend (advertiser/media perspective)
 * Mounted at /api/bff/settlement
 * 
 * GET /api/bff/settlement/advertisers - period param (YYYY-MM)
 * GET /api/bff/settlement/media - period param (YYYY-MM)
 */

import { Router, Request, Response } from "express";
import { query, validationResult } from "express-validator";
import { Prisma } from "@prisma/client";
import prisma from "../../prisma.js";
import { requireAuth } from "../../middleware/auth.js";
import { getBusinessMonthRange } from "../../utils/date.js";

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
// GET /api/bff/settlement/advertisers
// Query: period (YYYY-MM), advertiserId (optional), adTypeCode (optional)
// Returns advertiser settlement rows grouped by upstream (confirmed only)
// ============================================================
router.get(
    "/advertisers",
    requireAuth,
    [
        query("period").notEmpty().withMessage("period is required (YYYY-MM)"),
        query("advertiserId").optional().isInt().toInt(),
        query("adTypeCode").optional().isString(),
    ],
    handleValidation,
    async (req: Request, res: Response) => {
        try {
            const periodStr = req.query.period as string;
            const advertiserId = req.query.advertiserId as number | undefined;
            const adTypeCode = req.query.adTypeCode as string | undefined;

            const [year, month] = periodStr.split("-").map(Number);
            const { gte, lt } = getBusinessMonthRange(year, month);

            const baseWhere: Prisma.DailyInputWhereInput = {
                recordDate: { gte, lt },
                status: "confirmed",
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

            const groupMap = new Map<number, {
                advertiser: string;
                advertiserId: number;
                adTypeCode: string;
                adTypeName: string;
                totalRevenue: number;
                recordCount: number;
            }>();

            for (const record of records) {
                const upstreamId = record.adSite.upstreamId;
                const existing = groupMap.get(upstreamId);
                if (existing) {
                    existing.totalRevenue += Number(record.revenue);
                    existing.recordCount += 1;
                } else {
                    groupMap.set(upstreamId, {
                        advertiser: record.adSite.upstream.name,
                        advertiserId: upstreamId,
                        adTypeCode: record.adSite.upstream.adType.code,
                        adTypeName: record.adSite.upstream.adType.name,
                        totalRevenue: Number(record.revenue),
                        recordCount: 1,
                    });
                }
            }

            const rows = Array.from(groupMap.values())
                .map((g) => ({
                    period: periodStr,
                    advertiser: g.advertiser,
                    advertiserId: g.advertiserId,
                    adTypeCode: g.adTypeCode,
                    adTypeName: g.adTypeName,
                    amount: Math.round(g.totalRevenue * 100) / 100,
                    recordCount: g.recordCount,
                }))
                .sort((a, b) => b.amount - a.amount);

            res.json({ success: true, data: rows });
        } catch (err: any) {
            console.error("GET /api/bff/settlement/advertisers error:", err);
            res.status(500).json({ success: false, error: "Internal server error" });
        }
    }
);

// ============================================================
// GET /api/bff/settlement/media
// Query: period (YYYY-MM), mediaId (optional), adTypeCode (optional)
// Returns media settlement rows grouped by adSite (confirmed only)
// ============================================================
router.get(
    "/media",
    requireAuth,
    [
        query("period").notEmpty().withMessage("period is required (YYYY-MM)"),
        query("mediaId").optional().isInt().toInt(),
        query("adTypeCode").optional().isString(),
    ],
    handleValidation,
    async (req: Request, res: Response) => {
        try {
            const periodStr = req.query.period as string;
            const mediaId = req.query.mediaId as number | undefined;
            const adTypeCode = req.query.adTypeCode as string | undefined;

            const [year, month] = periodStr.split("-").map(Number);
            const { gte, lt } = getBusinessMonthRange(year, month);

            const baseWhere: Prisma.DailyInputWhereInput = {
                recordDate: { gte, lt },
                status: "confirmed",
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

            const records = await prisma.dailyInput.findMany({
                where,
                include: {
                    adSite: {
                        include: {
                            upstream: { include: { adType: true } },
                            downstreams: {
                                include: { downstream: true },
                            },
                        },
                    },
                },
            });

            const groupMap = new Map<number, {
                media: string;
                mediaId: number;
                adTypeCode: string;
                adTypeName: string;
                totalReceivable: number;
                totalActualReceived: number;
                shareRatio: number | null;
                recordCount: number;
            }>();

            for (const record of records) {
                const siteId = record.adSite.id;
                const downstream = record.adSite.downstreams.find((ds) => ds.downstream.status === "active");
                const shareRatio = downstream ? Number(downstream.downstream.payoutRate) : null;
                const revenue = Number(record.revenue);
                const actualReceived = shareRatio !== null ? revenue * shareRatio : revenue;

                const existing = groupMap.get(siteId);
                if (existing) {
                    existing.totalReceivable += revenue;
                    existing.totalActualReceived += actualReceived;
                    existing.recordCount += 1;
                } else {
                    groupMap.set(siteId, {
                        media: record.adSite.name,
                        mediaId: siteId,
                        adTypeCode: record.adSite.upstream.adType.code,
                        adTypeName: record.adSite.upstream.adType.name,
                        totalReceivable: revenue,
                        totalActualReceived: actualReceived,
                        shareRatio,
                        recordCount: 1,
                    });
                }
            }

            const rows = Array.from(groupMap.values())
                .map((g) => ({
                    period: periodStr,
                    media: g.media,
                    mediaId: g.mediaId,
                    adTypeCode: g.adTypeCode,
                    adTypeName: g.adTypeName,
                    receivable: Math.round(g.totalReceivable * 100) / 100,
                    actualReceived: Math.round(g.totalActualReceived * 100) / 100,
                    shareRatio: g.shareRatio,
                    recordCount: g.recordCount,
                }))
                .sort((a, b) => b.actualReceived - a.actualReceived);

            res.json({ success: true, data: rows });
        } catch (err: any) {
            console.error("GET /api/bff/settlement/media error:", err);
            res.status(500).json({ success: false, error: "Internal server error" });
        }
    }
);

export default router;