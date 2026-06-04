/**
 * Test setup: seed a Downstream "ML" (rate 1.45, pctHal 0.8) and link it to the
 * existing advertiser ad-slots (xpagecn, movetab) so Total-Profit and Media
 * Settlement have a downstream cost side. There is no UI/API to create
 * downstreams or periods, so this is seeded directly (config data).
 *
 * Run: npx tsx scripts/seed-downstream.ts
 */
import { prisma } from '../src/shared/prisma/client';
import { Prisma } from '@prisma/client';

async function main() {
  const adType = await prisma.adType.findUnique({ where: { code: 'XIANGYUN' } });
  if (!adType) throw new Error('AdType XIANGYUN not found — run the advertiser test first');

  // 1. Downstream "ML"
  let ds = await prisma.downstream.findFirst({ where: { downstreamType: 'ML', adTypeId: adType.id } });
  if (!ds) {
    ds = await prisma.downstream.create({
      data: { adTypeId: adType.id, downstreamType: 'ML', payoutRate: new Prisma.Decimal('1.45'), status: 'active' },
    });
    console.log('Created Downstream ML id=', ds.id);
  } else {
    console.log('Downstream ML already exists id=', ds.id);
  }

  // 2. DownstreamPeriod: unitPrice 1.45, pctHal 0.8, effective from 2026-03-01
  const existingPeriod = await prisma.downstreamPeriod.findFirst({ where: { downstreamId: ds.id } });
  if (!existingPeriod) {
    const p = await prisma.downstreamPeriod.create({
      data: {
        downstreamId: ds.id,
        unitPrice: new Prisma.Decimal('1.45'),
        pctHal: new Prisma.Decimal('0.8'),
        startDate: new Date('2026-03-01T00:00:00.000Z'),
        endDate: null,
        note: 'test seed',
      },
    });
    console.log('Created DownstreamPeriod id=', p.id, 'unitPrice=1.45 pctHal=0.8');
  } else {
    console.log('DownstreamPeriod already exists id=', existingPeriod.id);
  }

  // 3. Junctions for xpagecn & movetab (customPrice null => uses period 1.45)
  const slots = ['xpagecn', 'movetab'];
  for (const name of slots) {
    const site = await prisma.adSite.findFirst({ where: { name, upstream: { name: '上游-响云-bb' } } });
    if (!site) { console.log('  adSite not found:', name); continue; }
    const j = await prisma.adSiteDownstream.upsert({
      where: { adSiteId_downstreamId: { adSiteId: site.id, downstreamId: ds.id } },
      update: {},
      create: { adSiteId: site.id, downstreamId: ds.id, customPrice: null },
    });
    console.log(`  junction ${name}(adSite=${site.id}) -> ML(${ds.id}) junctionId=${j.id}`);
  }

  console.log('DONE');
}

main().catch((e) => { console.error('SEED FAILED:', e); process.exit(1); });
