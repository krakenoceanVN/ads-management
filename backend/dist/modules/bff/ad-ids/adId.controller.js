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
async function getAll(req, res) {
    const { advertiserId, adOrderId, adTypeCode, type, archived } = req.query;
    const filters = {
        advertiserId: advertiserId ? parseInt(String(advertiserId), 10) : undefined,
        adOrderId: adOrderId ? parseInt(String(adOrderId), 10) : undefined,
        adTypeCode: adTypeCode ? String(adTypeCode) : undefined,
        type: type ? String(type) : undefined,
        archived: archived !== undefined ? archived === 'true' : undefined,
    };
    const data = await (0, adId_service_1.listAdIds)(filters);
    res.json((0, success_1.bffData)(data));
}
async function getById(req, res) {
    const id = parseInt(req.params['id'], 10);
    if (isNaN(id))
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
    if (!body.adOrderId && !body.adTypeCode)
        throw new AppError_1.BadRequestError('adOrderId or adTypeCode is required');
    if (!body.slot?.trim())
        throw new AppError_1.BadRequestError('slot is required');
    if (!body.type)
        throw new AppError_1.BadRequestError('type is required');
    if ((body.type === 'CPM' || body.type === 'CPA') && (body.unitPrice === undefined || body.unitPrice === null || isNaN(Number(body.unitPrice)) || Number(body.unitPrice) <= 0)) {
        throw new AppError_1.BadRequestError('unitPrice is required and must be greater than 0 for ' + body.type);
    }
    if ((body.type === 'RATIO' || body.type === 'CPS') && (body.ratio === undefined || body.ratio === null || isNaN(Number(body.ratio)) || Number(body.ratio) <= 0)) {
        throw new AppError_1.BadRequestError('ratio is required and must be greater than 0 for CPS');
    }
    const adId = await (0, adId_write_service_1.createAdId)({
        advertiserId: body.advertiserId,
        adOrderId: body.adOrderId,
        adTypeCode: body.adTypeCode,
        slot: body.slot.trim(),
        type: body.type,
        unitPrice: body.unitPrice ?? null,
        ratio: body.ratio ?? null,
        status: body.status ?? 'active',
    });
    res.status(201).json((0, success_1.bffData)(adId));
}
async function update(req, res) {
    const id = parseInt(req.params['id'], 10);
    if (isNaN(id))
        throw new AppError_1.NotFoundError('Invalid ad id');
    const body = req.body;
    const adId = await (0, adId_write_service_1.updateAdId)(id, {
        advertiserId: body.advertiserId,
        adOrderId: body.adOrderId,
        adTypeCode: body.adTypeCode,
        slot: body.slot?.trim(),
        type: body.type,
        unitPrice: body.unitPrice,
        ratio: body.ratio,
        status: body.status,
    });
    res.json((0, success_1.bffData)(adId));
}
async function remove(req, res) {
    const id = parseInt(req.params['id'], 10);
    if (isNaN(id))
        throw new AppError_1.NotFoundError('Invalid ad id');
    await (0, adId_write_service_1.deleteAdId)(id);
    res.json((0, success_1.bffData)({ deleted: true }));
}
//# sourceMappingURL=adId.controller.js.map