/**
 * DESTRUCTIVE DEMO SEED — DO NOT RUN ON PRODUCTION
 * This script deletes ALL business data (daily_inputs, ad_sites, upstreams, etc.)
 * and recreates demo data from scratch.
 *
 * For RBAC-only seed (SAFE, no data loss), use:
 *   npm run seed:rbac
 *
 * DO NOT run: npm run seed on a production system.
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Clean up
  await prisma.dailyInput.deleteMany()
  await prisma.adSiteDownstream.deleteMany()
  await prisma.dailyDownstreamRate.deleteMany()
  await prisma.downstreamPeriod.deleteMany()
  await prisma.lEDailyCost.deleteMany()
  await prisma.yiyiDailyData.deleteMany()
  await prisma.yiyiDailyPricing.deleteMany()
  await prisma.downstream.deleteMany()
  await prisma.adSite.deleteMany()
  await prisma.upstream.deleteMany()
  await prisma.adType.deleteMany()
  await prisma.rolePermission.deleteMany()
  await prisma.permission.deleteMany()
  await prisma.role.deleteMany()
  await prisma.user.deleteMany()

  // ============================================================
  // Ad Types
  // ============================================================
  await prisma.adType.createMany({
    data: [
      { id: 1, code: 'SM', name: 'GS-SM' },
      { id: 2, code: '360', name: '360' },
      { id: 3, code: 'BAIDU_JS', name: 'Baidu JS' },
      { id: 4, code: 'OTHER', name: 'Other' },
    ],
  })
  console.log('✓ AdTypes created')

  // ============================================================
  // Upstreams
  // ============================================================
  // SM upstreams
  const smUpstreams = await Promise.all([
    prisma.upstream.create({ data: { adTypeId: 1, name: 'SLY' } }),
    prisma.upstream.create({ data: { adTypeId: 1, name: 'BB' } }),
    prisma.upstream.create({ data: { adTypeId: 1, name: 'BZ' } }),
    prisma.upstream.create({ data: { adTypeId: 1, name: 'JW' } }),
    prisma.upstream.create({ data: { adTypeId: 1, name: '大白' } }),
    prisma.upstream.create({ data: { adTypeId: 1, name: '1369' } }),
    prisma.upstream.create({ data: { adTypeId: 1, name: 'XHCL' } }),
    prisma.upstream.create({ data: { adTypeId: 1, name: 'YL' } }),
    prisma.upstream.create({ data: { adTypeId: 1, name: 'LJ' } }),
    prisma.upstream.create({ data: { adTypeId: 1, name: 'RZ' } }),
    prisma.upstream.create({ data: { adTypeId: 1, name: 'OY' } }),
    prisma.upstream.create({ data: { adTypeId: 1, name: 'SQ' } }),
    prisma.upstream.create({ data: { adTypeId: 1, name: 'JJ' } }),
    prisma.upstream.create({ data: { adTypeId: 1, name: 'SC' } }),
    prisma.upstream.create({ data: { adTypeId: 1, name: 'BT' } }),
  ])

  // 360 upstreams
  const up360JW = await prisma.upstream.create({ data: { adTypeId: 2, name: 'JW' } })
  const up360BB = await prisma.upstream.create({ data: { adTypeId: 2, name: 'BB' } })
  const up360SLY = await prisma.upstream.create({ data: { adTypeId: 2, name: 'SLY' } })
  const up360Test = await prisma.upstream.create({ data: { adTypeId: 2, name: '上游测试' } })
  const up360BigWhite = await prisma.upstream.create({ data: { adTypeId: 2, name: '大白' } })

  // Baidu JS upstreams
  const upBaiduSLY = await prisma.upstream.create({ data: { adTypeId: 3, name: 'SLY/102bs' } })
  const upBaiduBigWhite = await prisma.upstream.create({ data: { adTypeId: 3, name: '上游大白/H5-2' } })

  // Other upstreams
  const upOtherA = await prisma.upstream.create({ data: { adTypeId: 4, name: 'Other-A' } })
  const upOtherB = await prisma.upstream.create({ data: { adTypeId: 4, name: 'Other-B' } })
  const upOtherC = await prisma.upstream.create({ data: { adTypeId: 4, name: 'Other-C' } })

  console.log('✓ Upstreams created')

  // ============================================================
  // Ad Sites
  // ============================================================
  // SM sites (CPM)
  for (const up of smUpstreams) {
    await prisma.adSite.create({
      data: {
        upstreamId: up.id,
        name: `${up.name} - Site 1`,
        billingMethod: 'CPM',
        currentUnitPrice: 0.5 + Math.random() * 1.5,
        status: 'active',
      },
    })
    await prisma.adSite.create({
      data: {
        upstreamId: up.id,
        name: `${up.name} - Site 2`,
        billingMethod: 'CPM',
        currentUnitPrice: 0.4 + Math.random() * 1.2,
        status: 'active',
      },
    })
  }

  // 360 sites (RATIO)
  await prisma.adSite.create({ data: { upstreamId: up360JW.id, name: '360 - JW', billingMethod: 'RATIO', currentRatio: 0.7, status: 'active' } })
  await prisma.adSite.create({ data: { upstreamId: up360BB.id, name: '360 - BB', billingMethod: 'RATIO', currentRatio: 0.9, status: 'active' } })
  await prisma.adSite.create({ data: { upstreamId: up360SLY.id, name: '360 - SLY', billingMethod: 'RATIO', currentRatio: 0.8, status: 'active' } })
  await prisma.adSite.create({ data: { upstreamId: up360Test.id, name: '360 - 上游测试', billingMethod: 'RATIO', currentRatio: 0.8, status: 'active' } })
  await prisma.adSite.create({ data: { upstreamId: up360BigWhite.id, name: '360 - 大白', billingMethod: 'RATIO', currentRatio: 0.8, status: 'active' } })

  // Baidu JS sites (RATIO)
  await prisma.adSite.create({ data: { upstreamId: upBaiduSLY.id, name: 'Baidu - SLY/102bs', billingMethod: 'RATIO', currentRatio: 0.7, status: 'active' } })
  await prisma.adSite.create({ data: { upstreamId: upBaiduBigWhite.id, name: 'Baidu - 上游大白/H5-2', billingMethod: 'RATIO', currentRatio: 0.8, status: 'active' } })

  // Other sites (RATIO)
  await prisma.adSite.create({ data: { upstreamId: upOtherA.id, name: 'Other - A1', billingMethod: 'RATIO', currentRatio: 0.75, status: 'active' } })
  await prisma.adSite.create({ data: { upstreamId: upOtherA.id, name: 'Other - A2', billingMethod: 'RATIO', currentRatio: 0.8, status: 'active' } })
  await prisma.adSite.create({ data: { upstreamId: upOtherB.id, name: 'Other - B1', billingMethod: 'RATIO', currentRatio: 0.7, status: 'active' } })
  await prisma.adSite.create({ data: { upstreamId: upOtherB.id, name: 'Other - B2', billingMethod: 'RATIO', currentRatio: 0.85, status: 'active' } })
  await prisma.adSite.create({ data: { upstreamId: upOtherC.id, name: 'Other - C1', billingMethod: 'RATIO', currentRatio: 0.9, status: 'active' } })

  console.log('✓ AdSites created')

  // ============================================================
  // Downstreams + Periods
  // ============================================================
  // SM ML
  const smML = await prisma.downstream.create({ data: { adTypeId: 1, downstreamType: 'ML', payoutRate: 0.8, status: 'active' } })
  await prisma.downstreamPeriod.create({ data: { downstreamId: smML.id, pctHal: 1.0, unitPrice: 95, startDate: new Date('2024-01-01'), note: 'SM ML standard rate' } })

  // SM LE
  const smLE = await prisma.downstream.create({ data: { adTypeId: 1, downstreamType: 'LE', payoutRate: 0.9, status: 'active' } })
  await prisma.downstreamPeriod.create({ data: { downstreamId: smLE.id, pctHal: 1.0, unitPrice: 16, startDate: new Date('2024-01-01'), note: 'SM LE CPM rate' } })

  // SM yiyi
  const smYiyi = await prisma.downstream.create({ data: { adTypeId: 1, downstreamType: 'YIYI', payoutRate: 1.0, status: 'active' } })
  await prisma.downstreamPeriod.create({ data: { downstreamId: smYiyi.id, pctHal: 1.0, startDate: new Date('2024-01-01'), note: 'SM yiyi UV rate 2/1000' } })

  // 360 ML
  const ml360 = await prisma.downstream.create({ data: { adTypeId: 2, downstreamType: 'ML', payoutRate: 0.8, status: 'active' } })
  await prisma.downstreamPeriod.create({ data: { downstreamId: ml360.id, pctHal: 1.0, unitPrice: 80, startDate: new Date('2024-01-01'), note: '360 ML standard rate' } })

  // Baidu ML
  const mlBaidu = await prisma.downstream.create({ data: { adTypeId: 3, downstreamType: 'ML', payoutRate: 0.8, status: 'active' } })
  await prisma.downstreamPeriod.create({ data: { downstreamId: mlBaidu.id, pctHal: 1.0, unitPrice: 75, startDate: new Date('2024-01-01'), note: 'Baidu ML standard rate' } })

  // Other ML
  const mlOther = await prisma.downstream.create({ data: { adTypeId: 4, downstreamType: 'ML', payoutRate: 0.8, status: 'active' } })
  await prisma.downstreamPeriod.create({ data: { downstreamId: mlOther.id, pctHal: 1.0, unitPrice: 70, startDate: new Date('2024-01-01'), note: 'Other ML standard rate' } })

  console.log('✓ Downstreams + Periods created')

  // ============================================================
  // Sample Daily Inputs (last 7 days, confirmed + unconfirmed)
  // ============================================================
  const sites = await prisma.adSite.findMany({ include: { upstream: true } })
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (let d = 6; d >= 0; d--) {
    const date = new Date(today)
    date.setDate(date.getDate() - d)
    const dateStr = date.toISOString().split('T')[0]

    for (const site of sites) {
      const isConfirmed = d < 5 // last 5 days confirmed
      const isCPM = site.billingMethod === 'CPM'

      let revenue: number
      let qty = 0, unitPrice = 0, amount1 = 0, amount2 = 0, ratio = 1

      if (isCPM) {
        qty = Math.floor(10000 + Math.random() * 50000)
        unitPrice = Number(site.currentUnitPrice ?? 0.5)
        revenue = qty * unitPrice
      } else {
        amount1 = Math.floor(5000 + Math.random() * 20000)
        amount2 = Math.floor(1000 + Math.random() * 5000)
        ratio = Number(site.currentRatio ?? 0.8)
        revenue = (amount1 + amount2) * ratio
      }

      await prisma.dailyInput.create({
        data: {
          recordDate: date,
          adSiteId: site.id,
          qty,
          unitPriceSnapshot: isCPM ? unitPrice : null,
          amount1,
          amount2,
          ratioSnapshot: isCPM ? null : ratio,
          revenue,
          status: isConfirmed ? 'confirmed' : 'unconfirmed',
        },
      })
    }
    console.log(`  ✓ Daily inputs for ${dateStr}`)
  }

  // ============================================================
  // Admin User
  // ============================================================
  const hash = await bcrypt.hash('admin123', 10)
  await prisma.user.create({
    data: {
      username: 'admin',
      passwordHash: hash,
      permDataInput: true,
      permDataConfirm: true,
      permAdmin: true,
      status: 'active',
    },
  })

  const editorHash = await bcrypt.hash('editor123', 10)
  await prisma.user.create({
    data: {
      username: 'editor',
      passwordHash: editorHash,
      permDataInput: true,
      permDataConfirm: false,
      permAdmin: false,
      status: 'active',
    },
  })

  console.log('✓ Users created (admin/admin123, editor/editor123)')

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
  console.log('✓ Roles created')

  // ============================================================
  // RBAC: Permissions
  // ============================================================
  const permissionDefs = [
    // User management
    { key: 'user.read', module: 'user', action: 'read', name: 'View Users' },
    { key: 'user.create', module: 'user', action: 'create', name: 'Create User' },
    { key: 'user.update', module: 'user', action: 'update', name: 'Update User' },
    { key: 'user.disable', module: 'user', action: 'disable', name: 'Disable User' },
    { key: 'user.reset-password', module: 'user', action: 'reset-password', name: 'Reset User Password' },
    // Role management
    { key: 'role.read', module: 'role', action: 'read', name: 'View Roles' },
    { key: 'role.update', module: 'role', action: 'update', name: 'Update Role' },
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
  console.log('✓ Permissions created')

  // ============================================================
  // RBAC: RolePermissions
  // ============================================================
  // SUPER_ADMIN: all permissions
  const superAdminPerms = permissionDefs.map(p => p.key)
  for (const key of superAdminPerms) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: superAdminRole.id, permissionId: permissionMap[key].id } },
      update: {},
      create: { roleId: superAdminRole.id, permissionId: permissionMap[key].id },
    })
  }

  // ADMIN: all except system.config
  const adminPerms = permissionDefs.filter(p => p.key !== 'system.config').map(p => p.key)
  for (const key of adminPerms) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: adminRole.id, permissionId: permissionMap[key].id } },
      update: {},
      create: { roleId: adminRole.id, permissionId: permissionMap[key].id },
    })
  }

  // MANAGER: data entry + reports + settlement + advertiser + adOrder + adId read
  const managerPerms = [
    'advertiser.read', 'advertiser.create', 'advertiser.update',
    'adOrder.read', 'adOrder.create', 'adOrder.update',
    'adId.read', 'adId.create', 'adId.update',
    'media.read',
    'dataEntry.read', 'dataEntry.create', 'dataEntry.update', 'dataEntry.confirm',
    'report.read', 'report.export',
    'settlement.read',
    'auditLog.read',
  ]
  for (const key of managerPerms) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: managerRole.id, permissionId: permissionMap[key].id } },
      update: {},
      create: { roleId: managerRole.id, permissionId: permissionMap[key].id },
    })
  }

  // OPERATOR: data entry + reports (no confirm)
  const operatorPerms = [
    'advertiser.read',
    'adOrder.read',
    'adId.read',
    'media.read',
    'dataEntry.read', 'dataEntry.create', 'dataEntry.update',
    'report.read', 'report.export',
  ]
  for (const key of operatorPerms) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: operatorRole.id, permissionId: permissionMap[key].id } },
      update: {},
      create: { roleId: operatorRole.id, permissionId: permissionMap[key].id },
    })
  }

  // EDITOR: data entry (no confirm) + reports
  const editorPerms = [
    'advertiser.read',
    'adOrder.read',
    'adId.read',
    'media.read',
    'dataEntry.read', 'dataEntry.create', 'dataEntry.update',
    'report.read', 'report.export',
  ]
  for (const key of editorPerms) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: editorRole.id, permissionId: permissionMap[key].id } },
      update: {},
      create: { roleId: editorRole.id, permissionId: permissionMap[key].id },
    })
  }

  // VIEWER: read-only
  const viewerPerms = [
    'advertiser.read',
    'adOrder.read',
    'adId.read',
    'media.read',
    'dataEntry.read',
    'report.read',
    'settlement.read',
    'auditLog.read',
  ]
  for (const key of viewerPerms) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: viewerRole.id, permissionId: permissionMap[key].id } },
      update: {},
      create: { roleId: viewerRole.id, permissionId: permissionMap[key].id },
    })
  }
  console.log('✓ RolePermissions created')

  // ============================================================
  // RBAC: Assign roles to existing users
  // ============================================================
  await prisma.user.update({ where: { username: 'admin' }, data: { roleId: superAdminRole.id } })
  await prisma.user.update({ where: { username: 'editor' }, data: { roleId: operatorRole.id } })
  console.log('✓ Users linked to roles')

  console.log('\n✅ Seed complete!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
