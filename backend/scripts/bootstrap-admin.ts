/**
 * Bootstrap Admin Script
 *
 * Creates/upserts system roles, permissions, and the admin user.
 * Safe to run multiple times — uses upsert throughout.
 *
 * Run: npm run bootstrap:admin
 */

import { prisma } from '../src/shared/prisma/client';
import bcrypt from 'bcrypt';
import { generateShortId } from '../src/shared/ids';

const BCRYPT_ROUNDS = 10;
const ADMIN_PASSWORD = 'localdev-admin-123';
const OPERATOR_PASSWORD = 'localdev-operator-123';
const VIEWER_PASSWORD = 'localdev-viewer-123';

const ROLES = [
  { code: 'SUPER_ADMIN', name: 'Super Admin', description: 'Full system access', isSystem: true },
  { code: 'ADMIN', name: 'Admin', description: 'Administrative access', isSystem: true },
  { code: 'OPERATOR', name: 'Operator', description: 'Operational access', isSystem: true },
  { code: 'VIEWER', name: 'Viewer', description: 'Read-only access', isSystem: true },
];

const PERMISSIONS = [
  { key: 'user.read', module: 'user', action: 'read', name: 'View Users' },
  { key: 'user.create', module: 'user', action: 'create', name: 'Create Users' },
  { key: 'user.update', module: 'user', action: 'update', name: 'Update Users' },
  { key: 'user.disable', module: 'user', action: 'disable', name: 'Disable Users' },
  { key: 'user.resetPassword', module: 'user', action: 'resetPassword', name: 'Reset User Password' },
  { key: 'role.read', module: 'role', action: 'read', name: 'View Roles' },
  { key: 'role.update', module: 'role', action: 'update', name: 'Update Roles' },
  { key: 'permission.read', module: 'permission', action: 'read', name: 'View Permissions' },
  { key: 'advertiser.read', module: 'advertiser', action: 'read', name: 'View Advertisers' },
  { key: 'advertiser.create', module: 'advertiser', action: 'create', name: 'Create Advertisers' },
  { key: 'advertiser.update', module: 'advertiser', action: 'update', name: 'Update Advertisers' },
  { key: 'advertiser.delete', module: 'advertiser', action: 'delete', name: 'Delete Advertisers' },
  { key: 'adOrder.read', module: 'adOrder', action: 'read', name: 'View Ad Orders' },
  { key: 'adOrder.create', module: 'adOrder', action: 'create', name: 'Create Ad Orders' },
  { key: 'adOrder.update', module: 'adOrder', action: 'update', name: 'Update Ad Orders' },
  { key: 'adOrder.delete', module: 'adOrder', action: 'delete', name: 'Delete Ad Orders' },
  { key: 'adId.read', module: 'adId', action: 'read', name: 'View Ad IDs' },
  { key: 'adId.create', module: 'adId', action: 'create', name: 'Create Ad IDs' },
  { key: 'adId.update', module: 'adId', action: 'update', name: 'Update Ad IDs' },
  { key: 'adId.delete', module: 'adId', action: 'delete', name: 'Delete Ad IDs' },
  { key: 'media.read', module: 'media', action: 'read', name: 'View Media' },
  { key: 'media.create', module: 'media', action: 'create', name: 'Create Media' },
  { key: 'media.update', module: 'media', action: 'update', name: 'Update Media' },
  { key: 'media.delete', module: 'media', action: 'delete', name: 'Delete Media' },
  { key: 'mediaId.create', module: 'mediaId', action: 'create', name: 'Create Media IDs' },
  { key: 'mediaId.update', module: 'mediaId', action: 'update', name: 'Update Media IDs' },
  { key: 'mediaId.delete', module: 'mediaId', action: 'delete', name: 'Delete Media IDs' },
  { key: 'dataEntry.read', module: 'dataEntry', action: 'read', name: 'View Data Entries' },
  { key: 'dataEntry.create', module: 'dataEntry', action: 'create', name: 'Create Data Entries' },
  { key: 'dataEntry.update', module: 'dataEntry', action: 'update', name: 'Update Data Entries' },
  { key: 'dataEntry.delete', module: 'dataEntry', action: 'delete', name: 'Delete Data Entries' },
  { key: 'dataEntry.confirm', module: 'dataEntry', action: 'confirm', name: 'Confirm Data Entries' },
  { key: 'dataEntry.unconfirm', module: 'dataEntry', action: 'unconfirm', name: 'Unconfirm Data Entries' },
  { key: 'report.read', module: 'report', action: 'read', name: 'View Reports' },
  { key: 'report.export', module: 'report', action: 'export', name: 'Export Reports' },
  { key: 'settlement.read', module: 'settlement', action: 'read', name: 'View Settlements' },
  { key: 'settlement.approve', module: 'settlement', action: 'approve', name: 'Approve Settlements' },
  { key: 'auditLog.read', module: 'auditLog', action: 'read', name: 'View Audit Logs' },
  { key: 'oplog.read', module: 'oplog', action: 'read', name: 'View Operation Logs' },
  { key: 'quarantine.execute', module: 'quarantine', action: 'execute', name: 'Execute Quarantine' },
  { key: 'quarantine.restore', module: 'quarantine', action: 'restore', name: 'Restore Quarantine' },
  { key: 'masterData.hardDelete', module: 'masterData', action: 'hardDelete', name: 'Hard Delete Master Data' },
  { key: 'system.config', module: 'system', action: 'config', name: 'System Configuration' },
];

