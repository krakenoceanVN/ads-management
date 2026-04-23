"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const auth_js_1 = require("../middleware/auth.js");
const prisma_js_1 = __importDefault(require("../prisma.js"));
const date_js_1 = require("../utils/date.js");
const env_js_1 = require("../utils/env.js");
const constants_js_1 = require("../utils/constants.js");
const rateLimit_js_1 = require("../utils/rateLimit.js");
const calculations_js_1 = require("../utils/calculations.js");
const router = (0, express_1.Router)();
const JWT_EXPIRES_IN = "8h";
const handleValidation = (req, res, next) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ success: false, error: errors.array()[0].msg });
        return;
    }
    next();
};
const loginRateLimiter = (0, rateLimit_js_1.createMemoryRateLimiter)({
    windowMs: 15 * 60 * 1000,
    max: 10,
    keyGenerator: (req) => {
        const username = typeof req.body?.username === "string" ? req.body.username.trim().toLowerCase() : "";
        return `${req.ip}:${username}`;
    },
    errorMessage: "Too many login attempts. Please try again later.",
});
function resolveUserRole(user) {
    if (user.role === "VIEWER")
        return "VIEWER";
    if (user.permAdmin || user.role === "ADMIN")
        return "ADMIN";
    return "EDITOR";
}
function toUserPublic(user) {
    const resolvedRole = resolveUserRole(user);
    return {
        id: user.id,
        username: user.username,
        role: resolvedRole,
        perm_data_input: resolvedRole === "VIEWER" ? false : resolvedRole === "ADMIN" ? true : Boolean(user.permDataInput),
        perm_data_confirm: resolvedRole === "VIEWER" ? false : resolvedRole === "ADMIN" ? true : Boolean(user.permDataConfirm),
        perm_admin: resolvedRole === "ADMIN",
        status: user.status,
        last_login_at: user.lastLoginAt ?? undefined,
        created_at: user.createdAt,
    };
}
async function createAdSiteEvent(adSiteId, eventType, input = {}) {
    return prisma_js_1.default.adSiteEvent.create({
        data: {
            adSiteId,
            eventType,
            note: input.note,
            eventDate: input.eventDate ?? new Date(),
        },
    });
}
function normalizeRebateBoundary(dateValue) {
    return (0, date_js_1.getBusinessDayStart)(typeof dateValue === "string" ? dateValue : (0, date_js_1.formatBusinessDate)(dateValue));
}
function rebateWindowsOverlap(startDate, endDate, otherStartDate, otherEndDate) {
    const selfEnd = endDate ?? new Date("9999-12-31T00:00:00.000Z");
    const otherEnd = otherEndDate ?? new Date("9999-12-31T00:00:00.000Z");
    return startDate.getTime() <= otherEnd.getTime() && otherStartDate.getTime() <= selfEnd.getTime();
}
async function ensureSmAdSite(adSiteId) {
    const adSite = await prisma_js_1.default.adSite.findUnique({
        where: { id: adSiteId },
        include: {
            upstream: {
                include: { adType: true },
            },
        },
    });
    if (!adSite) {
        return { ok: false, error: "Ad site not found" };
    }
    if (adSite.upstream.adType.code !== "SM") {
        return { ok: false, error: "Rebate config is only available for SM ad sites" };
    }
    return { ok: true, adSite };
}
async function findOverlappingAdSiteRebate(adSiteId, startDate, endDate, excludeId) {
    const existing = await prisma_js_1.default.adSiteRebateRate.findMany({
        where: {
            adSiteId,
            ...(excludeId ? { id: { not: excludeId } } : {}),
        },
        select: {
            id: true,
            startDate: true,
            endDate: true,
        },
    });
    return existing.find((rate) => rebateWindowsOverlap(startDate, endDate, rate.startDate, rate.endDate));
}
function resolveAdSiteRebateRateForDate(rates, targetDate) {
    for (const rate of rates) {
        if (rate.startDate.getTime() <= targetDate.getTime() &&
            (rate.endDate === null || rate.endDate.getTime() >= targetDate.getTime())) {
            return rate.rate;
        }
    }
    return 0;
}
// ============================================================
// GET /api/admin/ad-sites
// ============================================================
router.get("/admin/ad-sites", auth_js_1.requireAuth, [(0, express_validator_1.query)("archived").optional().isIn(["0", "1"])], handleValidation, async (req, res) => {
    try {
        const archivedMode = req.query.archived === "1";
        const sites = await prisma_js_1.default.adSite.findMany({
            where: {
                isArchived: archivedMode,
            },
            include: {
                upstream: {
                    include: { adType: true },
                },
                downstreams: {
                    include: { downstream: true },
                },
            },
            orderBy: [{ upstream: { name: "asc" } }, { name: "asc" }],
        });
        const result = sites.map((site) => ({
            id: site.id,
            ad_type_code: site.upstream.adType.code,
            upstream_name: site.upstream.name,
            ad_site_name: site.name,
            billing_method: site.billingMethod,
            current_unit_price: site.currentUnitPrice ? Number(site.currentUnitPrice) : null,
            current_ratio: site.currentRatio ? Number(site.currentRatio) : null,
            is_active: site.isActive,
            is_archived: site.isArchived,
            status: site.status,
            downstream_ids: site.downstreams.map((d) => d.downstreamId),
            downstream_prices: site.downstreams.reduce((acc, d) => {
                if (d.customPrice !== null) {
                    acc[d.downstreamId] = Number(d.customPrice);
                }
                return acc;
            }, {}),
        }));
        res.json({ success: true, data: result });
    }
    catch (err) {
        console.error("GET /api/admin/ad-sites error:", err);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
});
// ============================================================
// GET /api/admin/downstreams
// ============================================================
router.get("/admin/downstreams", auth_js_1.requireAuth, async (_req, res) => {
    try {
        const downstreams = await prisma_js_1.default.downstream.findMany({
            include: {
                adType: true,
                adSites: {
                    where: {
                        adSite: {
                            isArchived: false,
                        },
                    },
                },
            },
            orderBy: { id: "asc" },
        });
        const result = downstreams.map((d) => ({
            id: d.id,
            ad_type_code: d.adType.code,
            downstream_type: d.downstreamType,
            payout_rate: Number(d.payoutRate),
            site_count: d.adSites.length,
            status: d.status,
        }));
        res.json({ success: true, data: result });
    }
    catch (err) {
        console.error("GET /api/admin/downstreams error:", err);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
});
// ============================================================
// GET /api/admin/downstream-periods
// ============================================================
router.get("/admin/downstream-periods", auth_js_1.requireAuth, async (_req, res) => {
    try {
        const periods = await prisma_js_1.default.downstreamPeriod.findMany({
            include: {
                downstream: {
                    include: { adType: true },
                },
            },
            orderBy: { startDate: "desc" },
        });
        const result = periods.map((p) => ({
            id: p.id,
            downstream_id: p.downstreamId,
            downstream_type: p.downstream.downstreamType,
            ad_type_code: p.downstream.adType.code,
            pct_hal: Number(p.pctHal),
            unit_price: p.unitPrice ? Number(p.unitPrice) : null,
            start_date: (0, date_js_1.formatBusinessDate)(p.startDate),
            end_date: p.endDate ? (0, date_js_1.formatBusinessDate)(p.endDate) : null,
            note: p.note,
        }));
        res.json({ success: true, data: result });
    }
    catch (err) {
        console.error("GET /api/admin/downstream-periods error:", err);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
});
// ============================================================
// GET /api/admin/downstream-sites/:downstreamId/inputs
// Query: date (optional, YYYY-MM-DD) or month (optional, YYYY-MM)
// If neither is provided, returns the latest input per site
// ============================================================
router.get("/admin/downstream-sites/:downstreamId/inputs", auth_js_1.requireAuth, [
    (0, express_validator_1.query)("date").optional().isISO8601(),
    (0, express_validator_1.query)("month").optional().matches(/^\d{4}-\d{2}$/).withMessage("month must be YYYY-MM"),
], handleValidation, async (req, res) => {
    try {
        const isOfficialView = req.user?.perm_admin === true;
        const downstreamId = parseInt(req.params.downstreamId);
        const dateStr = req.query.date;
        const monthStr = req.query.month;
        // Get the downstream to know ad_type
        const downstream = await prisma_js_1.default.downstream.findUnique({
            where: { id: downstreamId },
            include: { adType: true },
        });
        if (!downstream) {
            res.status(404).json({ success: false, error: "Downstream not found" });
            return;
        }
        // Get ad sites linked to this downstream
        const siteDownstreams = await prisma_js_1.default.adSiteDownstream.findMany({
            where: {
                downstreamId,
                adSite: {
                    isArchived: false,
                },
            },
            include: {
                adSite: {
                    include: { upstream: { include: { adType: true } } },
                },
            },
        });
        if (siteDownstreams.length === 0) {
            res.json({ success: true, data: [] });
            return;
        }
        const siteIds = siteDownstreams.map((sd) => sd.adSiteId);
        const priceReferenceDate = dateStr
            ? new Date(dateStr)
            : monthStr
                ? new Date(`${monthStr}-01`)
                : new Date();
        const activePeriod = await prisma_js_1.default.downstreamPeriod.findFirst({
            where: {
                downstreamId,
                startDate: { lte: priceReferenceDate },
                OR: [{ endDate: null }, { endDate: { gte: priceReferenceDate } }],
            },
            orderBy: { startDate: "desc" },
        });
        // Get daily inputs for these sites
        let inputsQuery = {
            where: {
                adSiteId: { in: siteIds },
                adSite: { isArchived: false },
                status: isOfficialView ? "confirmed" : undefined,
            },
            orderBy: [{ adSiteId: "asc" }, { recordDate: "desc" }],
        };
        // If date provided, filter by that date; if month provided, fetch all inputs in month; otherwise get latest per site
        if (dateStr) {
            const { gte: startOfDay, lt: endOfDay } = (0, date_js_1.getBusinessDayRange)(dateStr);
            inputsQuery = {
                where: {
                    adSiteId: { in: siteIds },
                    adSite: { isArchived: false },
                    status: isOfficialView ? "confirmed" : undefined,
                    recordDate: { gte: startOfDay, lt: endOfDay },
                },
                orderBy: [{ adSiteId: "asc" }, { recordDate: "asc" }],
            };
        }
        else if (monthStr) {
            const [year, month] = monthStr.split("-").map(Number);
            const { gte: startOfMonth, lt: endOfMonth } = (0, date_js_1.getBusinessMonthRange)(year, month);
            inputsQuery = {
                where: {
                    adSiteId: { in: siteIds },
                    adSite: { isArchived: false },
                    status: isOfficialView ? "confirmed" : undefined,
                    recordDate: { gte: startOfMonth, lt: endOfMonth },
                },
                orderBy: [{ adSiteId: "asc" }, { recordDate: "asc" }],
            };
        }
        const inputs = await prisma_js_1.default.dailyInput.findMany(inputsQuery);
        const inputMap = new Map();
        const inputByDateMap = new Map();
        for (const input of inputs) {
            const formattedInput = {
                date: (0, date_js_1.formatBusinessDate)(input.recordDate),
                qty: input.qty,
                unit_price_snapshot: input.unitPriceSnapshot === null ? null : Number(input.unitPriceSnapshot),
                amount1: input.amount1 ? Number(input.amount1) : null,
                amount2: input.amount2 ? Number(input.amount2) : null,
                revenue: Number(input.revenue),
                status: input.status,
            };
            const currentByDate = inputByDateMap.get(input.adSiteId) ?? {};
            currentByDate[formattedInput.date] = formattedInput;
            inputByDateMap.set(input.adSiteId, currentByDate);
            if (monthStr || dateStr) {
                const current = inputMap.get(input.adSiteId) ?? [];
                current.push(formattedInput);
                inputMap.set(input.adSiteId, current);
                continue;
            }
            if (!inputMap.has(input.adSiteId)) {
                inputMap.set(input.adSiteId, [formattedInput]);
            }
        }
        const result = siteDownstreams.map((sd) => ({
            id: sd.adSite.id,
            ad_site_name: sd.adSite.name,
            is_active: sd.adSite.isActive,
            upstream_name: sd.adSite.upstream.name,
            billing_method: sd.adSite.billingMethod,
            current_unit_price: sd.adSite.currentUnitPrice === null ? null : Number(sd.adSite.currentUnitPrice),
            custom_price: sd.customPrice ? Number(sd.customPrice) : null,
            resolved_price: sd.customPrice !== null
                ? Number(sd.customPrice)
                : Number(activePeriod?.unitPrice ?? constants_js_1.DEFAULT_DOWNSTREAM_PRICES[String(downstreamId)] ?? 0),
            input: inputMap.get(sd.adSite.id)?.[0] ?? null,
            inputs: inputMap.get(sd.adSite.id) ?? [],
            inputs_by_date: inputByDateMap.get(sd.adSite.id) ?? {},
        }));
        res.json({ success: true, data: result });
    }
    catch (err) {
        console.error("GET /api/admin/downstream-sites/:downstreamId/inputs error:", err);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
});
// ============================================================
// CRUD: Upstreams
// ============================================================
router.get("/admin/upstreams", auth_js_1.requireAuth, (0, auth_js_1.requirePermission)("perm_admin"), async (_req, res) => {
    try {
        const upstreams = await prisma_js_1.default.upstream.findMany({
            include: { adType: true },
            orderBy: [{ adType: { code: "asc" } }, { name: "asc" }],
        });
        const result = upstreams.map((u) => ({
            id: u.id,
            ad_type_id: u.adTypeId,
            ad_type_code: u.adType.code,
            ad_type_name: u.adType.name,
            name: u.name,
            status: u.status,
        }));
        res.json({ success: true, data: result });
    }
    catch (err) {
        console.error("GET /api/admin/upstreams error:", err);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
});
router.post("/admin/upstreams", auth_js_1.requireAuth, auth_js_1.requireWriteAccess, (0, auth_js_1.requirePermission)("perm_admin"), [
    (0, express_validator_1.body)("name").notEmpty().withMessage("name required").isLength({ max: 200 }),
    (0, express_validator_1.body)("ad_type_id").isInt().toInt(),
    (0, express_validator_1.body)("status").optional().isIn(["active", "inactive"]),
], handleValidation, async (req, res) => {
    try {
        const { name, ad_type_id, status } = req.body;
        const existing = await prisma_js_1.default.adType.findUnique({ where: { id: ad_type_id } });
        if (!existing) {
            res.status(400).json({ success: false, error: "Ad type not found" });
            return;
        }
        const upstream = await prisma_js_1.default.upstream.create({
            data: { name, adTypeId: ad_type_id, status: status ?? "active" },
        });
        res.status(201).json({ success: true, data: { id: upstream.id, name: upstream.name, ad_type_id: upstream.adTypeId, status: upstream.status } });
    }
    catch (err) {
        console.error("POST /api/admin/upstreams error:", err);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
});
router.put("/admin/upstreams/:id", auth_js_1.requireAuth, auth_js_1.requireWriteAccess, (0, auth_js_1.requirePermission)("perm_admin"), [
    (0, express_validator_1.param)("id").isInt().toInt(),
    (0, express_validator_1.body)("name").optional().isLength({ max: 200 }),
    (0, express_validator_1.body)("ad_type_id").optional().isInt().toInt(),
    (0, express_validator_1.body)("status").optional().isIn(["active", "inactive"]),
], handleValidation, async (req, res) => {
    try {
        const id = Number(req.params.id);
        const { name, ad_type_id, status } = req.body;
        const existing = await prisma_js_1.default.upstream.findUnique({ where: { id } });
        if (!existing) {
            res.status(404).json({ success: false, error: "Upstream not found" });
            return;
        }
        const updateData = {};
        if (name !== undefined)
            updateData.name = name;
        if (ad_type_id !== undefined) {
            const at = await prisma_js_1.default.adType.findUnique({ where: { id: ad_type_id } });
            if (!at) {
                res.status(400).json({ success: false, error: "Ad type not found" });
                return;
            }
            updateData.adTypeId = ad_type_id;
        }
        if (status !== undefined)
            updateData.status = status;
        const updated = await prisma_js_1.default.upstream.update({ where: { id }, data: updateData });
        res.json({ success: true, data: { id: updated.id, name: updated.name, ad_type_id: updated.adTypeId, status: updated.status } });
    }
    catch (err) {
        console.error("PUT /api/admin/upstreams/:id error:", err);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
});
router.delete("/admin/upstreams/:id", auth_js_1.requireAuth, auth_js_1.requireWriteAccess, (0, auth_js_1.requirePermission)("perm_admin"), [(0, express_validator_1.param)("id").isInt().toInt()], handleValidation, async (req, res) => {
    try {
        const id = Number(req.params.id);
        const sites = await prisma_js_1.default.adSite.findMany({ where: { upstreamId: id }, take: 1 });
        if (sites.length > 0) {
            res.status(409).json({ success: false, error: "Upstream has ad sites — delete sites first" });
            return;
        }
        await prisma_js_1.default.upstream.delete({ where: { id } });
        res.json({ success: true, message: "Upstream deleted" });
    }
    catch (err) {
        console.error("DELETE /api/admin/upstreams/:id error:", err);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
});
router.get("/admin/ad-sites/:id/rebates", auth_js_1.requireAuth, (0, auth_js_1.requirePermission)("perm_admin"), [(0, express_validator_1.param)("id").isInt().toInt()], handleValidation, async (req, res) => {
    try {
        const adSiteId = Number(req.params.id);
        const adSiteResult = await ensureSmAdSite(adSiteId);
        if (!adSiteResult.ok) {
            res.status(adSiteResult.error === "Ad site not found" ? 404 : 400).json({ success: false, error: adSiteResult.error });
            return;
        }
        const rebates = await prisma_js_1.default.adSiteRebateRate.findMany({
            where: { adSiteId },
            orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
        });
        res.json({
            success: true,
            data: rebates.map((rebate) => ({
                id: rebate.id,
                ad_site_id: rebate.adSiteId,
                rate: Number(rebate.rate),
                start_date: (0, date_js_1.formatBusinessDate)(rebate.startDate),
                end_date: rebate.endDate ? (0, date_js_1.formatBusinessDate)(rebate.endDate) : null,
                created_at: rebate.createdAt,
                updated_at: rebate.updatedAt,
            })),
        });
    }
    catch (err) {
        console.error("GET /api/admin/ad-sites/:id/rebates error:", err);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
});
router.post("/admin/ad-sites/:id/rebates", auth_js_1.requireAuth, auth_js_1.requireWriteAccess, (0, auth_js_1.requirePermission)("perm_admin"), [
    (0, express_validator_1.param)("id").isInt().toInt(),
    (0, express_validator_1.body)("rate").notEmpty().withMessage("rate required").isDecimal().toFloat(),
    (0, express_validator_1.body)("start_date").notEmpty().withMessage("start_date required").isISO8601(),
    (0, express_validator_1.body)("end_date").optional({ nullable: true }).isISO8601(),
], handleValidation, async (req, res) => {
    try {
        const adSiteId = Number(req.params.id);
        const adSiteResult = await ensureSmAdSite(adSiteId);
        if (!adSiteResult.ok) {
            res.status(adSiteResult.error === "Ad site not found" ? 404 : 400).json({ success: false, error: adSiteResult.error });
            return;
        }
        const startDate = normalizeRebateBoundary(req.body.start_date);
        const endDate = req.body.end_date ? normalizeRebateBoundary(req.body.end_date) : null;
        if (endDate && endDate.getTime() < startDate.getTime()) {
            res.status(400).json({ success: false, error: "end_date must be greater than or equal to start_date" });
            return;
        }
        const overlap = await findOverlappingAdSiteRebate(adSiteId, startDate, endDate);
        if (overlap) {
            res.status(409).json({ success: false, error: "Rebate period overlaps with existing config" });
            return;
        }
        const created = await prisma_js_1.default.adSiteRebateRate.create({
            data: {
                adSiteId,
                rate: req.body.rate,
                startDate,
                endDate,
            },
        });
        res.status(201).json({
            success: true,
            data: {
                id: created.id,
                ad_site_id: created.adSiteId,
                rate: Number(created.rate),
                start_date: (0, date_js_1.formatBusinessDate)(created.startDate),
                end_date: created.endDate ? (0, date_js_1.formatBusinessDate)(created.endDate) : null,
                created_at: created.createdAt,
                updated_at: created.updatedAt,
            },
        });
    }
    catch (err) {
        console.error("POST /api/admin/ad-sites/:id/rebates error:", err);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
});
router.put("/admin/ad-sites/:id/rebates/:rebateId", auth_js_1.requireAuth, auth_js_1.requireWriteAccess, (0, auth_js_1.requirePermission)("perm_admin"), [
    (0, express_validator_1.param)("id").isInt().toInt(),
    (0, express_validator_1.param)("rebateId").notEmpty().isString(),
    (0, express_validator_1.body)("rate").notEmpty().withMessage("rate required").isDecimal().toFloat(),
    (0, express_validator_1.body)("start_date").notEmpty().withMessage("start_date required").isISO8601(),
    (0, express_validator_1.body)("end_date").optional({ nullable: true }).isISO8601(),
], handleValidation, async (req, res) => {
    try {
        const adSiteId = Number(req.params.id);
        const rebateId = String(req.params.rebateId);
        const adSiteResult = await ensureSmAdSite(adSiteId);
        if (!adSiteResult.ok) {
            res.status(adSiteResult.error === "Ad site not found" ? 404 : 400).json({ success: false, error: adSiteResult.error });
            return;
        }
        const existing = await prisma_js_1.default.adSiteRebateRate.findFirst({
            where: {
                id: rebateId,
                adSiteId,
            },
        });
        if (!existing) {
            res.status(404).json({ success: false, error: "Rebate config not found" });
            return;
        }
        const startDate = normalizeRebateBoundary(req.body.start_date);
        const endDate = req.body.end_date ? normalizeRebateBoundary(req.body.end_date) : null;
        if (endDate && endDate.getTime() < startDate.getTime()) {
            res.status(400).json({ success: false, error: "end_date must be greater than or equal to start_date" });
            return;
        }
        const overlap = await findOverlappingAdSiteRebate(adSiteId, startDate, endDate, rebateId);
        if (overlap) {
            res.status(409).json({ success: false, error: "Rebate period overlaps with existing config" });
            return;
        }
        const updated = await prisma_js_1.default.adSiteRebateRate.update({
            where: { id: rebateId },
            data: {
                rate: req.body.rate,
                startDate,
                endDate,
            },
        });
        res.json({
            success: true,
            data: {
                id: updated.id,
                ad_site_id: updated.adSiteId,
                rate: Number(updated.rate),
                start_date: (0, date_js_1.formatBusinessDate)(updated.startDate),
                end_date: updated.endDate ? (0, date_js_1.formatBusinessDate)(updated.endDate) : null,
                created_at: updated.createdAt,
                updated_at: updated.updatedAt,
            },
        });
    }
    catch (err) {
        console.error("PUT /api/admin/ad-sites/:id/rebates/:rebateId error:", err);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
});
router.delete("/admin/ad-sites/:id/rebates/:rebateId", auth_js_1.requireAuth, auth_js_1.requireWriteAccess, (0, auth_js_1.requirePermission)("perm_admin"), [
    (0, express_validator_1.param)("id").isInt().toInt(),
    (0, express_validator_1.param)("rebateId").notEmpty().isString(),
], handleValidation, async (req, res) => {
    try {
        const adSiteId = Number(req.params.id);
        const rebateId = String(req.params.rebateId);
        const existing = await prisma_js_1.default.adSiteRebateRate.findFirst({
            where: {
                id: rebateId,
                adSiteId,
            },
        });
        if (!existing) {
            res.status(404).json({ success: false, error: "Rebate config not found" });
            return;
        }
        await prisma_js_1.default.adSiteRebateRate.delete({ where: { id: rebateId } });
        res.json({ success: true, message: "Rebate config deleted" });
    }
    catch (err) {
        console.error("DELETE /api/admin/ad-sites/:id/rebates/:rebateId error:", err);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
});
router.post("/admin/ad-sites/:id/rebates/recalculate", auth_js_1.requireAuth, auth_js_1.requireWriteAccess, (0, auth_js_1.requirePermission)("perm_admin"), [
    (0, express_validator_1.param)("id").isInt().toInt(),
    (0, express_validator_1.body)("start_date").notEmpty().withMessage("start_date required").isISO8601(),
    (0, express_validator_1.body)("end_date").notEmpty().withMessage("end_date required").isISO8601(),
    (0, express_validator_1.body)("include_confirmed").optional().isBoolean(),
], handleValidation, async (req, res) => {
    try {
        const adSiteId = Number(req.params.id);
        const adSiteResult = await ensureSmAdSite(adSiteId);
        if (!adSiteResult.ok) {
            res.status(adSiteResult.error === "Ad site not found" ? 404 : 400).json({ success: false, error: adSiteResult.error });
            return;
        }
        const startDate = normalizeRebateBoundary(req.body.start_date);
        const endDate = normalizeRebateBoundary(req.body.end_date);
        const includeConfirmed = Boolean(req.body.include_confirmed);
        if (endDate.getTime() < startDate.getTime()) {
            res.status(400).json({ success: false, error: "end_date must be greater than or equal to start_date" });
            return;
        }
        const rateWindows = await prisma_js_1.default.adSiteRebateRate.findMany({
            where: { adSiteId },
            orderBy: { startDate: "desc" },
        });
        const rangeEnd = (0, date_js_1.getBusinessDayRange)(req.body.end_date).lt;
        const records = await prisma_js_1.default.dailyInput.findMany({
            where: {
                recordDate: { gte: startDate, lt: rangeEnd },
                status: includeConfirmed ? { in: ["unconfirmed", "confirmed"] } : "unconfirmed",
                adSite: {
                    id: adSiteId,
                    billingMethod: "CPM",
                },
            },
            include: {
                adSite: {
                    select: {
                        currentUnitPrice: true,
                    },
                },
            },
            orderBy: { recordDate: "asc" },
        });
        if (records.length === 0) {
            res.json({ success: true, updated: 0 });
            return;
        }
        const normalizedRates = rateWindows.map((rate) => ({
            startDate: normalizeRebateBoundary(rate.startDate),
            endDate: rate.endDate ? normalizeRebateBoundary(rate.endDate) : null,
            rate: Number(rate.rate),
        }));
        await prisma_js_1.default.$transaction(records.map((record) => {
            const unitPrice = Number(record.unitPriceSnapshot ?? record.adSite.currentUnitPrice ?? 0);
            const qty = Number(record.qty ?? 0);
            const baseRevenue = (0, calculations_js_1.calculateCpmRevenue)(qty, unitPrice);
            const activeRate = resolveAdSiteRebateRateForDate(normalizedRates, (0, date_js_1.getBusinessDayStart)((0, date_js_1.formatBusinessDate)(record.recordDate)));
            const rebateAmount = (0, calculations_js_1.calculateRebateAmount)(qty, activeRate);
            const actualRevenue = (0, calculations_js_1.calculateActualRevenue)(baseRevenue, rebateAmount);
            return prisma_js_1.default.dailyInput.update({
                where: { id: record.id },
                data: {
                    rebateAmount,
                    rebateRateSnapshot: activeRate,
                    revenue: actualRevenue,
                },
            });
        }));
        res.json({ success: true, updated: records.length });
    }
    catch (err) {
        console.error("POST /api/admin/ad-sites/:id/rebates/recalculate error:", err);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
});
// ============================================================
// GET: AdTypes
// ============================================================
router.get("/admin/ad-types", auth_js_1.requireAuth, (0, auth_js_1.requirePermission)("perm_admin"), handleValidation, async (_req, res) => {
    try {
        const adTypes = await prisma_js_1.default.adType.findMany({ orderBy: { code: "asc" } });
        res.json({ success: true, data: adTypes });
    }
    catch (err) {
        console.error("GET /api/admin/ad-types error:", err);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
});
// ============================================================
// CRUD: AdSites
// ============================================================
router.post("/admin/ad-sites", auth_js_1.requireAuth, auth_js_1.requireWriteAccess, (0, auth_js_1.requirePermission)("perm_admin"), [
    (0, express_validator_1.body)("name").notEmpty().withMessage("name required").isLength({ max: 200 }),
    (0, express_validator_1.body)("upstream_id").isInt().toInt(),
    (0, express_validator_1.body)("billing_method").isIn(["CPM", "RATIO"]),
    (0, express_validator_1.body)("current_unit_price").optional().isDecimal().toFloat(),
    (0, express_validator_1.body)("current_ratio").optional().isDecimal().toFloat(),
    (0, express_validator_1.body)("status").optional().isIn(["active", "inactive"]),
    (0, express_validator_1.body)("downstream_ids").optional().isArray(),
], handleValidation, async (req, res) => {
    try {
        const { name, upstream_id, billing_method, current_unit_price, current_ratio, status, downstream_ids } = req.body;
        const upstream = await prisma_js_1.default.upstream.findUnique({ where: { id: upstream_id } });
        if (!upstream) {
            res.status(400).json({ success: false, error: "Upstream not found" });
            return;
        }
        const site = await prisma_js_1.default.$transaction(async (tx) => {
            const created = await tx.adSite.create({
                data: {
                    name,
                    upstreamId: upstream_id,
                    billingMethod: billing_method,
                    currentUnitPrice: billing_method === "CPM" ? (current_unit_price ?? 0) : undefined,
                    currentRatio: billing_method === "RATIO" ? (current_ratio ?? 1) : undefined,
                    isActive: true,
                    isArchived: false,
                    status: status ?? "active",
                    downstreams: downstream_ids?.length
                        ? { create: downstream_ids.map((did) => ({ downstreamId: did })) }
                        : undefined,
                },
            });
            await tx.adSiteEvent.create({
                data: {
                    adSiteId: created.id,
                    eventType: "CREATED",
                },
            });
            return created;
        });
        res.status(201).json({ success: true, data: { id: site.id, name: site.name } });
    }
    catch (err) {
        console.error("POST /api/admin/ad-sites error:", err);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
});
router.put("/admin/ad-sites/:id", auth_js_1.requireAuth, auth_js_1.requireWriteAccess, (0, auth_js_1.requirePermission)("perm_admin"), [
    (0, express_validator_1.param)("id").isInt().toInt(),
    (0, express_validator_1.body)("name").optional().isLength({ max: 200 }),
    (0, express_validator_1.body)("upstream_id").optional().isInt().toInt(),
    (0, express_validator_1.body)("billing_method").optional().isIn(["CPM", "RATIO"]),
    (0, express_validator_1.body)("current_unit_price").optional().isDecimal().toFloat(),
    (0, express_validator_1.body)("current_ratio").optional().isDecimal().toFloat(),
    (0, express_validator_1.body)("status").optional().isIn(["active", "inactive"]),
    (0, express_validator_1.body)("downstream_ids").optional().isArray(),
], handleValidation, async (req, res) => {
    try {
        const id = Number(req.params.id);
        const { name, upstream_id, billing_method, current_unit_price, current_ratio, status, downstream_ids } = req.body;
        const existing = await prisma_js_1.default.adSite.findUnique({ where: { id } });
        if (!existing) {
            res.status(404).json({ success: false, error: "Ad site not found" });
            return;
        }
        const updateData = {};
        if (name !== undefined)
            updateData.name = name;
        if (upstream_id !== undefined) {
            const up = await prisma_js_1.default.upstream.findUnique({ where: { id: upstream_id } });
            if (!up) {
                res.status(400).json({ success: false, error: "Upstream not found" });
                return;
            }
            updateData.upstreamId = upstream_id;
        }
        if (billing_method !== undefined)
            updateData.billingMethod = billing_method;
        if (current_unit_price !== undefined)
            updateData.currentUnitPrice = current_unit_price;
        if (current_ratio !== undefined)
            updateData.currentRatio = current_ratio;
        if (status !== undefined)
            updateData.status = status;
        await prisma_js_1.default.adSite.update({ where: { id }, data: updateData });
        // Update downstreams if provided
        if (downstream_ids !== undefined) {
            await prisma_js_1.default.adSiteDownstream.deleteMany({ where: { adSiteId: id } });
            if (downstream_ids?.length) {
                await prisma_js_1.default.adSiteDownstream.createMany({
                    data: downstream_ids.map((did) => ({ adSiteId: id, downstreamId: did })),
                });
            }
        }
        res.json({ success: true, message: "Ad site updated" });
    }
    catch (err) {
        console.error("PUT /api/admin/ad-sites/:id error:", err);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
});
router.put("/admin/ad-sites/:id/toggle-active", auth_js_1.requireAuth, auth_js_1.requireWriteAccess, (0, auth_js_1.requirePermission)("perm_admin"), [
    (0, express_validator_1.param)("id").isInt().toInt(),
    (0, express_validator_1.body)("eventDate").optional().isISO8601().withMessage("eventDate must be YYYY-MM-DD"),
    (0, express_validator_1.body)("note").optional().isLength({ max: 1000 }),
], handleValidation, async (req, res) => {
    try {
        const id = Number(req.params.id);
        const eventDate = typeof req.body.eventDate === "string" ? (0, date_js_1.getBusinessDayStart)(req.body.eventDate) : undefined;
        const note = typeof req.body.note === "string" ? req.body.note.trim() || undefined : undefined;
        const existing = await prisma_js_1.default.adSite.findUnique({ where: { id } });
        if (!existing) {
            res.status(404).json({ success: false, error: "Ad site not found" });
            return;
        }
        const nextIsActive = !existing.isActive;
        const updated = await prisma_js_1.default.$transaction(async (tx) => {
            const site = await tx.adSite.update({
                where: { id },
                data: { isActive: nextIsActive },
            });
            await tx.adSiteEvent.create({
                data: {
                    adSiteId: id,
                    eventType: nextIsActive ? "RESUMED" : "PAUSED",
                    eventDate: eventDate ?? new Date(),
                    note,
                },
            });
            return site;
        });
        res.json({
            success: true,
            data: {
                id: updated.id,
                is_active: updated.isActive,
                is_archived: updated.isArchived,
            },
        });
    }
    catch (err) {
        console.error("PUT /api/admin/ad-sites/:id/toggle-active error:", err);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
});
router.put("/admin/ad-sites/:id/toggle-archive", auth_js_1.requireAuth, auth_js_1.requireWriteAccess, (0, auth_js_1.requirePermission)("perm_admin"), [
    (0, express_validator_1.param)("id").isInt().toInt(),
    (0, express_validator_1.body)("eventDate").optional().isISO8601().withMessage("eventDate must be YYYY-MM-DD"),
    (0, express_validator_1.body)("note").optional().isLength({ max: 1000 }),
], handleValidation, async (req, res) => {
    try {
        const id = Number(req.params.id);
        const eventDate = typeof req.body.eventDate === "string" ? (0, date_js_1.getBusinessDayStart)(req.body.eventDate) : undefined;
        const note = typeof req.body.note === "string" ? req.body.note.trim() || undefined : undefined;
        const existing = await prisma_js_1.default.adSite.findUnique({ where: { id } });
        if (!existing) {
            res.status(404).json({ success: false, error: "Ad site not found" });
            return;
        }
        const nextIsArchived = !existing.isArchived;
        const updated = await prisma_js_1.default.$transaction(async (tx) => {
            const site = await tx.adSite.update({
                where: { id },
                data: { isArchived: nextIsArchived },
            });
            await tx.adSiteEvent.create({
                data: {
                    adSiteId: id,
                    eventType: nextIsArchived ? "DIED" : "RESUMED",
                    eventDate: eventDate ?? new Date(),
                    note,
                },
            });
            return site;
        });
        res.json({
            success: true,
            data: {
                id: updated.id,
                is_active: updated.isActive,
                is_archived: updated.isArchived,
            },
        });
    }
    catch (err) {
        console.error("PUT /api/admin/ad-sites/:id/toggle-archive error:", err);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
});
router.delete("/admin/ad-sites/:id", auth_js_1.requireAuth, auth_js_1.requireWriteAccess, (0, auth_js_1.requirePermission)("perm_admin"), [(0, express_validator_1.param)("id").isInt().toInt()], handleValidation, async (req, res) => {
    try {
        const id = Number(req.params.id);
        const force = req.query.force === '1';
        if (!force) {
            const inputs = await prisma_js_1.default.dailyInput.findMany({ where: { adSiteId: id }, take: 1 });
            if (inputs.length > 0) {
                res.status(409).json({ success: false, error: "Ad site has daily inputs — cannot delete. Add ?force=1 to delete anyway." });
                return;
            }
        }
        // Delete related daily inputs first if force
        if (force) {
            await prisma_js_1.default.dailyInput.deleteMany({ where: { adSiteId: id } });
        }
        await prisma_js_1.default.adSite.delete({ where: { id } });
        res.json({ success: true, message: "Ad site deleted" });
    }
    catch (err) {
        console.error("DELETE /api/admin/ad-sites/:id error:", err);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
});
router.get("/admin/ad-sites/:id/events", auth_js_1.requireAuth, [(0, express_validator_1.param)("id").isInt().toInt()], handleValidation, async (req, res) => {
    try {
        const id = Number(req.params.id);
        const site = await prisma_js_1.default.adSite.findUnique({
            where: { id },
            select: { id: true },
        });
        if (!site) {
            res.status(404).json({ success: false, error: "Ad site not found" });
            return;
        }
        const events = await prisma_js_1.default.adSiteEvent.findMany({
            where: { adSiteId: id },
            orderBy: [{ eventDate: "desc" }, { createdAt: "desc" }, { id: "desc" }],
        });
        res.json({
            success: true,
            data: events.map((event) => ({
                id: event.id,
                ad_site_id: event.adSiteId,
                event_type: event.eventType,
                note: event.note,
                event_date: event.eventDate,
                created_at: event.createdAt,
            })),
        });
    }
    catch (err) {
        console.error("GET /api/admin/ad-sites/:id/events error:", err);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
});
router.post("/admin/ad-sites/:id/events", auth_js_1.requireAuth, auth_js_1.requireWriteAccess, (0, auth_js_1.requirePermission)("perm_admin"), [
    (0, express_validator_1.param)("id").isInt().toInt(),
    (0, express_validator_1.body)("note").notEmpty().withMessage("note required").isLength({ max: 1000 }),
    (0, express_validator_1.body)("eventDate").optional().isISO8601().withMessage("eventDate must be YYYY-MM-DD"),
], handleValidation, async (req, res) => {
    try {
        const id = Number(req.params.id);
        const note = String(req.body.note ?? "").trim();
        const eventDate = typeof req.body.eventDate === "string" ? (0, date_js_1.getBusinessDayStart)(req.body.eventDate) : undefined;
        const site = await prisma_js_1.default.adSite.findUnique({
            where: { id },
            select: { id: true },
        });
        if (!site) {
            res.status(404).json({ success: false, error: "Ad site not found" });
            return;
        }
        const event = await createAdSiteEvent(id, "NOTE", { note, eventDate });
        res.status(201).json({
            success: true,
            data: {
                id: event.id,
                ad_site_id: event.adSiteId,
                event_type: event.eventType,
                note: event.note,
                event_date: event.eventDate,
                created_at: event.createdAt,
            },
        });
    }
    catch (err) {
        console.error("POST /api/admin/ad-sites/:id/events error:", err);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
});
// ============================================================
// PUT /api/admin/ad-sites/:id/downstream-price
// ============================================================
router.put("/admin/ad-sites/:id/downstream-price", auth_js_1.requireAuth, auth_js_1.requireWriteAccess, (0, auth_js_1.requirePermission)("perm_admin"), [(0, express_validator_1.param)("id").isInt().toInt(), (0, express_validator_1.body)("prices").isObject()], handleValidation, async (req, res) => {
    try {
        const id = Number(req.params.id);
        const { prices } = req.body;
        // prices is a map of downstreamId -> price
        for (const [downstreamIdStr, price] of Object.entries(prices)) {
            const downstreamId = parseInt(downstreamIdStr);
            // Upsert downstream price in ad_site_downstream table
            await prisma_js_1.default.adSiteDownstream.upsert({
                where: {
                    adSiteId_downstreamId: {
                        adSiteId: id,
                        downstreamId: downstreamId,
                    },
                },
                create: {
                    adSiteId: id,
                    downstreamId: downstreamId,
                    customPrice: price,
                },
                update: {
                    customPrice: price,
                },
            });
        }
        res.json({ success: true, message: "Downstream price updated" });
    }
    catch (err) {
        console.error("PUT /api/admin/ad-sites/:id/downstream-price error:", err);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
});
// ============================================================
// CRUD: Downstreams
// ============================================================
router.post("/admin/downstreams", auth_js_1.requireAuth, auth_js_1.requireWriteAccess, (0, auth_js_1.requirePermission)("perm_admin"), [
    (0, express_validator_1.body)("ad_type_id").isInt().toInt(),
    (0, express_validator_1.body)("downstream_type").isIn(["ML", "LE", "YIYI"]),
    (0, express_validator_1.body)("payout_rate").isDecimal().toFloat(),
    (0, express_validator_1.body)("status").optional().isIn(["active", "inactive"]),
], handleValidation, async (req, res) => {
    try {
        const { ad_type_id, downstream_type, payout_rate, status } = req.body;
        const adType = await prisma_js_1.default.adType.findUnique({ where: { id: ad_type_id } });
        if (!adType) {
            res.status(400).json({ success: false, error: "Ad type not found" });
            return;
        }
        const ds = await prisma_js_1.default.downstream.create({
            data: { adTypeId: ad_type_id, downstreamType: downstream_type, payoutRate: payout_rate, status: status ?? "active" },
        });
        res.status(201).json({ success: true, data: { id: ds.id, downstream_type: ds.downstreamType, ad_type_code: adType.code } });
    }
    catch (err) {
        console.error("POST /api/admin/downstreams error:", err);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
});
router.put("/admin/downstreams/:id", auth_js_1.requireAuth, auth_js_1.requireWriteAccess, (0, auth_js_1.requirePermission)("perm_admin"), [
    (0, express_validator_1.param)("id").isInt().toInt(),
    (0, express_validator_1.body)("payout_rate").optional().isDecimal().toFloat(),
    (0, express_validator_1.body)("status").optional().isIn(["active", "inactive"]),
], handleValidation, async (req, res) => {
    try {
        const id = Number(req.params.id);
        const { payout_rate, status } = req.body;
        const updateData = {};
        if (payout_rate !== undefined)
            updateData.payoutRate = payout_rate;
        if (status !== undefined)
            updateData.status = status;
        const updated = await prisma_js_1.default.downstream.update({ where: { id }, data: updateData });
        res.json({ success: true, message: "Downstream updated" });
    }
    catch (err) {
        console.error("PUT /api/admin/downstreams/:id error:", err);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
});
router.delete("/admin/downstreams/:id", auth_js_1.requireAuth, auth_js_1.requireWriteAccess, (0, auth_js_1.requirePermission)("perm_admin"), [(0, express_validator_1.param)("id").isInt().toInt()], handleValidation, async (req, res) => {
    try {
        const id = Number(req.params.id);
        await prisma_js_1.default.downstream.delete({ where: { id } });
        res.json({ success: true, message: "Downstream deleted" });
    }
    catch (err) {
        console.error("DELETE /api/admin/downstreams/:id error:", err);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
});
// ============================================================
// Edit/Delete: DownstreamPeriods
// ============================================================
router.put("/admin/downstream-periods/:id", auth_js_1.requireAuth, auth_js_1.requireWriteAccess, (0, auth_js_1.requirePermission)("perm_admin"), [
    (0, express_validator_1.param)("id").isInt().toInt(),
    (0, express_validator_1.body)("pct_hal").optional().isDecimal().toFloat(),
    (0, express_validator_1.body)("unit_price").optional().isDecimal().toFloat(),
    (0, express_validator_1.body)("end_date").optional().isISO8601(),
    (0, express_validator_1.body)("note").optional().isString(),
], handleValidation, async (req, res) => {
    try {
        const id = Number(req.params.id);
        const { pct_hal, unit_price, end_date, note } = req.body;
        const existing = await prisma_js_1.default.downstreamPeriod.findUnique({ where: { id } });
        if (!existing) {
            res.status(404).json({ success: false, error: "Period not found" });
            return;
        }
        const updateData = {};
        if (pct_hal !== undefined)
            updateData.pctHal = pct_hal;
        if (unit_price !== undefined)
            updateData.unitPrice = unit_price;
        if (end_date !== undefined)
            updateData.endDate = end_date ? new Date(end_date) : null;
        if (note !== undefined)
            updateData.note = note;
        await prisma_js_1.default.downstreamPeriod.update({ where: { id }, data: updateData });
        res.json({ success: true, message: "Period updated" });
    }
    catch (err) {
        console.error("PUT /api/admin/downstream-periods/:id error:", err);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
});
router.delete("/admin/downstream-periods/:id", auth_js_1.requireAuth, auth_js_1.requireWriteAccess, (0, auth_js_1.requirePermission)("perm_admin"), [(0, express_validator_1.param)("id").isInt().toInt()], handleValidation, async (req, res) => {
    try {
        const id = Number(req.params.id);
        await prisma_js_1.default.downstreamPeriod.delete({ where: { id } });
        res.json({ success: true, message: "Period deleted" });
    }
    catch (err) {
        console.error("DELETE /api/admin/downstream-periods/:id error:", err);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
});
// ============================================================
// POST /api/admin/downstream-rates
// Body: { downstream_id, date (YYYY-MM-DD), effective_rate }
// ============================================================
router.post("/admin/downstream-rates", auth_js_1.requireAuth, auth_js_1.requireWriteAccess, (0, auth_js_1.requirePermission)("perm_admin"), [
    (0, express_validator_1.body)("downstream_id").isInt().toInt(),
    (0, express_validator_1.body)("date").notEmpty().withMessage("date required").isISO8601(),
    (0, express_validator_1.body)("effective_rate").isDecimal().toFloat(),
], handleValidation, async (req, res) => {
    try {
        const { downstream_id, date, effective_rate } = req.body;
        const downstream = await prisma_js_1.default.downstream.findUnique({ where: { id: downstream_id } });
        if (!downstream) {
            res.status(404).json({ success: false, error: "Downstream not found" });
            return;
        }
        const record = await prisma_js_1.default.dailyDownstreamRate.upsert({
            where: {
                downstreamId_date: {
                    downstreamId: downstream_id,
                    date: new Date(date),
                },
            },
            create: {
                downstreamId: downstream_id,
                date: new Date(date),
                effectiveRate: effective_rate,
            },
            update: {
                effectiveRate: effective_rate,
            },
        });
        res.json({ success: true, data: record });
    }
    catch (err) {
        console.error("POST /api/admin/downstream-rates error:", err);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
});
// ============================================================
// GET /api/admin/downstream-rates
// Query: downstream_id, start_date, end_date
// ============================================================
router.get("/admin/downstream-rates", auth_js_1.requireAuth, [
    (0, express_validator_1.query)("downstream_id").isInt().toInt(),
    (0, express_validator_1.query)("start_date").optional().isISO8601(),
    (0, express_validator_1.query)("end_date").optional().isISO8601(),
], handleValidation, async (req, res) => {
    try {
        const downstreamId = Number(req.query.downstream_id);
        const where = { downstreamId };
        if (req.query.start_date) {
            where.date = { ...where.date, gte: new Date(req.query.start_date) };
        }
        if (req.query.end_date) {
            where.date = { ...where.date, lte: new Date(req.query.end_date) };
        }
        const rates = await prisma_js_1.default.dailyDownstreamRate.findMany({
            where,
            orderBy: { date: "asc" },
        });
        const result = rates.map((r) => ({
            id: r.id,
            downstream_id: r.downstreamId,
            date: (0, date_js_1.formatBusinessDate)(r.date),
            effective_rate: Number(r.effectiveRate),
        }));
        res.json({ success: true, data: result });
    }
    catch (err) {
        console.error("GET /api/admin/downstream-rates error:", err);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
});
// ============================================================
// DELETE /api/users/:id
// ============================================================
router.delete("/users/:id", auth_js_1.requireAuth, auth_js_1.requireWriteAccess, (0, auth_js_1.requirePermission)("perm_admin"), [(0, express_validator_1.param)("id").isInt().toInt()], handleValidation, async (req, res) => {
    try {
        const userId = Number(req.params.id);
        const existing = await prisma_js_1.default.user.findUnique({ where: { id: userId } });
        if (!existing) {
            res.status(404).json({ success: false, error: "User not found" });
            return;
        }
        await prisma_js_1.default.user.delete({ where: { id: userId } });
        res.json({ success: true, message: "User deleted" });
    }
    catch (err) {
        console.error("DELETE /api/users/:id error:", err);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
});
// ============================================================
// PUT /api/ad-sites/:id/price
// ============================================================
router.put("/ad-sites/:id/price", auth_js_1.requireAuth, auth_js_1.requireWriteAccess, (0, auth_js_1.requirePermission)("perm_admin"), [
    (0, express_validator_1.param)("id").isInt().toInt(),
    (0, express_validator_1.body)("new_unit_price").optional().isDecimal().toFloat(),
    (0, express_validator_1.body)("new_ratio").optional().isDecimal().toFloat(),
], handleValidation, async (req, res) => {
    try {
        const siteId = Number(req.params.id);
        const { new_unit_price, new_ratio } = req.body;
        const site = await prisma_js_1.default.adSite.findUnique({ where: { id: siteId } });
        if (!site) {
            res.status(404).json({ success: false, error: "Ad site not found" });
            return;
        }
        if (site.billingMethod === "CPM") {
            if (new_unit_price === undefined) {
                res.status(400).json({ success: false, error: "new_unit_price required for CPM" });
                return;
            }
            await prisma_js_1.default.adSite.update({
                where: { id: siteId },
                data: { currentUnitPrice: new_unit_price },
            });
        }
        else {
            if (new_ratio === undefined) {
                res.status(400).json({ success: false, error: "new_ratio required for RATIO" });
                return;
            }
            await prisma_js_1.default.adSite.update({
                where: { id: siteId },
                data: { currentRatio: new_ratio },
            });
        }
        res.json({ success: true, message: "Price updated" });
    }
    catch (err) {
        console.error("PUT /api/ad-sites/:id/price error:", err);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
});
// ============================================================
// GET /api/admin/ad-sites/:id/reconciliation?month=YYYY-MM
// GET /api/admin/ad-sites/:id/reconciliation?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
// ============================================================
router.get("/admin/ad-sites/:id/reconciliation", auth_js_1.requireAuth, [
    (0, express_validator_1.param)("id").isInt().toInt(),
    (0, express_validator_1.query)("month").optional().matches(/^\d{4}-\d{2}$/).withMessage("month must be YYYY-MM"),
    (0, express_validator_1.query)("start_date").optional().isISO8601().withMessage("start_date must be YYYY-MM-DD"),
    (0, express_validator_1.query)("end_date").optional().isISO8601().withMessage("end_date must be YYYY-MM-DD"),
    (0, express_validator_1.query)().custom((_, { req }) => {
        const queryParams = req.query ?? {};
        const hasMonth = typeof queryParams.month === "string" && queryParams.month.length > 0;
        const hasStart = typeof queryParams.start_date === "string" && queryParams.start_date.length > 0;
        const hasEnd = typeof queryParams.end_date === "string" && queryParams.end_date.length > 0;
        if (!hasMonth && !(hasStart && hasEnd)) {
            throw new Error("month or start_date/end_date is required");
        }
        if (hasStart !== hasEnd) {
            throw new Error("start_date and end_date must be provided together");
        }
        return true;
    }),
], handleValidation, async (req, res) => {
    try {
        const siteId = Number(req.params.id);
        const monthStr = typeof req.query.month === "string" ? req.query.month : undefined;
        const startDateStr = typeof req.query.start_date === "string" ? req.query.start_date : undefined;
        const endDateStr = typeof req.query.end_date === "string" ? req.query.end_date : undefined;
        let startAt;
        let endExclusive;
        if (startDateStr && endDateStr) {
            startAt = (0, date_js_1.getBusinessDayStart)(startDateStr);
            endExclusive = (0, date_js_1.getBusinessDayRange)(endDateStr).lt;
            if (startAt.getTime() >= endExclusive.getTime()) {
                res.status(400).json({ success: false, error: "end_date must be greater than or equal to start_date" });
                return;
            }
        }
        else {
            const [year, month] = String(monthStr).split("-").map(Number);
            const range = (0, date_js_1.getBusinessMonthRange)(year, month);
            startAt = range.gte;
            endExclusive = range.lt;
        }
        const site = await prisma_js_1.default.adSite.findUnique({
            where: { id: siteId },
            select: {
                id: true,
                name: true,
            },
        });
        if (!site) {
            res.status(404).json({ success: false, error: "Ad site not found" });
            return;
        }
        const dailyInputs = await prisma_js_1.default.dailyInput.findMany({
            where: {
                adSiteId: siteId,
                status: "confirmed",
                recordDate: { gte: startAt, lt: endExclusive },
            },
            select: {
                recordDate: true,
                qty: true,
                revenue: true,
            },
            orderBy: { recordDate: "asc" },
        });
        const dailyDetails = dailyInputs.map((row) => ({
            date: (0, date_js_1.formatBusinessDate)(row.recordDate),
            qty: row.qty ?? 0,
            revenue: Number(row.revenue),
            actualRevenue: 0,
        }));
        const totalQty = dailyDetails.reduce((sum, row) => sum + row.qty, 0);
        const totalRevenue = dailyDetails.reduce((sum, row) => sum + row.revenue, 0);
        res.json({
            success: true,
            data: {
                siteInfo: {
                    id: site.id,
                    name: site.name,
                },
                range: {
                    startDate: startDateStr ?? `${monthStr}-01`,
                    endDate: endDateStr ??
                        (0, date_js_1.formatBusinessDate)(new Date(endExclusive.getTime() - 1)),
                },
                summary: {
                    totalQty,
                    totalRevenue,
                    totalActualQty: 0,
                    totalActualRevenue: 0,
                },
                dailyDetails,
            },
        });
    }
    catch (err) {
        console.error("GET /api/admin/ad-sites/:id/reconciliation error:", err);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
});
// ============================================================
// GET /api/downstream/:id/periods
// ============================================================
router.get("/downstream/:id/periods", auth_js_1.requireAuth, (0, auth_js_1.requirePermission)("perm_admin"), [(0, express_validator_1.param)("id").isInt().toInt()], handleValidation, async (req, res) => {
    try {
        const downstreamId = Number(req.params.id);
        const periods = await prisma_js_1.default.downstreamPeriod.findMany({
            where: { downstreamId: downstreamId },
            orderBy: { startDate: "desc" },
        });
        res.json({ success: true, data: periods });
    }
    catch (err) {
        console.error("GET /api/downstream/:id/periods error:", err);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
});
// ============================================================
// POST /api/downstream/:id/periods
// ============================================================
router.post("/downstream/:id/periods", auth_js_1.requireAuth, auth_js_1.requireWriteAccess, (0, auth_js_1.requirePermission)("perm_admin"), [
    (0, express_validator_1.param)("id").isInt().toInt(),
    (0, express_validator_1.body)("pct_ha").notEmpty().withMessage("pct_ha is required").isDecimal().toFloat(),
    (0, express_validator_1.body)("unit_price").notEmpty().withMessage("unit_price is required").isDecimal().toFloat(),
    (0, express_validator_1.body)("start_date").notEmpty().withMessage("start_date is required").isISO8601().toDate(),
    (0, express_validator_1.body)("note").optional().isString(),
], handleValidation, async (req, res) => {
    try {
        const downstreamId = Number(req.params.id);
        const { pct_ha, unit_price, start_date, note } = req.body;
        const userId = req.user.id;
        const startDate = new Date(start_date);
        // 1. Check for overlap — reject if start_date already in an existing period
        const overlapping = await prisma_js_1.default.downstreamPeriod.findFirst({
            where: {
                downstreamId: downstreamId,
                startDate: { lte: startDate },
                OR: [
                    { endDate: null },
                    { endDate: { gte: startDate } },
                ],
            },
        });
        if (overlapping) {
            res.status(409).json({ success: false, error: "start_date overlaps with existing period" });
            return;
        }
        // 2. Close current active period (end_date IS NULL) — set to day before new start
        const activePeriod = await prisma_js_1.default.downstreamPeriod.findFirst({
            where: { downstreamId: downstreamId, endDate: null },
        });
        if (activePeriod) {
            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() - 1);
            await prisma_js_1.default.downstreamPeriod.update({
                where: { id: activePeriod.id },
                data: { endDate: endDate },
            });
        }
        // 3. Insert new period
        const newPeriod = await prisma_js_1.default.downstreamPeriod.create({
            data: {
                downstreamId: downstreamId,
                pctHal: pct_ha,
                unitPrice: unit_price,
                startDate: startDate,
                endDate: null,
                note,
                createdBy: userId,
            },
        });
        res.json({ success: true, data: newPeriod });
    }
    catch (err) {
        console.error("POST /api/downstream/:id/periods error:", err);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
});
// ============================================================
// GET /api/users
// ============================================================
router.get("/users", auth_js_1.requireAuth, (0, auth_js_1.requirePermission)("perm_admin"), async (_req, res) => {
    try {
        const users = await prisma_js_1.default.user.findMany({
            select: {
                id: true,
                username: true,
                role: true,
                permDataInput: true,
                permDataConfirm: true,
                permAdmin: true,
                status: true,
                lastLoginAt: true,
                createdAt: true,
            },
            orderBy: { id: "asc" },
        });
        res.json({ success: true, data: users.map(toUserPublic) });
    }
    catch (err) {
        console.error("GET /api/users error:", err);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
});
// ============================================================
// POST /api/users
// ============================================================
router.post("/users", auth_js_1.requireAuth, auth_js_1.requireWriteAccess, (0, auth_js_1.requirePermission)("perm_admin"), [
    (0, express_validator_1.body)("username").notEmpty().withMessage("username required").isLength({ max: 100 }),
    (0, express_validator_1.body)("password").notEmpty().withMessage("password required").isLength({ min: 6 }),
    (0, express_validator_1.body)("role").notEmpty().withMessage("role required").isIn(["ADMIN", "EDITOR", "VIEWER"]),
    (0, express_validator_1.body)("perm_data_input").isInt({ min: 0, max: 1 }).toInt(),
    (0, express_validator_1.body)("perm_data_confirm").isInt({ min: 0, max: 1 }).toInt(),
    (0, express_validator_1.body)("perm_admin").isInt({ min: 0, max: 1 }).toInt(),
], handleValidation, async (req, res) => {
    try {
        const { username, password, role, perm_data_input, perm_data_confirm, perm_admin, status } = req.body;
        const normalizedRole = role;
        const isViewerRole = normalizedRole === "VIEWER";
        const isAdminRole = normalizedRole === "ADMIN";
        const existing = await prisma_js_1.default.user.findUnique({ where: { username } });
        if (existing) {
            res.status(409).json({ success: false, error: "Username already exists" });
            return;
        }
        const passwordHash = await bcrypt_1.default.hash(password, 10);
        const user = await prisma_js_1.default.user.create({
            data: {
                username,
                passwordHash: passwordHash,
                role: normalizedRole,
                permDataInput: isViewerRole ? false : (isAdminRole ? true : Boolean(perm_data_input)),
                permDataConfirm: isViewerRole ? false : (isAdminRole ? true : Boolean(perm_data_confirm)),
                permAdmin: isAdminRole,
                status: status ?? "active",
            },
            select: {
                id: true,
                username: true,
                role: true,
                permDataInput: true,
                permDataConfirm: true,
                permAdmin: true,
                status: true,
                createdAt: true,
            },
        });
        res.status(201).json({ success: true, data: toUserPublic(user) });
    }
    catch (err) {
        console.error("POST /api/users error:", err);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
});
// ============================================================
// PUT /api/users/:id
// ============================================================
router.put("/users/:id", auth_js_1.requireAuth, auth_js_1.requireWriteAccess, (0, auth_js_1.requirePermission)("perm_admin"), [
    (0, express_validator_1.param)("id").isInt().toInt(),
    (0, express_validator_1.body)("password").optional().isLength({ min: 6 }),
    (0, express_validator_1.body)("role").notEmpty().withMessage("role required").isIn(["ADMIN", "EDITOR", "VIEWER"]),
    (0, express_validator_1.body)("perm_data_input").isInt({ min: 0, max: 1 }).toInt(),
    (0, express_validator_1.body)("perm_data_confirm").isInt({ min: 0, max: 1 }).toInt(),
    (0, express_validator_1.body)("perm_admin").isInt({ min: 0, max: 1 }).toInt(),
    (0, express_validator_1.body)("status").isIn(["active", "inactive"]),
], handleValidation, async (req, res) => {
    try {
        const userId = Number(req.params.id);
        const { password, role, perm_data_input, perm_data_confirm, perm_admin, status } = req.body;
        const normalizedRole = role;
        const isViewerRole = normalizedRole === "VIEWER";
        const isAdminRole = normalizedRole === "ADMIN";
        const existing = await prisma_js_1.default.user.findUnique({ where: { id: userId } });
        if (!existing) {
            res.status(404).json({ success: false, error: "User not found" });
            return;
        }
        const updateData = {
            role: normalizedRole,
            permDataInput: isViewerRole ? false : (isAdminRole ? true : Boolean(perm_data_input)),
            permDataConfirm: isViewerRole ? false : (isAdminRole ? true : Boolean(perm_data_confirm)),
            permAdmin: isAdminRole ? true : (isViewerRole ? false : Boolean(perm_admin)),
            status,
        };
        if (password) {
            updateData.passwordHash = await bcrypt_1.default.hash(password, 10);
        }
        const user = await prisma_js_1.default.user.update({
            where: { id: userId },
            data: updateData,
            select: {
                id: true,
                username: true,
                role: true,
                permDataInput: true,
                permDataConfirm: true,
                permAdmin: true,
                status: true,
                lastLoginAt: true,
                createdAt: true,
            },
        });
        res.json({ success: true, data: toUserPublic(user) });
    }
    catch (err) {
        console.error("PUT /api/users/:id error:", err);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
});
// ============================================================
// POST /api/auth/login
// ============================================================
router.post("/auth/login", [
    (0, express_validator_1.body)("username").notEmpty().withMessage("username required"),
    (0, express_validator_1.body)("password").notEmpty().withMessage("password required"),
], handleValidation, loginRateLimiter.middleware, async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await prisma_js_1.default.user.findUnique({ where: { username } });
        if (!user || user.status === "inactive") {
            res.status(401).json({ success: false, error: "Invalid credentials" });
            return;
        }
        const valid = await bcrypt_1.default.compare(password, user.passwordHash);
        if (!valid) {
            res.status(401).json({ success: false, error: "Invalid credentials" });
            return;
        }
        loginRateLimiter.reset(req);
        // Update last_login_at
        await prisma_js_1.default.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
        });
        const payload = {
            id: user.id,
            username: user.username,
            role: resolveUserRole(user),
            perm_data_input: user.permDataInput,
            perm_data_confirm: user.permDataConfirm,
            perm_admin: user.permAdmin,
            status: user.status,
            last_login_at: user.lastLoginAt ?? undefined,
            created_at: user.createdAt,
        };
        const token = jsonwebtoken_1.default.sign(payload, (0, env_js_1.getRequiredEnv)("JWT_SECRET"), { expiresIn: JWT_EXPIRES_IN });
        res.json({ success: true, token, user: payload });
    }
    catch (err) {
        console.error("POST /api/auth/login error:", err);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
});
// ============================================================
// GET /api/auth/me
// ============================================================
router.get("/auth/me", auth_js_1.requireAuth, async (req, res) => {
    try {
        const user = await prisma_js_1.default.user.findUnique({
            where: { id: req.user.id },
            select: {
                id: true,
                username: true,
                role: true,
                permDataInput: true,
                permDataConfirm: true,
                permAdmin: true,
                status: true,
                lastLoginAt: true,
                createdAt: true,
            },
        });
        if (!user) {
            res.status(404).json({ success: false, error: "User not found" });
            return;
        }
        res.json({ success: true, data: toUserPublic(user) });
    }
    catch (err) {
        console.error("GET /api/auth/me error:", err);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
});
exports.default = router;
