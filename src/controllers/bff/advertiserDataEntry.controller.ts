/**
 * BFF Advertiser DataEntry Controller
 * Handles Advertiser-side daily data entry rows (upstream perspective)
 * 
 * Uses shared saveDailyInputBatch() workflow from workflows/dailyInputBatch.workflow.ts
 */

import { Router, Request, Response } from "express";
import { param, query, body, validationResult } from "express-validator";
import { Prisma } from "@prisma/client";
import prisma from "../../prisma.js";
import { requireAuth, AuthRequest } from "../../middleware/auth.js";
import { createOperationLog } from "../../services/operationLog.service.js";
import {
    mapDailyInputToAdvertiserEntry,
    mapAdSiteToAdvertiserEntry,
    validateDataCoefficient,
    mapTypeToBillingMethod,
    type BFFAdvertiserEntryRow,
} from "../../mappers/bff/dataEntry.mapper.js";
import { saveDailyInputBatch, type DailyInputBatchRecord } from "../../workflows/dailyInputBatch.workflow.js";
import { getBusinessDayRange } from "../../utils/date.js";

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
// GET /api/bff/data-entry/advertisers
// Query: date (YYYY-MM-DD), advertiserId (optional), adTypeCode (optional)
// ============================================================
router.get(
    "/",
    requireAuth,
    [
        query("date").notEmpty().withMessage("date is required").isISO8601(),
        query("advertiserId").optional().isInt().toInt(),
        query("adTypeCode").optional().isString(),
        query("status").optional().isIn(["pending", "confirmed", "unconfirmed"]),
    ],
    handleValidation,
    async (req: Request, res: Response) => {
        try {
            const dateStr = req.query.date as string;
            const advertiserId = req.query.advertiserId as number | undefined;
            const adTypeCode = req.query.adTypeCode as string | undefined;
            const statusFilter = req.query.status as string | undefined;

            const { gte: startOfDay, lt: endOfDay } = getBusinessDayRange(dateStr);

            // Build base where for DailyInput query
            const baseWhere: Prisma.DailyInputWhereInput = {
                recordDate: { gte: startOfDay, lt: endOfDay },
            };

            // Build where clause for AdSite master rows
            const adSiteWhere: Prisma.AdSiteWhereInput = {
                isArchived: false,
                status: "active",
                upstream: { status: "active" },
            };
            if (advertiserId) adSiteWhere.upstreamId = advertiserId;
            if (adTypeCode) adSiteWhere.upstream = { ...adSiteWhere.upstream as object, adType: { code: adTypeCode } };

            // Load master AdSite rows (all active ad sites for this date's master data)
            const adSites = await prisma.adSite.findMany({
                where: adSiteWhere,
                include: {
                    upstream: { include: { adType: true } },
                },
                orderBy: { name: "asc" },
            });

            // Load existing DailyInput records for this date
            let existingWhere: Prisma.DailyInputWhereInput = baseWhere;
            if (advertiserId) {
                existingWhere = { ...existingWhere, adSite: { upstreamId: advertiserId } };
            }
            if (adTypeCode) {
                const adTypeFilter = advertiserId
                    ? { upstreamId: advertiserId, upstream: { adType: { code: adTypeCode } } }
                    : { upstream: { adType: { code: adTypeCode } } };
                existingWhere = { ...existingWhere, adSite: adTypeFilter as Prisma.AdSiteWhereInput };
            }
            if (statusFilter) {
                existingWhere.status = statusFilter === "pending" ? "unconfirmed" : statusFilter;
            }

            const existingRecords = await prisma.dailyInput.findMany({
                where: existingWhere,
                include: {
                    adSite: {
                        include: {
                            upstream: { include: { adType: true } },
                        },
                    },
                },
                orderBy: { adSite: { name: "asc" } },
            });

            // Build a map of existing DailyInput by adSiteId for merge
            const existingByAdSiteId = new Map<number, typeof existingRecords[0]>();
            for (const r of existingRecords) {
                existingByAdSiteId.set(r.adSiteId, r);
            }

            // Merge: generate rows from AdSite master data, overlay existing DailyInput where present
            const rows: BFFAdvertiserEntryRow[] = adSites.map((site) => {
                const existing = existingByAdSiteId.get(site.id);
                if (existing) {
                    return mapDailyInputToAdvertiserEntry(existing, adTypeCode || site.upstream.adType.code);
                }
                return mapAdSiteToAdvertiserEntry(site, dateStr);
            });

            res.json({ success: true, data: rows });
        } catch (err: any) {
            console.error("GET /api/bff/data-entry/advertisers error:", err);
            res.status(500).json({ success: false, error: "Internal server error" });
        }
    }
);

