/**
 * RBAC Seed — Safe idempotent seed for Roles, Permissions, RolePermissions.
 *
 * SAFE: Does NOT delete any business data (AdTypes, Upstreams, AdSites, DailyInputs, etc.)
 * Only upserts RBAC records and links existing users to roles.
 *
 * Usage: npx prisma db execute --file=prisma/seed-rbac.sql
 *   OR   ts-node --esm prisma/seed-rbac.ts (after building)
 *
 * This script is idempotent — safe to run multiple times.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔐 RBAC Seed — safe mode (no business data touched)')

  // ============================================================
  // RBAC: Roles
  // ============================================================
  const superAdminRole = await prisma.role.upsert({
    where: { code: 'SUPER_ADMIN' },
    update: {},
    create: { code: 'SUPER_ADMIN', name: 'Super Administrator', isSystem: true },
  })
  const adminRole = await prisma.role.upsert({
    where: { code: 'ADMIN' },
    update: {},
    create: { code: 'ADMIN', name: 'Administrator', isSystem: true },
  })
  const managerRole = await prisma.role.upsert({
    where: { code: 'MANAGER' },
    update: {},
    create: { code: 'MANAGER', name: 'Manager', isSystem: true },
  })
  const operatorRole = await prisma.role.upsert({
    where: { code: 'OPERATOR' },
    update: {},
    create: { code: 'OPERATOR', name: 'Operator', isSystem: true },
  })
  const editorRole = await prisma.role.upsert({
    where: { code: 'EDITOR' },
    update: {},
    create: { code: 'EDITOR', name: 'Editor', isSystem: true },
  })
  const viewerRole = await prisma.role.upsert({
    where: { code: 'VIEWER' },
    update: {},
    create: { code: 'VIEWER', name: 'Viewer', isSystem: true },
  })
  console.log('✓ Roles upserted')

  // ============================================================
  // RBAC: Permissions (camelCase naming)
  // ============================================================
  const permissionDefs = [
    // User management
    { key: 'user.read', module: 'user', action: 'read', name: 'View Users' },
    { key: 'user.create', module: 'user', action: 'create', name: 'Create User' },
    { key: 'user.update', module: 'user', action: 'update', name: 'Update User' },
    { key: 'user.disable', module: 'user', action: 'disable', name: 'Disable User' },
    { key: 'user.resetPassword', module: 'user', action: 'resetPassword', name: 'Reset User Password' },
    // Role management
    { key: 'role.read', module: 'role', action: 'read', name: 'View Roles' },
    { key: 'role.update', module: 'role', action: 'update', name: 'Update Role' },
    { key: 'permission.read', module: 'permission', action: 'read', name: 'View Permissions' },
    // Advertiser
    { key: 'advertiser.read', module: 'advertiser', action: 'read', name: 'View Advertisers' },
    { key: 'advertiser.create', module: 'advertiser', action: 'create', name: 'Create Advertiser' },
    { key: 'advertiser.update', module: 'advertiser', action: 'update', name: 'Update Advertiser' },
    { key: 'advertiser.delete', module: 'advertiser', action: 'delete', name: 'Delete Advertiser' },
    // AdOrder
    { key: 'adOrder.read', module: 'adOrder', action: 'read', name: 'View Ad Orders' },
    { key: 'adOrder.create', module: 'adOrder', action: 'create', name: 'Create Ad Order' },
    { key: 'adOrder.update', module: 'adOrder', action: 'update', name: 'Update Ad Order' },
    { key: 'adOrder.delete', module: 'adOrder', action: 'delete', name: 'Delete Ad Order' },
    // AdId
    { key: 'adId.read', module: 'adId', action: 'read', name: 'View Ad IDs' },
    { key: 'adId.create', module: 'adId', action: 'create', name: 'Create Ad ID' },
    { key: 'adId.update', module: 'adId', action: 'update', name: 'Update Ad ID' },
    { key: 'adId.delete', module: 'adId', action: 'delete', name: 'Delete Ad ID' },
    // Media
    { key: 'media.read', module: 'media', action: 'read', name: 'View Media' },
    { key: 'media.create', module: 'media', action: 'create', name: 'Create Media' },
    { key: 'media.update', module: 'media', action: 'update', name: 'Update Media' },
    { key: 'media.delete', module: 'media', action: 'delete', name: 'Delete Media' },
    // Data Entry
    { key: 'dataEntry.read', module: 'dataEntry', action: 'read', name: 'View Data Entry' },
    { key: 'dataEntry.create', module: 'dataEntry', action: 'create', name: 'Create Data Entry' },
    { key: 'dataEntry.update', module: 'dataEntry', action: 'update', name: 'Update Data Entry' },
    { key: 'dataEntry.confirm', module: 'dataEntry', action: 'confirm', name: 'Confirm Data Entry' },
    { key: 'dataEntry.delete', module: 'dataEntry', action: 'delete', name: 'Delete Data Entry' },
    // Reports
    { key: 'report.read', module: 'report', action: 'read', name: 'View Reports' },
    { key: 'report.export', module: 'report', action: 'export', name: 'Export Reports' },
    // Settlement
    { key: 'settlement.read', module: 'settlement', action: 'read', name: 'View Settlement' },
    { key: 'settlement.approve', module: 'settlement', action: 'approve', name: 'Approve Settlement' },
    // Audit Log
    { key: 'auditLog.read', module: 'auditLog', action: 'read', name: 'View Audit Logs' },
    // System Config
    { key: 'system.config', module: 'system', action: 'config', name: 'System Configuration' },
  ]

  const permissionMap: Record<string, { id: number }> = {}
  for (const def of permissionDefs) {
    const perm = await prisma.permission.upsert({
      where: { key: def.key },
      update: {},
      create: def,
    })
    permissionMap[def.key] = perm
  }
  console.log(`✓ ${permissionDefs.length} Permissions upserted`)

  // ============================================================
  // RBAC: RolePermissions
  // ============================================================
  const rolePermDefs: Array<{ roleId: number; permKeys: string[] }> = [
    // SUPER_ADMIN: all permissions
    { roleId: superAdminRole.id, permKeys: permissionDefs.map(p => p.key) },
    // ADMIN: all except system.config
    { roleId: adminRole.id, permKeys: permissionDefs.filter(p => p.key !== 'system.config').map(p => p.key) },
    // MANAGER
    { roleId: managerRole.id, permKeys: [
      'advertiser.read', 'advertiser.create', 'advertiser.update',
      'adOrder.read', 'adOrder.create', 'adOrder.update',
      'adId.read', 'adId.create', 'adId.update',
      'media.read',
      'dataEntry.read', 'dataEntry.create', 'dataEntry.update', 'dataEntry.confirm',
      'report.read', 'report.export',
      'settlement.read',
      'auditLog.read',
    ]},
    // OPERATOR
    { roleId: operatorRole.id, permKeys: [
      'advertiser.read',
      'adOrder.read',
      'adId.read',
      'media.read',
      'dataEntry.read', 'dataEntry.create', 'dataEntry.update',
      'report.read', 'report.export',
    ]},
    // EDITOR
    { roleId: editorRole.id, permKeys: [
      'advertiser.read',
      'adOrder.read',
      'adId.read',
      'media.read',
      'dataEntry.read', 'dataEntry.create', 'dataEntry.update',
      'report.read', 'report.export',
    ]},
    // VIEWER
    { roleId: viewerRole.id, permKeys: [
      'advertiser.read',
      'adOrder.read',
      'adId.read',
      'media.read',
      'dataEntry.read',
      'report.read',
      'settlement.read',
      'auditLog.read',
    ]},
  ]

  for (const { roleId, permKeys } of rolePermDefs) {
    for (const key of permKeys) {
      if (!permissionMap[key]) continue
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId, permissionId: permissionMap[key].id } },
        update: {},
        create: { roleId, permissionId: permissionMap[key].id },
      })
    }
  }
  console.log('✓ RolePermissions upserted')

  // ============================================================
  // RBAC: Link existing users to roles
  // ============================================================
  const adminUser = await prisma.user.findUnique({ where: { username: 'admin' } })
  if (adminUser && !adminUser.roleId) {
    await prisma.user.update({ where: { username: 'admin' }, data: { roleId: superAdminRole.id } })
    console.log('✓ admin user linked to SUPER_ADMIN')
  }

  const editorUser = await prisma.user.findUnique({ where: { username: 'editor' } })
  if (editorUser && !editorUser.roleId) {
    await prisma.user.update({ where: { username: 'editor' }, data: { roleId: operatorRole.id } })
    console.log('✓ editor user linked to OPERATOR')
  }

  console.log('\n✅ RBAC seed complete (safe — no business data deleted)')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())