/**
 * BFF AdId Controller
 * AdId is a PERSISTENT entity — maps to AdSite (demand-side ad slot)
 *
 * Rules:
 * - GET lists AdIds from AdSite, supports advertiserId/adOrderId/type filtering
 * - POST creates new AdSite record
 * - PUT updates existing AdSite record
 * - DELETE soft-deletes (isArchived=true) AdSite
 * - Exclude archived records by default
 * - billingMethod: CPM | RATIO (CPA mapped at API boundary)
 */

import { Router, Request, Response } from "express";
import { body, param, query, validationResult } from "express-validator";
import { Prisma } from "@prisma/client";
import prisma from "../../prisma.js";
import { requireAuth, requirePermission, AuthRequest } from "../../middleware/auth.js";
import { createOperationLog } from "../../services/operationLog.service.js";

const router = Router();

const handleValidation = (req: Request, res: Response, next: Function) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ success: false, error: errors.array()[0].msg });
        return;
    }
    next();
};

function mapAdSiteToAdId(adSite: any): any {
    return {
        id: adSite.id,
        slot: adSite.name,
        type: adSite.billingMethod,
        rate: adSite.billingMethod === 'CPM'
            ? (adSite.currentUnitPrice ? Number(adSite.currentUnitPrice) : null)
            : (adSite.currentRatio ? Number(adSite.currentRatio) : null),
        status: adSite.status,
        advertiserId: adSite.upstreamId,
        advertiserName: adSite.upstream?.name ?? '',
        adTypeCode: adSite.upstream?.adType?.code ?? '',
        adOrderId: adSite.adOrderId,
        upstreamId: adSite.upstreamId,
        billingMethod: adSite.billingMethod,
        isActive: adSite.isActive,
        isArchived: adSite.isArchived,
    };
}

