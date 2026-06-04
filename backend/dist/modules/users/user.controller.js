"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAll = getAll;
exports.create = create;
exports.update = update;
exports.doResetPassword = doResetPassword;
const user_service_1 = require("./user.service");
const success_1 = require("../../shared/response/success");
const AppError_1 = require("../../shared/errors/AppError");
async function getAll(_req, res) {
    const users = await (0, user_service_1.listUsers)();
    res.json((0, success_1.bffData)(users));
}
async function create(req, res) {
    const body = req.body;
    if (!body?.username?.trim())
        throw new AppError_1.BadRequestError('username is required');
    if (!body?.password?.trim())
        throw new AppError_1.BadRequestError('password is required');
    const user = await (0, user_service_1.createUser)({
        username: body.username.trim(),
        password: body.password,
        role: body.role,
        permDataInput: body.permDataInput,
        permDataConfirm: body.permDataConfirm,
        permAdmin: body.permAdmin,
        status: body.status,
        roleId: body.roleId,
    });
    res.status(201).json((0, success_1.bffData)(user));
}
async function update(req, res) {
    const id = parseInt(req.params['id'], 10);
    if (isNaN(id))
        throw new AppError_1.NotFoundError('Invalid user id');
    const body = req.body;
    const user = await (0, user_service_1.updateUser)(id, {
        username: body.username?.trim(),
        role: body.role,
        permDataInput: body.permDataInput,
        permDataConfirm: body.permDataConfirm,
        permAdmin: body.permAdmin,
        status: body.status,
        roleId: body.roleId,
        password: body.password,
    });
    res.json((0, success_1.bffData)(user));
}
async function doResetPassword(req, res) {
    const id = parseInt(req.params['id'], 10);
    if (isNaN(id))
        throw new AppError_1.NotFoundError('Invalid user id');
    const body = req.body;
    if (!body?.password?.trim())
        throw new AppError_1.BadRequestError('password is required');
    await (0, user_service_1.resetPassword)(id, { password: body.password });
    res.json((0, success_1.bffData)({ updated: true }));
}
//# sourceMappingURL=user.controller.js.map