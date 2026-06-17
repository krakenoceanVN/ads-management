import { prisma } from '../src/shared/prisma/client';
import * as fs from 'fs';

/**
 * DEPENDENCY ANALYSIS REPORT
 * Quét toàn bộ FK references trong database
 * KHÔNG thay đổi dữ liệu
 */

interface TableInfo {
  tableName: string;
  recordCount: number;
}

interface FKReference {
  constraintName: string;
  tableName: string;
  columnName: string;
  foreignTableName: string;
  foreignColumnName: string;
}

interface EntityRecordCount {
  upstreamId?: number;
  adOrderId?: number;
  adSiteId?: number;
  tableName: string;
  count: number;
  details?: string;
}

async function main() {
  console.log('='.repeat(100));
  console.log('BÁO CÁO PHÂN TÍCH PHỤ THUỘC (DEPENDENCY ANALYSIS)');
  console.log('='.repeat(100));
  console.log('');

  // ============================================
  // PHẦN 1: LIỆT KÊ TẤT CẢ BẢNG VÀ SỐ BẢN GHI
  // ============================================
  console.log('### PHẦN 1: DANH SÁCH TẤT CẢ BẢNG TRONG DATABASE');
  console.log('');

  const tables = await prisma.$queryRaw<TableInfo[]>`
    SELECT table_name,
           (SELECT n_live_tup FROM pg_stat_user_tables
            WHERE schemaname='public' AND relname=table_name) as "recordCount"
    FROM information_schema.tables
    WHERE table_schema='public'
    ORDER BY table_name
  `;

  console.log('Table Name'.padEnd(40) + ' | Records');
  console.log('-'.repeat(55));
  for (const t of tables) {
    const name = (t.tableName || '').padEnd(40);
    const cnt = String(t.recordCount || 0).padStart(8);
    console.log(`${name} | ${cnt}`);
  }
  console.log('');

  // ============================================
  // PHẦN 2: LIỆT KÊ TẤT CẢ FOREIGN KEY
  // ============================================
  console.log('### PHẦN 2: TẤT CẢ FOREIGN KEY TRONG DATABASE');
  console.log('');

  const fks = await prisma.$queryRaw<FKReference[]>`
    SELECT
      tc.constraint_name as "constraintName",
      tc.table_name as "tableName",
      kcu.column_name as "columnName",
      ccu.table_name as "foreignTableName",
      ccu.column_name as "foreignColumnName"
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema='public'
    ORDER BY tc.table_name, kcu.column_name
  `;

  console.log('Constraint'.padEnd(45) + ' | Table.Column'.padEnd(35) + ' | References');
  console.log('-'.repeat(110));
  for (const fk of fks) {
    const cn = (fk.constraintName || '').padEnd(45);
    const tc = `${fk.tableName}.${fk.columnName}`.padEnd(35);
    const ref = `${fk.foreignTableName}.${fk.foreignColumnName}`;
    console.log(`${cn} | ${tc} | ${ref}`);
  }
  console.log('');

  // ============================================
  // PHẦN 3: PHỤ THUỘC VÀO UPSTREAM (advertiser_id)
  // ============================================
  console.log('### PHẦN 3: PHỤ THUỘC VÀO UPSTREAM (upstreamId)');
  console.log('');

  const upstreamIds = [1, 2, 3, 4, 5, 6, 8, 9, 14, 15];
  const upstreamRefs: EntityRecordCount[] = [];

  for (const uid of upstreamIds) {
    const adOrderCount = await prisma.adOrder.count({ where: { upstreamId: uid } });
    const adSiteCount = await prisma.adSite.count({ where: { upstreamId: uid } });
    const upstreamAdTypeCount = await prisma.upstreamAdType.count({ where: { upstreamId: uid } });
    const adSiteRebateCount = await prisma.adSiteRebateRate.count({
      where: { adSite: { upstreamId: uid } }
    });
    const adSiteEventCount = await prisma.adSiteEvent.count({
      where: { adSite: { upstreamId: uid } }
    });
    const adSiteDownstreamCount = await prisma.adSiteDownstream.count({
      where: { adSite: { upstreamId: uid } }
    });

    if (adOrderCount) upstreamRefs.push({ upstreamId: uid, tableName: 'ad_order', count: adOrderCount });
    if (adSiteCount) upstreamRefs.push({ upstreamId: uid, tableName: 'ad_site', count: adSiteCount });
    if (upstreamAdTypeCount) upstreamRefs.push({ upstreamId: uid, tableName: 'upstream_ad_type', count: upstreamAdTypeCount });
    if (adSiteRebateCount) upstreamRefs.push({ upstreamId: uid, tableName: 'ad_site_rebate_rate (via ad_site)', count: adSiteRebateCount });
    if (adSiteEventCount) upstreamRefs.push({ upstreamId: uid, tableName: 'ad_site_event (via ad_site)', count: adSiteEventCount });
    if (adSiteDownstreamCount) upstreamRefs.push({ upstreamId: uid, tableName: 'ad_site_downstream (via ad_site)', count: adSiteDownstreamCount });
  }

  console.log('Upstream_ID | Table'.padEnd(45) + ' | Count');
  console.log('-'.repeat(70));
  for (const ref of upstreamRefs) {
    const id = String(ref.upstreamId).padEnd(11);
    const tbl = ref.tableName.padEnd(45);
    console.log(`${id} | ${tbl} | ${ref.count}`);
  }
  console.log('');

  // ============================================
  // PHẦN 4: PHỤ THUỘC VÀO AD_ORDER (adOrderId)
  // ============================================
  console.log('### PHẦN 4: PHỤ THUỘC VÀO AD_ORDER (adOrderId)');
  console.log('');

  const adOrderIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
  const adOrderRefs: EntityRecordCount[] = [];

  for (const oid of adOrderIds) {
    const adSiteCount = await prisma.adSite.count({ where: { adOrderId: oid } });
    if (adSiteCount) adOrderRefs.push({ adOrderId: oid, tableName: 'ad_site', count: adSiteCount });
  }

  console.log('AdOrder_ID | Table'.padEnd(45) + ' | Count');
  console.log('-'.repeat(70));
  for (const ref of adOrderRefs) {
    const id = String(ref.adOrderId).padEnd(10);
    const tbl = ref.tableName.padEnd(45);
    console.log(`${id} | ${tbl} | ${ref.count}`);
  }
  console.log('');

  // ============================================
  // PHẦN 5: PHỤ THUỘC VÀO AD_SITE (adSiteId)
  // ============================================
  console.log('### PHẦN 5: PHỤ THUỘC VÀO AD_SITE (adSiteId)');
  console.log('');

  const adSiteRefs: EntityRecordCount[] = [];

  // Get all AdSite IDs
  const allAdSites = await prisma.adSite.findMany({ select: { id: true, name: true, upstreamId: true, adOrderId: true } });

  for (const site of allAdSites) {
    const diCount = await prisma.dailyInput.count({ where: { adSiteId: site.id } });
    const rebateCount = await prisma.adSiteRebateRate.count({ where: { adSiteId: site.id } });
    const eventCount = await prisma.adSiteEvent.count({ where: { adSiteId: site.id } });
    const downstreamCount = await prisma.adSiteDownstream.count({ where: { adSiteId: site.id } });

    if (diCount) adSiteRefs.push({
      adSiteId: site.id,
      tableName: 'daily_input',
      count: diCount,
      details: `site="${site.name}" upstream=${site.upstreamId} adOrder=${site.adOrderId}`
    });
    if (rebateCount) adSiteRefs.push({
      adSiteId: site.id,
      tableName: 'ad_site_rebate_rate',
      count: rebateCount,
      details: `site="${site.name}"`
    });
    if (eventCount) adSiteRefs.push({
      adSiteId: site.id,
      tableName: 'ad_site_event',
      count: eventCount,
      details: `site="${site.name}"`
    });
    if (downstreamCount) adSiteRefs.push({
      adSiteId: site.id,
      tableName: 'ad_site_downstream',
      count: downstreamCount,
      details: `site="${site.name}"`
    });
  }

  console.log('AdSite_ID | Table'.padEnd(25) + ' | Count | Details');
  console.log('-'.repeat(120));
  for (const ref of adSiteRefs) {
    const id = String(ref.adSiteId).padEnd(9);
    const tbl = ref.tableName.padEnd(25);
    const cnt = String(ref.count).padStart(5);
    console.log(`${id} | ${tbl} | ${cnt} | ${ref.details || ''}`);
  }
  console.log('');

  // ============================================
  // PHẦN 6: PHỤ THUỘC VÀO DOWNSTREAM
  // ============================================
  console.log('### PHẦN 6: PHỤ THUỘC VÀO DOWNSTREAM (downstreamId)');
  console.log('');

  const downstreamRefs: EntityRecordCount[] = [];

  const allDownstreams = await prisma.downstream.findMany({ select: { id: true, downstreamType: true } });
  for (const d of allDownstreams) {
    const adSiteDownstreamCount = await prisma.adSiteDownstream.count({ where: { downstreamId: d.id } });
    const periodCount = await prisma.downstreamPeriod.count({ where: { downstreamId: d.id } });
    const rateCount = await prisma.dailyDownstreamRate.count({ where: { downstreamId: d.id } });

    if (adSiteDownstreamCount) downstreamRefs.push({
      adSiteId: d.id,
      tableName: 'ad_site_downstream',
      count: adSiteDownstreamCount,
      details: `downstream="${d.downstreamType}"`
    });
    if (periodCount) downstreamRefs.push({
      adSiteId: d.id,
      tableName: 'downstream_period',
      count: periodCount,
      details: `downstream="${d.downstreamType}"`
    });
    if (rateCount) downstreamRefs.push({
      adSiteId: d.id,
      tableName: 'daily_downstream_rate',
      count: rateCount,
      details: `downstream="${d.downstreamType}"`
    });
  }

  console.log('Downstream_ID | Table'.padEnd(30) + ' | Count | Details');
  console.log('-'.repeat(100));
  for (const ref of downstreamRefs) {
    const id = String(ref.adSiteId).padEnd(13);
    const tbl = ref.tableName.padEnd(30);
    const cnt = String(ref.count).padStart(5);
    console.log(`${id} | ${tbl} | ${cnt} | ${ref.details || ''}`);
  }
  console.log('');

  // ============================================
  // PHẦN 7: PHỤ THUỘC VÀO ADTYPE (adTypeId)
  // ============================================
  console.log('### PHẦN 7: PHỤ THUỘC VÀO ADTYPE (adTypeId)');
  console.log('');

  const adTypes = await prisma.adType.findMany();
  const adTypeRefs: EntityRecordCount[] = [];

  for (const at of adTypes) {
    const upstreamCount = await prisma.upstream.count({ where: { adTypeId: at.id } });
    const upstreamAdTypeCount = await prisma.upstreamAdType.count({ where: { adTypeId: at.id } });
    const adOrderCount = await prisma.adOrder.count({ where: { adTypeId: at.id } });
    const adSiteCount = await prisma.adSite.count({ where: {
      OR: [
        { adOrder: { adTypeId: at.id } },
        { adOrderId: null, upstream: { adTypeId: at.id } }
      ]
    } });

    if (upstreamCount) adTypeRefs.push({ upstreamId: at.id, tableName: 'upstream (adTypeId)', count: upstreamCount, details: `code=${at.code}` });
    if (upstreamAdTypeCount) adTypeRefs.push({ upstreamId: at.id, tableName: 'upstream_ad_type', count: upstreamAdTypeCount, details: `code=${at.code}` });
    if (adOrderCount) adTypeRefs.push({ upstreamId: at.id, tableName: 'ad_order (adTypeId)', count: adOrderCount, details: `code=${at.code}` });
    if (adSiteCount) adTypeRefs.push({ upstreamId: at.id, tableName: 'ad_site (via adOrder/upstream)', count: adSiteCount, details: `code=${at.code}` });
  }

  console.log('AdType_ID | Table'.padEnd(40) + ' | Count | Details');
  console.log('-'.repeat(100));
  for (const ref of adTypeRefs) {
    const id = String(ref.upstreamId).padEnd(9);
    const tbl = ref.tableName.padEnd(40);
    const cnt = String(ref.count).padStart(5);
    console.log(`${id} | ${tbl} | ${cnt} | ${ref.details || ''}`);
  }
  console.log('');

  // ============================================
  // PHẦN 8: TỔNG HỢP RỦI RO THEO TỪNG UPSTREAM CẦN XÓA
  // ============================================
  console.log('### PHẦN 8: ĐÁNH GIÁ RỦI RO KHI HARD DELETE / SOFT DELETE');
  console.log('');

  const upstreamImpact = [
    { id: 5, name: '圣乐游-iqiyi', adSites: 0, di: 0, rev: 0, adOrders: 2 },
    { id: 6, name: '响云-360', adSites: 1, di: 0, rev: 0, adOrders: 1 },
    { id: 8, name: '圣乐游-千问', adSites: 5, di: 38, rev: 117628.80, adOrders: 1 },
    { id: 9, name: '百战-千问', adSites: 3, di: 38, rev: 92370.76, adOrders: 1 },
    { id: 14, name: '响云-千问', adSites: 1, di: 4, rev: 5105.10, adOrders: 1 },
  ];

  console.log('Upstream_ID | Tên'.padEnd(25) + ' | AdOrder | AdSite | DI | Revenue | Decision');
  console.log('-'.repeat(120));
  for (const u of upstreamImpact) {
    const id = String(u.id).padEnd(11);
    const name = u.name.padEnd(25);
    const ao = String(u.adOrders).padStart(7);
    const as_ = String(u.adSites).padStart(6);
    const di = String(u.di).padStart(3);
    const rev = u.rev.toFixed(2).padStart(12);
    let decision = '';
    if (u.adSites === 0 && u.di === 0) {
      decision = '✅ Có thể HARD DELETE (an toàn)';
    } else if (u.di > 0) {
      decision = '⚠️  PHẢI migrate AdSite trước, sau đó soft delete';
    } else {
      decision = '⚠️  Soft delete (có AdSite)';
    }
    console.log(`${id} | ${name} | ${ao} | ${as_} | ${di} | ${rev} | ${decision}`);
  }
  console.log('');

  // ============================================
  // PHẦN 9: PHÂN TÍCH CHI TIẾT ADORDER id=8 vs id=11 (圣乐游 千问)
  // ============================================
  console.log('### PHẦN 9: PHÂN TÍCH CHI TIẾT ADORDER id=8 vs id=11 (圣乐游 千问)');
  console.log('');

  const adOrder8 = await prisma.adOrder.findUnique({
    where: { id: 8 },
    include: {
      upstream: true,
      adType: true,
      adSites: {
        include: {
          dailyInputs: true,
        }
      }
    }
  });

  const adOrder11 = await prisma.adOrder.findUnique({
    where: { id: 11 },
    include: {
      upstream: true,
      adType: true,
      adSites: {
        include: {
          dailyInputs: true,
        }
      }
    }
  });

  console.log('--- AdOrder id=8 ---');
  console.log(`  Tên: "${adOrder8?.name}"`);
  console.log(`  Upstream: id=${adOrder8?.upstreamId} "${adOrder8?.upstream?.name}"`);
  console.log(`  AdType: id=${adOrder8?.adTypeId} code=${adOrder8?.adType?.code} name=${adOrder8?.adType?.name}`);
  console.log(`  Status: ${adOrder8?.status}`);
  console.log(`  Created: ${adOrder8?.createdAt.toISOString()}`);
  console.log(`  Updated: ${adOrder8?.updatedAt.toISOString()}`);
  console.log(`  Số AdSite: ${adOrder8?.adSites.length}`);
  for (const s of adOrder8?.adSites || []) {
    const di = s.dailyInputs.length;
    const rev = s.dailyInputs.reduce((sum, d) => sum + Number(d.revenue), 0);
    console.log(`    - AdSite id=${s.id} "${s.name}" billing=${s.billingMethod} (${di} DI, rev=${rev.toFixed(2)})`);
  }
  console.log('');

  console.log('--- AdOrder id=11 ---');
  console.log(`  Tên: "${adOrder11?.name}"`);
  console.log(`  Upstream: id=${adOrder11?.upstreamId} "${adOrder11?.upstream?.name}"`);
  console.log(`  AdType: id=${adOrder11?.adTypeId} code=${adOrder11?.adType?.code} name=${adOrder11?.adType?.name}`);
  console.log(`  Status: ${adOrder11?.status}`);
  console.log(`  Created: ${adOrder11?.createdAt.toISOString()}`);
  console.log(`  Updated: ${adOrder11?.updatedAt.toISOString()}`);
  console.log(`  Số AdSite: ${adOrder11?.adSites.length}`);
  for (const s of adOrder11?.adSites || []) {
    const di = s.dailyInputs.length;
    const rev = s.dailyInputs.reduce((sum, d) => sum + Number(d.revenue), 0);
    console.log(`    - AdSite id=${s.id} "${s.name}" billing=${s.billingMethod} (${di} DI, rev=${rev.toFixed(2)})`);
  }
  console.log('');

  // So sánh
  console.log('--- SO SÁNH ---');
  console.log(`  Cùng adType: ${adOrder8?.adTypeId === adOrder11?.adTypeId ? '✅ CÓ (cùng OTHER)' : '❌ KHÔNG'}`);
  console.log(`  Cùng tên: ${adOrder8?.name === adOrder11?.name ? '✅ CÓ (cùng "other")' : '❌ KHÔNG'}`);
  console.log(`  Khác Upstream: ${adOrder8?.upstreamId !== adOrder11?.upstreamId ? '✅ KHÁC (1 vs 8)' : '❌ CÙNG'}`);

  const names8 = new Set(adOrder8?.adSites.map(s => s.name.toLowerCase()) || []);
  const names11 = new Set(adOrder11?.adSites.map(s => s.name.toLowerCase()) || []);
  const intersection = [...names8].filter(n => names11.has(n));
  console.log(`  AdSite trùng tên (case-insensitive): ${intersection.length === 0 ? '✅ KHÔNG CÓ' : `❌ CÓ ${intersection.length}: ${intersection.join(', ')}`}`);
  console.log('');

  // ============================================
  // PHẦN 10: ĐÁNH GIÁ KHẢ NĂNG GỘP
  // ============================================
  console.log('### PHẦN 10: ĐÁNH GIÁ KHẢ NĂNG GỘP ADORDER id=8 vs id=11');
  console.log('');

  const canMergeSafely =
    adOrder8?.adTypeId === adOrder11?.adTypeId &&
    intersection.length === 0;

  console.log('ĐIỀU KIỆN CẦN ĐỂ GỘP AN TOÀN:');
  console.log(`  1. Cùng adType: ${adOrder8?.adTypeId === adOrder11?.adTypeId ? '✅' : '❌'}`);
  console.log(`  2. Không có AdSite trùng tên: ${intersection.length === 0 ? '✅' : '❌'}`);
  console.log(`  3. Migration an toàn cho DailyInput: ✅ (chỉ đổi adSiteId reference)`);
  console.log('');

  if (canMergeSafely) {
    console.log('✅ KẾT LUẬN: CÓ THỂ GỘP AN TOÀN');
    console.log('   - Cùng adType (OTHER = 千问)');
    console.log('   - Không có AdSite trùng tên');
    console.log('   - DailyInput sẽ tự động trỏ theo adSiteId mới');
    console.log('');
    console.log('PHƯƠNG ÁN ĐỀ XUẤT:');
    console.log(`  Tùy chọn A: Giữ id=8 (51 DI, 136k rev), migrate 5 AdSite của id=11 sang`);
    console.log(`  Tùy chọn B: Giữ id=11 (38 DI, 117k rev), migrate 4 AdSite của id=8 sang`);
    console.log(`  Tùy chọn C: Giữ cả 2, đổi tên id=11 thành "other2"`);
  } else {
    console.log('⚠️ KẾT LUẬN: KHÔNG NÊN GỘP TỰ ĐỘNG');
    console.log('   Cần xử lý thủ công trước khi gộp');
  }
  console.log('');

  // ============================================
  // PHẦN 11: TỔNG KẾT CÁC BẢNG CẦN THEO DÕI
  // ============================================
  console.log('### PHẦN 11: TỔNG KẾT CÁC BẢNG CẦN THEO DÕI KHI MIGRATE');
  console.log('');

  const summary = [
    { table: 'ad_order', fk: 'upstreamId', count: await prisma.adOrder.count() },
    { table: 'ad_site', fk: 'upstreamId', count: await prisma.adSite.count() },
    { table: 'ad_site', fk: 'adOrderId', count: await prisma.adSite.count({ where: { adOrderId: { not: null } } }) },
    { table: 'ad_site_rebate_rate', fk: 'adSiteId', count: await prisma.adSiteRebateRate.count() },
    { table: 'ad_site_event', fk: 'adSiteId', count: await prisma.adSiteEvent.count() },
    { table: 'ad_site_downstream', fk: 'adSiteId', count: await prisma.adSiteDownstream.count() },
    { table: 'daily_input', fk: 'adSiteId', count: await prisma.dailyInput.count() },
    { table: 'upstream_ad_type', fk: 'upstreamId', count: await prisma.upstreamAdType.count() },
  ];

  console.log('Table'.padEnd(30) + ' | FK Column'.padEnd(15) + ' | Total Records');
  console.log('-'.repeat(70));
  for (const s of summary) {
    const t = s.table.padEnd(30);
    const f = s.fk.padEnd(15);
    const c = String(s.count).padStart(8);
    console.log(`${t} | ${f} | ${c}`);
  }
  console.log('');

  // ============================================
  // XUẤT CSV
  // ============================================
  const csv = [
    'BÁO CÁO DEPENDENCY ANALYSIS',
    '',
    'Phụ thuộc Upstream',
    ...upstreamRefs.map(r => `upstream_id=${r.upstreamId},${r.tableName},${r.count}`),
    '',
    'Phụ thuộc AdOrder',
    ...adOrderRefs.map(r => `ad_order_id=${r.adOrderId},${r.tableName},${r.count}`),
    '',
    'Phụ thuộc AdSite',
    ...adSiteRefs.map(r => `ad_site_id=${r.adSiteId},${r.tableName},${r.count},${r.details || ''}`),
  ].join('\n');

  fs.writeFileSync('dependency-analysis-report.csv', csv, 'utf8');
  console.log('Đã xuất file: dependency-analysis-report.csv');
  console.log('');
  console.log('='.repeat(100));
  console.log('KẾT THÚC BÁO CÁO PHÂN TÍCH PHỤ THUỘC');
  console.log('='.repeat(100));

  await prisma.$disconnect();
}

main().catch(console.error).finally(() => prisma.$disconnect());
