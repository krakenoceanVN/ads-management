/**
 * BFF MediaId Controller
 * MediaId maps to AdSite + Downstream (supply side ad slot)
 *
 * Endpoints:
 * GET    /api/bff/media-ids              - List mediaIds
 * GET    /api/bff/media-ids/:id          - Get single mediaId
 * POST   /api/bff/media-ids              - Create AdSiteDownstream junction
 * PUT    /api/bff/media-ids/:id          - Update AdSiteDownstream (customPrice only)
 * DELETE /api/bff/media-ids/:id          - Delete AdSiteDownstream junction
 *
 * Rules:
 * - ID-based lookup preferred
 * - CPM only (CPA/CPS = 400 error)
 * - shareRatio from Downstream.payoutRate (NOT rebateRate)
 * - dataCoefficient NOT mapped to rebateRate (different concepts)
 * - shareRatio from Downstream.payoutRate via AdSiteDownstream
 *
 * CREATE safety:
 * - Validates adSiteId and downstreamId exist
 * - Checks @@unique([adSiteId, downstreamId]) before insert
 * - Only creates AdSiteDownstream junction record — does NOT modify AdSite or Downstream
 * - Does NOT update historical DailyInput, settlement, or report data
 *
 * UPDATE safety:
 * - Only updates customPrice on AdSiteDownstream
 * - Does NOT update Downstream.payoutRate (would affect historical billing)
 *
 * DELETE safety:
 * - Only deletes AdSiteDownstream junction
 * - Does NOT cascade delete AdSite or Downstream
 * - Safe because junction has no billing data of its own
 */

import { Router, Request, Response } from "express";
import { body, param, query, validationResult } from "express-validator";
import { Prisma } from "@prisma/client";
import prisma from "../../prisma.js";
import { requireAuth, requirePermission, AuthRequest } from "../../middleware/auth.js";
import { createOperationLog } from "../../services/operationLog.service.js";
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
    requirePermission("media.read"),
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
    requirePermission("media.read"),
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

// POST /api/bff/media-ids
// Creates AdSiteDownstream junction record
router.post(
    "/",
    requireAuth,
    requirePermission("media.create"),
    [
        body("adSiteId").notEmpty().withMessage("adSiteId is required").isInt(),
        body("downstreamId").notEmpty().withMessage("downstreamId is required").isInt(),
        body("customPrice").optional({ nullable: true }).isNumeric(),
        body("status").optional().isIn(["active", "inactive"]),
    ],
    handleValidation,
    async (req: Request, res: Response) => {
        try {
            const { adSiteId, downstreamId, customPrice, status } = req.body;

            // Validate adSiteId exists and load with upstream/adType
            const adSite = await prisma.adSite.findUnique({
                where: { id: adSiteId },
                include: { upstream: { include: { adType: true } } },
            });
            if (!adSite) {
                res.status(400).json({ success: false, error: "Invalid adSiteId" });
                return;
            }

            // Validate downstreamId exists and load with adType
            const downstream = await prisma.downstream.findUnique({
                where: { id: downstreamId },
                include: { adType: true },
            });
            if (!downstream) {
                res.status(400).json({ success: false, error: "Invalid downstreamId" });
                return;
            }

            // Validate adType match — AdSite and Downstream must use the same ad type
            if (adSite.upstream.adTypeId !== downstream.adTypeId) {
                res.status(400).json({
                    success: false,
                    error: "AdSite and downstream must use the same ad type",
                });
                return;
            }

            // Check duplicate junction
            const existing = await prisma.adSiteDownstream.findUnique({
                where: {
                    adSiteId_downstreamId: {
                        adSiteId,
                        downstreamId,
                    },
                },
            });
            if (existing) {
                res.status(409).json({
                    success: false,
                    error: "MediaId already exists for this ad site and downstream",
                    data: {
                        id: existing.id,
                        adSiteId: existing.adSiteId,
                        downstreamId: existing.downstreamId,
                        customPrice: existing.customPrice,
                    },
                });
                return;
            }

            // Create junction record only — no billing changes
            const junction = await prisma.adSiteDownstream.create({
                data: {
                    adSiteId,
                    downstreamId,
                    customPrice: customPrice != null ? customPrice : null,
                },
            });

            createOperationLog({
                userId: (req as AuthRequest).user?.id,
                username: (req as AuthRequest).user?.username,
                action: "CREATE",
                module: "AdId",
                targetType: "MediaId",
                targetId: String(junction.id),
                detail: `adSite:${adSiteId} downstream:${downstreamId}`,
            });

            // Reload the full AdSite with downstream info to return full MediaId representation
            const reloaded = await prisma.adSite.findUnique({
                where: { id: adSiteId },
                include: {
                    upstream: { include: { adType: true } },
                    downstreams: { include: { downstream: true } },
                },
            });

            const mediaIds = mapAdSitesToMediaIds([reloaded as AdSiteWithUpstreamAndDownstream]);

            res.status(201).json({
                success: true,
                data: mediaIds[0],
            });
        } catch (err: any) {
            console.error("POST /api/bff/media-ids error:", err);
            res.status(500).json({ success: false, error: "Internal server error" });
        }
    }
);

