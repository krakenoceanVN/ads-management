"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updatePermissionsHandler = void 0;
exports.getAllRoles = getAllRoles;
exports.getAllPermissions = getAllPermissions;
exports.updatePermissions = updatePermissions;
const role_service_1 = require("./role.service");
const success_1 = require("../../shared/response/success");
const AppError_1 = require("../../shared/errors/AppError");
const asyncHandler_1 = require("../../shared/errors/asyncHandler");
async function getAllRoles(_req, res) {
    const roles = await (0, role_service_1.listRoles)();
    res.json((0, success_1.bffData)(roles));
}
async function getAllPermissions(_req, res) {
    const permissions = await (0, role_service_1.getPermissions)();
    res.json((0, success_1.bffData)(permissions));
}
async function updatePermissions(req, res) {
    const id = req.params['id'];
    if (!id)
        throw new AppError_1.NotFoundError('Invalid role id');
    const body = req.body;
    if (!Array.isArray(body.permissionKeys)) {
        throw new AppError_1.BadRequestError('permissionKeys must be an array of permission key strings');
    }
    const roles = await (0, role_service_1.updateRolePermissions)(id, body.permissionKeys);
    res.json((0, success_1.bffData)(roles));
}
exports.updatePermissionsHandler = (0, asyncHandler_1.asyncHandler)(updatePermissions);
//# sourceMappingURL=role.controller.js.map