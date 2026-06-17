import { prisma } from '../src/shared/prisma/client';
import * as fs from 'fs';

async function main() {
  // 1. Xuất Upstream
  const upstreams = await prisma.upstream.findMany({
    include: {
      adType: true,
      adTypeLinks: { include: { adType: true } },
      adOrders: {
        include: {
          adType: true,
          adSites: {
            include: {
              dailyInputs: { select: { id: true } }
            }
          }
        }
      }
    },
    orderBy: { id: 'asc' },
  });

  let csv = '';
  csv += '=== UPSTREAM (Nhà quảng cáo) ===\n';
  csv += 'Upstream_ID,Upstream_Name,Status,AdTypes,AdOrder_Count,AdSite_Count,DailyInput_Count\n';
  for (const u of upstreams) {
    const linkedTypes = u.adTypeLinks.map(l => l.adType.code);
    const allTypes = [...new Set([u.adType?.code, ...linkedTypes].filter(Boolean))];
    const siteIds = u.adOrders.flatMap(o => o.adSites.map(s => s.id));
    const diCount = u.adOrders.reduce((sum, o) =>
      sum + o.adSites.reduce((s2, s) => s2 + s.dailyInputs.length, 0), 0);
    csv += `${u.id},"${u.name}",${u.status},"${allTypes.join('|')}",${u.adOrders.length},${siteIds.length},${diCount}\n`;
  }

  csv += '\n=== ADORDER (Đơn hàng quảng cáo) ===\n';
  csv += 'AdOrder_ID,AdOrder_Name,Upstream_ID,Upstream_Name,AdType,Status,AdSite_Count,DailyInput_Count\n';
  const allOrders = upstreams.flatMap(u => u.adOrders.map(o => ({ ...o, upstreamName: u.name })));
  for (const o of allOrders) {
    const diCount = o.adSites.reduce((sum, s) => sum + s.dailyInputs.length, 0);
    csv += `${o.id},"${o.name}",${o.upstreamId},"${o.upstreamName}",${o.adType?.code || ''},${o.status},${o.adSites.length},${diCount}\n`;
  }

  csv += '\n=== ADSITE (Vị trí quảng cáo) ===\n';
  csv += 'AdSite_ID,AdSite_Name,Upstream_ID,Upstream_Name,AdOrder_ID,AdOrder_Name,BillingMethod,Status,DailyInput_Count\n';
  const allSites = upstreams.flatMap(u => u.adOrders.flatMap(o => o.adSites.map(s => ({
    ...s,
    upstreamId: u.id,
    upstreamName: u.name,
    adOrderName: o.name
  }))));
  for (const s of allSites) {
    csv += `${s.id},"${s.name}",${s.upstreamId},"${s.upstreamName}",${s.adOrderId},"${s.adOrderName}",${s.billingMethod},${s.status},${s.dailyInputs.length}\n`;
  }

  fs.writeFileSync('master-data-export.csv', csv, 'utf8');
  console.log('Đã xuất file: master-data-export.csv');
  console.log(`Tổng: ${upstreams.length} Upstream, ${allOrders.length} AdOrder, ${allSites.length} AdSite`);

  // In ra console dạng bảng
  console.log('\n=== ADORDER ID MAP (quan trọng) ===');
  console.log('ID  | Tên             | Upstream ID | Upstream Name         | AdType | Sites | DI');
  console.log('----|-----------------|-------------|----------------------|--------|-------|-----');
  for (const o of allOrders) {
    const diCount = o.adSites.reduce((sum, s) => sum + s.dailyInputs.length, 0);
    const pad = (s: string | number, n: number) => String(s).padEnd(n);
    console.log(`${pad(o.id, 4)}| ${pad(o.name, 15)} | ${pad(o.upstreamId, 11)} | ${pad(o.upstreamName, 20)} | ${pad(o.adType?.code || '-', 6)} | ${pad(o.adSites.length, 5)} | ${diCount}`);
  }

  await prisma.$disconnect();
}

main().catch(console.error).finally(() => prisma.$disconnect());
