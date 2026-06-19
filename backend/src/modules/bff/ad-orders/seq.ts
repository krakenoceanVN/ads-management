/**
 * AdOrder sequence helpers.
 *
 * Two distinct paths share the (upstreamId, adTypeId, seq) unique index but
 * differ in retry semantics:
 *
 *   * Form path (`createAdOrder`) — used by the AdOrder management page.
 *     Always creates a new row. Retry on P2002 = re-read max(seq) and bump.
 *     Multiple AdOrder per pair are allowed by business rule.
 *
 *   * Auto-create path (`resolveAdOrderId` in adId.write.service.ts) — used
 *     when an AdSite is created for a pair that has no AdOrder yet. Retry
 *     on P2002 = re-run findFirst, reuse the row another request just made.
 *     This path is implemented in-place, NOT via this helper, because its
 *     retry semantics are different (reuse vs. create).
 *
 * Concurrency model: Read Committed isolation + the unique index on
 * (upstreamId, adTypeId, seq) + retry-on-P2002. Serializable is not used
 * because it would surface as P2034 (transaction conflict) and force a
 * second retry layer for no real benefit on this workload.
 *
 * Unique-index check on P2002: Prisma's error.meta.target reports the index
 * name. We only retry when the violating index is the seq one, so we never
 * accidentally swallow a different unique violation.
 */

import type { PrismaClient } from '@prisma/client';
import type { AdOrder as PrismaAdOrder } from '@prisma/client';

const SEQ_UNIQUE_COLUMNS = ['upstreamId', 'adTypeId', 'seq'];
const MAX_ATTEMPTS = 5;

export interface CreateAdOrderInput {
  upstreamId: number;
  adTypeId: number;
  /** adType.code — used to compose the default name `{code}-{seq padded 3}`. */
  adTypeCode: string;
  /** User-supplied name. Empty/whitespace = backend auto-generates. */
  name?: string | null;
  notes?: string | null;
  status?: 'active' | 'inactive';
}

function isSeqUniqueViolation(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false;
  const err = e as { code?: string; meta?: { target?: string | string[] } };
  if (err.code !== 'P2002') return false;
  const target = err.meta?.target;
  const targetArr = Array.isArray(target) ? target : typeof target === 'string' ? [target] : [];
  // Prisma reports the columns of the unique index in `target`. We accept any
  // violation that touches the (upstreamId, adTypeId, seq) tuple.
  return SEQ_UNIQUE_COLUMNS.every(col => targetArr.includes(col));
}

function padSeq(seq: number): string {
  return String(seq).padStart(3, '0');
}

/**
 * Atomically compute the next per-pair seq and create the AdOrder.
 *
 * Each attempt: read MAX(seq) for the pair, compute next, INSERT, all in a
 * single transaction. If the unique index rejects the INSERT because a
 * concurrent caller just claimed the same seq, retry up to MAX_ATTEMPTS
 * times.
 *
 * If the user supplied a non-empty `name`, it is used verbatim and overrides
 * the auto-generated name. Otherwise the name is `${adTypeCode}-${seq}`.
 */
export async function generateAndCreateAdOrder(
  prisma: PrismaClient,
  input: CreateAdOrderInput
): Promise<PrismaAdOrder> {
  const userName = (input.name ?? '').trim();

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const agg = await tx.adOrder.aggregate({
          where: { upstreamId: input.upstreamId, adTypeId: input.adTypeId },
          _max: { seq: true },
        });
        const seq = (agg._max.seq ?? 0) + 1;
        const generatedName = `${input.adTypeCode}-${padSeq(seq)}`;
        return await tx.adOrder.create({
          data: {
            upstreamId: input.upstreamId,
            adTypeId: input.adTypeId,
            seq,
            name: userName || generatedName,
            notes: input.notes ?? null,
            status: input.status ?? 'active',
          },
        });
      });
    } catch (e) {
      if (isSeqUniqueViolation(e) && attempt < MAX_ATTEMPTS - 1) {
        continue;
      }
      throw e;
    }
  }
  throw new Error('generateAndCreateAdOrder: exhausted retries');
}
