"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAll = getAll;
exports.getById = getById;
exports.create = create;
exports.update = update;
exports.remove = remove;
const media_service_1 = require("./media.service");
const media_write_service_1 = require("./media.write.service");
const success_1 = require("../../../shared/response/success");
const AppError_1 = require("../../../shared/errors/AppError");
const oplog_write_service_1 = require("../operation-logs/oplog.write.service");
async function getAll(_req, res) {
    const data = await (0, media_service_1.listMedia)();
    res.json((0, success_1.bffData)(data));
}
async function getById(req, res) {
    const id = parseInt(req.params['id'], 10);
    if (isNaN(id))
        throw new AppError_1.NotFoundError('Invalid media id');
    const media = await (0, media_service_1.getMedia)(id);
    if (!media)
        throw new AppError_1.NotFoundError('Media not found');
    res.json((0, success_1.bffData)(media));
}
async function create(req, res) {
    const body = req.body;
    if (!body || !body.name?.trim())
        throw new AppError_1.BadRequestError('name is required');
    if (!body.upstreamId || body.upstreamId <= 0)
        throw new AppError_1.BadRequestError('upstreamId is required');
    if ((body.billingMethod === 'CPM' || body.billingMethod === 'CPA') &&
        (body.currentUnitPrice === undefined || body.currentUnitPrice === null || isNaN(Number(body.currentUnitPrice)) || Number(body.currentUnitPrice) <= 0)) {
        throw new AppError_1.BadRequestError('currentUnitPrice is required and must be greater than 0 for ' + body.billingMethod);
    }
    if ((body.billingMethod === 'RATIO' || body.billingMethod === 'CPS') &&
        (body.currentRatio === undefined || body.currentRatio === null || isNaN(Number(body.currentRatio)) || Number(body.currentRatio) <= 0)) {
        throw new AppError_1.BadRequestError('currentRatio is required and must be greater than 0 for RATIO/CPS');
    }
    const media = await (0, media_write_service_1.createMedia)({
        name: body.name.trim(),
        contact: body.contact ?? null,
        phone: body.phone ?? null,
        email: body.email ?? null,
        notes: body.notes ?? null,
        status: body.status ?? 'active',
        upstreamId: body.upstreamId,
        billingMethod: body.billingMethod,
        currentUnitPrice: body.currentUnitPrice ?? null,
        currentRatio: body.currentRatio ?? null,
    });
    await (0, oplog_write_service_1.recordMasterDataOperation)(req, 'CREATE_MEDIA', 'media', media.id, media.name);
    res.status(201).json((0, success_1.bffData)(media));
}
async function update(req, res) {
    const id = parseInt(req.params['id'], 10);
    if (isNaN(id))
        throw new AppError_1.NotFoundError('Invalid media id');
    const body = req.body;
    if (body.upstreamId !== undefined && body.upstreamId <= 0)
        throw new AppError_1.BadRequestError('upstreamId must be greater than 0');
    const media = await (0, media_write_service_1.updateMedia)(id, {
        name: body.name?.trim(),
        contact: body.contact !== undefined ? body.contact : undefined,
        phone: body.phone !== undefined ? body.phone : undefined,
        email: body.email !== undefined ? body.email : undefined,
        notes: body.notes !== undefined ? body.notes : undefined,
        status: body.status,
        upstreamId: body.upstreamId,
        adTypeCode: body.adTypeCode?.trim(),
        billingMethod: body.billingMethod,
        currentUnitPrice: body.currentUnitPrice,
        currentRatio: body.currentRatio,
        isArchived: body.isArchived,
    });
    await (0, oplog_write_service_1.recordMasterDataOperation)(req, 'UPDATE_MEDIA', 'media', media.id, media.name);
    res.json((0, success_1.bffData)(media));
}
async function remove(req, res) {
    const id = parseInt(req.params['id'], 10);
    if (isNaN(id))
        throw new AppError_1.NotFoundError('Invalid media id');
    const media = await (0, media_write_service_1.deleteMedia)(id);
    await (0, oplog_write_service_1.recordMasterDataOperation)(req, 'DELETE_MEDIA', 'media', id, media.name);
    res.json((0, success_1.bffData)({ deleted: true }));
}
//# sourceMappingURL=media.controller.js.map