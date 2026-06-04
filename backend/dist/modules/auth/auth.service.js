"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = login;
exports.getUserById = getUserById;
exports.buildAuthUser = buildAuthUser;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_1 = require("../../shared/prisma/client");
const config_1 = require("../../config");
async function login(input) {
    const { username, password } = input;
    if (!username?.trim() || !password?.trim()) {
        throw new Error('username and password are required');
    }
    const user = await client_1.prisma.user.findUnique({
        where: { username: username.trim() },
        include: { roleRef: { include: { permissions: { include: { permission: true } } } } },
    });
    if (!user) {
        throw new Error('Invalid credentials');
    }
    if (user.status !== 'active') {
        throw new Error('Account is not active');
    }
    const valid = await bcrypt_1.default.compare(password, user.passwordHash);
    if (!valid) {
        throw new Error('Invalid credentials');
    }
    const permissions = user.roleRef?.permissions.map(p => p.permission.key) ?? [];
    const authUser = {
        id: user.id,
        username: user.username,
        role: user.role,
        permDataInput: user.permDataInput,
        permDataConfirm: user.permDataConfirm,
        permAdmin: user.permAdmin,
        status: user.status,
        roleId: user.roleId,
        permissions,
    };
    const token = jsonwebtoken_1.default.sign({ sub: user.id, username: user.username, role: user.role }, config_1.config.jwt.secret, { expiresIn: config_1.config.jwt.expiresIn });
    return { token, user: authUser };
}
async function getUserById(id) {
    const user = await client_1.prisma.user.findUnique({
        where: { id },
        include: { roleRef: { include: { permissions: { include: { permission: true } } } } },
    });
    if (!user || user.status !== 'active')
        return null;
    const permissions = user.roleRef?.permissions.map(p => p.permission.key) ?? [];
    return {
        id: user.id,
        username: user.username,
        role: user.role,
        permDataInput: user.permDataInput,
        permDataConfirm: user.permDataConfirm,
        permAdmin: user.permAdmin,
        status: user.status,
        roleId: user.roleId,
        permissions,
    };
}
function buildAuthUser(user, permissions) {
    return {
        id: user.id,
        username: user.username,
        role: user.role,
        permDataInput: user.permDataInput,
        permDataConfirm: user.permDataConfirm,
        permAdmin: user.permAdmin,
        status: user.status,
        roleId: user.roleId,
        permissions,
    };
}
//# sourceMappingURL=auth.service.js.map