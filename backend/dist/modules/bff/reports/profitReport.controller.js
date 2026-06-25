"use strict";
/**
 * Profit Report Controller
 *
 * GET /api/bff/reports/total-profit
 * GET /api/bff/reports/order-profit
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTotalProfitReport = getTotalProfitReport;
exports.getOrderProfitReport = getOrderProfitReport;
const profitReport_service_1 = require("./profitReport.service");
const success_1 = require("../../../shared/response/success");
async function getTotalProfitReport(req, res) {
    const { date, startDate, endDate, advertiserId, upstreamId, adTypeCode } = req.query;
    const params = {
        ...(date !== undefined && { date: String(date) }),
        ...(startDate !== undefined && { startDate: String(startDate) }),
        ...(endDate !== undefined && { endDate: String(endDate) }),
        ...(advertiserId !== undefined && { advertiserId: String(advertiserId) }),
        ...(upstreamId !== undefined && { upstreamId: String(upstreamId) }),
        ...(adTypeCode !== undefined && { adTypeCode: String(adTypeCode) }),
    };
    try {
        const rows = await (0, profitReport_service_1.getTotalProfit)(params);
        res.json((0, success_1.bffData)(rows));
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message, code: 'INTERNAL' });
    }
}
async function getOrderProfitReport(req, res) {
    const { date, startDate, endDate, advertiserId, upstreamId, adTypeCode } = req.query;
    const params = {
        ...(date !== undefined && { date: String(date) }),
        ...(startDate !== undefined && { startDate: String(startDate) }),
        ...(endDate !== undefined && { endDate: String(endDate) }),
        ...(advertiserId !== undefined && { advertiserId: String(advertiserId) }),
        ...(upstreamId !== undefined && { upstreamId: String(upstreamId) }),
        ...(adTypeCode !== undefined && { adTypeCode: String(adTypeCode) }),
    };
    try {
        const rows = await (0, profitReport_service_1.getOrderProfit)(params);
        res.json((0, success_1.bffData)(rows));
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message, code: 'INTERNAL' });
    }
}
//# sourceMappingURL=profitReport.controller.js.map