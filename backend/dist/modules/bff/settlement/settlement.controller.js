"use strict";
/**
 * Settlement Controller
 *
 * GET /api/bff/settlement/advertisers — confirmed advertiser settlement
 * GET /api/bff/settlement/media — confirmed media settlement with payout cost
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAdvertiserSettlementHandler = getAdvertiserSettlementHandler;
exports.getMediaSettlementHandler = getMediaSettlementHandler;
const settlement_service_1 = require("./settlement.service");
const success_1 = require("../../../shared/response/success");
async function getAdvertiserSettlementHandler(req, res) {
    const { period, advertiserId, adTypeCode } = req.query;
    const params = {
        ...(period !== undefined && { period: String(period) }),
        ...(advertiserId !== undefined && { advertiserId: parseInt(String(advertiserId), 10) }),
        ...(adTypeCode !== undefined && { adTypeCode: String(adTypeCode) }),
    };
    try {
        const rows = await (0, settlement_service_1.getAdvertiserSettlement)(params);
        res.json((0, success_1.bffData)(rows));
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message, code: 'INTERNAL' });
    }
}
async function getMediaSettlementHandler(req, res) {
    const { period, mediaId, adTypeCode } = req.query;
    const params = {
        ...(period !== undefined && { period: String(period) }),
        ...(mediaId !== undefined && { mediaId: parseInt(String(mediaId), 10) }),
        ...(adTypeCode !== undefined && { adTypeCode: String(adTypeCode) }),
    };
    try {
        const rows = await (0, settlement_service_1.getMediaSettlement)(params);
        res.json((0, success_1.bffData)(rows));
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message, code: 'INTERNAL' });
    }
}
//# sourceMappingURL=settlement.controller.js.map