/**
 * BFF Media Controller
 * Handles Frontend Media → Backend AdSite mapping
 * 
 * Endpoints:
 * GET    /api/bff/media              - List all media
 * GET    /api/bff/media/:id         - Get single media
 * POST   /api/bff/media              - Create media
 * PUT    /api/bff/media/:id           - Update media
 * DELETE /api/bff/media/:id           - Soft archive (isArchived=true)
 */

import { Router, Request, Response } from "express";
import { body, param, query, validationResult } from "express-validator";
import prisma from "../../prisma.js";
import { requireAuth, AuthRequest } from "../../middleware/auth.js";
import { createOperationLog } from "../../services/operationLog.service.js";
import {
    mapAdSiteToMedia,
    mapAdSitesToMedia,
    type BFFMedia,
    type CreateMediaRequest,
    type UpdateMediaRequest,
} from "../../mappers/bff/media.mapper.js";

const router = Router();

const handleValidation = (req: Request, res: Response, next: Function) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ success: false, error: errors.array()[0].msg });
        return;
    }
    next();
};

// GET /api/bff/media
router.get(
    "/",
    requireAuth,
    [
        query("upstreamId").optional().isInt().toInt(),
        query("archived").optional().isIn(["0", "1"]),
    ],
    handleValidation,
    async (req: Request, res: Response) => {
        try {
            const upstreamId = req.query.upstreamId ? Number(req.query.upstreamId) : undefined;
            const includeArchived = req.query.archived === "1";

            const where: any = {};
            if (!includeArchived) {
                where.isArchived = false;
            }
            if (upstreamId) {
                where.upstreamId = upstreamId;
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

            const media = mapAdSitesToMedia(adSites);
            res.json({ success: true, data: media });
        } catch (err: any) {
            console.error("GET /api/bff/media error:", err);
            res.status(500).json({ success: false, error: "Internal server error" });
        }
    }
);

// GET /api/bff/media/:id
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
                res.status(404).json({ success: false, error: "Media not found" });
                return;
            }

            const media = mapAdSiteToMedia(adSite);
            res.json({ success: true, data: media });
        } catch (err: any) {
            console.error("GET /api/bff/media/:id error:", err);
            res.status(500).json({ success: false, error: "Internal server error" });
        }
    }
);

// POST /api/bff/media
router.post(
    "/",
    requireAuth,
    [
        body("name").notEmpty().withMessage("name is required").isLength({ max: 200 }),
        body("upstreamId").isInt().toInt().withMessage("upstreamId is required (no default)"),
        body("billingMethod").isIn(["CPM", "RATIO", "CPA"]).withMessage("billingMethod must be CPM, RATIO, or CPA (no default)"),
        body("status").optional().isIn(["active", "inactive"]),
        body("currentUnitPrice").optional().isFloat().toFloat(),
        body("currentRatio").optional().isFloat().toFloat(),
    ],
    handleValidation,
    async (req: Request, res: Response) => {
        try {
            const {
                name,
                upstreamId,
                billingMethod,
                status,
                currentUnitPrice,
                currentRatio,
            } = req.body as CreateMediaRequest;

            // Validate upstreamId exists
            const upstream = await prisma.upstream.findUnique({
                where: { id: upstreamId },
            });

            if (!upstream) {
                res.status(400).json({
                    success: false,
                    error: `Invalid upstreamId: ${upstreamId}. Advertiser not found.`,
                });
                return;
            }

            const createData: any = {
                name: name.trim(),
                upstreamId,
                billingMethod,
                status: status ?? "active",
                isActive: true,
                isArchived: false,
            };

            if (billingMethod === "CPM") {
                createData.currentUnitPrice = currentUnitPrice ?? 0;
            } else if (billingMethod === "RATIO") {
                createData.currentRatio = currentRatio ?? 1;
            } else {
                // CPA: no default price/ratio
            }

            const adSite = await prisma.$transaction(async (tx) => {
                const created = await tx.adSite.create({
                    data: createData,
                });

                // Create event for creation
                await tx.adSiteEvent.create({
                    data: {
                        adSiteId: created.id,
                        eventType: "CREATED",
                    },
                });

                return created;
            });

            // Fetch with upstream for response
            const adSiteWithUpstream = await prisma.adSite.findUnique({
                where: { id: adSite.id },
                include: { upstream: { include: { adType: true } } },
            });

            const media = mapAdSiteToMedia(adSiteWithUpstream!);
            createOperationLog({
                userId: (req as AuthRequest).user?.id,
                username: (req as AuthRequest).user?.username,
                action: "CREATE",
                module: "Media",
                targetType: "AdSite",
                targetId: String(adSite.id),
                detail: adSite.name,
            });
            res.status(201).json({ success: true, data: media });
        } catch (err: any) {
            console.error("POST /api/bff/media error:", err);
            res.status(500).json({ success: false, error: "Internal server error" });
        }
    }
);

