/**
 * Bootstrap Admin Script
 *
 * Creates/upserts all system roles, permissions, and the admin user.
 * Safe to run multiple times — uses upsert throughout.
 *
 * Run: npm run bootstrap:admin
 */

import { prisma } from '../src/shared/prisma/client';
import bcrypt from 'bcrypt';

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
  // User management
  { key: 'user.read', module: 'user', action: 'read', name: 'View Users' },
  { key: 'user.create', module: 'user', action: 'create', name: 'Create Users' },
  { key: 'user.update', module: 'user', action: 'update', name: 'Update Users' },
  { key: 'user.disable', module: 'user', action: 'disable', name: 'Disable Users' },
  { key: 'user.resetPassword', module: 'user', action: 'resetPassword', name: 'Reset User Password' },
  // Role management
  { key: 'role.read', module: 'role', action: 'read', name: 'View Roles' },
  { key: 'role.update', module: 'role', action: 'update', name: 'Update Roles' },
  { key: 'permission.read', module: 'permission', action: 'read', name: 'View Permissions' },
  // Advertiser
  { key: 'advertiser.read', module: 'advertiser', action: 'read', name: 'View Advertisers' },
  { key: 'advertiser.create', module: 'advertiser', action: 'create', name: 'Create Advertisers' },
  { key: 'advertiser.update', module: 'advertiser', action: 'update', name: 'Update Advertisers' },
  { key: 'advertiser.delete', module: 'advertiser', action: 'delete', name: 'Delete Advertisers' },
  // Ad Order
  { key: 'adOrder.read', module: 'adOrder', action: 'read', name: 'View Ad Orders' },
  { key: 'adOrder.create', module: 'adOrder', action: 'create', name: 'Create Ad Orders' },
  { key: 'adOrder.update', module: 'adOrder', action: 'update', name: 'Update Ad Orders' },
  { key: 'adOrder.delete', module: 'adOrder', action: 'delete', name: 'Delete Ad Orders' },
  // Ad ID
  { key: 'adId.read', module: 'adId', action: 'read', name: 'View Ad IDs' },
  { key: 'adId.create', module: 'adId', action: 'create', name: 'Create Ad IDs' },
  { key: 'adId.update', module: 'adId', action: 'update', name: 'Update Ad IDs' },
  { key: 'adId.delete', module: 'adId', action: 'delete', name: 'Delete Ad IDs' },
  // Media
  { key: 'media.read', module: 'media', action: 'read', name: 'View Media' },
  { key: 'media.create', module: 'media', action: 'create', name: 'Create Media' },
  { key: 'media.update', module: 'media', action: 'update', name: 'Update Media' },
  { key: 'media.delete', module: 'media', action: 'delete', name: 'Delete Media' },
  // Media ID
  { key: 'mediaId.create', module: 'mediaId', action: 'create', name: 'Create Media IDs' },
  { key: 'mediaId.update', module: 'mediaId', action: 'update', name: 'Update Media IDs' },
  { key: 'mediaId.delete', module: 'mediaId', action: 'delete', name: 'Delete Media IDs' },
  // Data Entry
  { key: 'dataEntry.read', module: 'dataEntry', action: 'read', name: 'View Data Entries' },
  { key: 'dataEntry.create', module: 'dataEntry', action: 'create', name: 'Create Data Entries' },
  { key: 'dataEntry.update', module: 'dataEntry', action: 'update', name: 'Update Data Entries' },
  { key: 'dataEntry.delete', module: 'dataEntry', action: 'delete', name: 'Delete Data Entries' },
  { key: 'dataEntry.confirm', module: 'dataEntry', action: 'confirm', name: 'Confirm Data Entries' },
  { key: 'dataEntry.unconfirm', module: 'dataEntry', action: 'unconfirm', name: 'Unconfirm Data Entries' },
  // Reports
  { key: 'report.read', module: 'report', action: 'read', name: 'View Reports' },
  { key: 'report.export', module: 'report', action: 'export', name: 'Export Reports' },
  // Settlement
  { key: 'settlement.read', module: 'settlement', action: 'read', name: 'View Settlements' },
  { key: 'settlement.approve', module: 'settlement', action: 'approve', name: 'Approve Settlements' },
  // Audit / Oplog
  { key: 'auditLog.read', module: 'auditLog', action: 'read', name: 'View Audit Logs' },
  { key: 'oplog.read', module: 'oplog', action: 'read', name: 'View Operation Logs' },
  // Quarantine
  { key: 'quarantine.execute', module: 'quarantine', action: 'execute', name: 'Execute Quarantine' },
  { key: 'quarantine.restore', module: 'quarantine', action: 'restore', name: 'Restore Quarantine' },
  // Master Data Hard Delete
  { key: 'masterData.hardDelete', module: 'masterData', action: 'hardDelete', name: 'Hard Delete Master Data' },
  // System
  { key: 'system.config', module: 'system', action: 'config', name: 'System Configuration' },
];

