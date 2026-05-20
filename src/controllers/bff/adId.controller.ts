/**
 * BFF AdId Controller
 * AdId is READ-ONLY lookup over AdSite (demand side ad slot)
 * 
 * Per Phase 2 rules:
 * - AdId GET is read-only lookup over AdSite
 * - POST/PUT/DELETE → 501 Not Implemented
 * - "Independent AdId/MediaId creation is not supported. Create Media instead."
 */

import { Router, Request, Response } from "express";
import { param, query, validationResult } from "express-validator";
import { Prisma } from "@prisma/client";
import prisma from "../../prisma.js";
import { requireAuth } from "../../middleware/auth.js";
import {
    mapAdSitesToAdIds,
    type BFFAdId,
    type AdSiteWithUpstream,
} from "../../mappers/bff/adId.mapper.js";

const router = Router();

const handleValidation = (req: Request, res: Response, next: Function) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ success: false, error: errors.array()[0].msg });
        return;
    }
    next();
};

// GET /api/bff/ad-ids
router.get(
    "/",
    requireAuth,
    [
        query("advertiserId").optional().isInt().toInt(),
        query("adTypeCode").optional().isString(),
        query("type").optional().isIn(["CPM", "RATIO"]),
        query("archived").optional().isIn(["0", "1"]),
    ],
    handleValidation,
    async (req: Request, res: Response) => {
        try {
            const advertiserId = req.query.advertiserId ? Number(req.query.advertiserId) : undefined;
            const adTypeCode = req.query.adTypeCode as string | undefined;
            const type = req.query.type as string | undefined;
            const includeArchived = req.query.archived === "1";

            const where: Prisma.AdSiteWhereInput = {};
            if (!includeArchived) {
                where.isArchived = false;
            }
            if (advertiserId) {
                where.upstreamId = advertiserId;
            }
            if (type) {
                where.billingMethod = type;
            }

            const adSites = await prisma.adSite.findMany({
                where,
                include: {
                    upstream: {
                        include: { adType: true },
                    },
                },
                orderBy: [{ upstream: { name: "asc" } }, { name: "asc" }],
            });

            // Filter by adTypeCode if provided
            let filtered: typeof adSites = adSites;
            if (adTypeCode) {
                filtered = adSites.filter(s => s.upstream.adType.code === adTypeCode);
            }

            const adIds = mapAdSitesToAdIds(filtered as AdSiteWithUpstream[]);
            res.json({ success: true, data: adIds });
        } catch (err: any) {
            console.error("GET /api/bff/ad-ids error:", err);
            res.status(500).json({ success: false, error: "Internal server error" });
        }
    }
);

// GET /api/bff/ad-ids/:id
router.get(
    "/:id",
    requireAuth,
    [param("id").isInt().toInt()],
    handleValidation,
    async (req: Request, res: Response) => {
        try {
            const id = Number(req.params.id);
            const adSite = await prisma.adSite.findUnique({
                where: { id },
                include: {
                    upstream: {
                        include: { adType: true },
                    },
                },
            });

            if (!adSite) {
                res.status(404).json({ success: false, error: "AdId not found" });
                return;
            }

            const adIds = mapAdSitesToAdIds([adSite as AdSiteWithUpstream]);
            res.json({ success: true, data: adIds[0] });
        } catch (err: any) {
            console.error("GET /api/bff/ad-ids/:id error:", err);
            res.status(500).json({ success: false, error: "Internal server error" });
        }
    }
);

// POST /api/bff/ad-ids → 501 Not Implemented
router.post(
    "/",
    requireAuth,
    async (_req: Request, res: Response) => {
        res.status(501).json({
            success: false,
            error: "AdId POST not implemented. Independent AdId creation is not supported. Create Media instead.",
        });
    }
);

// PUT /api/bff/ad-ids/:id → 501 Not Implemented
router.put(
    "/:id",
    requireAuth,
    async (_req: Request, res: Response) => {
        res.status(501).json({
            success: false,
            error: "AdId PUT not implemented. Use PUT /api/bff/media/:id for updates.",
        });
    }
);

// DELETE /api/bff/ad-ids/:id → 501 Not Implemented
router.delete(
    "/:id",
    requireAuth,
    async (_req: Request, res: Response) => {
        res.status(501).json({
            success: false,
            error: "AdId delete not implemented. Use DELETE /api/bff/media/:id for soft archive.",
        });
    }
);

export default router;