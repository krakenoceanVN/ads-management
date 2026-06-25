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
const oplog_write_service_1 = require("../operation-logs/oplog.write.service");
async function getAll(_req, res) {
    const data = await (0, advertiser_service_1.listAdvertisers)();
    res.json((0, success_1.bffData)(data));
}
async function getById(req, res) {
    const id = req.params['id'];
    if (!id)
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
    const adTypeIds = body.adTypeIds?.map(id => id.trim()).filter(Boolean) ?? [];
    const legacyAdTypeId = body.adTypeId?.trim();
    const advertiser = await (0, advertiser_write_service_1.createAdvertiser)({
        name: body.name.trim(),
        contact: body.contact ?? null,
        phone: body.phone ?? null,
        email: body.email ?? null,
        notes: body.notes ?? null,
        status: body.status ?? 'active',
        adTypeId: legacyAdTypeId,
        adTypeIds: adTypeIds.length ? adTypeIds : undefined,
    });
    await (0, oplog_write_service_1.recordMasterDataOperation)(req, 'CREATE_ADVERTISER', 'advertiser', advertiser.id, advertiser.name);
    res.status(201).json((0, success_1.bffData)(advertiser));
}
async function update(req, res) {
    const id = req.params['id'];
    if (!id)
        throw new AppError_1.NotFoundError('Invalid advertiser id');
    const body = req.body;
    const advertiser = await (0, advertiser_write_service_1.updateAdvertiser)(id, {
        name: body.name?.trim(),
        contact: body.contact !== undefined ? body.contact : undefined,
        phone: body.phone !== undefined ? body.phone : undefined,
        email: body.email !== undefined ? body.email : undefined,
        notes: body.notes !== undefined ? body.notes : undefined,
        status: body.status,
        adTypeId: body.adTypeId?.trim(),
        adTypeIds: body.adTypeIds?.map(id => id.trim()).filter(Boolean),
    });
    await (0, oplog_write_service_1.recordMasterDataOperation)(req, 'UPDATE_ADVERTISER', 'advertiser', advertiser.id, advertiser.name);
    res.json((0, success_1.bffData)(advertiser));
}
async function remove(req, res) {
    const id = req.params['id'];
    if (!id)
        throw new AppError_1.NotFoundError('Invalid advertiser id');
    const advertiser = await (0, advertiser_write_service_1.deleteAdvertiser)(id);
    await (0, oplog_write_service_1.recordMasterDataOperation)(req, 'DELETE_ADVERTISER', 'advertiser', id, advertiser.name);
    res.json((0, success_1.bffData)({ deleted: true }));
}
//# sourceMappingURL=advertiser.controller.js.map