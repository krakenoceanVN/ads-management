/**
 * BFF Advertiser Controller
 * Handles Frontend Advertiser → Backend Upstream mapping
 * 
 * Endpoints:
 * GET    /api/bff/advertisers          - List all advertisers
 * GET    /api/bff/advertisers/:id     - Get single advertiser
 * POST   /api/bff/advertisers          - Create advertiser
 * PUT    /api/bff/advertisers/:id      - Update advertiser
 * DELETE /api/bff/advertisers/:id      - Soft delete (status=inactive)
 */

import { Router, Request, Response } from "express";
import { body, param, validationResult } from "express-validator";
import prisma from "../../prisma.js";
import { requireAuth, AuthRequest } from "../../middleware/auth.js";
import { createOperationLog } from "../../services/operationLog.service.js";
import {
    mapUpstreamToAdvertiser,
    mapUpstreamsToAdvertisers,
    type BFFAdvertiser,
    type CreateAdvertiserRequest,
    type UpdateAdvertiserRequest,
} from "../../mappers/bff/advertiser.mapper.js";

const router = Router();

const handleValidation = (req: Request, res: Response, next: Function) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ success: false, error: errors.array()[0].msg });
        return;
    }
    next();
};

// GET /api/bff/advertisers
router.get(
    "/",
    requireAuth,
    async (_req: Request, res: Response) => {
        try {
            const upstreams = await prisma.upstream.findMany({
                include: { adType: true },
                orderBy: [{ adType: { code: "asc" } }, { name: "asc" }],
            });

            const advertisers = mapUpstreamsToAdvertisers(upstreams);
            res.json({ success: true, data: advertisers });
        } catch (err: any) {
            console.error("GET /api/bff/advertisers error:", err);
            res.status(500).json({ success: false, error: "Internal server error" });
        }
    }
);

// GET /api/bff/advertisers/:id
router.get(
    "/:id",
    requireAuth,
    [param("id").isInt().toInt()],
    handleValidation,
    async (req: Request, res: Response) => {
        try {
            const id = Number(req.params.id);
            const upstream = await prisma.upstream.findUnique({
                where: { id },
                include: { adType: true },
            });

            if (!upstream) {
                res.status(404).json({ success: false, error: "Advertiser not found" });
                return;
            }

            const advertiser = mapUpstreamToAdvertiser(upstream);
            res.json({ success: true, data: advertiser });
        } catch (err: any) {
            console.error("GET /api/bff/advertisers/:id error:", err);
            res.status(500).json({ success: false, error: "Internal server error" });
        }
    }
);

// POST /api/bff/advertisers
router.post(
    "/",
    requireAuth,
    [
        body("name").notEmpty().withMessage("name is required").isLength({ max: 200 }),
        body("adTypeCode").notEmpty().withMessage("adTypeCode is required (no default)"),
        body("status").optional().isIn(["active", "inactive"]),
        body("contact").optional().isString(),
        body("phone").optional().isString(),
        body("email").optional().isString(),
        body("notes").optional().isString(),
    ],
    handleValidation,
    async (req: Request, res: Response) => {
        try {
            const { name, adTypeCode, status, contact, phone, email, notes } = req.body as CreateAdvertiserRequest;

            // Resolve adTypeCode to adTypeId
            const adType = await prisma.adType.findUnique({
                where: { code: adTypeCode },
            });

            if (!adType) {
                res.status(400).json({
                    success: false,
                    error: `Invalid adTypeCode: '${adTypeCode}'. Must be one of: SM, 360, BAIDU_JS, OTHER`,
                });
                return;
            }

            const upstream = await prisma.upstream.create({
                data: {
                    name: name.trim(),
                    adTypeId: adType.id,
                    status: status ?? "active",
                    contact: contact?.trim() || null,
                    phone: phone?.trim() || null,
                    email: email?.trim() || null,
                    notes: notes?.trim() || null,
                },
                include: { adType: true },
            });

            const advertiser = mapUpstreamToAdvertiser(upstream);
            createOperationLog({
                userId: (req as AuthRequest).user?.id,
                username: (req as AuthRequest).user?.username,
                action: "CREATE",
                module: "Advertiser",
                targetType: "Upstream",
                targetId: String(upstream.id),
                detail: name.trim(),
            });
            res.status(201).json({ success: true, data: advertiser });
        } catch (err: any) {
            console.error("POST /api/bff/advertisers error:", err);
            res.status(500).json({ success: false, error: "Internal server error" });
        }
    }
);

