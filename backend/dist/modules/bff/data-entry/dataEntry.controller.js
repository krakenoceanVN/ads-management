"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAdvertiserEntries = getAdvertiserEntries;
exports.getMediaEntries = getMediaEntries;
const dataEntry_service_1 = require("./dataEntry.service");
const success_1 = require("../../../shared/response/success");
async function getAdvertiserEntries(req, res) {
    const { date, advertiserId, adTypeCode, status } = req.query;
    if (!date) {
        res.status(400).json({ success: false, error: 'date query param is required', code: 'BAD_REQUEST' });
        return;
    }
    const params = {
        date: String(date),
        ...(advertiserId !== undefined && { advertiserId: parseInt(String(advertiserId), 10) }),
        ...(adTypeCode !== undefined && { adTypeCode: String(adTypeCode) }),
        ...(status !== undefined && { status: String(status) }),
    };
    const rows = await (0, dataEntry_service_1.listAdvertiserEntries)(params);
    res.json((0, success_1.bffData)(rows));
}
async function getMediaEntries(req, res) {
    const { date, mediaId, adTypeCode, status } = req.query;
    if (!date) {
        res.status(400).json({ success: false, error: 'date query param is required', code: 'BAD_REQUEST' });
        return;
    }
    const params = {
        date: String(date),
        ...(mediaId !== undefined && { mediaId: parseInt(String(mediaId), 10) }),
        ...(adTypeCode !== undefined && { adTypeCode: String(adTypeCode) }),
        ...(status !== undefined && { status: String(status) }),
    };
    const rows = await (0, dataEntry_service_1.listMediaEntries)(params);
    res.json((0, success_1.bffData)(rows));
}
//# sourceMappingURL=dataEntry.controller.js.map