async function upsertRole(code: string, name: string, description: string, isSystem: boolean) {
  return prisma.role.upsert({
    where: { code },
    update: { name, description, isSystem },
    create: { code, name, description, isSystem },
  });
}

async function upsertPermission(key: string, module: string, action: string, name: string) {
  return prisma.permission.upsert({
    where: { key },
    update: { module, action, name },
    create: { key, module, action, name },
  });
}

async function assignPermissionsToRole(roleId: number, permissionIds: number[]) {
  // Remove existing assignments first
  await prisma.rolePermission.deleteMany({ where: { roleId } });

  // Create new assignments in batches
  const assignments = permissionIds.map(pid => ({ roleId, permissionId: pid }));
  await prisma.rolePermission.createMany({ data: assignments });
}

async function main() {
  console.log('=== Admin Bootstrap ===\n');

  // 1. Upsert roles
  console.log('Upserting roles...');
  const roleMap: Record<string, Awaited<ReturnType<typeof upsertRole>>> = {};
  for (const r of ROLES) {
    const role = await upsertRole(r.code, r.name, r.description, r.isSystem);
    roleMap[r.code] = role;
    console.log(`  ${role.code} -> id=${role.id}`);
  }

  // 2. Upsert permissions
  console.log('\nUpserting permissions...');
  const permMap: Record<string, Awaited<ReturnType<typeof upsertPermission>>> = {};
  for (const p of PERMISSIONS) {
    const perm = await upsertPermission(p.key, p.module, p.action, p.name);
    permMap[p.key] = perm;
  }
  console.log(`  ${PERMISSIONS.length} permissions upserted`);

  // 3. Assign all permissions to SUPER_ADMIN
  const superAdminRole = roleMap['SUPER_ADMIN'];
  if (superAdminRole) {
    console.log(`\nAssigning all permissions to SUPER_ADMIN (roleId=${superAdminRole.id})...`);
    const permIds = Object.values(permMap).map(p => p.id);
    await assignPermissionsToRole(superAdminRole.id, permIds);
    console.log(`  Assigned ${permIds.length} permissions`);
  }

  // 3b. Assign OPERATOR permissions
  const operatorRole = roleMap['OPERATOR'];
  if (operatorRole) {
    console.log(`\nAssigning permissions to OPERATOR (roleId=${operatorRole.id})...`);
    const opPermKeys = [
      'advertiser.read', 'advertiser.create', 'advertiser.update',
      'adOrder.read', 'adOrder.create', 'adOrder.update',
      'adId.read', 'adId.create', 'adId.update',
      'media.read',
      'dataEntry.read', 'dataEntry.create', 'dataEntry.update', 'dataEntry.confirm',
      'report.read', 'report.export',
      'settlement.read',
      'auditLog.read',
    ];
    const opPerms = opPermKeys.map(k => permMap[k]).filter(Boolean);
    await assignPermissionsToRole(operatorRole.id, opPerms.map(p => p.id));
    console.log(`  Assigned ${opPerms.length} permissions`);
  }

  // 3c. Assign VIEWER permissions
  const viewerRole = roleMap['VIEWER'];
  if (viewerRole) {
    console.log(`\nAssigning permissions to VIEWER (roleId=${viewerRole.id})...`);
    const viewerPermKeys = [
      'report.read',
      'settlement.read',
      'auditLog.read',
      'oplog.read',
    ];
    const viewerPerms = viewerPermKeys.map(k => permMap[k]).filter(Boolean);
    await assignPermissionsToRole(viewerRole.id, viewerPerms.map(p => p.id));
    console.log(`  Assigned ${viewerPerms.length} permissions`);
  }

  // 4. Upsert admin user
  console.log('\nUpserting admin user...');
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, BCRYPT_ROUNDS);
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {
      passwordHash,
      role: 'SUPER_ADMIN',
      roleId: roleMap['SUPER_ADMIN'].id,
      status: 'active',
      permAdmin: true,
      permDataInput: true,
      permDataConfirm: true,
    },
    create: {
      username: 'admin',
      passwordHash,
      role: 'SUPER_ADMIN',
      roleId: roleMap['SUPER_ADMIN'].id,
      status: 'active',
      permAdmin: true,
      permDataInput: true,
      permDataConfirm: true,
    },
  });

  // 5. Upsert operator user
  console.log('\nUpserting operator user...');
  const operatorPasswordHash = await bcrypt.hash(OPERATOR_PASSWORD, BCRYPT_ROUNDS);
  const operator = await prisma.user.upsert({
    where: { username: 'operator' },
    update: {
      passwordHash: operatorPasswordHash,
      role: 'OPERATOR',
      roleId: roleMap['OPERATOR'].id,
      status: 'active',
      permAdmin: false,
      permDataInput: true,
      permDataConfirm: true,
    },
    create: {
      username: 'operator',
      passwordHash: operatorPasswordHash,
      role: 'OPERATOR',
      roleId: roleMap['OPERATOR'].id,
      status: 'active',
      permAdmin: false,
      permDataInput: true,
      permDataConfirm: true,
    },
  });

  // 6. Upsert viewer user
  console.log('\nUpserting viewer user...');
  const viewerPasswordHash = await bcrypt.hash(VIEWER_PASSWORD, BCRYPT_ROUNDS);
  const viewer = await prisma.user.upsert({
    where: { username: 'viewer' },
    update: {
      passwordHash: viewerPasswordHash,
      role: 'VIEWER',
      roleId: roleMap['VIEWER'].id,
      status: 'active',
      permAdmin: false,
      permDataInput: false,
      permDataConfirm: false,
    },
    create: {
      username: 'viewer',
      passwordHash: viewerPasswordHash,
      role: 'VIEWER',
      roleId: roleMap['VIEWER'].id,
      status: 'active',
      permAdmin: false,
      permDataInput: false,
      permDataConfirm: false,
    },
  });

  console.log('\n=== RESULT ===');
  console.log(`Admin user id   : ${admin.id}`);
  console.log(`  Role          : ${admin.role}`);
  console.log(`  RoleId        : ${admin.roleId}`);
  console.log(`  Username      : admin`);
  console.log(`  Password      : ${ADMIN_PASSWORD}`);
  console.log(`Operator user id: ${operator.id}`);
  console.log(`  Role          : ${operator.role}`);
  console.log(`  RoleId        : ${operator.roleId}`);
  console.log(`  Username      : operator`);
  console.log(`  Password      : ${OPERATOR_PASSWORD}`);
  console.log(`Viewer user id  : ${viewer.id}`);
  console.log(`  Role          : ${viewer.role}`);
  console.log(`  RoleId        : ${viewer.roleId}`);
  console.log(`  Username      : viewer`);
  console.log(`  Password      : ${VIEWER_PASSWORD}`);
  console.log(`\nPermission count: ${PERMISSIONS.length}`);
  console.log('\n=== DONE ===');
}

main()
  .catch(err => {
    console.error('Bootstrap failed:', err);
    process.exit(1);
  });