/**
 * Backfill script: gán lại id 6 ký tự alphanumeric cho MỌI row hiện có.
 *
 * Chiến lược an toàn (1 transaction, downtime ngắn):
 * 1. Drop TẤT CẢ FK constraints.
 * 2. Với mỗi FK (foreignKey.column → primaryKey.id):
 *    - Nếu bảng con có FK dạng (column) → PK.id, ta UPDATE bảng con:
 *        SET column = map[oldId]  -- dùng map của bảng cha
 *    - Bỏ qua junction tables (bảng có surrogate id riêng).
 * 3. UPDATE PK của tất cả bảng gốc (AdType, Upstream, AdOrder, AdSite, Downstream, ...).
 * 4. Recreate FK constraints.
 *
 * YÊU CẦU: tắt backend dev server trước khi chạy.
 * Chạy: node scripts/backfill-short-ids.cjs
 */

const { PrismaClient } = require('@prisma/client');
const { randomBytes } = require('crypto');

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const ID_LENGTH = 6;
const VALID_RE = /^[0-9A-Za-z]{6}$/;

function generateShortId() {
  const bytes = randomBytes(16);
  let result = '';
  for (let i = 0; i < bytes.length && result.length < ID_LENGTH; i++) {
    if (bytes[i] < 248) result += ALPHABET[bytes[i] % 62];
  }
  return result.length === ID_LENGTH ? result : generateShortId();
}

const prisma = new PrismaClient();

/**
 * Build id map: oldId → newId cho 1 bảng.
 * Giữ nguyên id đã là alphanumeric 6 ký tự.
 */
async function buildIdMap(tableName) {
  const rows = await prisma.$queryRawUnsafe(`SELECT id FROM "${tableName}"`);
  const used = new Set();
  for (const r of rows) {
    if (VALID_RE.test(r.id)) used.add(r.id);
  }
  const map = new Map();
  for (const r of rows) {
    if (VALID_RE.test(r.id)) {
      map.set(r.id, r.id);
      continue;
    }
    let attempts = 0;
    while (attempts < 10) {
      const candidate = generateShortId();
      if (!used.has(candidate)) {
        used.add(candidate);
        map.set(r.id, candidate);
        break;
      }
      attempts++;
    }
    if (attempts >= 10) throw new Error(`Collision in ${tableName}`);
  }
  return map;
}

const TABLES = [
  'AdType', 'Upstream', 'AdOrder', 'AdSite', 'Downstream',
  'DownstreamAdType', 'UpstreamAdType', 'AdSiteDownstream',
  'AdSiteRebateRate', 'AdSiteEvent', 'DownstreamPeriod',
  'DailyDownstreamRate', 'DailyInput', 'DailyInputQuarantineBatch',
  'DailyInputQuarantineRecord', 'YiyiDailyData', 'YiyiDailyPricing',
  'LEDailyCost', 'User', 'Role', 'Permission', 'OperationLog',
];

async function main() {
  console.log('=== Backfill short id script ===\n');

  // 1. Build id maps
  console.log('Building id maps...');
  const maps = {};
  for (const t of TABLES) {
    maps[t] = await buildIdMap(t);
    const total = maps[t].size;
    const changed = Array.from(maps[t].entries()).filter(([o, n]) => o !== n).length;
    console.log(`  ${t.padEnd(35)} total=${total.toString().padStart(4)}  to-change=${changed}`);
  }

  // 2. Load FK metadata
  const fks = await prisma.$queryRawUnsafe(`
    SELECT
      tc.constraint_name AS name,
      tc.table_name AS table,
      kcu.column_name AS "column",
      ccu.table_name AS "foreignTableName",
      ccu.column_name AS "foreignColumn",
      rc.delete_rule AS "onDelete",
      rc.update_rule AS "onUpdate"
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
    JOIN information_schema.referential_constraints AS rc
      ON rc.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
  `);
  console.log(`\nFound ${fks.length} FK constraints`);

  // 3. Run transaction
  const start = Date.now();
  await prisma.$transaction(async (tx) => {
    // Step A: Drop all FK
    console.log('\nStep A: Dropping FK constraints...');
    for (const fk of fks) {
      await tx.$executeRawUnsafe(`ALTER TABLE "${fk.table}" DROP CONSTRAINT "${fk.name}"`);
    }

    // Step B: Update FK columns (in child tables) using each parent's map
    // Bảng nào có FK trỏ vào bảng cha, cập nhật cột FK theo map của cha.
    console.log('Step B: Updating FK columns in child tables...');
    const updatesByChild = new Map(); // childTable -> { column, parentTable, map }
    for (const fk of fks) {
      const map = maps[fk.foreignTableName];
      if (!map) continue; // FK trỏ vào bảng ngoài schema (không có)
      const changes = Array.from(map.entries()).filter(([o, n]) => o !== n);
      if (changes.length === 0) continue;
      if (!updatesByChild.has(fk.table)) updatesByChild.set(fk.table, []);
      updatesByChild.get(fk.table).push({ column: fk.column, map });
    }
    for (const [table, updates] of updatesByChild) {
      for (const { column, map } of updates) {
        const changes = Array.from(map.entries()).filter(([o, n]) => o !== n);
        for (const [oldId, newId] of changes) {
          await tx.$executeRawUnsafe(
            `UPDATE "${table}" SET "${column}" = $1 WHERE "${column}" = $2`,
            newId, oldId
          );
        }
      }
      console.log(`  ${table.padEnd(35)} ${updates.length} FK columns updated`);
    }

    // Step C: Update PK
    console.log('Step C: Updating PK columns...');
    for (const table of TABLES) {
      const map = maps[table];
      const changes = Array.from(map.entries()).filter(([o, n]) => o !== n);
      for (const [oldId, newId] of changes) {
        await tx.$executeRawUnsafe(
          `UPDATE "${table}" SET id = $1 WHERE id = $2`,
          newId, oldId
        );
      }
      console.log(`  ${table.padEnd(35)} ${changes.length} ids updated`);
    }

    // Step D: Recreate FK
    console.log('Step D: Recreating FK constraints...');
    for (const fk of fks) {
      const onDelete = fk.onDelete && fk.onDelete !== 'NO ACTION' ? ` ON DELETE ${fk.onDelete}` : '';
      const onUpdate = fk.onUpdate && fk.onUpdate !== 'NO ACTION' ? ` ON UPDATE ${fk.onUpdate}` : '';
      await tx.$executeRawUnsafe(
        `ALTER TABLE "${fk.table}" ADD CONSTRAINT "${fk.name}" FOREIGN KEY ("${fk.column}") REFERENCES "${fk.foreignTableName}"("${fk.foreignColumn}")${onDelete}${onUpdate}`
      );
    }
  }, { timeout: 120000 });

  console.log(`\nTransaction done in ${((Date.now() - start) / 1000).toFixed(1)}s`);

  // 4. Verify
  console.log('\n=== Verification ===');
  let totalNumeric = 0;
  for (const t of TABLES) {
    const r = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS c FROM "${t}" WHERE id ~ '^[0-9]+$'`
    );
    const numeric = r[0].c;
    totalNumeric += numeric;
    const status = numeric === 0 ? 'OK' : `STILL HAS ${numeric}`;
    console.log(`  ${t.padEnd(35)} ${status}`);
  }
  console.log(`\nTotal remaining numeric ids: ${totalNumeric}`);
  if (totalNumeric > 0) {
    console.log('WARNING: not all ids converted.');
    process.exit(1);
  } else {
    console.log('All ids are 6-char alphanumeric. SUCCESS.');
  }
}

main()
  .catch(err => { console.error('FAILED:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
