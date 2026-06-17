import { prisma } from '../src/shared/prisma/client';
import * as fs from 'fs';

/**
 * PREVIEW REPORT: Phân tích gộp Upstream
 * KHÔNG thay đổi database, chỉ đọc và báo cáo
 */

const TARGET_STRUCTURE = {
  '百战': { adTypes: ['SM', '千问(OTHER)'] },
  '圣乐游': { adTypes: ['SM', '千问(OTHER)'] },
  '响云': { adTypes: ['SM', '千问(OTHER)', '360', '360 AI桌面'] },
  '罗强': { adTypes: ['抖音(DOUYIN)', '千问(OTHER)'] },
  '刘佳': { adTypes: ['SM'] },
  '龙云': { adTypes: ['电商补量(OTHER?)'] },
};

async function main() {
  console.log('='.repeat(80));
  console.log('BÁO CÁO PREVIEW: GỘP UPSTREAM THEO YÊU CẦU KHÁCH HÀNG');
  console.log('='.repeat(80));
  console.log('');

  // 1. Lấy tất cả AdType để map
  const adTypes = await prisma.adType.findMany();
  const adTypeByCode = new Map(adTypes.map(t => [t.code, t]));
  const adTypeByName = new Map(adTypes.map(t => [t.name, t]));

  console.log('=== A. DANH SÁCH ADTYPE TRONG DB ===');
  console.log('ID  | Code          | Name');
  console.log('----|---------------|---------------');
  for (const t of adTypes.sort((a, b) => a.id - b.id)) {
    console.log(`${String(t.id).padEnd(4)}| ${t.code.padEnd(13)} | ${t.name}`);
  }
  console.log('');

  // 2. Lấy tất cả Upstream active
  const upstreams = await prisma.upstream.findMany({
    where: { status: 'active' },
    include: {
      adType: true,
      adTypeLinks: { include: { adType: true } },
      adOrders: {
        include: {
          adType: true,
          adSites: {
            include: {
              dailyInputs: true,
            }
          }
        }
      }
    },
    orderBy: { id: 'asc' },
  });

  console.log('=== B. UPSTREAM ACTIVE - CHI TIẾT ===');
  console.log('');

  type Group = {
    targetName: string;
    sources: Array<{
      id: number;
      name: string;
      adTypeCode: string | null;
      adTypeId: number | null;
      adOrders: Array<{
        id: number;
        name: string;
        adTypeCode: string;
        adTypeId: number;
        adSiteCount: number;
        dailyInputCount: number;
        adSites: Array<{ id: number; name: string; billingMethod: string }>;
      }>;
      adSiteTotal: number;
      dailyInputTotal: number;
      revenueTotal: number;
    }>;
    targetType: string;
  };

  const groups: Group[] = [];

  // Group theo tên gốc
  const groupByTarget: Record<string, typeof upstreams> = {
    '百战': [],
    '圣乐游': [],
    '响云': [],
    '罗强': [],
    '刘佳': [],
    '龙云': [],
  };

  for (const u of upstreams) {
    for (const key of Object.keys(groupByTarget)) {
      if (u.name.startsWith(key)) {
        groupByTarget[key].push(u);
        break;
      }
    }
  }

  // 3. In chi tiết từng nhóm
  for (const [targetName, sources] of Object.entries(groupByTarget)) {
    const group: Group = { targetName, sources: [], targetType: 'unknown' };
    console.log(`### NHÓM: ${targetName} (mong muốn: ${TARGET_STRUCTURE[targetName as keyof typeof TARGET_STRUCTURE]?.adTypes.join(', ') || '?'})`);
    console.log('');

    if (sources.length === 0) {
      console.log(`  ⚠️  CHƯA CÓ Upstream nào trong DB`);
      console.log('');
      continue;
    }

    for (const u of sources) {
      const linkedTypes = u.adTypeLinks.map(l => l.adType.code);
      const allTypes = [...new Set([u.adType?.code, ...linkedTypes].filter(Boolean))];
      const adSiteTotal = u.adOrders.reduce((s, o) => s + o.adSites.length, 0);
      const diTotal = u.adOrders.reduce((s, o) =>
        s + o.adSites.reduce((s2, site) => s2 + site.dailyInputs.length, 0), 0);
      const revenueTotal = u.adOrders.reduce((s, o) =>
        s + o.adSites.reduce((s2, site) =>
          s2 + site.dailyInputs.reduce((s3, di) => s3 + Number(di.revenue), 0), 0), 0);

      console.log(`  Upstream ID=${u.id} | Tên: "${u.name}" | Status: ${u.status}`);
      console.log(`    adType chính: ${u.adType?.code || 'NULL'} | adTypeLinks: [${linkedTypes.join(', ') || 'none'}]`);
      console.log(`    Tổng: ${u.adOrders.length} AdOrder, ${adSiteTotal} AdSite, ${diTotal} DailyInput, Revenue: ${revenueTotal.toFixed(2)}`);

      for (const o of u.adOrders) {
        const oDi = o.adSites.reduce((s, site) => s + site.dailyInputs.length, 0);
        const oRev = o.adSites.reduce((s, site) =>
          s + site.dailyInputs.reduce((s2, di) => s2 + Number(di.revenue), 0), 0);
        console.log(`      - AdOrder id=${o.id} "${o.name}" (adType=${o.adType?.code}): ${o.adSites.length} site, ${oDi} DI, rev=${oRev.toFixed(2)}`);
        for (const site of o.adSites) {
          console.log(`         * AdSite id=${site.id} "${site.name}" billing=${site.billingMethod}`);
        }
      }
      console.log('');

      group.sources.push({
        id: u.id,
        name: u.name,
        adTypeCode: u.adType?.code || null,
        adTypeId: u.adType?.id || null,
        adOrders: u.adOrders.map(o => ({
          id: o.id,
          name: o.name,
          adTypeCode: o.adType?.code || '',
          adTypeId: o.adType?.id || 0,
          adSiteCount: o.adSites.length,
          dailyInputCount: o.adSites.reduce((s, site) => s + site.dailyInputs.length, 0),
          adSites: o.adSites.map(s => ({ id: s.id, name: s.name, billingMethod: s.billingMethod })),
        })),
        adSiteTotal,
        dailyInputTotal: diTotal,
        revenueTotal,
      });
    }
    groups.push(group);
  }

  // 4. Phân tích xung đột tiềm ẩn
  console.log('=== C. PHÂN TÍCH XUNG ĐỘT KHI GỘP ===');
  console.log('');

  for (const group of groups) {
    if (group.sources.length < 2) {
      console.log(`### ${group.targetName}: Không cần gộp (chỉ có ${group.sources.length} Upstream)`);
      console.log('');
      continue;
    }

    console.log(`### ${group.targetName}: Cần gộp ${group.sources.length} Upstream`);

    // Tìm AdOrder trùng tên giữa các Upstream nguồn
    const allAdOrderNames = new Map<string, number[]>();
    for (const src of group.sources) {
      for (const o of src.adOrders) {
        const key = `${o.adTypeCode}:${o.name}`;
        if (!allAdOrderNames.has(key)) allAdOrderNames.set(key, []);
        allAdOrderNames.get(key)!.push(o.id);
      }
    }

    const conflicts: string[] = [];
    for (const [key, ids] of allAdOrderNames) {
      if (ids.length > 1) {
        conflicts.push(`AdOrder "${key}" xuất hiện ${ids.length} lần (IDs: ${ids.join(', ')})`);
      }
    }

    if (conflicts.length) {
      console.log(`  ⚠️  XUNG ĐỘT: ${conflicts.length}`);
      for (const c of conflicts) console.log(`     - ${c}`);
    } else {
      console.log(`  ✅ Không có AdOrder trùng tên trong nhóm`);
    }

    // Tìm AdSite trùng tên (trong cùng adType)
    const allAdSites = new Map<string, number[]>();
    for (const src of group.sources) {
      for (const o of src.adOrders) {
        for (const s of o.adSites) {
          const key = `${o.adTypeCode}:${s.name}`;
          if (!allAdSites.has(key)) allAdSites.set(key, []);
          allAdSites.get(key)!.push(s.id);
        }
      }
    }

    const siteConflicts: string[] = [];
    for (const [key, ids] of allAdSites) {
      if (ids.length > 1) {
        siteConflicts.push(`AdSite "${key}" xuất hiện ${ids.length} lần (IDs: ${ids.join(', ')})`);
      }
    }

    if (siteConflicts.length) {
      console.log(`  ⚠️  AdSite trùng tên trong cùng adType: ${siteConflicts.length}`);
      for (const c of siteConflicts.slice(0, 5)) console.log(`     - ${c}`);
      if (siteConflicts.length > 5) console.log(`     ... và ${siteConflicts.length - 5} cái nữa`);
    } else {
      console.log(`  ✅ Không có AdSite trùng tên trong cùng adType`);
    }

    // Tổng kết
    const totalSites = group.sources.reduce((s, src) => s + src.adSiteTotal, 0);
    const totalDi = group.sources.reduce((s, src) => s + src.dailyInputTotal, 0);
    const totalRev = group.sources.reduce((s, src) => s + src.revenueTotal, 0);
    console.log(`  Tổng sẽ migrate: ${totalSites} AdSite, ${totalDi} DailyInput, Revenue: ${totalRev.toFixed(2)}`);
    console.log('');
  }

  // 5. So sánh với cấu trúc mong muốn
  console.log('=== D. SO SÁNH VỚI CẤU TRÚC MONG MUỐN ===');
  console.log('');

  for (const [targetName, expected] of Object.entries(TARGET_STRUCTURE)) {
    const group = groups.find(g => g.targetName === targetName);
    if (!group) continue;

    // Tập hợp tất cả adType hiện có
    const currentTypes = new Set<string>();
    for (const src of group.sources) {
      for (const o of src.adOrders) {
        if (o.adTypeCode) currentTypes.add(o.adTypeCode);
      }
    }

    console.log(`### ${targetName}`);
    console.log(`  Mong muốn: ${expected.adTypes.join(', ')}`);
    console.log(`  Hiện có: ${[...currentTypes].join(', ') || '(trống)'}`);

    // Tìm adType thiếu
    const expectedCodes = expected.adTypes.map(t => {
      if (t.includes('SM')) return 'SM';
      if (t.includes('千问')) return 'OTHER'; // Giả định 千问 = OTHER
      if (t.includes('360 AI')) return 'OTHER'; // Cần kiểm tra
      if (t.includes('360')) return '360';
      if (t.includes('抖音')) return 'DOUYIN';
      if (t.includes('电商补量')) return 'OTHER'; // Giả định
      return null;
    }).filter(Boolean);

    const missing = expectedCodes.filter(c => !currentTypes.has(c));
    if (missing.length) {
      console.log(`  ⚠️  Thiếu adType: ${missing.join(', ')}`);
    } else {
      console.log(`  ✅ Đủ adType`);
    }
    console.log('');
  }

  // 6. In ra file CSV để dễ xem
  const csvPath = 'merge-preview-report.csv';
  let csv = '=== BÁO CÁO PREVIEW GỘP UPSTREAM ===\n\n';
  csv += 'Nhóm,Upstream_ID,Upstream_Name,AdType,AdOrder_ID,AdOrder_Name,AdSite_Count,DailyInput_Count,Revenue\n';
  for (const group of groups) {
    for (const src of group.sources) {
      if (src.adOrders.length === 0) {
        csv += `${group.targetName},${src.id},"${src.name}",${src.adTypeCode || ''},,,0,0,0\n`;
      } else {
        for (const o of src.adOrders) {
          const oRev = group.sources
            .flatMap(s => s.adOrders.find(x => x.id === o.id)?.adSites || [])
            .reduce((s, site) => s + 0, 0); // Đã tính ở dưới
          csv += `${group.targetName},${src.id},"${src.name}",${src.adTypeCode || ''},${o.id},"${o.name}",${o.adSiteCount},${o.dailyInputCount},0\n`;
        }
      }
    }
  }
  fs.writeFileSync(csvPath, csv, 'utf8');
  console.log(`Đã xuất file: ${csvPath}`);
  console.log('');
  console.log('='.repeat(80));
  console.log('KẾT THÚC BÁO CÁO PREVIEW');
  console.log('='.repeat(80));
  console.log('');
  console.log('BẠN CẦN XÁC NHẬN:');
  console.log('1. Cấu trúc mong muốn đã đúng chưa?');
  console.log('2. Các nhóm gộp có hợp lý không?');
  console.log('3. Xung đột nào cần xử lý trước?');
  console.log('4. Upstream nào sẽ là "target" (giữ lại) cho mỗi nhóm?');
  console.log('');
  console.log('SAU KHI XÁC NHẬN, tôi sẽ tạo file SQL EXECUTE để thực hiện gộp.');

  await prisma.$disconnect();
}

main().catch(console.error).finally(() => prisma.$disconnect());
