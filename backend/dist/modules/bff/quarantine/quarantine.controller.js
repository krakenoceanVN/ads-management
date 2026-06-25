"use strict";
/**
 * Phase 5A: Quarantine Controller
 *
 * Handles quarantine and restore endpoints.
 * Permission guards via requirePermission middleware (route-level).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.postQuarantine = postQuarantine;
exports.postRestore = postRestore;
exports.getQuarantineBatches = getQuarantineBatches;
exports.getQuarantineBatchRecords = getQuarantineBatchRecords;
const quarantine_service_1 = require("./quarantine.service");
const success_1 = require("../../../shared/response/success");
async function postQuarantine(req, res) {
    const { scope, advertiserId, adSiteId, startDate, endDate, reason } = req.body;
    if (!scope || !startDate || !endDate) {
        res.status(400).json({ success: false, error: 'scope, startDate, and endDate are required', code: 'BAD_REQUEST' });
        return;
    }
    const userId = String(req.authUser?.id ?? '');
    try {
        let result;
        if (scope === 'advertiser') {
            if (!advertiserId) {
                res.status(400).json({ success: false, error: 'advertiserId is required for advertiser scope', code: 'BAD_REQUEST' });
                return;
            }
            result = await (0, quarantine_service_1.quarantineAdvertiser)({ advertiserId, startDate, endDate, reason, userId });
        }
        else if (scope === 'media') {
            if (!adSiteId) {
                res.status(400).json({ success: false, error: 'adSiteId is required for media scope', code: 'BAD_REQUEST' });
                return;
            }
            result = await (0, quarantine_service_1.quarantineMedia)({ adSiteId, startDate, endDate, reason, userId });
        }
        else {
            res.status(400).json({ success: false, error: 'scope must be "advertiser" or "media"', code: 'BAD_REQUEST' });
            return;
        }
        res.json((0, success_1.bffData)(result));
    }
    catch (err) {
        if (err.message === 'No confirmed records found for quarantine') {
            res.status(409).json({ success: false, error: err.message, code: 'CONFLICT' });
            return;
        }
        res.status(400).json({ success: false, error: err.message, code: 'BAD_REQUEST' });
    }
}
async function postRestore(req, res) {
    const batchId = req.params['batchId'];
    if (!batchId) {
        res.status(400).json({ success: false, error: 'invalid batchId', code: 'BAD_REQUEST' });
        return;
    }
    const userId = String(req.authUser?.id ?? '');
    try {
        const result = await (0, quarantine_service_1.restoreBatch)(batchId, userId);
        res.json((0, success_1.bffData)(result));
    }
    catch (err) {
        if (err.message === 'Batch was already restored') {
            res.status(409).json({ success: false, error: err.message, code: 'CONFLICT' });
            return;
        }
        if (err.message === 'Batch not found') {
            res.status(404).json({ success: false, error: err.message, code: 'NOT_FOUND' });
            return;
        }
        res.status(400).json({ success: false, error: err.message, code: 'BAD_REQUEST' });
    }
}
async function getQuarantineBatches(req, res) {
    const batches = await (0, quarantine_service_1.listQuarantineBatches)();
    res.json((0, success_1.bffData)(batches));
}
async function getQuarantineBatchRecords(req, res) {
    const batchId = req.params['batchId'];
    if (!batchId) {
        res.status(400).json({ success: false, error: 'invalid batchId', code: 'BAD_REQUEST' });
        return;
    }
    const records = await (0, quarantine_service_1.getBatchRecords)(batchId);
    res.json((0, success_1.bffData)(records));
}
//# sourceMappingURL=quarantine.controller.js.map