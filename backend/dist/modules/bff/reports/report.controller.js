"use strict";
/**
 * Phase 4A: Reports Controller
 * Read-only report endpoints.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAdvertisersReport = getAdvertisersReport;
exports.getMediaReportHandler = getMediaReportHandler;
const report_service_1 = require("./report.service");
const success_1 = require("../../../shared/response/success");
async function getAdvertisersReport(req, res) {
    const { date, startDate, endDate, advertiserId, adTypeCode, status } = req.query;
    const params = {
        ...(date !== undefined && { date: String(date) }),
        ...(startDate !== undefined && { startDate: String(startDate) }),
        ...(endDate !== undefined && { endDate: String(endDate) }),
        ...(advertiserId !== undefined && { advertiserId: String(advertiserId) }),
        ...(adTypeCode !== undefined && { adTypeCode: String(adTypeCode) }),
        ...(status !== undefined && { status: String(status) }),
    };
    const rows = await (0, report_service_1.getAdvertiserReport)(params);
    res.json((0, success_1.bffData)(rows));
}
async function getMediaReportHandler(req, res) {
    const { date, startDate, endDate, mediaId, adTypeCode, status } = req.query;
    const params = {
        ...(date !== undefined && { date: String(date) }),
        ...(startDate !== undefined && { startDate: String(startDate) }),
        ...(endDate !== undefined && { endDate: String(endDate) }),
        ...(mediaId !== undefined && { mediaId: String(mediaId) }),
        ...(adTypeCode !== undefined && { adTypeCode: String(adTypeCode) }),
        ...(status !== undefined && { status: String(status) }),
    };
    const rows = await (0, report_service_1.getMediaReport)(params);
    res.json((0, success_1.bffData)(rows));
}
//# sourceMappingURL=report.controller.js.map