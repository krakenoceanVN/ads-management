"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAll = getAll;
exports.getById = getById;
exports.create = create;
exports.update = update;
exports.remove = remove;
const mediaId_service_1 = require("./mediaId.service");
const mediaId_write_service_1 = require("./mediaId.write.service");
const success_1 = require("../../../shared/response/success");
const AppError_1 = require("../../../shared/errors/AppError");
const oplog_write_service_1 = require("../operation-logs/oplog.write.service");
async function getAll(req, res) {
    const { mediaId, adTypeCode, type, archived } = req.query;
    const filters = {
        mediaId: mediaId ? parseInt(String(mediaId), 10) : undefined,
        adTypeCode: adTypeCode ? String(adTypeCode) : undefined,
        type: type ? String(type) : undefined,
        archived: archived !== undefined ? archived === 'true' : undefined,
    };
    const data = await (0, mediaId_service_1.listMediaIds)(filters);
    res.json((0, success_1.bffData)(data));
}
async function getById(req, res) {
    const id = parseInt(req.params['id'], 10);
    if (isNaN(id))
        throw new AppError_1.NotFoundError('Invalid media id');
    const mediaId = await (0, mediaId_service_1.getMediaId)(id);
    if (!mediaId)
        throw new AppError_1.NotFoundError('Media id not found');
    res.json((0, success_1.bffData)(mediaId));
}
async function create(req, res) {
    const body = req.body;
    if (!body || !body.adSiteId)
        throw new AppError_1.BadRequestError('adSiteId is required');
    if (!body.downstreamId)
        throw new AppError_1.BadRequestError('downstreamId is required');
    // Reject status="inactive" on create
    if (body.status && body.status !== 'active') {
        throw new AppError_1.BadRequestError('status must be "active" — MediaId.status is a read-only compatibility field');
    }
    const mediaId = await (0, mediaId_write_service_1.createMediaId)({
        adSiteId: body.adSiteId,
        downstreamId: body.downstreamId,
        customPrice: body.customPrice ?? null,
    });
    await (0, oplog_write_service_1.recordMasterDataOperation)(req, 'CREATE_MEDIA_ID', 'mediaId', mediaId.id, mediaId.slot);
    res.status(201).json((0, success_1.bffData)(mediaId));
}
async function update(req, res) {
    const id = parseInt(req.params['id'], 10);
    if (isNaN(id))
        throw new AppError_1.NotFoundError('Invalid media id');
    const body = req.body;
    // Reject status="inactive" on PUT
    if (body.status !== undefined && body.status !== 'active') {
        throw new AppError_1.BadRequestError('status must be "active" — MediaId.status is a read-only compatibility field');
    }
    const mediaId = await (0, mediaId_write_service_1.updateMediaId)(id, {
        customPrice: body.customPrice,
        status: body.status,
    });
    await (0, oplog_write_service_1.recordMasterDataOperation)(req, 'UPDATE_MEDIA_ID', 'mediaId', mediaId.id, mediaId.slot);
    res.json((0, success_1.bffData)(mediaId));
}
async function remove(req, res) {
    const id = parseInt(req.params['id'], 10);
    if (isNaN(id))
        throw new AppError_1.NotFoundError('Invalid media id');
    await (0, mediaId_write_service_1.deleteMediaId)(id);
    res.json((0, success_1.bffData)({ deleted: true }));
}
//# sourceMappingURL=mediaId.controller.js.map