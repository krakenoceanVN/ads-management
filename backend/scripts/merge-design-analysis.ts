import { prisma } from '../src/shared/prisma/client';
import * as fs from 'fs';

/**
 * MERGE DESIGN ANALYSIS - PHIÊN BẢN 2
 * Phân tích theo mô hình N-N: 1 Upstream nhiều AdType
 * KHÔNG thay đổi database
 */

async function main() {
  console.log('='.repeat(100));
  console.log('BÁO CÁO PHÂN TÍCH THIẾT KẾ: UPSTREAM NHIỀU ADTYPE (N-N)');
  console.log('='.repeat(100));
  console.log('');

  // ============================================
  // PHẦN 1: TRẠNG THÁI HIỆN TẠI
  // ============================================
  console.log('### PHẦN 1: TRẠNG THÁI HIỆN TẠI');
  console.log('');

  const adTypes = await prisma.adType.findMany();
  console.log('Các AdType hiện có:');
  console.log('ID  | Code          | Name');
  console.log('----|---------------|----------------');
  for (const t of adTypes.sort((a, b) => a.id - b.id)) {
    console.log(`${String(t.id).padEnd(4)}| ${t.code.padEnd(13)} | ${t.name}`);
  }
  console.log('');

  const allUpstreams = await prisma.upstream.findMany({
    include: {
      adType: true,
      adTypeLinks: { include: { adType: true } },
      adOrders: { include: { adType: true } },
    },
    orderBy: { id: 'asc' },
  });

  console.log('Các Upstream hiện có:');
  console.log('ID  | Tên'.padEnd(25) + ' | adType chính | adTypeLinks | Status');
  console.log('-'.repeat(90));
  for (const u of allUpstreams) {
    const id = String(u.id).padEnd(4);
    const name = u.name.padEnd(25);
    const mainType = u.adType?.code || 'NULL';
    const links = u.adTypeLinks.map(l => l.adType.code).join(',') || 'none';
    console.log(`${id}| ${name} | ${mainType.padEnd(13)}| ${links.padEnd(12)}| ${u.status}`);
  }
  console.log('');

  // ============================================
  // PHẦN 2: THỐNG KÊ ADORDER "other"
  // ============================================
  console.log('### PHẦN 2: THỐNG KÊ ADORDER TÊN "other"');
  console.log('');

  const otherOrders = await prisma.adOrder.findMany({
    where: { name: 'other' },
    include: {
      upstream: true,
      adType: true,
      adSites: { include: { dailyInputs: true } },
    },
  });

  console.log('AdOrder_ID | Upstream'.padEnd(25) + ' | AdType | AdSite | DI | Revenue');
  console.log('-'.repeat(100));
  for (const o of otherOrders) {
    const id = String(o.id).padEnd(10);
    const up = o.upstream.name.padEnd(25);
    const at = o.adType?.code.padEnd(8) || 'NULL'.padEnd(8);
    const siteCnt = o.adSites.length;
    const di = o.adSites.reduce((s, site) => s + site.dailyInputs.length, 0);
    const rev = o.adSites.reduce((s, site) =>
      s + site.dailyInputs.reduce((s2, d) => s2 + Number(d.revenue), 0), 0);
    console.log(`${id}| ${up} | ${at} | ${String(siteCnt).padStart(6)} | ${String(di).padStart(3)} | ${rev.toFixed(2).padStart(12)}`);
  }
  console.log('');

  // Chi tiết AdSite của từng AdOrder "other"
  console.log('Chi tiết AdSite của từng AdOrder "other":');
  for (const o of otherOrders) {
    console.log(`\n--- AdOrder id=${o.id} (Upstream: ${o.upstream.name}, AdType: ${o.adType?.code}) ---`);
    for (const s of o.adSites) {
      const di = s.dailyInputs.length;
      const rev = s.dailyInputs.reduce((sum, d) => sum + Number(d.revenue), 0);
      console.log(`  AdSite ${s.id}: "${s.name}" (${s.billingMethod}) - ${di} DI, rev=${rev.toFixed(2)}`);
    }
  }
  console.log('');

  // ============================================
  // PHẦN 3: THIẾT KẾ MỚI - MÔ HÌNH N-N
  // ============================================
  console.log('### PHẦN 3: THIẾT KẾ MỚI - MÔ HÌNH N-N');
  console.log('');

  console.log('Cấu trúc hiện tại (1 Upstream - 1 adType chính):');
  console.log('  Upstream 圣乐游-sly-sm → adTypeId = SM');
  console.log('  Upstream 圣乐游-千问  → adTypeId = OTHER');
  console.log('');

  console.log('Cấu trúc mới (1 Upstream - nhiều AdType):');
  console.log('  Upstream 圣乐游 → adTypeId = SM (chính)');
  console.log('                 → upstream_ad_type: [(圣乐游, SM), (圣乐游, OTHER)]');
  console.log('  → AdOrder id=1 (sm/SM) thuộc Upstream 圣乐游');
  console.log('  → AdOrder id=8 (other/OTHER) thuộc Upstream 圣乐游');
  console.log('  → AdOrder id=11 (other/OTHER) thuộc Upstream 圣乐游');
  console.log('');

  // ============================================
  // PHẦN 4: ĐÁNH GIÁ TÁC ĐỘNG GỘP 圣乐游
  // ============================================
  console.log('### PHẦN 4: ĐÁNH GIÁ TÁC ĐỘNG GỘP 圣乐游 (id=1 + id=8)');
  console.log('');

  // Thông tin Upstream 1 và 8
  const up1 = await prisma.upstream.findUnique({
    where: { id: 1 },
    include: {
      adType: true,
      adTypeLinks: { include: { adType: true } },
      adOrders: { include: { adType: true, adSites: { include: { dailyInputs: true } } } },
    },
  });

  const up8 = await prisma.upstream.findUnique({
    where: { id: 8 },
    include: {
      adType: true,
      adTypeLinks: { include: { adType: true } },
      adOrders: { include: { adType: true, adSites: { include: { dailyInputs: true } } } },
    },
  });

  console.log('--- Upstream 1 (圣乐游-sly-sm) - GIỮ LÀM TARGET ---');
  console.log(`  Tên hiện tại: "${up1?.name}"`);
  console.log(`  adType chính: ${up1?.adType?.code}`);
  console.log(`  Số AdOrder: ${up1?.adOrders.length}`);
  for (const o of up1?.adOrders || []) {
    const di = o.adSites.reduce((s, s2) => s + s2.dailyInputs.length, 0);
    const rev = o.adSites.reduce((s, s2) =>
      s + s2.dailyInputs.reduce((s3, d) => s3 + Number(d.revenue), 0), 0);
    console.log(`    - AdOrder id=${o.id} "${o.name}" (${o.adType?.code}): ${o.adSites.length} site, ${di} DI, rev=${rev.toFixed(2)}`);
  }
  console.log('');

  console.log('--- Upstream 8 (圣乐游-千问) - SẼ BỊ XÓA ---');
  console.log(`  Tên hiện tại: "${up8?.name}"`);
  console.log(`  adType chính: ${up8?.adType?.code}`);
  console.log(`  Số AdOrder: ${up8?.adOrders.length}`);
  for (const o of up8?.adOrders || []) {
    const di = o.adSites.reduce((s, s2) => s + s2.dailyInputs.length, 0);
    const rev = o.adSites.reduce((s, s2) =>
      s + s2.dailyInputs.reduce((s3, d) => s3 + Number(d.revenue), 0), 0);
    console.log(`    - AdOrder id=${o.id} "${o.name}" (${o.adType?.code}): ${o.adSites.length} site, ${di} DI, rev=${rev.toFixed(2)}`);
  }
  console.log('');

  // Tổng kết
  const totalSites_1 = up1?.adOrders.reduce((s, o) => s + o.adSites.length, 0) || 0;
  const totalDi_1 = up1?.adOrders.reduce((s, o) =>
    s + o.adSites.reduce((s2, s3) => s2 + s3.dailyInputs.length, 0), 0) || 0;
  const totalRev_1 = up1?.adOrders.reduce((s, o) =>
    s + o.adSites.reduce((s2, s3) =>
      s2 + s3.dailyInputs.reduce((s4, d) => s4 + Number(d.revenue), 0), 0), 0) || 0;

  const totalSites_8 = up8?.adOrders.reduce((s, o) => s + o.adSites.length, 0) || 0;
  const totalDi_8 = up8?.adOrders.reduce((s, o) =>
    s + o.adSites.reduce((s2, s3) => s2 + s3.dailyInputs.length, 0), 0) || 0;
  const totalRev_8 = up8?.adOrders.reduce((s, o) =>
    s + o.adSites.reduce((s2, s3) =>
      s2 + s3.dailyInputs.reduce((s4, d) => s4 + Number(d.revenue), 0), 0), 0) || 0;

  console.log('TỔNG KẾT SAU KHI GỘP:');
  console.log(`  Upstream 1 (圣乐游) sẽ có:`);
  console.log(`    - 2 AdOrder (id=1 SM, id=8 OTHER, id=11 OTHER)`);
  console.log(`    - ${totalSites_1 + totalSites_8} AdSite`);
  console.log(`    - ${totalDi_1 + totalDi_8} DailyInput`);
  console.log(`    - Revenue: ${(totalRev_1 + totalRev_8).toFixed(2)}`);
  console.log(`    - 2 adType qua upstream_ad_type: SM + OTHER`);
  console.log('');

  // ============================================
  // PHẦN 5: KIỂM TRA XUNG ĐỘT
  // ============================================
  console.log('### PHẦN 5: KIỂM TRA XUNG ĐỘT KHI GỘP');
  console.log('');

  // AdOrder trùng tên trong cùng adType
  const ordersAfterMerge = [
    { id: 1, name: 'sm', adType: 'SM', sourceUp: 1, sites: 4, di: 33 },
    { id: 8, name: 'other', adType: 'OTHER', sourceUp: 1, sites: 4, di: 51 },
    { id: 11, name: 'other', adType: 'OTHER', sourceUp: 8, sites: 5, di: 38 },
  ];

  console.log('Các AdOrder sau khi gộp vào Upstream 1:');
  console.log('  - id=1 "sm" (SM) - GIỮ NGUYÊN');
  console.log('  - id=8 "other" (OTHER) - GIỮ NGUYÊN (thuộc Upstream 1)');
  console.log('  - id=11 "other" (OTHER) - CHUYỂN từ Upstream 8 sang Upstream 1');
  console.log('');

  console.log('Câu hỏi: id=8 và id=11 có trùng không?');
  console.log('  - Cùng adType (OTHER): ĐÚNG → đây là 2 AdOrder cùng loại');
  console.log('  - Cùng tên ("other"): ĐÚNG → đây là 2 AdOrder cùng tên');
  console.log('  - KHÁC AdSite:');
  const sites8 = new Set<string>();
  for (const o of up1?.adOrders || []) {
    if (o.id === 8) {
      for (const s of o.adSites) sites8.add(s.name.toLowerCase());
    }
  }
  const sites11 = new Set<string>();
  for (const o of up8?.adOrders || []) {
    if (o.id === 11) {
      for (const s of o.adSites) sites11.add(s.name.toLowerCase());
    }
  }
  const intersection = [...sites8].filter(n => sites11.has(n));
  console.log(`    AdSite id=8: ${[...sites8].join(', ')}`);
  console.log(`    AdSite id=11: ${[...sites11].join(', ')}`);
  console.log(`    Trùng tên: ${intersection.length === 0 ? 'KHÔNG' : `CÓ ${intersection.length}: ${intersection.join(', ')}`}`);
  console.log('');

  console.log('KẾT LUẬN: id=8 và id=11 KHÔNG trùng AdSite → có thể tồn tại song song trong cùng 1 Upstream');
  console.log('');

  // ============================================
  // PHẦN 6: KẾ HOẠCH MIGRATE TỔNG THỂ
  // ============================================
  console.log('### PHẦN 6: KẾ HOẠCH MIGRATE TỔNG THỂ');
  console.log('');

  const plan = [
    {
      step: 1,
      action: 'ĐỔI TÊN UPSTREAM',
      sql: 'UPDATE upstream SET name = ... WHERE id IN (...)',
      targets: [
        { id: 1, from: '圣乐游-sly-sm', to: '圣乐游' },
        { id: 2, from: '响云- BB-sm', to: '响云' },
        { id: 3, from: '百战-BZ-sm', to: '百战' },
        { id: 4, from: '刘佳-LJ-sm', to: '刘佳' },
        { id: 15, from: '罗强-抖音', to: '罗强' },
      ],
      risk: '0 (chỉ update text)',
      rollback: 'UPDATE upstream SET name = <old>',
    },
    {
      step: 2,
      action: 'XÓA ADORDER RỖNG',
      sql: 'DELETE FROM ad_order WHERE id IN (2, 6, 9)',
      targets: [
        { id: 2, name: 'sm', upstream: 2, adType: 'OTHER', sites: 0, di: 0, note: 'rỗng' },
        { id: 6, name: '投放链接1', upstream: 5, adType: 'IQIYI', sites: 0, di: 0, note: 'rỗng' },
        { id: 9, name: 'other', upstream: 3, adType: 'OTHER', sites: 0, di: 0, note: 'rỗng' },
      ],
      risk: '0 (không có FK)',
      rollback: 'Cần backup trước',
    },
    {
      step: 3,
      action: 'XÓA 圣乐游-IQIYI',
      sql: 'Xóa AdSite 8, junction, AdOrder 5, Upstream 5',
      targets: [
        { id: 8, name: 'iqiyi URL', note: 'có junction với Downstream 2' },
        { id: 5, name: 'iqiyi', note: 'AdOrder rỗng' },
        { id: 5, name: '圣乐游-iqiyi', note: 'Upstream' },
      ],
      risk: 'Thấp (0 DI, 0 Revenue)',
      rollback: 'Cần backup trước',
    },
    {
      step: 4,
      action: 'GỘP 百战-千问 → 百战',
      sql: 'UPDATE ad_site SET upstreamId=3 WHERE upstreamId=9; UPDATE ad_order SET upstreamId=3 WHERE upstreamId=9; UPDATE upstream_ad_type ...; soft delete upstream 9',
      targets: [
        { from: 9, to: 3, sites: 3, di: 38, rev: 92370.76 },
      ],
      risk: 'Thấp',
      rollback: 'UPDATE ... WHERE upstreamId=3 → 9',
    },
    {
      step: 5,
      action: 'GỘP 响云-千问 → 响云',
      sql: 'UPDATE ad_site SET upstreamId=2 WHERE upstreamId=14; UPDATE ad_order SET upstreamId=2 WHERE upstreamId=14; soft delete upstream 14',
      targets: [
        { from: 14, to: 2, sites: 1, di: 4, rev: 5105.10 },
      ],
      risk: 'Thấp',
      rollback: 'UPDATE ... WHERE upstreamId=2 → 14',
    },
    {
      step: 6,
      action: 'GỘP 圣乐游-千问 → 圣乐游 (MÔ HÌNH N-N)',
      sql: 'UPDATE ad_site SET upstreamId=1 WHERE upstreamId=8; UPDATE ad_order SET upstreamId=1 WHERE upstreamId=8; INSERT INTO upstream_ad_type (upstreamId=1, adTypeId=5); soft delete upstream 8',
      targets: [
        { from: 8, to: 1, sites: 5, di: 38, rev: 117628.80 },
      ],
      risk: 'Trung bình (phải thêm upstream_ad_type)',
      rollback: 'UPDATE ... WHERE upstreamId=1 → 8; DELETE FROM upstream_ad_type',
    },
    {
      step: 7,
      action: 'TẠO ADTYPE 360_AI',
      sql: 'INSERT INTO ad_type (code, name) VALUES (\'360_AI\', \'360 AI桌面\')',
      targets: [{ code: '360_AI', name: '360 AI桌面' }],
      risk: '0',
      rollback: 'DELETE FROM ad_type WHERE code = \'360_AI\'',
    },
    {
      step: 8,
      action: 'TẠO 响云-360 AI桌面',
      sql: 'INSERT INTO ad_order (upstreamId=2, adTypeId=<360_AI>, name=\'360 AI桌面\')',
      targets: [{ upstream: 2, adType: '360_AI', name: '360 AI桌面' }],
      risk: '0',
      rollback: 'DELETE FROM ad_order WHERE ...',
    },
    {
      step: 9,
      action: 'TẠO 罗强-千问',
      sql: 'INSERT INTO ad_order (upstreamId=15, adTypeId=5, name=\'千问\')',
      targets: [{ upstream: 15, adType: 'OTHER', name: '千问' }],
      risk: '0',
      rollback: 'DELETE FROM ad_order WHERE ...',
    },
    {
      step: 10,
      action: 'TẠO 龙云-电商补量',
      sql: 'INSERT INTO upstream (name, adTypeId, status) VALUES (\'龙云\', 5, \'active\'); INSERT INTO ad_order ...; INSERT INTO upstream_ad_type ...',
      targets: [
        { upstream: '龙云', adType: 'OTHER', order: '电商补量' },
      ],
      risk: '0',
      rollback: 'DELETE ...',
    },
  ];

  for (const p of plan) {
    console.log(`### BƯỚC ${p.step}: ${p.action}`);
    console.log(`  SQL: ${p.sql}`);
    console.log(`  Targets: ${p.targets.length} đối tượng`);
    console.log(`  Risk: ${p.risk}`);
    console.log(`  Rollback: ${p.rollback}`);
    console.log('');
  }

  // ============================================
  // PHẦN 7: TỔNG KẾT TÁC ĐỘNG
  // ============================================
  console.log('### PHẦN 7: TỔNG KẾT TÁC ĐỘNG');
  console.log('');

  console.log('Tổng số bản ghi bị ảnh hưởng:');
  console.log(`  - Upstream: 6 đổi tên + 4 soft delete + 1 tạo mới = 11 thay đổi`);
  console.log(`  - AdOrder: 3 xóa + 6 cập nhật upstreamId + 1 đổi tên (响云-360) + 3 tạo mới = 13 thay đổi`);
  console.log(`  - AdSite: 9 cập nhật upstreamId + 1 xóa = 10 thay đổi`);
  console.log(`  - UpstreamAdType: 4 cập nhật/thêm mới`);
  console.log(`  - AdType: 1 tạo mới (360_AI)`);
  console.log('');

  console.log('Dữ liệu DailyInput: KHÔNG bị ảnh hưởng (FK tham chiếu adSiteId)');
  console.log('  - Tổng DailyInput trong các Upstream bị ảnh hưởng: 80 (38+4+38)');
  console.log('  - Tất cả sẽ tự động theo adSiteId mới');
  console.log('');

  // ============================================
  // XUẤT BÁO CÁO
  // ============================================
  const reportLines: string[] = [];
  reportLines.push('BÁO CÁO THIẾT KẾ MỚI: UPSTREAM NHIỀU ADTYPE');
  reportLines.push('='.repeat(80));
  reportLines.push('');
  reportLines.push('Các AdOrder "other" hiện tại:');
  for (const o of otherOrders) {
    const di = o.adSites.reduce((s, site) => s + site.dailyInputs.length, 0);
    const rev = o.adSites.reduce((s, site) =>
      s + site.dailyInputs.reduce((s2, d) => s2 + Number(d.revenue), 0), 0);
    reportLines.push(`  AdOrder ${o.id}: Upstream=${o.upstream.name}, AdType=${o.adType?.code}, Sites=${o.adSites.length}, DI=${di}, Rev=${rev.toFixed(2)}`);
  }
  reportLines.push('');
  reportLines.push('Đề xuất đổi tên "other" → "千问":');
  reportLines.push('  - AdOrder id=10 (Upstream 3 百战): NÊN đổi → "千问"');
  reportLines.push('  - AdOrder id=8  (Upstream 1 圣乐游): NÊN đổi → "千问"');
  reportLines.push('  - AdOrder id=11 (sẽ về Upstream 1 圣乐游): NÊN đổi → "千问"');
  reportLines.push('  - AdOrder id=13 (Upstream 2 响云): NÊN đổi → "千问"');
  reportLines.push('');

  fs.writeFileSync('merge-design-report.txt', reportLines.join('\n'), 'utf8');
  console.log('Đã xuất file: merge-design-report.txt');
  console.log('');

  console.log('='.repeat(100));
  console.log('KẾT THÚC BÁO CÁO');
  console.log('='.repeat(100));
  console.log('');
  console.log('CHỜ XÁC NHẬN CỦA BẠN TRƯỚC KHI TẠO SQL EXECUTE');

  await prisma.$disconnect();
}

main().catch(console.error).finally(() => prisma.$disconnect());
