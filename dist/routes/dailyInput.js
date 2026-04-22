"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const auth_js_1 = require("../middleware/auth.js");
const prisma_js_1 = __importDefault(require("../prisma.js"));
const date_js_1 = require("../utils/date.js");
const calculations_js_1 = require("../utils/calculations.js");
const router = (0, express_1.Router)();
// ============================================================
// Validation helpers
// ============================================================
const handleValidation = (req, res, next) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ success: false, error: errors.array()[0].msg });
        return;
    }
    next();
};
function toNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}
async function getActiveUpstreamRebateRateMap(upstreamIds, targetDate) {
    if (upstreamIds.length === 0) {
        return new Map();
    }
    const rates = await prisma_js_1.default.upstreamRebateRate.findMany({
        where: {
            upstreamId: { in: upstreamIds },
            startDate: { lte: targetDate },
            OR: [{ endDate: null }, { endDate: { gte: targetDate } }],
        },
        orderBy: [{ upstreamId: "asc" }, { startDate: "desc" }],
    });
    const rateMap = new Map();
    for (const rate of rates) {
        if (!rateMap.has(rate.upstreamId)) {
            rateMap.set(rate.upstreamId, Number(rate.rate));
        }
    }
    return rateMap;
}
async function unconfirmDailyInputRecord(req, res) {
    try {
        const id = Number(req.params.id);
        const existing = await prisma_js_1.default.dailyInput.findUnique({ where: { id } });
        if (!existing) {
            res.status(404).json({ success: false, error: "Record not found" });
            return;
        }
        if (existing.status !== "confirmed") {
            res.status(409).json({ success: false, error: "Record not confirmed — cannot unconfirm" });
            return;
        }
        const updated = await prisma_js_1.default.dailyInput.update({
            where: { id },
            data: { status: "unconfirmed" },
        });
        res.json({ success: true, data: updated, message: "Unconfirmed" });
    }
    catch (err) {
        console.error("PUT /api/daily-input/:id/unconfirm error:", err);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
}
// ============================================================
// GET /api/daily-input
// Query: date (YYYY-MM-DD), ad_type (SM|360|BAIDU_JS)
// ============================================================
router.get("/", [
    (0, express_validator_1.query)("date").notEmpty().withMessage("date is required").isISO8601(),
    (0, express_validator_1.query)("ad_type").notEmpty().withMessage("ad_type is required").isIn(["SM", "360", "BAIDU_JS", "OTHER"]),
    (0, express_validator_1.query)("search").optional().isString(),
    (0, express_validator_1.query)("status").optional().isIn(["confirmed", "unconfirmed"]),
], handleValidation, async (req, res) => {
    try {
        const dateStr = req.query.date;
        const adTypeCode = req.query.ad_type;
        const search = req.query.search?.trim();
        const searchFilter = search
            ? {
                OR: [
                    { name: { contains: search, mode: "insensitive" } },
                    {
                        upstream: {
                            name: { contains: search, mode: "insensitive" },
                        },
                    },
                ],
            }
            : undefined;
        // 1. Lấy tất cả ad_sites theo ad_type + search (Nguồn trên OR Ad Site)
        const adSites = await prisma_js_1.default.adSite.findMany({
            where: {
                isActive: true,
                isArchived: false,
                status: "active",
                upstream: {
                    status: "active",
                    adType: { code: adTypeCode },
                },
                ...searchFilter,
            },
            include: {
                upstream: { include: { adType: true } },
            },
            orderBy: { name: "asc" },
        });
        if (adSites.length === 0) {
            res.json({ success: true, data: [] });
            return;
        }
        const siteIds = adSites.map((s) => s.id);
        const activeRebateRateMap = adTypeCode === "SM"
            ? await getActiveUpstreamRebateRateMap([...new Set(adSites.map((site) => site.upstreamId))], (0, date_js_1.getBusinessDayStart)(dateStr))
            : new Map();
        // 2. LEFT JOIN daily_input WHERE record_date = date (using range for TZ safety)
        const { gte: startOfDay, lt: endOfDay } = (0, date_js_1.getBusinessDayRange)(dateStr);
        const records = await prisma_js_1.default.dailyInput.findMany({
            where: {
                recordDate: { gte: startOfDay, lt: endOfDay },
                adSiteId: { in: siteIds },
            },
        });
        // Map Prisma camelCase → snake_case DailyInputRecord
        const recordMap = new Map();
        for (const r of records) {
            recordMap.set(r.adSiteId, {
                id: r.id,
                record_date: (0, date_js_1.formatBusinessDate)(r.recordDate),
                ad_site_id: r.adSiteId,
                qty: r.qty ?? undefined,
                unit_price_snapshot: r.unitPriceSnapshot ? Number(r.unitPriceSnapshot) : undefined,
                amount1: Number(r.amount1),
                amount2: Number(r.amount2),
                ratio_snapshot: r.ratioSnapshot ? Number(r.ratioSnapshot) : undefined,
                rebate_amount: Number(r.rebateAmount),
                rebate_rate_snapshot: Number(r.rebateRateSnapshot),
                actual_revenue: Number(r.revenue),
                revenue: Number(r.revenue),
                status: r.status,
                created_at: r.createdAt,
                updated_at: r.updatedAt,
            });
        }
        // 3. Build DailyInputRow[] (AdSite snake_case shape + existing_record)
        const rows = adSites.map((site) => ({
            id: site.id,
            upstream_id: site.upstreamId,
            name: site.name,
            billing_method: site.billingMethod,
            current_unit_price: site.currentUnitPrice ? Number(site.currentUnitPrice) : undefined,
            current_ratio: site.currentRatio ? Number(site.currentRatio) : undefined,
            status: site.status,
            upstream_name: site.upstream.name,
            ad_type_id: site.upstream.adTypeId,
            ad_type_code: site.upstream.adType.code,
            active_rebate_rate: adTypeCode === "SM" ? (activeRebateRateMap.get(site.upstreamId) ?? 0) : undefined,
            existing_record: recordMap.get(site.id) ?? null,
            created_at: site.createdAt,
            updated_at: site.updatedAt,
        }));
        res.json({ success: true, data: rows });
    }
    catch (err) {
        console.error("GET /api/daily-input error:", err);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
});
// ============================================================
// POST /api/daily-input/batch
// Body: { date: string, ad_type: AdTypeCode, records: BatchInputItem[] }
// ============================================================
router.post("/batch", auth_js_1.requireAuth, auth_js_1.requireWriteAccess, (0, auth_js_1.requirePermission)("perm_data_input"), [
    (0, express_validator_1.body)("date").notEmpty().withMessage("date is required").isISO8601(),
    (0, express_validator_1.body)("ad_type").notEmpty().withMessage("ad_type is required").isIn(["SM", "360", "BAIDU_JS", "OTHER"]),
    (0, express_validator_1.body)("records").isArray({ min: 1 }).withMessage("records must be a non-empty array"),
], handleValidation, async (req, res) => {
    try {
        const { date, ad_type, records } = req.body;
        const userId = req.user.id;
        // Validate: date <= today
        const inputDate = (0, date_js_1.getBusinessDayStart)(date);
        const todayDate = (0, date_js_1.getBusinessDayStart)((0, date_js_1.formatBusinessDate)(new Date()));
        if (inputDate.getTime() > todayDate.getTime()) {
            res.status(400).json({ success: false, error: "Cannot input future date" });
            return;
        }
        // Fetch all involved ad_sites
        const siteIds = records.map((r) => r.ad_site_id);
        const adSites = await prisma_js_1.default.adSite.findMany({
            where: {
                id: { in: siteIds },
                isActive: true,
                isArchived: false,
                status: "active",
                upstream: {
                    status: "active",
                },
            },
            include: { upstream: { include: { adType: true } } },
        });
        const siteMap = new Map(adSites.map((s) => [s.id, s]));
        const activeRebateRateMap = ad_type === "SM"
            ? await getActiveUpstreamRebateRateMap([...new Set(adSites.map((site) => site.upstreamId))], inputDate)
            : new Map();
        const errors = [];
        let saved = 0;
        for (const item of records) {
            const site = siteMap.get(item.ad_site_id);
            if (!site) {
                errors.push({ ad_site_id: item.ad_site_id, message: "Ad site not found" });
                continue;
            }
            if (site.upstream.adType.code !== ad_type) {
                errors.push({ ad_site_id: item.ad_site_id, message: `Site does not belong to ${ad_type}` });
                continue;
            }
            // Check existing record
            const existing = await prisma_js_1.default.dailyInput.findUnique({
                where: {
                    recordDate_adSiteId: {
                        recordDate: inputDate,
                        adSiteId: item.ad_site_id,
                    },
                },
            });
            if (existing && existing.status === "confirmed") {
                errors.push({ ad_site_id: item.ad_site_id, message: "Record confirmed — cannot edit" });
                continue;
            }
            let revenue;
            let rebateAmount = 0;
            let rebateRateSnapshot = 0;
            if (site.billingMethod === "CPM") {
                // CPM: use stored snapshot price (or override) for revenue calculation
                const basePrice = existing?.unitPriceSnapshot ?? site.currentUnitPrice ?? 0;
                const unitPrice = item.unit_price_override ?? Number(basePrice);
                const qty = item.qty ?? existing?.qty ?? 0;
                const baseRevenue = (0, calculations_js_1.calculateCpmRevenue)(qty, unitPrice);
                if (ad_type === "SM") {
                    rebateRateSnapshot = activeRebateRateMap.get(site.upstreamId) ?? 0;
                    if (item.actual_revenue !== undefined) {
                        revenue = toNumber(item.actual_revenue);
                        rebateAmount = baseRevenue - revenue;
                    }
                    else if (item.rebate_amount !== undefined) {
                        rebateAmount = toNumber(item.rebate_amount);
                        revenue = (0, calculations_js_1.calculateActualRevenue)(baseRevenue, rebateAmount);
                    }
                    else if (existing &&
                        item.qty === undefined &&
                        item.unit_price_override === undefined) {
                        rebateAmount = Number(existing.rebateAmount);
                        revenue = Number(existing.revenue);
                        rebateRateSnapshot = Number(existing.rebateRateSnapshot);
                    }
                    else {
                        rebateAmount = (0, calculations_js_1.calculateRebateAmount)(baseRevenue, rebateRateSnapshot);
                        revenue = (0, calculations_js_1.calculateActualRevenue)(baseRevenue, rebateAmount);
                    }
                }
                else {
                    revenue = baseRevenue;
                }
            }
            else {
                // RATIO: ratio_override from frontend > existing snapshot > current ratio
                const baseRatio = item.ratio_override ?? existing?.ratioSnapshot ?? site.currentRatio ?? 1;
                const ratio = item.ratio_override !== undefined
                    ? Number(item.ratio_override)
                    : (item.amount1 !== undefined || item.amount2 !== undefined
                        ? Number(baseRatio)
                        : Number(site.currentRatio ?? 1));
                revenue = (0, calculations_js_1.calculateRatioRevenue)(item.amount1 ?? 0, item.amount2 ?? 0, ratio);
            }
            if (existing) {
                // UPDATE unconfirmed record
                const updateData = {
                    amount1: item.amount1,
                    amount2: item.amount2,
                    ratioSnapshot: site.billingMethod === "RATIO"
                        ? (item.ratio_override ?? existing.ratioSnapshot ?? site.currentRatio)
                        : undefined,
                    rebateAmount: site.billingMethod === "CPM" && ad_type === "SM" ? rebateAmount : existing.rebateAmount,
                    rebateRateSnapshot: site.billingMethod === "CPM" && ad_type === "SM" ? rebateRateSnapshot : existing.rebateRateSnapshot,
                    revenue,
                    updatedAt: new Date(),
                };
                // Only touch qty if explicitly provided (don't overwrite existing qty for RATIO records)
                if (item.qty !== undefined) {
                    updateData.qty = item.qty;
                }
                if (site.billingMethod === "CPM") {
                    updateData.unitPriceSnapshot = item.unit_price_override ?? existing.unitPriceSnapshot ?? site.currentUnitPrice;
                }
                await prisma_js_1.default.dailyInput.update({
                    where: { id: existing.id },
                    data: updateData,
                });
            }
            else {
                // INSERT
                await prisma_js_1.default.dailyInput.create({
                    data: {
                        recordDate: inputDate,
                        adSiteId: item.ad_site_id,
                        qty: item.qty ?? 0,
                        unitPriceSnapshot: site.billingMethod === "CPM"
                            ? (item.unit_price_override ?? site.currentUnitPrice)
                            : undefined,
                        amount1: item.amount1 ?? 0,
                        amount2: item.amount2 ?? 0,
                        ratioSnapshot: site.billingMethod === "RATIO"
                            ? (item.ratio_override ?? site.currentRatio)
                            : undefined,
                        rebateAmount: site.billingMethod === "CPM" && ad_type === "SM" ? rebateAmount : 0,
                        rebateRateSnapshot: site.billingMethod === "CPM" && ad_type === "SM" ? rebateRateSnapshot : 0,
                        revenue,
                        status: "unconfirmed",
                        createdBy: userId,
                    },
                });
            }
            saved++;
        }
        res.json({ success: true, saved, errors });
    }
    catch (err) {
        console.error("POST /api/daily-input/batch error:", err);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
});
// ============================================================
// POST /api/daily-input/confirm-batch
// Body: { ids: number[] }
// ============================================================
router.post("/confirm-batch", auth_js_1.requireAuth, auth_js_1.requireWriteAccess, (0, auth_js_1.requirePermission)("perm_data_confirm"), [
    (0, express_validator_1.body)("ids").isArray({ min: 1 }).withMessage("ids must be a non-empty array"),
    (0, express_validator_1.body)("ids.*").isInt().toInt().withMessage("all ids must be integers"),
], handleValidation, async (req, res) => {
    try {
        const ids = [...new Set(req.body.ids.map(Number).filter(Number.isInteger))];
        if (ids.length === 0) {
            res.status(400).json({ success: false, error: "No valid ids provided" });
            return;
        }
        const result = await prisma_js_1.default.dailyInput.updateMany({
            where: {
                id: { in: ids },
                status: "unconfirmed",
            },
            data: {
                status: "confirmed",
            },
        });
        res.json({ success: true, updated: result.count });
    }
    catch (err) {
        console.error("POST /api/daily-input/confirm-batch error:", err);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
});
// ============================================================
// POST /api/daily-input/:id/confirm
// ============================================================
router.post("/:id/confirm", auth_js_1.requireAuth, auth_js_1.requireWriteAccess, (0, auth_js_1.requirePermission)("perm_data_confirm"), [(0, express_validator_1.param)("id").isInt().toInt()], handleValidation, async (req, res) => {
    try {
        const id = Number(req.params.id);
        const existing = await prisma_js_1.default.dailyInput.findUnique({ where: { id } });
        if (!existing) {
            res.status(404).json({ success: false, error: "Record not found" });
            return;
        }
        if (existing.status === "confirmed") {
            res.status(409).json({ success: false, error: "Already confirmed" });
            return;
        }
        await prisma_js_1.default.dailyInput.update({
            where: { id },
            data: { status: "confirmed" },
        });
        res.json({ success: true, message: "Confirmed" });
    }
    catch (err) {
        console.error("POST /api/daily-input/:id/confirm error:", err);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
});
// ============================================================
// PUT /api/daily-input/:id/unconfirm
// ============================================================
router.put("/:id/unconfirm", auth_js_1.requireAuth, auth_js_1.requireWriteAccess, (0, auth_js_1.requirePermission)("perm_admin"), [(0, express_validator_1.param)("id").isInt().toInt()], handleValidation, unconfirmDailyInputRecord);
// Backward-compatible alias, still admin-only
router.post("/:id/unconfirm", auth_js_1.requireAuth, auth_js_1.requireWriteAccess, (0, auth_js_1.requirePermission)("perm_admin"), [(0, express_validator_1.param)("id").isInt().toInt()], handleValidation, unconfirmDailyInputRecord);
// ============================================================
// DELETE /api/daily-input/:id
// ============================================================
router.delete("/:id", auth_js_1.requireAuth, auth_js_1.requireWriteAccess, (0, auth_js_1.requirePermission)("perm_data_input"), [(0, express_validator_1.param)("id").isInt().toInt()], handleValidation, async (req, res) => {
    try {
        const id = Number(req.params.id);
        const existing = await prisma_js_1.default.dailyInput.findUnique({ where: { id } });
        if (!existing) {
            res.status(404).json({ success: false, error: "Record not found" });
            return;
        }
        if (existing.status === "confirmed") {
            res.status(409).json({ success: false, error: "Cannot delete confirmed record" });
            return;
        }
        await prisma_js_1.default.dailyInput.delete({ where: { id } });
        res.json({ success: true, message: "Deleted" });
    }
    catch (err) {
        console.error("DELETE /api/daily-input/:id error:", err);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
});
exports.default = router;
