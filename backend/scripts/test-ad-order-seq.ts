/**
 * Tests for AdOrder sequence generation.
 *
 * Run: npx tsx scripts/test-ad-order-seq.ts
 *
 * Uses the test database (DATABASE_URL from .env). Each test picks a fresh,
 * empty (upstreamId, adTypeId) pair and cleans up at the end so the suite is
 * idempotent. If a test fails, the cleanup step still runs (try/finally).
 *
 * What we cover:
 *   1. generateAndCreateAdOrder (form path) — empty pair gets seq=1, name=CODE-001.
 *   2. generateAndCreateAdOrder — pair with seq=3 already gets seq=4.
 *   3. generateAndCreateAdOrder — user-supplied name overrides auto-generated.
 *   4. generateAndCreateAdOrder — 2 parallel calls on the same pair yield
 *      distinct seq values (1 and 2), no P2002 leaks.
 *   5. resolveAdOrderId auto-create path — pair empty then 2 parallel calls
 *      both reuse the SAME id, no seq=2 row is created.
 */

import 'dotenv/config';
import { prisma } from '../src/shared/prisma/client';
import { generateAndCreateAdOrder } from '../src/modules/bff/ad-orders/seq';
import { resolveAdOrderId } from '../src/modules/bff/ad-ids/adId.write.service';

let pass = 0;
let fail = 0;

function assert(cond: unknown, msg: string) {
  if (cond) {
    console.log(`  ok  ${msg}`);
    pass++;
  } else {
    console.error(`  FAIL  ${msg}`);
    fail++;
  }
}

async function pickEmptyPair(): Promise<{ upstreamId: number; adTypeId: number; adTypeCode: string }> {
  const row: { upstreamId: number; adTypeId: number; code: string }[] = await prisma.$queryRawUnsafe(`
    SELECT u."upstreamId", u."adTypeId", t.code
    FROM "UpstreamAdType" u
    JOIN "AdType" t ON t.id = u."adTypeId"
    WHERE NOT EXISTS (
      SELECT 1 FROM "AdOrder" o
      WHERE o."upstreamId" = u."upstreamId" AND o."adTypeId" = u."adTypeId"
    )
    ORDER BY u."upstreamId", u."adTypeId"
    LIMIT 1
  `);
  if (!row[0]) throw new Error('No empty pair available for testing');
  return { upstreamId: row[0].upstreamId, adTypeId: row[0].adTypeId, adTypeCode: row[0].code };
}

async function cleanupPair(upstreamId: number, adTypeId: number) {
  await prisma.adOrder.deleteMany({ where: { upstreamId, adTypeId } });
}

async function testEmptyPairGetsSeq1() {
  console.log('Test 1: empty pair → seq=1, name=CODE-001');
  const pair = await pickEmptyPair();
  try {
    const row = await generateAndCreateAdOrder(prisma, {
      upstreamId: pair.upstreamId,
      adTypeId: pair.adTypeId,
      adTypeCode: pair.adTypeCode,
    });
    assert(row.seq === 1, `seq is 1 (got ${row.seq})`);
    assert(row.name === `${pair.adTypeCode}-001`, `name is ${pair.adTypeCode}-001 (got ${row.name})`);
  } finally {
    await cleanupPair(pair.upstreamId, pair.adTypeId);
  }
}

async function testExistingPairBumpsSeq() {
  console.log('Test 2: pair with seq=3 already → next is 4');
  const pair = await pickEmptyPair();
  try {
    // Seed seq=1, 2, 3
    for (let i = 1; i <= 3; i++) {
      await prisma.adOrder.create({
        data: {
          upstreamId: pair.upstreamId,
          adTypeId: pair.adTypeId,
          seq: i,
          name: `${pair.adTypeCode}-${String(i).padStart(3, '0')}`,
          status: 'active',
        },
      });
    }
    const row = await generateAndCreateAdOrder(prisma, {
      upstreamId: pair.upstreamId,
      adTypeId: pair.adTypeId,
      adTypeCode: pair.adTypeCode,
    });
    assert(row.seq === 4, `seq is 4 (got ${row.seq})`);
    assert(row.name === `${pair.adTypeCode}-004`, `name is ${pair.adTypeCode}-004 (got ${row.name})`);
  } finally {
    await cleanupPair(pair.upstreamId, pair.adTypeId);
  }
}

async function testUserNameOverride() {
  console.log('Test 3: user-supplied name overrides auto-generated');
  const pair = await pickEmptyPair();
  try {
    const row = await generateAndCreateAdOrder(prisma, {
      upstreamId: pair.upstreamId,
      adTypeId: pair.adTypeId,
      adTypeCode: pair.adTypeCode,
      name: 'Summer Campaign',
    });
    assert(row.seq === 1, `seq still 1 (got ${row.seq})`);
    assert(row.name === 'Summer Campaign', `name is "Summer Campaign" (got ${row.name})`);
  } finally {
    await cleanupPair(pair.upstreamId, pair.adTypeId);
  }
}

async function testParallelFormCreates() {
  console.log('Test 4: 2 parallel generateAndCreateAdOrder on same pair → distinct seq');
  const pair = await pickEmptyPair();
  try {
    const [a, b] = await Promise.all([
      generateAndCreateAdOrder(prisma, {
        upstreamId: pair.upstreamId,
        adTypeId: pair.adTypeId,
        adTypeCode: pair.adTypeCode,
      }),
      generateAndCreateAdOrder(prisma, {
        upstreamId: pair.upstreamId,
        adTypeId: pair.adTypeId,
        adTypeCode: pair.adTypeCode,
      }),
    ]);
    const seqs = [a.seq, b.seq].sort();
    assert(seqs[0] === 1 && seqs[1] === 2, `seqs are [1,2] (got [${seqs}])`);
    assert(a.id !== b.id, 'rows have different ids');
  } finally {
    await cleanupPair(pair.upstreamId, pair.adTypeId);
  }
}

async function testParallelAutoCreateReuses() {
  console.log('Test 5: 2 parallel resolveAdOrderId on empty pair → same id, only seq=1 created');
  const pair = await pickEmptyPair();
  try {
    const [idA, idB] = await Promise.all([
      resolveAdOrderId(pair.upstreamId, pair.adTypeCode),
      resolveAdOrderId(pair.upstreamId, pair.adTypeCode),
    ]);
    assert(idA === idB, `both calls got the same id (got ${idA} vs ${idB})`);
    const rows = await prisma.adOrder.findMany({
      where: { upstreamId: pair.upstreamId, adTypeId: pair.adTypeId },
    });
    assert(rows.length === 1, `exactly 1 AdOrder row (got ${rows.length})`);
    assert(rows[0].seq === 1, `seq is 1 (got ${rows[0].seq})`);
    assert(rows[0].name === `${pair.adTypeCode}-001`, `name is ${pair.adTypeCode}-001 (got ${rows[0].name})`);
  } finally {
    await cleanupPair(pair.upstreamId, pair.adTypeId);
  }
}

async function main() {
  try {
    await testEmptyPairGetsSeq1();
    await testExistingPairBumpsSeq();
    await testUserNameOverride();
    await testParallelFormCreates();
    await testParallelAutoCreateReuses();
  } catch (e) {
    console.error('Test runner error:', e);
    fail++;
  } finally {
    await prisma.$disconnect();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

void main();