// PUT /api/bff/media/:id
router.put(
    "/:id",
    requireAuth,
    [
        param("id").isInt().toInt(),
        body("name").optional().isLength({ max: 200 }),
        body("upstreamId").optional().isInt().toInt(),
        body("billingMethod").optional().isIn(["CPM", "RATIO", "CPA"]),
        body("status").optional().isIn(["active", "inactive"]),
        body("currentUnitPrice").optional().isFloat().toFloat(),
        body("currentRatio").optional().isFloat().toFloat(),
    ],
    handleValidation,
    async (req: Request, res: Response) => {
        try {
            const id = Number(req.params.id);
            const {
                name,
                upstreamId,
                billingMethod,
                status,
                currentUnitPrice,
                currentRatio,
            } = req.body as UpdateMediaRequest;

            const existing = await prisma.adSite.findUnique({ where: { id } });
            if (!existing) {
                res.status(404).json({ success: false, error: "Media not found" });
                return;
            }

            const updateData: Record<string, unknown> = {};
            if (name !== undefined) updateData.name = name.trim();
            if (status !== undefined) updateData.status = status;

            if (upstreamId !== undefined) {
                const upstream = await prisma.upstream.findUnique({ where: { id: upstreamId } });
                if (!upstream) {
                    res.status(400).json({
                        success: false,
                        error: `Invalid upstreamId: ${upstreamId}`,
                    });
                    return;
                }
                updateData.upstreamId = upstreamId;
            }

            if (billingMethod !== undefined) {
                if (billingMethod !== "CPM" && billingMethod !== "RATIO" && billingMethod !== "CPA") {
                    res.status(400).json({
                        success: false,
                        error: "billingMethod must be CPM, RATIO, or CPA",
                    });
                    return;
                }
                updateData.billingMethod = billingMethod;
                if (billingMethod === "CPM") {
                    updateData.currentUnitPrice = currentUnitPrice ?? existing.currentUnitPrice ?? 0;
                    updateData.currentRatio = null;
                } else if (billingMethod === "RATIO") {
                    updateData.currentRatio = currentRatio ?? existing.currentRatio ?? 1;
                    updateData.currentUnitPrice = null;
                } else {
                    // CPA: no currentUnitPrice/currentRatio needed
                    updateData.currentUnitPrice = null;
                    updateData.currentRatio = null;
                }
            }

            const updated = await prisma.adSite.update({
                where: { id },
                data: updateData,
                include: { upstream: { include: { adType: true } } },
            });

            const media = mapAdSiteToMedia(updated);
            createOperationLog({
                userId: (req as AuthRequest).user?.id,
                username: (req as AuthRequest).user?.username,
                action: "UPDATE",
                module: "Media",
                targetType: "AdSite",
                targetId: String(id),
                detail: updated.name,
            });
            res.json({ success: true, data: media });
        } catch (err: any) {
            console.error("PUT /api/bff/media/:id error:", err);
            res.status(500).json({ success: false, error: "Internal server error" });
        }
    }
);

// DELETE /api/bff/media/:id (soft archive - set isArchived=true)
router.delete(
    "/:id",
    requireAuth,
    [param("id").isInt().toInt()],
    handleValidation,
    async (req: Request, res: Response) => {
        try {
            const id = Number(req.params.id);

            const existing = await prisma.adSite.findUnique({ where: { id } });
            if (!existing) {
                res.status(404).json({ success: false, error: "Media not found" });
                return;
            }

            // Check for confirmed DailyInput references
            const hasConfirmedInput = await prisma.dailyInput.findFirst({
                where: {
                    adSiteId: id,
                    status: "confirmed",
                },
            });

            // Soft archive - set isArchived=true
            await prisma.$transaction(async (tx) => {
                await tx.adSite.update({
                    where: { id },
                    data: { isArchived: true },
                });

                // Create DIED event
                await tx.adSiteEvent.create({
                    data: {
                        adSiteId: id,
                        eventType: "DIED",
                    },
                });
            });

            createOperationLog({
                userId: (req as AuthRequest).user?.id,
                username: (req as AuthRequest).user?.username,
                action: "DELETE",
                module: "Media",
                targetType: "AdSite",
                targetId: String(id),
                detail: existing.name,
            });

            if (hasConfirmedInput) {
                res.json({
                    success: true,
                    message: "Media archived (has confirmed data)",
                    archived: true,
                });
            } else {
                res.json({ success: true, message: "Media archived" });
            }
        } catch (err: any) {
            console.error("DELETE /api/bff/media/:id error:", err);
            res.status(500).json({ success: false, error: "Internal server error" });
        }
    }
);

export default router;