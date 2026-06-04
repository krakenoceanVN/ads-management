import { prisma } from '../../shared/prisma/client';
import { ConflictError } from '../../shared/errors/AppError';

export async function listRoles() {
  const roles = await prisma.role.findMany({
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

export async function getPermissions() {
  const permissions = await prisma.permission.findMany({
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

export async function updateRolePermissions(roleId: number, permissionKeys: string[]) {
  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) throw new ConflictError('Role not found');
  if (role.isSystem) throw new ConflictError('Cannot modify system role');

  // Resolve permission IDs from keys
  const permissions = await prisma.permission.findMany({
    where: { key: { in: permissionKeys } },
  });

  // Delete existing RolePermission records for this role
  await prisma.rolePermission.deleteMany({
    where: { roleId },
  });

  // Create new RolePermission records
  if (permissions.length > 0) {
    await prisma.rolePermission.createMany({
      data: permissions.map(p => ({
        roleId,
        permissionId: p.id,
      })),
    });
  }

  return listRoles();
}
