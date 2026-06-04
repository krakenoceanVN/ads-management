"use strict";
/**
 * AdType BFF Controller
 * Handles HTTP endpoints for AdType CRUD.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAll = getAll;
exports.getById = getById;
exports.create = create;
exports.update = update;
exports.remove = remove;
const adType_service_1 = require("./adType.service");
const adType_write_service_1 = require("./adType.write.service");
const success_1 = require("../../../shared/response/success");
const AppError_1 = require("../../../shared/errors/AppError");
async function getAll(_req, res) {
    const data = await (0, adType_service_1.listAdTypes)();
    res.json((0, success_1.bffData)(data));
}
async function getById(req, res) {
    const id = parseInt(req.params['id'], 10);
    if (isNaN(id))
        throw new AppError_1.NotFoundError('Invalid adType id');
    const adType = await (0, adType_service_1.getAdType)(id);
    if (!adType)
        throw new AppError_1.NotFoundError('AdType not found');
    res.json((0, success_1.bffData)(adType));
}
async function create(req, res) {
    const { code, name } = req.body;
    if (!code)
        throw new AppError_1.BadRequestError('code is required');
    if (!name)
        throw new AppError_1.BadRequestError('name is required');
    const result = await (0, adType_write_service_1.createAdType)({ code, name });
    res.status(201).json((0, success_1.bffData)(result));
}
async function update(req, res) {
    const id = parseInt(req.params['id'], 10);
    if (isNaN(id))
        throw new AppError_1.NotFoundError('Invalid adType id');
    const { code, name } = req.body;
    const result = await (0, adType_write_service_1.updateAdType)(id, { code, name });
    res.json((0, success_1.bffData)(result));
}
async function remove(req, res) {
    const id = parseInt(req.params['id'], 10);
    if (isNaN(id))
        throw new AppError_1.NotFoundError('Invalid adType id');
    await (0, adType_write_service_1.deleteAdType)(id);
    res.json((0, success_1.bffData)({ deleted: true }));
}
//# sourceMappingURL=adType.controller.js.map