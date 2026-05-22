/**
 * BFF Downstream Controller
 * Read-only endpoint for looking up Downstream entities.
 *
 * Endpoints:
 * GET /api/bff/downstreams        - List downstreams
 * GET /api/bff/downstreams/:id   - Get single downstream
 *
 * Rules:
 * - Read-only — no POST/PUT/DELETE
 * - No payoutRate mutation (would affect historical billing)
 * - adTypeCode joined from AdType relation
 */

import { Router, Request, Response } from "express";
import { query, param, validationResult } from "express-validator";
import prisma from "../../prisma.js";
import { requireAuth } from "../../middleware/auth.js";

const router = Router();

const handleValidation = (req: Request, res: Response, next: Function) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ success: false, error: errors.array()[0].msg });
        return;
    }
    next();
};

// GET /api/bff/downstreams
router.get(
    "/",
    requireAuth,
    [
        query("adTypeCode").optional().isString(),
        query("status").optional().isIn(["active", "inactive"]),
        query("keyword").optional().isString(),
    ],
    handleValidation,
    async (req: Request, res: Response) => {
        try {
            const adTypeCode = req.query.adTypeCode as string | undefined;
            const status = req.query.status as string | undefined;
            const keyword = req.query.keyword as string | undefined;

            const where: any = {};
            if (status) where.status = status;
            if (adTypeCode) {
                where.adType = { code: adTypeCode };
            }
            if (keyword) {
                where.downstreamType = { contains: keyword, mode: 'insensitive' };
            }

            const downstreams = await prisma.downstream.findMany({
                where,
                include: { adType: true },
                orderBy: { downstreamType: "asc" },
            });

            const result = downstreams.map(d => ({
                id: d.id,
                downstreamType: d.downstreamType,
                adTypeId: d.adTypeId,
                adTypeCode: d.adType.code,
                payoutRate: d.payoutRate ? Number(d.payoutRate) : null,
                status: d.status,
            }));

            res.json({ success: true, data: result });
        } catch (err: any) {
            console.error("GET /api/bff/downstreams error:", err);
            res.status(500).json({ success: false, error: "Internal server error" });
        }
    }
);

// GET /api/bff/downstreams/:id
router.get(
    "/:id",
    requireAuth,
    [param("id").isInt().toInt()],
    handleValidation,
    async (req: Request, res: Response) => {
        try {
            const id = Number(req.params.id);
            const downstream = await prisma.downstream.findUnique({
                where: { id },
                include: { adType: true },
            });

            if (!downstream) {
                res.status(404).json({ success: false, error: "Downstream not found" });
                return;
            }

            res.json({
                success: true,
                data: {
                    id: downstream.id,
                    downstreamType: downstream.downstreamType,
                    adTypeId: downstream.adTypeId,
                    adTypeCode: downstream.adType.code,
                    payoutRate: downstream.payoutRate ? Number(downstream.payoutRate) : null,
                    status: downstream.status,
                },
            });
        } catch (err: any) {
            console.error("GET /api/bff/downstreams/:id error:", err);
            res.status(500).json({ success: false, error: "Internal server error" });
        }
    }
);

export default router;