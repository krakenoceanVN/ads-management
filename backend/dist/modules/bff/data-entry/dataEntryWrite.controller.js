"use strict";
/**
 * Phase 3B/3C: Data Entry Write Controller
 * Handles advertiser and media batch save/confirm/unconfirm.
 * Permission guards are applied at route level via requirePermission middleware.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.postAdvertiserBatch = postAdvertiserBatch;
exports.postAdvertiserConfirmBatch = postAdvertiserConfirmBatch;
exports.putAdvertiserUnconfirm = putAdvertiserUnconfirm;
exports.postMediaBatch = postMediaBatch;
exports.postMediaConfirmBatch = postMediaConfirmBatch;
exports.putMediaUnconfirm = putMediaUnconfirm;
const advertiserBatch_service_1 = require("./advertiserBatch.service");
const mediaBatch_service_1 = require("./mediaBatch.service");
const success_1 = require("../../../shared/response/success");
// ─── Advertiser Batch Save ───────────────────────────────────────────────────
async function postAdvertiserBatch(req, res) {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
        res.status(400).json({ success: false, error: 'items must be a non-empty array', code: 'BAD_REQUEST' });
        return;
    }
    const userId = req.authUser?.id ?? 0;
    try {
        const result = await (0, advertiserBatch_service_1.saveAdvertiserBatch)(items, userId);
        res.json((0, success_1.bffData)(result));
    }
    catch (err) {
        res.status(400).json({ success: false, error: err.message, code: 'BAD_REQUEST' });
    }
}
// ─── Advertiser Confirm Batch ────────────────────────────────────────────────
async function postAdvertiserConfirmBatch(req, res) {
    const { recordDate, adSiteIds } = req.body;
    if (!recordDate || !Array.isArray(adSiteIds) || adSiteIds.length === 0) {
        res.status(400).json({ success: false, error: 'recordDate and adSiteIds[] are required', code: 'BAD_REQUEST' });
        return;
    }
    const userId = req.authUser?.id ?? 0;
    const result = await (0, advertiserBatch_service_1.confirmAdvertiserBatch)(recordDate, adSiteIds, userId);
    res.json((0, success_1.bffData)(result));
}
// ─── Advertiser Unconfirm ────────────────────────────────────────────────────
async function putAdvertiserUnconfirm(req, res) {
    const id = parseInt(req.params['id'], 10);
    if (!id) {
        res.status(400).json({ success: false, error: 'invalid id', code: 'BAD_REQUEST' });
        return;
    }
    const userId = req.authUser?.id ?? 0;
    try {
        const result = await (0, advertiserBatch_service_1.unconfirmAdvertiser)(id, userId);
        res.json((0, success_1.bffData)(result));
    }
    catch (err) {
        res.status(400).json({ success: false, error: err.message, code: 'BAD_REQUEST' });
    }
}
// ─── Media Batch Save ────────────────────────────────────────────────────────
async function postMediaBatch(req, res) {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
        res.status(400).json({ success: false, error: 'items must be a non-empty array', code: 'BAD_REQUEST' });
        return;
    }
    const userId = req.authUser?.id ?? 0;
    try {
        const result = await (0, mediaBatch_service_1.saveMediaBatch)(items, userId);
        res.json((0, success_1.bffData)(result));
    }
    catch (err) {
        res.status(400).json({ success: false, error: err.message, code: 'BAD_REQUEST' });
    }
}
// ─── Media Confirm Batch ─────────────────────────────────────────────────────
async function postMediaConfirmBatch(req, res) {
    const { recordDate, adSiteIds } = req.body;
    if (!recordDate || !Array.isArray(adSiteIds) || adSiteIds.length === 0) {
        res.status(400).json({ success: false, error: 'recordDate and adSiteIds[] are required', code: 'BAD_REQUEST' });
        return;
    }
    const userId = req.authUser?.id ?? 0;
    const result = await (0, mediaBatch_service_1.confirmMediaBatch)(recordDate, adSiteIds, userId);
    res.json((0, success_1.bffData)(result));
}
// ─── Media Unconfirm ─────────────────────────────────────────────────────────
async function putMediaUnconfirm(req, res) {
    const id = parseInt(req.params['id'], 10);
    if (!id) {
        res.status(400).json({ success: false, error: 'invalid id', code: 'BAD_REQUEST' });
        return;
    }
    const userId = req.authUser?.id ?? 0;
    try {
        const result = await (0, mediaBatch_service_1.unconfirmMedia)(id, userId);
        res.json((0, success_1.bffData)(result));
    }
    catch (err) {
        res.status(400).json({ success: false, error: err.message, code: 'BAD_REQUEST' });
    }
}
//# sourceMappingURL=dataEntryWrite.controller.js.map