// PUT /api/bff/media-ids/:id
// Updates customPrice only on AdSiteDownstream junction
router.put(
    "/:id",
    requireAuth,
    requirePermission("media.update"),
    [
        param("id").isInt().toInt(),
        body("customPrice").optional({ nullable: true }).isNumeric(),
        body("status").optional().isIn(["active", "inactive"]),
    ],
    handleValidation,
    async (req: Request, res: Response) => {
        try {
            const id = Number(req.params.id);
            const { customPrice, status } = req.body;

            const existing = await prisma.adSiteDownstream.findUnique({
                where: { id },
                include: { adSite: true, downstream: true },
            });
            if (!existing) {
                res.status(404).json({ success: false, error: "MediaId not found" });
                return;
            }

            const updateData: Prisma.AdSiteDownstreamUpdateInput = {};
            if (customPrice !== undefined) {
                // customPrice is Decimal in Prisma; cast from number to any to satisfy type checker
                (updateData as any).customPrice = customPrice == null ? Prisma.DbNull : customPrice;
            }

            const updated = await prisma.adSiteDownstream.update({
                where: { id },
                data: updateData,
            });

            createOperationLog({
                userId: (req as AuthRequest).user?.id,
                username: (req as AuthRequest).user?.username,
                action: "UPDATE",
                module: "AdId",
                targetType: "MediaId",
                targetId: String(id),
                detail: `adSite:${updated.adSiteId} downstream:${updated.downstreamId}`,
            });

            // Reload full representation
            const reloaded = await prisma.adSite.findUnique({
                where: { id: updated.adSiteId },
                include: {
                    upstream: { include: { adType: true } },
                    downstreams: { include: { downstream: true } },
                },
            });

            const mediaIds = mapAdSitesToMediaIds([reloaded as AdSiteWithUpstreamAndDownstream]);

            res.json({
                success: true,
                data: mediaIds[0],
            });
        } catch (err: any) {
            console.error("PUT /api/bff/media-ids/:id error:", err);
            res.status(500).json({ success: false, error: "Internal server error" });
        }
    }
);

// DELETE /api/bff/media-ids/:id
// Deletes AdSiteDownstream junction record only
router.delete(
    "/:id",
    requireAuth,
    requirePermission("media.delete"),
    [param("id").isInt().toInt()],
    handleValidation,
    async (req: Request, res: Response) => {
        try {
            const id = Number(req.params.id);

            const existing = await prisma.adSiteDownstream.findUnique({ where: { id } });
            if (!existing) {
                res.status(404).json({ success: false, error: "MediaId not found" });
                return;
            }

            await prisma.adSiteDownstream.delete({ where: { id } });

            createOperationLog({
                userId: (req as AuthRequest).user?.id,
                username: (req as AuthRequest).user?.username,
                action: "DELETE",
                module: "AdId",
                targetType: "MediaId",
                targetId: String(id),
                detail: `adSite:${existing.adSiteId} downstream:${existing.downstreamId}`,
            });

            res.json({
                success: true,
                data: {
                    id,
                    deleted: true,
                },
            });
        } catch (err: any) {
            console.error("DELETE /api/bff/media-ids/:id error:", err);
            res.status(500).json({ success: false, error: "Internal server error" });
        }
    }
);

export default router;