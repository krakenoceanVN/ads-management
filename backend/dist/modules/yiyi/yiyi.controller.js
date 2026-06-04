"use strict";
/**
 * Phase 6A: Yiyi Controller
 *
 * Endpoints at /api/yiyi-data (NOT /api/bff)
 * - GET /yiyi-data?date=YYYY-MM-DD
 * - GET /yiyi-data/monthly?year=YYYY&month=M
 * - POST /yiyi-data/batch
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getYiyiDailyHandler = getYiyiDailyHandler;
exports.getYiyiMonthlyHandler = getYiyiMonthlyHandler;
exports.postYiyiBatch = postYiyiBatch;
const yiyi_service_1 = require("./yiyi.service");
const success_1 = require("../../shared/response/success");
// ─── GET /yiyi-data?date=YYYY-MM-DD ──────────────────────────────────────────
async function getYiyiDailyHandler(req, res) {
    const { date } = req.query;
    if (!date || typeof date !== 'string') {
        res.status(400).json({ success: false, error: 'date query param is required (YYYY-MM-DD)', code: 'BAD_REQUEST' });
        return;
    }
    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        res.status(400).json({ success: false, error: 'Invalid date format. Use YYYY-MM-DD.', code: 'BAD_REQUEST' });
        return;
    }
    const rows = await (0, yiyi_service_1.getYiyiDaily)(date);
    res.json((0, success_1.bffData)(rows));
}
// ─── GET /yiyi-data/monthly?year=YYYY&month=M ──────────────────────────────────
async function getYiyiMonthlyHandler(req, res) {
    const { year, month } = req.query;
    if (!year || !month) {
        res.status(400).json({ success: false, error: 'year and month query params are required', code: 'BAD_REQUEST' });
        return;
    }
    const yearNum = parseInt(String(year), 10);
    const monthNum = parseInt(String(month), 10);
    if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
        res.status(400).json({ success: false, error: 'Invalid year or month', code: 'BAD_REQUEST' });
        return;
    }
    const rows = await (0, yiyi_service_1.getYiyiMonthly)(yearNum, monthNum);
    res.json((0, success_1.bffData)(rows));
}
// ─── POST /yiyi-data/batch ─────────────────────────────────────────────────────
async function postYiyiBatch(req, res) {
    const { date, items, pricing } = req.body;
    if (!date || typeof date !== 'string') {
        res.status(400).json({ success: false, error: 'date is required', code: 'BAD_REQUEST' });
        return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        res.status(400).json({ success: false, error: 'Invalid date format. Use YYYY-MM-DD.', code: 'BAD_REQUEST' });
        return;
    }
    if (!Array.isArray(items) || items.length === 0) {
        res.status(400).json({ success: false, error: 'items must be a non-empty array', code: 'BAD_REQUEST' });
        return;
    }
    // Validate each item
    for (const item of items) {
        if (!yiyi_service_1.YIYI_CHANNELS.includes(item.channel)) {
            res.status(400).json({ success: false, error: `Invalid channel: ${item.channel}. Allowed: ${yiyi_service_1.YIYI_CHANNELS.join(', ')}`, code: 'BAD_REQUEST' });
            return;
        }
        if (typeof item.qty !== 'number' || item.qty < 0 || !Number.isInteger(item.qty)) {
            res.status(400).json({ success: false, error: 'qty must be a non-negative integer', code: 'BAD_REQUEST' });
            return;
        }
        if (item.unitPrice !== undefined && (typeof item.unitPrice !== 'number' || item.unitPrice < 0)) {
            res.status(400).json({ success: false, error: 'unitPrice must be >= 0', code: 'BAD_REQUEST' });
            return;
        }
        if (item.profitUnitPrice !== undefined && (typeof item.profitUnitPrice !== 'number' || item.profitUnitPrice < 0)) {
            res.status(400).json({ success: false, error: 'profitUnitPrice must be >= 0', code: 'BAD_REQUEST' });
            return;
        }
    }
    // Validate pricing
    if (pricing) {
        if (pricing.unitPrice !== undefined && pricing.unitPrice < 0) {
            res.status(400).json({ success: false, error: 'pricing.unitPrice must be >= 0', code: 'BAD_REQUEST' });
            return;
        }
        if (pricing.profitUnitPrice !== undefined && pricing.profitUnitPrice < 0) {
            res.status(400).json({ success: false, error: 'pricing.profitUnitPrice must be >= 0', code: 'BAD_REQUEST' });
            return;
        }
    }
    try {
        const result = await (0, yiyi_service_1.saveYiyiBatch)(date, items, pricing);
        res.json((0, success_1.bffData)(result));
    }
    catch (err) {
        res.status(400).json({ success: false, error: err.message, code: 'BAD_REQUEST' });
    }
}
//# sourceMappingURL=yiyi.controller.js.map