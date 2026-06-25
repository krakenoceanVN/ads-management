"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAll = getAll;
exports.getById = getById;
exports.create = create;
exports.update = update;
exports.remove = remove;
const adId_service_1 = require("./adId.service");
const adId_write_service_1 = require("./adId.write.service");
const success_1 = require("../../../shared/response/success");
const AppError_1 = require("../../../shared/errors/AppError");
const oplog_write_service_1 = require("../operation-logs/oplog.write.service");
const bff_types_1 = require("../bff.types");
async function getAll(req, res) {
    const { advertiserId, adTypeId, type, archived } = req.query;
    const filters = {
        advertiserId: advertiserId ? parseInt(String(advertiserId), 10) : undefined,
        adTypeId: adTypeId ? String(adTypeId) : undefined,
        type: type ? String(type) : undefined,
        archived: archived !== undefined ? archived === 'true' : undefined,
    };
    const data = await (0, adId_service_1.listAdIds)(filters);
    res.json((0, success_1.bffData)(data));
}
async function getById(req, res) {
    const id = req.params['id'];
    if (!id)
        throw new AppError_1.NotFoundError('Invalid ad id');
    const adId = await (0, adId_service_1.getAdId)(id);
    if (!adId)
        throw new AppError_1.NotFoundError('Ad id not found');
    res.json((0, success_1.bffData)(adId));
}
async function create(req, res) {
    const body = req.body;
    if (!body || !body.advertiserId)
        throw new AppError_1.BadRequestError('advertiserId is required');
    if (!body.adTypeId)
        throw new AppError_1.BadRequestError('adTypeId is required');
    if (!body.slot?.trim())
        throw new AppError_1.BadRequestError('slot is required');
    if (!body.type)
        throw new AppError_1.BadRequestError('type is required');
    const canonicalType = (0, bff_types_1.normalizeBillingMethodForStorage)(body.type);
    if (!canonicalType)
        throw new AppError_1.BadRequestError('Invalid billing method: ' + body.type);
    if ((canonicalType === 'CPM' || canonicalType === 'CPA') && (body.unitPrice === undefined || body.unitPrice === null || isNaN(Number(body.unitPrice)) || Number(body.unitPrice) <= 0)) {
        throw new AppError_1.BadRequestError('unitPrice is required and must be greater than 0 for ' + canonicalType);
    }
    if (canonicalType === 'CPS' && (body.ratio === undefined || body.ratio === null || isNaN(Number(body.ratio)) || Number(body.ratio) <= 0)) {
        throw new AppError_1.BadRequestError('ratio is required and must be greater than 0 for CPS');
    }
    const adId = await (0, adId_write_service_1.createAdId)({
        advertiserId: body.advertiserId,
        adTypeId: body.adTypeId,
        slot: body.slot.trim(),
        type: body.type,
        unitPrice: body.unitPrice ?? null,
        ratio: body.ratio ?? null,
        notes: body.notes ?? null,
        status: body.status ?? 'active',
    });
    await (0, oplog_write_service_1.recordMasterDataOperation)(req, 'CREATE_AD_ID', 'adId', adId.id, adId.slot);
    res.status(201).json((0, success_1.bffData)(adId));
}
async function update(req, res) {
    const id = req.params['id'];
    if (!id)
        throw new AppError_1.NotFoundError('Invalid ad id');
    const body = req.body;
    const adId = await (0, adId_write_service_1.updateAdId)(id, {
        advertiserId: body.advertiserId,
        adTypeId: body.adTypeId,
        slot: body.slot?.trim(),
        type: body.type,
        unitPrice: body.unitPrice,
        ratio: body.ratio,
        notes: body.notes !== undefined ? body.notes : undefined,
        status: body.status,
    });
    await (0, oplog_write_service_1.recordMasterDataOperation)(req, 'UPDATE_AD_ID', 'adId', adId.id, adId.slot);
    res.json((0, success_1.bffData)(adId));
}
async function remove(req, res) {
    const id = req.params['id'];
    if (!id)
        throw new AppError_1.NotFoundError('Invalid ad id');
    const adId = await (0, adId_write_service_1.deleteAdId)(id);
    await (0, oplog_write_service_1.recordMasterDataOperation)(req, 'DELETE_AD_ID', 'adId', id, adId.slot);
    res.json((0, success_1.bffData)({ deleted: true }));
}
//# sourceMappingURL=adId.controller.js.map