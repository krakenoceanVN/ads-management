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
  console.log('\n✅ Seed complete!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
