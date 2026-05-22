/**
 * BFF AdOrder Controller
 * AdOrder is a PERSISTENT entity — per-advertiser order/campaign
 *
 * Rules:
 * - GET lists AdOrder records, filtered by advertiserId and/or adTypeCode
 * - POST creates new AdOrder
 * - PUT updates existing AdOrder
 * - DELETE soft-deletes (status=inactive) AdOrder
 * - Exclude soft-deleted records by default
 */

import { Router, Request, Response } from "express";
import { body, param, query, validationResult } from "express-validator";
import { Prisma } from "@prisma/client";
import prisma from "../../prisma.js";
import { requireAuth, AuthRequest } from "../../middleware/auth.js";
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

// GET /api/bff/ad-orders
router.get(
    "/",
    requireAuth,
    [
        query("advertiserId").optional().isInt().toInt(),
        query("adTypeCode").optional().isString(),
    ],
    handleValidation,
    async (req: Request, res: Response) => {
        try {
            const advertiserId = req.query.advertiserId ? Number(req.query.advertiserId) : undefined;
            const adTypeCode = req.query.adTypeCode as string | undefined;

            const where: any = {};
            if (advertiserId) where.upstreamId = advertiserId;

            // Always fetch real AdOrder rows
            const realOrders = await prisma.adOrder.findMany({
                where,
                include: {
                    upstream: { include: { adType: true } },
                    adType: true,
                },
                orderBy: { name: "asc" },
            });

            const result: any[] = realOrders.map(o => ({
                id: o.id,
                advId: o.upstreamId,
                name: o.name,
                adTypeCode: o.adType.code,
                notes: o.notes,
                status: o.status,
                isVirtual: false,
            }));

            // Build compound key Set: "upstreamId:adTypeCode" for real records
            const realKeys = new Set(realOrders.map(o => `${o.upstreamId}:${o.adType.code}`));

            // Determine which (upstream, adTypeCode) pairs need virtual rows
            // For each upstream in scope, all its adTypes are candidates
            const upstreamWhere: any = { status: "active" };
            if (advertiserId) upstreamWhere.id = advertiserId;

            const upstreams = await prisma.upstream.findMany({
                where: upstreamWhere,
                include: { adType: true },
                orderBy: { name: "asc" },
            });

            for (const u of upstreams) {
                const key = `${u.id}:${u.adType.code}`;
                if (!realKeys.has(key)) {
                    // No real AdOrder for this upstream+adTypeCode combination — add not-synced row
                    const entry = {
                        id: u.id,
                        advId: u.id,
                        name: u.adType.name,
                        adTypeCode: u.adType.code,
                        notes: null,
                        status: u.status,
                        isVirtual: true,
                    };
                    if (!adTypeCode || entry.adTypeCode === adTypeCode) {
                        result.push(entry);
                    }
                }
            }

            res.json({ success: true, data: result });
        } catch (err: any) {
            console.error("GET /api/bff/ad-orders error:", err);
            res.status(500).json({ success: false, error: "Internal server error" });
        }
    }
);

// GET /api/bff/ad-orders/:id
router.get(
    "/:id",
    requireAuth,
    [param("id").isInt().toInt()],
    handleValidation,
    async (req: Request, res: Response) => {
        try {
            const id = Number(req.params.id);
            const order = await prisma.adOrder.findUnique({
                where: { id },
                include: { upstream: { include: { adType: true } }, adType: true },
            });

            if (!order) {
                res.status(404).json({ success: false, error: "AdOrder not found" });
                return;
            }

            res.json({
                success: true,
                data: {
                    id: order.id,
                    advId: order.upstreamId,
                    name: order.name,
                    adTypeCode: order.adType.code,
                    notes: order.notes,
                    status: order.status,
                },
            });
        } catch (err: any) {
            console.error("GET /api/bff/ad-orders/:id error:", err);
            res.status(500).json({ success: false, error: "Internal server error" });
        }
    }
);

