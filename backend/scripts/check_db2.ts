import { prisma } from '../src/shared/prisma/client';

async function main() {
  // Check all active Upstreams
  const activeUpstreams = await prisma.upstream.findMany({
    where: { status: 'active' },
    include: {
      adType: true,
      adTypeLinks: { include: { adType: true } },
      adOrders: { 
        include: { 
          adType: true,
          adSites: { select: { id: true, name: true, billingMethod: true } }
        } 
      },
    },
    orderBy: { id: 'asc' },
  });
  
  console.log('=== ACTIVE UPSTREAMS WITH AdSITES ===');
  console.log('Count:', activeUpstreams.length);
  console.log('');
  
  // Daily input by Upstream
  console.log('=== DAILY INPUT BY UPSTREAM ===');
  for (const u of activeUpstreams) {
    const siteIds = u.adOrders.flatMap(o => o.adSites.map(s => s.id));
    const diCount = siteIds.length > 0 
      ? await prisma.dailyInput.count({ where: { adSiteId: { in: siteIds } } })
      : 0;
    
    const linkedTypes = u.adTypeLinks.map(l => l.adType.code);
    const allTypes = [...new Set([u.adType?.code, ...linkedTypes].filter(Boolean))];
    
    console.log(`Upstream ${u.id} "${u.name}" (types: ${allTypes.join(',')}):`);
    console.log(`  - AdOrders: ${u.adOrders.length}, AdSites: ${siteIds.length}, DailyInput: ${diCount}`);
    
    for (const o of u.adOrders) {
      const siteIdList = o.adSites.map(s => s.id);
      const oDi = siteIdList.length > 0 
        ? await prisma.dailyInput.count({ where: { adSiteId: { in: siteIdList } } })
        : 0;
      console.log(`    - AdOrder id=${o.id} "${o.name}" (${o.adType?.code}): ${o.adSites.length} sites, ${oDi} DI`);
    }
    console.log('');
  }
  
  // Check Upstream 3 (百战-BZ-sm) detail
  console.log('=== DETAIL: 百战 (Upstream 3) ===');
  const detail = await prisma.upstream.findUnique({
    where: { id: 3 },
    include: {
      adType: true,
      adTypeLinks: { include: { adType: true } },
      adOrders: {
        include: {
          adType: true,
          adSites: {
            include: {
              dailyInputs: { take: 3, orderBy: { recordDate: 'desc' } }
            }
          }
        }
      }
    }
  });
  console.log(JSON.stringify(detail, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2).slice(0, 3000));
  
}

main().catch(console.error).finally(() => prisma.$disconnect());
