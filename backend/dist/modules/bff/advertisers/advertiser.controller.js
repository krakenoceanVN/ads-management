"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAll = getAll;
exports.getById = getById;
exports.create = create;
exports.update = update;
exports.remove = remove;
const advertiser_service_1 = require("./advertiser.service");
const advertiser_write_service_1 = require("./advertiser.write.service");
const success_1 = require("../../../shared/response/success");
const AppError_1 = require("../../../shared/errors/AppError");
async function getAll(_req, res) {
    const data = await (0, advertiser_service_1.listAdvertisers)();
    res.json((0, success_1.bffData)(data));
}
async function getById(req, res) {
    const id = parseInt(req.params['id'], 10);
    if (isNaN(id))
        throw new AppError_1.NotFoundError('Invalid advertiser id');
    const advertiser = await (0, advertiser_service_1.getAdvertiser)(id);
    if (!advertiser)
        throw new AppError_1.NotFoundError('Advertiser not found');
    res.json((0, success_1.bffData)(advertiser));
}
async function create(req, res) {
    const body = req.body;
    if (!body || !body.name?.trim())
        throw new AppError_1.BadRequestError('name is required');
    if (!body.adTypeCode?.trim())
        throw new AppError_1.BadRequestError('adTypeCode is required');
    const advertiser = await (0, advertiser_write_service_1.createAdvertiser)({
        name: body.name.trim(),
        contact: body.contact ?? null,
        phone: body.phone ?? null,
        email: body.email ?? null,
        notes: body.notes ?? null,
        status: body.status ?? 'active',
        adTypeCode: body.adTypeCode.trim(),
    });
    res.status(201).json((0, success_1.bffData)(advertiser));
}
async function update(req, res) {
    const id = parseInt(req.params['id'], 10);
    if (isNaN(id))
        throw new AppError_1.NotFoundError('Invalid advertiser id');
    const body = req.body;
    const advertiser = await (0, advertiser_write_service_1.updateAdvertiser)(id, {
        name: body.name?.trim(),
        contact: body.contact !== undefined ? body.contact : undefined,
        phone: body.phone !== undefined ? body.phone : undefined,
        email: body.email !== undefined ? body.email : undefined,
        notes: body.notes !== undefined ? body.notes : undefined,
        status: body.status,
        adTypeCode: body.adTypeCode?.trim(),
    });
    res.json((0, success_1.bffData)(advertiser));
}
async function remove(req, res) {
    const id = parseInt(req.params['id'], 10);
    if (isNaN(id))
        throw new AppError_1.NotFoundError('Invalid advertiser id');
    await (0, advertiser_write_service_1.deleteAdvertiser)(id);
    res.json((0, success_1.bffData)({ deleted: true }));
}
//# sourceMappingURL=advertiser.controller.js.map