"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listUsers = listUsers;
exports.createUser = createUser;
exports.updateUser = updateUser;
exports.resetPassword = resetPassword;
const bcrypt_1 = __importDefault(require("bcrypt"));
const client_1 = require("../../shared/prisma/client");
function toUserResponse(user) {
    return {
        id: user.id,
        username: user.username,
        role: user.role,
        permDataInput: user.permDataInput,
        permDataConfirm: user.permDataConfirm,
        permAdmin: user.permAdmin,
        status: user.status,
        roleId: user.roleId,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
    };
}
async function listUsers() {
    const users = await client_1.prisma.user.findMany({
        orderBy: { id: 'asc' },
    });
    return users.map(toUserResponse);
}
async function createUser(input) {
    const { username, password, ...rest } = input;
    if (!username?.trim())
        throw new Error('username is required');
    if (!password?.trim())
        throw new Error('password is required');
    if (password.length < 6)
        throw new Error('password must be at least 6 characters');
    const existing = await client_1.prisma.user.findUnique({ where: { username: username.trim() } });
    if (existing)
        throw new Error('Username already exists');
    const passwordHash = await bcrypt_1.default.hash(password, 10);
    const user = await client_1.prisma.user.create({
        data: {
            username: username.trim(),
            passwordHash,
            role: rest.role ?? 'EDITOR',
            permDataInput: rest.permDataInput ?? false,
            permDataConfirm: rest.permDataConfirm ?? false,
            permAdmin: rest.permAdmin ?? false,
            status: rest.status ?? 'active',
            roleId: rest.roleId ?? null,
        },
    });
    return toUserResponse(user);
}
async function updateUser(id, input) {
    const { password, ...rest } = input;
    const updateData = {};
    if (rest.username !== undefined)
        updateData['username'] = rest.username.trim();
    if (rest.role !== undefined)
        updateData['role'] = rest.role;
    if (rest.permDataInput !== undefined)
        updateData['permDataInput'] = rest.permDataInput;
    if (rest.permDataConfirm !== undefined)
        updateData['permDataConfirm'] = rest.permDataConfirm;
    if (rest.permAdmin !== undefined)
        updateData['permAdmin'] = rest.permAdmin;
    if (rest.status !== undefined)
        updateData['status'] = rest.status;
    if (rest.roleId !== undefined)
        updateData['roleId'] = rest.roleId;
    if (password !== undefined) {
        if (!password?.trim())
            throw new Error('password cannot be empty');
        if (password.length < 6)
            throw new Error('password must be at least 6 characters');
        updateData['passwordHash'] = await bcrypt_1.default.hash(password, 10);
    }
    const user = await client_1.prisma.user.update({
        where: { id },
        data: updateData,
    });
    return toUserResponse(user);
}
async function resetPassword(id, input) {
    if (!input.password?.trim())
        throw new Error('password is required');
    if (input.password.length < 6)
        throw new Error('password must be at least 6 characters');
    const passwordHash = await bcrypt_1.default.hash(input.password, 10);
    await client_1.prisma.user.update({
        where: { id },
        data: { passwordHash },
    });
    return { updated: true };
}
//# sourceMappingURL=user.service.js.map