"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listRoles = listRoles;
exports.getPermissions = getPermissions;
exports.updateRolePermissions = updateRolePermissions;
const client_1 = require("../../shared/prisma/client");
const AppError_1 = require("../../shared/errors/AppError");
async function listRoles() {
    const roles = await client_1.prisma.role.findMany({
        include: {
            permissions: {
                include: { permission: true },
            },
        },
        orderBy: { id: 'asc' },
    });
    return roles.map(role => ({
        id: role.id,
        code: role.code,
        name: role.name,
        description: role.description,
        isSystem: role.isSystem,
        createdAt: role.createdAt,
        updatedAt: role.updatedAt,
        permissions: role.permissions.map(rp => rp.permission.key),
    }));
}
async function getPermissions() {
    const permissions = await client_1.prisma.permission.findMany({
        orderBy: { id: 'asc' },
    });
    return permissions.map(p => ({
        id: p.id,
        key: p.key,
        module: p.module,
        action: p.action,
        name: p.name,
        description: p.description,
    }));
}
async function updateRolePermissions(roleId, permissionKeys) {
    const role = await client_1.prisma.role.findUnique({ where: { id: roleId } });
    if (!role)
        throw new AppError_1.ConflictError('Role not found');
    if (role.isSystem)
        throw new AppError_1.ConflictError('Cannot modify system role');
    // Resolve permission IDs from keys
    const permissions = await client_1.prisma.permission.findMany({
        where: { key: { in: permissionKeys } },
    });
    // Delete existing RolePermission records for this role
    await client_1.prisma.rolePermission.deleteMany({
        where: { roleId },
    });
    // Create new RolePermission records
    if (permissions.length > 0) {
        await client_1.prisma.rolePermission.createMany({
            data: permissions.map(p => ({
                roleId,
                permissionId: p.id,
            })),
        });
    }
    return listRoles();
}
//# sourceMappingURL=role.service.js.map