// GET /api/bff/ad-ids
router.get(
    "/",
    requireAuth,
    requirePermission("adId.read"),
    [
        query("advertiserId").optional().isInt().toInt(),
        query("adOrderId").optional().isInt().toInt(),
        query("adTypeCode").optional().isString(),
        query("type").optional().isIn(["CPM", "RATIO", "CPA"]),
        query("archived").optional().isIn(["0", "1"]),
    ],
    handleValidation,
    async (req: Request, res: Response) => {
        try {
            const advertiserId = req.query.advertiserId ? Number(req.query.advertiserId) : undefined;
            const adOrderId = req.query.adOrderId ? Number(req.query.adOrderId) : undefined;
            const adTypeCode = req.query.adTypeCode as string | undefined;
            const type = req.query.type as string | undefined;
            const includeArchived = req.query.archived === "1";

            const where: Prisma.AdSiteWhereInput = {};
            if (!includeArchived) where.isArchived = false;
            if (advertiserId) where.upstreamId = advertiserId;
            if (adOrderId) where.adOrderId = adOrderId;
            if (type) where.billingMethod = type;

            const adSites = await prisma.adSite.findMany({
                where,
                include: {
                    upstream: { include: { adType: true } },
                    adOrder: true,
                },
                orderBy: [{ upstream: { name: "asc" } }, { name: "asc" }],
            });

            // Filter by adTypeCode if provided
            let filtered = adSites;
            if (adTypeCode) {
                filtered = adSites.filter(s => s.upstream.adType.code === adTypeCode);
            }

            const adIds = filtered.map(mapAdSiteToAdId);
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
    requirePermission("adId.read"),
    [param("id").isInt().toInt()],
    handleValidation,
    async (req: Request, res: Response) => {
        try {
            const id = Number(req.params.id);
            const adSite = await prisma.adSite.findUnique({
                where: { id },
                include: {
                    upstream: { include: { adType: true } },
                    adOrder: true,
                },
            });

            if (!adSite) {
                res.status(404).json({ success: false, error: "AdId not found" });
                return;
            }

            res.json({ success: true, data: mapAdSiteToAdId(adSite) });
        } catch (err: any) {
            console.error("GET /api/bff/ad-ids/:id error:", err);
            res.status(500).json({ success: false, error: "Internal server error" });
        }
    }
);

// POST /api/bff/ad-ids
router.post(
    "/",
    requireAuth,
    requirePermission("adId.create"),
    [
        body("advertiserId").notEmpty().withMessage("advertiserId is required").isInt(),
        body("adOrderId").notEmpty().withMessage("adOrderId is required").isInt(),
        body("slot").notEmpty().withMessage("slot (ad ID) is required").isLength({ max: 200 }),
        body("type").notEmpty().withMessage("type is required").isIn(["CPM", "RATIO", "CPA"]),
        body("unitPrice").optional().isFloat({ min: 0 }),
        body("ratio").optional().isFloat({ min: 0, max: 1 }),
        body("notes").optional().isString(),
        body("status").optional().isIn(["active", "inactive"]),
    ],
    handleValidation,
    async (req: Request, res: Response) => {
        try {
            const { advertiserId, adOrderId, slot, type, unitPrice, ratio, notes, status } = req.body;

            // Resolve advertiser
            const advertiser = await prisma.upstream.findUnique({ where: { id: advertiserId } });
            if (!advertiser) {
                res.status(400).json({ success: false, error: "Invalid advertiserId" });
                return;
            }

            // Validate adOrderId — must be real, active, and belong to the advertiser
            const adOrder = await prisma.adOrder.findFirst({
                where: {
                    id: Number(adOrderId),
                    status: "active",
                    upstreamId: advertiserId,
                },
                include: { upstream: true, adType: true },
            });
            if (!adOrder) {
                res.status(400).json({ success: false, error: "Invalid or inactive adOrderId, or does not belong to advertiser" });
                return;
            }

            const data: Prisma.AdSiteCreateInput = {
                upstream: { connect: { id: advertiserId } },
                adOrder: { connect: { id: adOrderId } },
                name: slot.trim(),
                billingMethod: type,
                status: status ?? "active",
                isActive: true,
                isArchived: false,
            };

            if (type === "CPM" && unitPrice !== undefined) {
                data.currentUnitPrice = unitPrice;
            }
            if (type === "RATIO" && ratio !== undefined) {
                data.currentRatio = ratio;
            }

            const adSite = await prisma.adSite.create({
                data,
                include: {
                    upstream: { include: { adType: true } },
                    adOrder: true,
                },
            });

            createOperationLog({
                userId: (req as AuthRequest).user?.id,
                username: (req as AuthRequest).user?.username,
                action: "CREATE",
                module: "AdId",
                targetType: "AdSite",
                targetId: String(adSite.id),
                detail: adSite.name,
            });

            res.status(201).json({ success: true, data: mapAdSiteToAdId(adSite) });
        } catch (err: any) {
            console.error("POST /api/bff/ad-ids error:", err);
            res.status(500).json({ success: false, error: "Internal server error" });
        }
    }
);

// PUT /api/bff/ad-ids/:id
router.put(
    "/:id",
    requireAuth,
    requirePermission("adId.update"),
    [
        param("id").isInt().toInt(),
        body("adOrderId").optional().isInt(),
        body("slot").optional().isLength({ max: 200 }),
        body("type").optional().isIn(["CPM", "RATIO", "CPA"]),
        body("unitPrice").optional().isFloat({ min: 0 }),
        body("ratio").optional().isFloat({ min: 0, max: 1 }),
        body("notes").optional().isString(),
        body("status").optional().isIn(["active", "inactive"]),
    ],
    handleValidation,
    async (req: Request, res: Response) => {
        try {
            const id = Number(req.params.id);
            const { adOrderId, slot, type, unitPrice, ratio, notes, status } = req.body;

            const existing = await prisma.adSite.findUnique({ where: { id } });
            if (!existing) {
                res.status(404).json({ success: false, error: "AdId not found" });
                return;
            }

            // If adOrderId is provided in payload, validate it (cannot clear it via this endpoint)
            if (adOrderId !== undefined) {
                const adOrder = await prisma.adOrder.findFirst({
                    where: {
                        id: Number(adOrderId),
                        status: "active",
                        upstreamId: existing.upstreamId,
                    },
                });
                if (!adOrder) {
                    res.status(400).json({ success: false, error: "Invalid or inactive adOrderId, or does not belong to advertiser" });
                    return;
                }
            }

            const updateData: Prisma.AdSiteUpdateInput = {};
            if (slot !== undefined) updateData.name = slot.trim();
            if (type !== undefined) updateData.billingMethod = type;
            if (status !== undefined) updateData.status = status;
            if (adOrderId !== undefined) {
                updateData.adOrder = { connect: { id: adOrderId } };
            }
            if (unitPrice !== undefined) updateData.currentUnitPrice = unitPrice;
            if (ratio !== undefined) updateData.currentRatio = ratio;

            const adSite = await prisma.adSite.update({
                where: { id },
                data: updateData,
                include: {
                    upstream: { include: { adType: true } },
                    adOrder: true,
                },
            });

            createOperationLog({
                userId: (req as AuthRequest).user?.id,
                username: (req as AuthRequest).user?.username,
                action: "UPDATE",
                module: "AdId",
                targetType: "AdSite",
                targetId: String(id),
                detail: adSite.name,
            });

            res.json({ success: true, data: mapAdSiteToAdId(adSite) });
        } catch (err: any) {
            console.error("PUT /api/bff/ad-ids/:id error:", err);
            res.status(500).json({ success: false, error: "Internal server error" });
        }
    }
);

// DELETE /api/bff/ad-ids/:id (soft delete — archive)
router.delete(
    "/:id",
    requireAuth,
    requirePermission("adId.delete"),
    [param("id").isInt().toInt()],
    handleValidation,
    async (req: Request, res: Response) => {
        try {
            const id = Number(req.params.id);

            const existing = await prisma.adSite.findUnique({ where: { id } });
            if (!existing) {
                res.status(404).json({ success: false, error: "AdId not found" });
                return;
            }

            // Soft delete — set isArchived = true
            const adSite = await prisma.adSite.update({
                where: { id },
                data: { isArchived: true },
                include: {
                    upstream: { include: { adType: true } },
                    adOrder: true,
                },
            });

            createOperationLog({
                userId: (req as AuthRequest).user?.id,
                username: (req as AuthRequest).user?.username,
                action: "DELETE",
                module: "AdId",
                targetType: "AdSite",
                targetId: String(id),
                detail: adSite.name,
            });

            res.json({ success: true, data: mapAdSiteToAdId(adSite) });
        } catch (err: any) {
            console.error("DELETE /api/bff/ad-ids/:id error:", err);
            res.status(500).json({ success: false, error: "Internal server error" });
        }
    }
);

export default router;