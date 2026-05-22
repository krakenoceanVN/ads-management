import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const adTypes = await prisma.adType.findMany({ select: { id: true, code: true, name: true } });
  console.log('=== AdType table ===');
  console.dir(adTypes, { depth: null });

  const rows = await prisma.adSite.findMany({
    where: { isArchived: false, status: 'active', upstream: { status: 'active' } },
    select: {
      id: true,
      name: true,
      billingMethod: true,
      currentUnitPrice: true,
      currentRatio: true,
      upstream: { select: { id: true, name: true, adType: { select: { code: true, name: true } } } },
    },
    orderBy: { id: 'asc' },
  });

  const summary = {};
  for (const r of rows) {
    const code = r.upstream && r.upstream.adType ? r.upstream.adType.code : 'NO_ADTYPE';
    const key = code + '|' + r.billingMethod;
    summary[key] = (summary[key] || 0) + 1;
  }
  console.log('\n=== Active AdSite by adType.code|billingMethod ===');
  console.dir(summary, { depth: null });

  const ratioRows = rows.filter(r => r.upstream && r.upstream.adType && ['360','BAIDU_JS'].includes(r.upstream.adType.code));
  console.log('\n=== AdSites with adType 360 or BAIDU_JS ===');
  console.dir(ratioRows, { depth: null });

  const adOrders = await prisma.adOrder.findMany({
    where: { status: 'active' },
    select: { id: true, name: true, upstreamId: true,
      upstream: { select: { id: true, name: true, adType: { select: { code: true } } } }
    }
  });
  console.log('\n=== Active AdOrders (first 20) ===');
  console.dir(adOrders.slice(0, 20), { depth: null });

  const adOrderByType = {};
  for (const o of adOrders) {
    const code = o.upstream && o.upstream.adType ? o.upstream.adType.code : 'NONE';
    adOrderByType[code] = (adOrderByType[code] || 0) + 1;
  }
  console.log('\n=== AdOrders by upstream.adType.code ===');
  console.dir(adOrderByType, { depth: null });
}

main()
  .catch(e => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());