async function upsertRole(code: string, name: string, description: string, isSystem: boolean) {
  const existing = await prisma.role.findUnique({ where: { code } });
  if (existing) {
    return prisma.role.update({
      where: { id: existing.id },
      data: { name, description: isSystem },
    });
  }
  return prisma.role.create({
    data: { id: generateShortId(), code, name, description, isSystem },
  });
}

async function upsertPermission(key: string, module: string, action: string, name: string) {
  const existing = await prisma.permission.findUnique({ where: { key } });
  if (existing) {
    return prisma.permission.update({
      where: { id: existing.id },
      data: { module, action, name },
    });
  }
  return prisma.permission.create({
    data: { id: generateShortId(), key, module, action, name },
  });
}

async function assignPermissionsToRole(roleId: string, permissionIds: string[]) {
  await prisma.rolePermission.deleteMany({ where: { roleId } });
  if (!permissionIds.length) return;
  await prisma.rolePermission.createMany({
    data: permissionIds.map(pid => ({ roleId, permissionId: pid })),
  });
}

async function upsertUser(username: string, password: string, role: string, roleId: string | null, perms: { input: boolean; confirm: boolean; admin: boolean }) {
  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: {
        passwordHash: hash,
        role,
        roleId,
        permDataInput: perms.input,
        permDataConfirm: perms.confirm,
        permAdmin: perms.admin,
      },
    });
  }
  return prisma.user.create({
    data: {
      id: generateShortId(),
      username,
      passwordHash: hash,
      role,
      roleId,
      permDataInput: perms.input,
      permDataConfirm: perms.confirm,
      permAdmin: perms.admin,
    },
  });
}

async function main() {
  console.log('=== Admin Bootstrap ===\n');

  console.log('Upserting roles...');
  const roleMap: Record<string, { id: string }> = {};
  for (const r of ROLES) {
    const role = await upsertRole(r.code, r.name, r.description, r.isSystem);
    roleMap[r.code] = role;
    console.log(`  ${role.code} -> id=${role.id}`);
  }

  console.log('\nUpserting permissions...');
  const permMap: Record<string, { id: string }> = {};
  for (const p of PERMISSIONS) {
    const perm = await upsertPermission(p.key, p.module, p.action, p.name);
    permMap[p.key] = perm;
  }
  console.log(`  ${Object.keys(permMap).length} permissions ready`);

  console.log('\nAssigning permissions to roles...');
  const allPermIds = Object.values(permMap).map(p => p.id);
  await assignPermissionsToRole(roleMap['SUPER_ADMIN'].id, allPermIds);
  console.log(`  SUPER_ADMIN: ${allPermIds.length} permissions`);

  const operatorKeys = PERMISSIONS.filter(p =>
    p.key.startsWith('advertiser.') ||
    p.key.startsWith('media.') ||
    p.key.startsWith('adOrder.') ||
    p.key.startsWith('adId.') ||
    p.key.startsWith('mediaId.') ||
    p.key.startsWith('dataEntry.') ||
    p.key.startsWith('report.') ||
    p.key.startsWith('oplog.') ||
    p.key.startsWith('auditLog.')
  ).map(p => p.key);
  const operatorIds = operatorKeys.map(k => permMap[k].id);
  await assignPermissionsToRole(roleMap['OPERATOR'].id, operatorIds);
  console.log(`  OPERATOR: ${operatorIds.length} permissions`);

  const viewerKeys = PERMISSIONS.filter(p =>
    p.key.endsWith('.read') || p.key === 'oplog.read'
  ).map(p => p.key);
  const viewerIds = viewerKeys.map(k => permMap[k].id);
  await assignPermissionsToRole(roleMap['VIEWER'].id, viewerIds);
  console.log(`  VIEWER: ${viewerIds.length} permissions`);

  console.log('\nUpserting users...');
  await upsertUser('admin', ADMIN_PASSWORD, 'SUPER_ADMIN', roleMap['SUPER_ADMIN'].id, { input: true, confirm: true, admin: true });
  await upsertUser('operator', OPERATOR_PASSWORD, 'OPERATOR', roleMap['OPERATOR'].id, { input: true, confirm: true, admin: false });
  await upsertUser('viewer', VIEWER_PASSWORD, 'VIEWER', roleMap['VIEWER'].id, { input: false, confirm: false, admin: false });
  console.log('  admin / operator / viewer created');

  console.log('\nDone.');
}

main()
  .catch((err) => {
    console.error('Bootstrap failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });