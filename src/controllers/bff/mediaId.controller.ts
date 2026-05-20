/**
 * BFF MediaId Controller
 * MediaId maps to AdSite + Downstream (supply side ad slot)
 * 
 * Endpoints:
 * GET    /api/bff/media-ids              - List mediaIds
 * GET    /api/bff/media-ids/:id          - Get single mediaId
 * POST   /api/bff/media-ids              - 501 Not Implemented (requires Downstream link)
 * PUT    /api/bff/media-ids/:id          - 501 Not Implemented (requires Downstream link)
 * DELETE /api/bff/media-ids/:id          - 501 Not Implemented (use Media soft delete)
 * 
 * Rules:
 * - ID-based lookup preferred
 * - CPM only (CPA/CPS = 400 error)
 * - shareRatio from Downstream.payoutRate (NOT rebateRate)
 * - dataCoefficient NOT mapped to rebateRate (different concepts)
 * 
 * NOTE: POST/PUT not implemented because creating/updating MediaId requires
 * managing the AdSiteDownstream junction table and Downstream payoutRate,
 * which involves complex business logic that may affect billing calculations.
 */

import { Router, Request, Response } from "express";
import { body, param, query, validationResult } from "express-validator";
import { Prisma } from "@prisma/client";
import prisma from "../../prisma.js";
import { requireAuth } from "../../middleware/auth.js";
import {
    mapAdSitesToMediaIds,
    type BFFMediaId,
    type AdSiteWithUpstreamAndDownstream,
} from "../../mappers/bff/mediaId.mapper.js";

const router = Router();

const handleValidation = (req: Request, res: Response, next: Function) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ success: false, error: errors.array()[0].msg });
        return;
    }
    next();
};

// GET /api/bff/media-ids
router.get(
    "/",
    requireAuth,
    [
        query("mediaId").optional().isInt().toInt(),
        query("adTypeCode").optional().isString(),
        query("type").optional().isIn(["CPM", "RATIO"]),
        query("archived").optional().isIn(["0", "1"]),
    ],
    handleValidation,
    async (req: Request, res: Response) => {
        try {
            const mediaId = req.query.mediaId ? Number(req.query.mediaId) : undefined;
            const adTypeCode = req.query.adTypeCode as string | undefined;
            const type = req.query.type as string | undefined;
            const includeArchived = req.query.archived === "1";

            const where: Prisma.AdSiteWhereInput = {};
            if (!includeArchived) {
                where.isArchived = false;
            }
            if (mediaId) {
                where.upstreamId = mediaId;
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
                    downstreams: {
                        include: {
                            downstream: true,
                        },
                    },
                },
                orderBy: [{ upstream: { name: "asc" } }, { name: "asc" }],
            });

            // Filter by adTypeCode if provided
            let filtered: typeof adSites = adSites;
            if (adTypeCode) {
                filtered = adSites.filter(s => s.upstream.adType.code === adTypeCode);
            }

            const mediaIds = mapAdSitesToMediaIds(filtered as AdSiteWithUpstreamAndDownstream[]);
            res.json({ success: true, data: mediaIds });
        } catch (err: any) {
            console.error("GET /api/bff/media-ids error:", err);
            res.status(500).json({ success: false, error: "Internal server error" });
        }
    }
);

// GET /api/bff/media-ids/:id
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
                    downstreams: {
                        include: {
                            downstream: true,
                        },
                    },
                },
            });

            if (!adSite) {
                res.status(404).json({ success: false, error: "MediaId not found" });
                return;
            }

            const mediaIds = mapAdSitesToMediaIds([adSite as AdSiteWithUpstreamAndDownstream]);
            res.json({ success: true, data: mediaIds[0] });
        } catch (err: any) {
            console.error("GET /api/bff/media-ids/:id error:", err);
            res.status(500).json({ success: false, error: "Internal server error" });
        }
    }
);

// POST /api/bff/media-ids → 501 Not Implemented
// Reason: Creating MediaId requires managing AdSiteDownstream junction and Downstream payoutRate
// which involves complex billing logic that may affect downstream settlement calculations.
// To safely implement this, we would need to:
// 1. Validate downstreamId exists
// 2. Create AdSiteDownstream junction record
// 3. Set payoutRate on the downstream link
// This is complex and not safe to implement without understanding full downstream billing flow.
router.post(
    "/",
    requireAuth,
    async (_req: Request, res: Response) => {
        res.status(501).json({
            success: false,
            error: "MediaId POST not implemented. Creating media IDs requires managing downstream payoutRate and AdSiteDownstream junction, which involves complex billing logic.",
        });
    }
);

// PUT /api/bff/media-ids/:id → 501 Not Implemented
// Reason: Updating MediaId shareRatio requires updating Downstream.payoutRate via AdSiteDownstream
// which may affect historical billing calculations. Not safe to implement without understanding
// the full downstream settlement impact.
router.put(
    "/:id",
    requireAuth,
    async (_req: Request, res: Response) => {
        res.status(501).json({
            success: false,
            error: "MediaId PUT not implemented. Updating shareRatio requires updating Downstream.payoutRate, which may affect historical billing calculations.",
        });
    }
);

// DELETE /api/bff/media-ids/:id → 501 Not Implemented
// Reason: Use DELETE /api/bff/media/:id for soft archive instead
router.delete(
    "/:id",
    requireAuth,
    async (_req: Request, res: Response) => {
        res.status(501).json({
            success: false,
            error: "MediaId delete not implemented. Use DELETE /api/bff/media/:id for soft archive.",
        });
    }
);

export default router;