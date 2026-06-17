import { prisma } from '../src/shared/prisma/client';

async function main() {
  try {
    const upstreams = await prisma.upstream.findMany({
      include: {
        adType: true,
        adTypeLinks: { include: { adType: true } },
        adOrders: { include: { adType: true } },
        adSites: { select: { id: true, name: true, billingMethod: true, adOrderId: true } },
      },
      orderBy: { id: 'asc' },
    });
    
    console.log('=== UPSTREAMS (Advertisers) ===');
    console.log('Total:', upstreams.length);
    console.log('');
    
    for (const u of upstreams) {
      const linkedTypes = u.adTypeLinks.map(l => l.adType.code);
      const primaryType = u.adType?.code || null;
      const allTypes = [...new Set([primaryType, ...linkedTypes].filter(Boolean))];
      
      console.log(`ID=${u.id} | Name="${u.name}" | Status=${u.status} | AdTypes=[${allTypes.join(', ')}]`);
      console.log(`  AdOrders: ${u.adOrders.length}`);
      for (const o of u.adOrders) {
        console.log(`    - AdOrder id=${o.id} name="${o.name}" adType=${o.adType?.code} status=${o.status}`);
      }
      console.log(`  AdSites: ${u.adSites.length}`);
      console.log('');
    }
    
    const diCount = await prisma.dailyInput.count();
    const diByDate = await prisma.dailyInput.groupBy({
      by: ['recordDate'],
      _count: true,
      orderBy: { recordDate: 'desc' },
      take: 10,
    });
    
    console.log('=== DAILY INPUT ===');
    console.log('Total records:', diCount);
    console.log('Recent dates:');
    for (const d of diByDate) {
      console.log(`  ${d.recordDate.toISOString().slice(0,10)}: ${d._count} records`);
    }
    
    const diByStatus = await prisma.dailyInput.groupBy({
      by: ['status'],
      _count: true,
    });
    console.log('By status:');
    for (const s of diByStatus) {
      console.log(`  ${s.status}: ${s._count}`);
    }
    
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