// ============================================================
// POST /api/bff/data-entry/advertisers/batch
// Body: { date, adTypeCode, records: AdvertiserBatchItem[] }
// Reuses existing DailyInput batch workflow
// ============================================================
router.post(
    "/batch",
    requireAuth,
    [
        body("date").notEmpty().withMessage("date is required").isISO8601(),
        body("adTypeCode").notEmpty().withMessage("adTypeCode is required"),
        body("records").isArray({ min: 1 }).withMessage("records must be a non-empty array"),
    ],
    handleValidation,
    async (req: Request, res: Response) => {
        try {
            const { date, adTypeCode, records } = req.body as {
                date: string;
                adTypeCode: string;
                records: AdvertiserBatchItem[];
            };

            // Validate types — reject unsupported
            for (const item of records) {
                const billingMethod = mapTypeToBillingMethod(item.type);
                if (billingMethod === "UNSUPPORTED") {
                    res.status(400).json({
                        success: false,
                        error: `Unsupported type '${item.type}'. Only CPM, RATIO, and CPA are supported.`,
                    });
                    return;
                }

                // Validate dataCoefficient
                const dcError = validateDataCoefficient(item.dataCoefficient);
                if (dcError) {
                    res.status(400).json({ success: false, error: dcError });
                    return;
                }
            }

            // Build records for shared workflow
            const batchRecords: DailyInputBatchRecord[] = records.map((item) => {
                const billingMethod = mapTypeToBillingMethod(item.type);
                if (billingMethod === "CPM") {
                    return {
                        ad_site_id: item.adId,
                        qty: item.traffic !== "" ? parseInt(item.traffic, 10) || 0 : undefined,
                        unit_price_override: item.rate !== "" ? parseFloat(item.rate) : undefined,
                    };
                } else {
                    // RATIO: settlement → amount1, amount2 = 0
                    const settlement = item.settlement !== "" ? parseFloat(item.settlement) || 0 : 0;
                    return {
                        ad_site_id: item.adId,
                        amount1: settlement,
                        amount2: 0,
                        ratio_override: item.rate !== "" ? parseFloat(item.rate) : undefined,
                    };
                }
            });

            // Call shared workflow (no userId needed for advertiser-side, pass 0 or get from auth)
            const result = await saveDailyInputBatch({
                date,
                adTypeCode: adTypeCode as any,
                records: batchRecords,
                userId: (req as AuthRequest).user?.id ?? 0,
            });

            createOperationLog({
                userId: (req as AuthRequest).user?.id,
                username: (req as AuthRequest).user?.username,
                action: "SAVE",
                module: "DataEntry",
                targetType: "DailyInput",
                targetId: null,
                detail: `Saved advertiser data entry batch: date=${date}, adTypeCode=${adTypeCode}, count=${records.length}`,
            });

            res.json(result);
        } catch (err: any) {
            console.error("POST /api/bff/data-entry/advertisers/batch error:", err);
            res.status(500).json({ success: false, error: "Internal server error" });
        }
    }
);

// ============================================================
// POST /api/bff/data-entry/advertisers/confirm-batch
// Body: { ids: number[] }
// ============================================================
router.post(
    "/confirm-batch",
    requireAuth,
    [
        body("ids").isArray({ min: 1 }).withMessage("ids must be a non-empty array"),
        body("ids.*").isInt().toInt().withMessage("all ids must be integers"),
    ],
    handleValidation,
    async (req: Request, res: Response) => {
        try {
            const ids = [...new Set((req.body.ids as number[]).map(Number).filter(Number.isInteger))];

            if (ids.length === 0) {
                res.status(400).json({ success: false, error: "No valid ids provided" });
                return;
            }

            const result = await prisma.dailyInput.updateMany({
                where: { id: { in: ids }, status: "unconfirmed" },
                data: { status: "confirmed" },
            });

            createOperationLog({
                userId: (req as AuthRequest).user?.id,
                username: (req as AuthRequest).user?.username,
                action: "CONFIRM",
                module: "DataEntry",
                targetType: "DailyInput",
                targetId: null,
                detail: `Confirmed advertiser data entries: count=${result.count}`,
            });

            res.json({ success: true, updated: result.count });
        } catch (err: any) {
            console.error("POST /api/bff/data-entry/advertisers/confirm-batch error:", err);
            res.status(500).json({ success: false, error: "Internal server error" });
        }
    }
);

// ============================================================
// PUT /api/bff/data-entry/advertisers/:id/unconfirm
// ============================================================
router.put(
    "/:id/unconfirm",
    requireAuth,
    [param("id").isInt().toInt()],
    handleValidation,
    async (req: Request, res: Response) => {
        try {
            const id = Number(req.params.id);

            const existing = await prisma.dailyInput.findUnique({ where: { id } });
            if (!existing) {
                res.status(404).json({ success: false, error: "Record not found" });
                return;
            }
            if (existing.status !== "confirmed") {
                res.status(409).json({ success: false, error: "Record not confirmed — cannot unconfirm" });
                return;
            }

            await prisma.dailyInput.update({
                where: { id },
                data: { status: "unconfirmed" },
            });

            createOperationLog({
                userId: (req as AuthRequest).user?.id,
                username: (req as AuthRequest).user?.username,
                action: "UNCONFIRM",
                module: "DataEntry",
                targetType: "DailyInput",
                targetId: String(id),
                detail: `Unconfirmed advertiser data entry id=${id}`,
            });

            res.json({ success: true, message: "Unconfirmed" });
        } catch (err: any) {
            console.error("PUT /api/bff/data-entry/advertisers/:id/unconfirm error:", err);
            res.status(500).json({ success: false, error: "Internal server error" });
        }
    }
);

// ============================================================
// Types
// ============================================================
interface AdvertiserBatchItem {
    adId: number;
    type: "CPM" | "RATIO";
    rate: string;
    traffic: string;
    settlement: string;
    dataCoefficient?: unknown;
}

export default router;
