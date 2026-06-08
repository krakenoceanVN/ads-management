"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAll = getAll;
exports.getById = getById;
exports.create = create;
exports.update = update;
exports.remove = remove;
const adOrder_service_1 = require("./adOrder.service");
const adOrder_write_service_1 = require("./adOrder.write.service");
const success_1 = require("../../../shared/response/success");
const AppError_1 = require("../../../shared/errors/AppError");
const oplog_write_service_1 = require("../operation-logs/oplog.write.service");
async function getAll(req, res) {
    const { advertiserId, adTypeCode } = req.query;
    const params = {
        advertiserId: advertiserId ? parseInt(String(advertiserId), 10) : undefined,
        adTypeCode: adTypeCode ? String(adTypeCode) : undefined,
    };
    const data = await (0, adOrder_service_1.listAdOrders)(params);
    res.json((0, success_1.bffData)(data));
}
async function getById(req, res) {
    const id = parseInt(req.params['id'], 10);
    if (isNaN(id))
        throw new AppError_1.NotFoundError('Invalid ad order id');
    const order = await (0, adOrder_service_1.getAdOrder)(id);
    if (!order)
        throw new AppError_1.NotFoundError('Ad order not found');
    res.json((0, success_1.bffData)(order));
}
async function create(req, res) {
    const body = req.body;
    if (!body || !body.advertiserId)
        throw new AppError_1.BadRequestError('advertiserId is required');
    if (!body.name?.trim())
        throw new AppError_1.BadRequestError('name is required');
    if (!body.adTypeCode?.trim())
        throw new AppError_1.BadRequestError('adTypeCode is required');
    const order = await (0, adOrder_write_service_1.createAdOrder)({
        advertiserId: body.advertiserId,
        name: body.name.trim(),
        adTypeCode: body.adTypeCode.trim(),
        notes: body.notes ?? null,
        status: body.status ?? 'active',
    });
    await (0, oplog_write_service_1.recordMasterDataOperation)(req, 'CREATE_AD_ORDER', 'adOrder', order.id, order.name);
    res.status(201).json((0, success_1.bffData)(order));
}
async function update(req, res) {
    const id = parseInt(req.params['id'], 10);
    if (isNaN(id))
        throw new AppError_1.NotFoundError('Invalid ad order id');
    const body = req.body;
    const order = await (0, adOrder_write_service_1.updateAdOrder)(id, {
        name: body.name?.trim(),
        notes: body.notes !== undefined ? body.notes : undefined,
        status: body.status,
        advertiserId: body.advertiserId,
        adTypeCode: body.adTypeCode?.trim(),
    });
    await (0, oplog_write_service_1.recordMasterDataOperation)(req, 'UPDATE_AD_ORDER', 'adOrder', order.id, order.name);
    res.json((0, success_1.bffData)(order));
}
async function remove(req, res) {
    const id = parseInt(req.params['id'], 10);
    if (isNaN(id))
        throw new AppError_1.NotFoundError('Invalid ad order id');
    const order = await (0, adOrder_write_service_1.deleteAdOrder)(id);
    await (0, oplog_write_service_1.recordMasterDataOperation)(req, 'DELETE_AD_ORDER', 'adOrder', id, order.name);
    res.json((0, success_1.bffData)({ deleted: true }));
}
//# sourceMappingURL=adOrder.controller.js.map