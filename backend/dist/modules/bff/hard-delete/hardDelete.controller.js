"use strict";
/**
 * Phase 3C: Hard Delete Controller
 *
 * Handles hard delete HTTP endpoints.
 * Permission guard via requirePermission middleware (route-level).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteAdvertiser = deleteAdvertiser;
exports.deleteAdType = deleteAdType;
exports.deleteAdId = deleteAdId;
exports.deleteMedia = deleteMedia;
exports.deleteMediaAdOrder = deleteMediaAdOrder;
exports.deleteMediaId = deleteMediaId;
exports.getAdvertiserDependencies = getAdvertiserDependencies;
exports.getAdTypeDependencies = getAdTypeDependencies;
exports.getAdIdDependencies = getAdIdDependencies;
exports.getMediaDependencies = getMediaDependencies;
const hardDelete_service_1 = require("./hardDelete.service");
function getUserId(req) {
    return req.authUser?.id ?? '';
}
function getUsername(req) {
    return req.authUser?.username ?? null;
}
function sendResult(res, result) {
    if (result.success) {
        res.json(result);
        return;
    }
    switch (result.code) {
        case 'NOT_FOUND':
            res.status(404).json(result);
            break;
        case 'ENTITY_HAS_FINANCIAL_DATA':
        case 'ENTITY_HAS_DEPENDENCIES':
            res.status(409).json(result);
            break;
        case 'LIMITATION':
            res.status(501).json(result);
            break;
        default:
            res.status(500).json({ success: false, code: 'INTERNAL_ERROR', message: 'Unexpected error' });
    }
}
async function deleteAdvertiser(req, res) {
    const id = req.params['id'];
    if (!id) {
        res.status(400).json({ success: false, code: 'BAD_REQUEST', message: 'Invalid id' });
        return;
    }
    try {
        const result = await (0, hardDelete_service_1.hardDeleteAdvertiser)(id, { userId: getUserId(req), username: getUsername(req) });
        sendResult(res, result);
    }
    catch (err) {
        if (err.message?.includes('Record to delete does not exist')) {
            res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Không tìm thấy bản ghi cần xóa.' });
            return;
        }
        res.status(500).json({ success: false, code: 'INTERNAL_ERROR', message: err.message });
    }
}
async function deleteAdType(req, res) {
    const id = req.params['id'];
    if (!id) {
        res.status(400).json({ success: false, code: 'BAD_REQUEST', message: 'Invalid id' });
        return;
    }
    try {
        const result = await (0, hardDelete_service_1.hardDeleteAdType)(id, { userId: getUserId(req), username: getUsername(req) });
        sendResult(res, result);
    }
    catch (err) {
        if (err.message?.includes('Record to delete does not exist')) {
            res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Không tìm thấy bản ghi cần xóa.' });
            return;
        }
        res.status(500).json({ success: false, code: 'INTERNAL_ERROR', message: err.message });
    }
}
async function deleteAdId(req, res) {
    const id = req.params['id'];
    if (!id) {
        res.status(400).json({ success: false, code: 'BAD_REQUEST', message: 'Invalid id' });
        return;
    }
    try {
        const result = await (0, hardDelete_service_1.hardDeleteAdSite)(id, { userId: getUserId(req), username: getUsername(req) }, 'adId');
        sendResult(res, result);
    }
    catch (err) {
        if (err.message?.includes('Record to delete does not exist')) {
            res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Không tìm thấy bản ghi cần xóa.' });
            return;
        }
        res.status(500).json({ success: false, code: 'INTERNAL_ERROR', message: err.message });
    }
}
async function deleteMedia(req, res) {
    const id = req.params['id'];
    if (!id) {
        res.status(400).json({ success: false, code: 'BAD_REQUEST', message: 'Invalid id' });
        return;
    }
    try {
        const result = await (0, hardDelete_service_1.hardDeleteAdSite)(id, { userId: getUserId(req), username: getUsername(req) }, 'media');
        sendResult(res, result);
    }
    catch (err) {
        if (err.message?.includes('Record to delete does not exist')) {
            res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Không tìm thấy bản ghi cần xóa.' });
            return;
        }
        res.status(500).json({ success: false, code: 'INTERNAL_ERROR', message: err.message });
    }
}
async function deleteMediaAdOrder(req, res) {
    const id = req.params['id'];
    if (!id) {
        res.status(400).json({ success: false, code: 'BAD_REQUEST', message: 'Invalid id' });
        return;
    }
    try {
        const result = await (0, hardDelete_service_1.hardDeleteMediaAdOrder)(id, { userId: getUserId(req), username: getUsername(req) });
        sendResult(res, result);
    }
    catch (err) {
        res.status(500).json({ success: false, code: 'INTERNAL_ERROR', message: err.message });
    }
}
async function deleteMediaId(req, res) {
    const id = req.params['id'];
    if (!id) {
        res.status(400).json({ success: false, code: 'BAD_REQUEST', message: 'Invalid id' });
        return;
    }
    try {
        const result = await (0, hardDelete_service_1.hardDeleteMediaId)(id, { userId: getUserId(req), username: getUsername(req) });
        sendResult(res, result);
    }
    catch (err) {
        res.status(500).json({ success: false, code: 'INTERNAL_ERROR', message: err.message });
    }
}
async function getAdvertiserDependencies(req, res) {
    const id = req.params['id'];
    if (!id) {
        res.status(400).json({ success: false, code: 'BAD_REQUEST', message: 'Invalid id' });
        return;
    }
    try {
        const counts = await (0, hardDelete_service_1.countAdvertiserDependencies)(id);
        res.json({ success: true, data: counts });
    }
    catch (err) {
        res.status(500).json({ success: false, code: 'INTERNAL_ERROR', message: err.message });
    }
}
async function getAdTypeDependencies(req, res) {
    const id = req.params['id'];
    if (!id) {
        res.status(400).json({ success: false, code: 'BAD_REQUEST', message: 'Invalid id' });
        return;
    }
    try {
        const counts = await (0, hardDelete_service_1.countAdTypeDependencies)(id);
        res.json({ success: true, data: counts });
    }
    catch (err) {
        res.status(500).json({ success: false, code: 'INTERNAL_ERROR', message: err.message });
    }
}
async function getAdIdDependencies(req, res) {
    const id = req.params['id'];
    if (!id) {
        res.status(400).json({ success: false, code: 'BAD_REQUEST', message: 'Invalid id' });
        return;
    }
    try {
        const counts = await (0, hardDelete_service_1.countAdSiteDependencies)(id);
        res.json({ success: true, data: counts });
    }
    catch (err) {
        res.status(500).json({ success: false, code: 'INTERNAL_ERROR', message: err.message });
    }
}
async function getMediaDependencies(req, res) {
    const id = req.params['id'];
    if (!id) {
        res.status(400).json({ success: false, code: 'BAD_REQUEST', message: 'Invalid id' });
        return;
    }
    try {
        const counts = await (0, hardDelete_service_1.countAdSiteDependencies)(id);
        res.json({ success: true, data: counts });
    }
    catch (err) {
        res.status(500).json({ success: false, code: 'INTERNAL_ERROR', message: err.message });
    }
}
//# sourceMappingURL=hardDelete.controller.js.map