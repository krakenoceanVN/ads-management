"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAll = getAll;
exports.getById = getById;
exports.create = create;
exports.update = update;
exports.remove = remove;
const downstream_service_1 = require("./downstream.service");
const downstream_write_service_1 = require("./downstream.write.service");
const success_1 = require("../../../shared/response/success");
const AppError_1 = require("../../../shared/errors/AppError");
const oplog_write_service_1 = require("../operation-logs/oplog.write.service");
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
async function getById(req, res) {
    const id = parseInt(req.params['id'], 10);
    if (isNaN(id))
        throw new AppError_1.NotFoundError('Invalid downstream id');
    const row = await (0, downstream_service_1.getDownstreamById)(id);
    if (!row)
        throw new AppError_1.NotFoundError('Downstream not found');
    res.json((0, success_1.bffData)(row));
}
async function create(req, res) {
    const body = req.body;
    if (!body.downstreamType)
        throw new AppError_1.BadRequestError('downstreamType is required');
    const adTypeCodes = body.adTypeCodes?.map(c => c.trim()).filter(Boolean) ?? [];
    if (!adTypeCodes.length) {
        throw new AppError_1.BadRequestError('adTypeCodes is required (at least one)');
    }
    const result = await (0, downstream_write_service_1.createDownstream)({
        adTypeCodes,
        downstreamType: body.downstreamType,
        payoutRate: body.payoutRate,
        status: body.status,
    });
    await (0, oplog_write_service_1.recordMasterDataOperation)(req, 'CREATE_DOWNSTREAM', 'downstream', result.id, result.downstreamType);
    res.status(201).json((0, success_1.bffData)(result));
}
async function update(req, res) {
    const id = parseInt(req.params['id'], 10);
    if (isNaN(id))
        throw new AppError_1.NotFoundError('Invalid downstream id');
    const body = req.body;
    const result = await (0, downstream_write_service_1.updateDownstream)(id, {
        downstreamType: body.downstreamType,
        payoutRate: body.payoutRate,
        status: body.status,
        adTypeCodes: body.adTypeCodes,
    });
    await (0, oplog_write_service_1.recordMasterDataOperation)(req, 'UPDATE_DOWNSTREAM', 'downstream', result.id, result.downstreamType);
    res.json((0, success_1.bffData)(result));
}
async function remove(req, res) {
    const id = parseInt(req.params['id'], 10);
    if (isNaN(id))
        throw new AppError_1.NotFoundError('Invalid downstream id');
    const result = await (0, downstream_write_service_1.deleteDownstream)(id);
    await (0, oplog_write_service_1.recordMasterDataOperation)(req, 'DELETE_DOWNSTREAM', 'downstream', id, result.mode);
    res.json((0, success_1.bffData)(result));
}
//# sourceMappingURL=downstream.controller.js.map