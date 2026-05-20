/**
 * BFF AdOrder Controller
 * AdOrder is VIRTUAL/READ-ONLY - derived from AdType (category/formula metadata)
 * 
 * Per Phase 2 rules:
 * - GET derives from AdType, NOT AdSite
 * - Do NOT group by upstreamId
 * - POST/PUT/DELETE → 501 Not Implemented
 */

import { Router, Request, Response } from "express";
import { param, query, validationResult } from "express-validator";
import { Prisma } from "@prisma/client";
import prisma from "../../prisma.js";
import { requireAuth } from "../../middleware/auth.js";
import {
    mapAdTypesToAdOrders,
    type BFFAdOrder,
} from "../../mappers/bff/adOrder.mapper.js";

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
        query("advId").optional().isInt().toInt(),
    ],
    handleValidation,
    async (req: Request, res: Response) => {
        try {
            const advId = req.query.advId ? Number(req.query.advId) : null;

            // AdOrder is derived from AdType, not AdSite
            const adTypes = await prisma.adType.findMany({
                orderBy: { name: "asc" },
            });

            const adOrders = mapAdTypesToAdOrders(adTypes, advId);
            res.json({ success: true, data: adOrders });
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

            const adType = await prisma.adType.findUnique({
                where: { id },
            });

            if (!adType) {
                res.status(404).json({ success: false, error: "AdOrder not found" });
                return;
            }

            const adOrders = mapAdTypesToAdOrders([adType], null);
            res.json({ success: true, data: adOrders[0] });
        } catch (err: any) {
            console.error("GET /api/bff/ad-orders/:id error:", err);
            res.status(500).json({ success: false, error: "Internal server error" });
        }
    }
);

// POST /api/bff/ad-orders → 501 Not Implemented
router.post(
    "/",
    requireAuth,
    async (_req: Request, res: Response) => {
        res.status(501).json({
            success: false,
            error: "AdOrder is virtual/read-only. POST not supported.",
        });
    }
);

// PUT /api/bff/ad-orders/:id → 501 Not Implemented
router.put(
    "/:id",
    requireAuth,
    async (_req: Request, res: Response) => {
        res.status(501).json({
            success: false,
            error: "AdOrder is virtual/read-only. PUT not supported.",
        });
    }
);

// DELETE /api/bff/ad-orders/:id → 501 Not Implemented
router.delete(
    "/:id",
    requireAuth,
    async (_req: Request, res: Response) => {
        res.status(501).json({
            success: false,
            error: "AdOrder is virtual/read-only. DELETE not supported.",
        });
    }
);

export default router;