// PUT /api/bff/advertisers/:id
router.put(
    "/:id",
    requireAuth,
    [
        param("id").isInt().toInt(),
        body("name").optional().isLength({ max: 200 }),
        body("adTypeCode").optional().isLength({ max: 20 }),
        body("status").optional().isIn(["active", "inactive"]),
        body("contact").optional().isString(),
        body("phone").optional().isString(),
        body("email").optional().isString(),
        body("notes").optional().isString(),
    ],
    handleValidation,
    async (req: Request, res: Response) => {
        try {
            const id = Number(req.params.id);
            const { name, adTypeCode, status, contact, phone, email, notes } = req.body as UpdateAdvertiserRequest;

            const existing = await prisma.upstream.findUnique({ where: { id } });
            if (!existing) {
                res.status(404).json({ success: false, error: "Advertiser not found" });
                return;
            }

            const updateData: Record<string, unknown> = {};
            if (name !== undefined) updateData.name = name.trim();
            if (status !== undefined) updateData.status = status;
            if (contact !== undefined) updateData.contact = contact?.trim() || null;
            if (phone !== undefined) updateData.phone = phone?.trim() || null;
            if (email !== undefined) updateData.email = email?.trim() || null;
            if (notes !== undefined) updateData.notes = notes?.trim() || null;

            // Resolve adTypeCode if provided
            if (adTypeCode !== undefined) {
                const adType = await prisma.adType.findUnique({
                    where: { code: adTypeCode },
                });
                if (!adType) {
                    res.status(400).json({
                        success: false,
                        error: `Invalid adTypeCode: '${adTypeCode}'`,
                    });
                    return;
                }
                updateData.adTypeId = adType.id;
            }

            const updated = await prisma.upstream.update({
                where: { id },
                data: updateData,
                include: { adType: true },
            });

            const advertiser = mapUpstreamToAdvertiser(updated);
            createOperationLog({
                userId: (req as AuthRequest).user?.id,
                username: (req as AuthRequest).user?.username,
                action: "UPDATE",
                module: "Advertiser",
                targetType: "Upstream",
                targetId: String(id),
                detail: updated.name,
            });
            res.json({ success: true, data: advertiser });
        } catch (err: any) {
            console.error("PUT /api/bff/advertisers/:id error:", err);
            res.status(500).json({ success: false, error: "Internal server error" });
        }
    }
);

// DELETE /api/bff/advertisers/:id (soft delete - set status=inactive)
router.delete(
    "/:id",
    requireAuth,
    [param("id").isInt().toInt()],
    handleValidation,
    async (req: Request, res: Response) => {
        try {
            const id = Number(req.params.id);

            const existing = await prisma.upstream.findUnique({ where: { id } });
            if (!existing) {
                res.status(404).json({ success: false, error: "Advertiser not found" });
                return;
            }

            // Check for existing DailyInput references
            const hasDailyInput = await prisma.dailyInput.findFirst({
                where: {
                    adSite: {
                        upstreamId: id,
                    },
                },
            });

            if (hasDailyInput) {
                // Soft delete - set status to inactive
                await prisma.upstream.update({
                    where: { id },
                    data: { status: "inactive" },
                });
                createOperationLog({
                    userId: (req as AuthRequest).user?.id,
                    username: (req as AuthRequest).user?.username,
                    action: "DELETE",
                    module: "Advertiser",
                    targetType: "Upstream",
                    targetId: String(id),
                    detail: existing.name,
                });
                res.json({
                    success: true,
                    message: "Advertiser deactivated (has existing data)",
                    deactivated: true,
                });
            } else {
                // No data references - can soft delete
                await prisma.upstream.update({
                    where: { id },
                    data: { status: "inactive" },
                });
                createOperationLog({
                    userId: (req as AuthRequest).user?.id,
                    username: (req as AuthRequest).user?.username,
                    action: "DELETE",
                    module: "Advertiser",
                    targetType: "Upstream",
                    targetId: String(id),
                    detail: existing.name,
                });
                res.json({ success: true, message: "Advertiser deactivated" });
            }
        } catch (err: any) {
            console.error("DELETE /api/bff/advertisers/:id error:", err);
            res.status(500).json({ success: false, error: "Internal server error" });
        }
    }
);

export default router;