// POST /api/bff/ad-orders
router.post(
    "/",
    requireAuth,
    [
        body("advertiserId").notEmpty().withMessage("advertiserId is required").isInt(),
        body("adTypeCode").notEmpty().withMessage("adTypeCode is required"),
        body("name").notEmpty().withMessage("name is required").isLength({ max: 200 }),
        body("notes").optional().isString(),
        body("status").optional().isIn(["active", "inactive"]),
    ],
    handleValidation,
    async (req: Request, res: Response) => {
        try {
            const { advertiserId, adTypeCode, name, notes, status } = req.body;

            // Resolve advertiser
            const advertiser = await prisma.upstream.findUnique({ where: { id: advertiserId } });
            if (!advertiser) {
                res.status(400).json({ success: false, error: "Invalid advertiserId" });
                return;
            }

            // Resolve adTypeCode to adTypeId
            const adType = await prisma.adType.findUnique({ where: { code: adTypeCode } });
            if (!adType) {
                res.status(400).json({ success: false, error: `Invalid adTypeCode: '${adTypeCode}'` });
                return;
            }

            // Check duplicate by compound key: upstreamId + adTypeId
            const existing = await prisma.adOrder.findFirst({
                where: {
                    upstreamId: advertiserId,
                    adTypeId: adType.id,
                },
            });
            if (existing) {
                res.status(409).json({
                    success: false,
                    error: `AdOrder already exists for this advertiser and ad type`,
                    data: {
                        id: existing.id,
                        advId: existing.upstreamId,
                        name: existing.name,
                        adTypeCode: adTypeCode,
                        notes: existing.notes,
                        status: existing.status,
                    },
                });
                return;
            }

            const order = await prisma.adOrder.create({
                data: {
                    upstreamId: advertiserId,
                    adTypeId: adType.id,
                    name: name.trim(),
                    notes: notes?.trim() || null,
                    status: status ?? "active",
                },
                include: { upstream: { include: { adType: true } }, adType: true },
            });

            createOperationLog({
                userId: (req as AuthRequest).user?.id,
                username: (req as AuthRequest).user?.username,
                action: "CREATE",
                module: "AdOrder",
                targetType: "AdOrder",
                targetId: String(order.id),
                detail: order.name,
            });

            res.status(201).json({
                success: true,
                data: {
                    id: order.id,
                    advId: order.upstreamId,
                    name: order.name,
                    adTypeCode: order.adType.code,
                    notes: order.notes,
                    status: order.status,
                },
            });
        } catch (err: any) {
            console.error("POST /api/bff/ad-orders error:", err);
            res.status(500).json({ success: false, error: "Internal server error" });
        }
    }
);

// PUT /api/bff/ad-orders/:id
router.put(
    "/:id",
    requireAuth,
    [
        param("id").isInt().toInt(),
        body("name").optional().isLength({ max: 200 }),
        body("adTypeCode").optional().isString(),
        body("notes").optional().isString(),
        body("status").optional().isIn(["active", "inactive"]),
    ],
    handleValidation,
    async (req: Request, res: Response) => {
        try {
            const id = Number(req.params.id);
            const { name, adTypeCode, notes, status } = req.body;

            const existing = await prisma.adOrder.findUnique({ where: { id } });
            if (!existing) {
                res.status(404).json({ success: false, error: "AdOrder not found" });
                return;
            }

            const updateData: Record<string, unknown> = {};
            if (name !== undefined) updateData.name = name.trim();
            if (status !== undefined) updateData.status = status;
            if (notes !== undefined) updateData.notes = notes?.trim() || null;

            if (adTypeCode !== undefined) {
                const adType = await prisma.adType.findUnique({ where: { code: adTypeCode } });
                if (!adType) {
                    res.status(400).json({ success: false, error: `Invalid adTypeCode: '${adTypeCode}'` });
                    return;
                }
                updateData.adTypeId = adType.id;
            }

            const order = await prisma.adOrder.update({
                where: { id },
                data: updateData,
                include: { upstream: { include: { adType: true } }, adType: true },
            });

            createOperationLog({
                userId: (req as AuthRequest).user?.id,
                username: (req as AuthRequest).user?.username,
                action: "UPDATE",
                module: "AdOrder",
                targetType: "AdOrder",
                targetId: String(id),
                detail: order.name,
            });

            res.json({
                success: true,
                data: {
                    id: order.id,
                    advId: order.upstreamId,
                    name: order.name,
                    adTypeCode: order.adType.code,
                    notes: order.notes,
                    status: order.status,
                },
            });
        } catch (err: any) {
            console.error("PUT /api/bff/ad-orders/:id error:", err);
            res.status(500).json({ success: false, error: "Internal server error" });
        }
    }
);

// DELETE /api/bff/ad-orders/:id (soft delete)
router.delete(
    "/:id",
    requireAuth,
    [param("id").isInt().toInt()],
    handleValidation,
    async (req: Request, res: Response) => {
        try {
            const id = Number(req.params.id);

            const existing = await prisma.adOrder.findUnique({ where: { id } });
            if (!existing) {
                res.status(404).json({ success: false, error: "AdOrder not found" });
                return;
            }

            // Soft delete — set status to inactive
            const order = await prisma.adOrder.update({
                where: { id },
                data: { status: "inactive" },
                include: { upstream: { include: { adType: true } }, adType: true },
            });

            createOperationLog({
                userId: (req as AuthRequest).user?.id,
                username: (req as AuthRequest).user?.username,
                action: "DELETE",
                module: "AdOrder",
                targetType: "AdOrder",
                targetId: String(id),
                detail: order.name,
            });

            res.json({
                success: true,
                data: {
                    id: order.id,
                    advId: order.upstreamId,
                    name: order.name,
                    adTypeCode: order.adType.code,
                    notes: order.notes,
                    status: order.status,
                },
            });
        } catch (err: any) {
            console.error("DELETE /api/bff/ad-orders/:id error:", err);
            res.status(500).json({ success: false, error: "Internal server error" });
        }
    }
);

export default router;