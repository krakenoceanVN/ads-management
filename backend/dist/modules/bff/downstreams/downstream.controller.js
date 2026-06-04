"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAll = getAll;
exports.create = create;
exports.update = update;
exports.remove = remove;
const downstream_service_1 = require("./downstream.service");
const downstream_write_service_1 = require("./downstream.write.service");
const success_1 = require("../../../shared/response/success");
const AppError_1 = require("../../../shared/errors/AppError");
async function getAll(req, res) {
    const { adTypeCode, status, keyword } = req.query;
    const filters = {
        adTypeCode: adTypeCode ? String(adTypeCode) : undefined,
        status: status ? String(status) : undefined,
        keyword: keyword ? String(keyword) : undefined,
    };
    const data = await (0, downstream_service_1.listDownstreams)(filters);
    res.json((0, success_1.bffData)(data));
}
async function create(req, res) {
    const { adTypeId, downstreamType, payoutRate, status } = req.body;
    if (!adTypeId)
        throw new AppError_1.BadRequestError('adTypeId is required');
    if (!downstreamType)
        throw new AppError_1.BadRequestError('downstreamType is required');
    const result = await (0, downstream_write_service_1.createDownstream)({ adTypeId, downstreamType, payoutRate, status });
    res.status(201).json((0, success_1.bffData)(result));
}
async function update(req, res) {
    const id = parseInt(req.params['id'], 10);
    if (isNaN(id))
        throw new AppError_1.NotFoundError('Invalid downstream id');
    const { downstreamType, payoutRate, status } = req.body;
    const result = await (0, downstream_write_service_1.updateDownstream)(id, { downstreamType, payoutRate, status });
    res.json((0, success_1.bffData)(result));
}
async function remove(req, res) {
    const id = parseInt(req.params['id'], 10);
    if (isNaN(id))
        throw new AppError_1.NotFoundError('Invalid downstream id');
    const result = await (0, downstream_write_service_1.deleteDownstream)(id);
    res.json((0, success_1.bffData)(result));
}
//# sourceMappingURL=downstream.controller.js.map