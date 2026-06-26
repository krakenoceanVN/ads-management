/**
 * MediaAdOrder sequence helpers.
 *
 * Mirrors ad-orders/seq.ts. The (downstreamId, adTypeId, seq) unique index
 * enforces seq uniqueness per (Downstream, AdType) pair. On P2002 we retry by
 * re-reading max(seq) for the pair.
 *
 * Concurrency model: Read Committed + unique index + retry-on-P2002 (same as
 * ad-orders/seq.ts). Serializable is intentionally avoided.
 */

import type { PrismaClient } from '@prisma/client';
import type { MediaAdOrder as PrismaMediaAdOrder } from '@prisma/client';
import { ConflictError } from '../../../shared/errors/AppError';

const SEQ_UNIQUE_COLUMNS = ['downstreamId', 'adTypeId', 'seq'];
const MAX_ATTEMPTS = 5;

export interface CreateMediaAdOrderInput {
  downstreamId: string;
  adTypeId: string;
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
  return SEQ_UNIQUE_COLUMNS.every(col => targetArr.includes(col));
}

function padSeq(seq: number): string {
  return String(seq).padStart(3, '0');
}

export async function generateAndCreateMediaAdOrder(
  prisma: PrismaClient,
  input: CreateMediaAdOrderInput
): Promise<PrismaMediaAdOrder> {
  const userName = (input.name ?? '').trim();

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const agg = await tx.mediaAdOrder.aggregate({
          where: { downstreamId: input.downstreamId, adTypeId: input.adTypeId },
          _max: { seq: true },
        });
        const seq = (agg._max.seq ?? 0) + 1;
        const adType = await tx.adType.findUnique({ where: { id: input.adTypeId }, select: { name: true } });
        const generatedName = `${adType?.name ?? 'TYPE'}-${padSeq(seq)}`;
        const finalName = userName || generatedName;
        // Tên đơn quảng cáo phải duy nhất toàn hệ thống (không phân biệt hoa/thường).
        const dupe = await tx.mediaAdOrder.findFirst({
          where: { name: { equals: finalName, mode: 'insensitive' } },
          select: { id: true },
        });
        if (dupe) throw new ConflictError(`Tên đơn quảng cáo '${finalName}' đã tồn tại`);
        const { generateShortId } = await import('../../../shared/ids');
        return await tx.mediaAdOrder.create({
          data: {
            id: generateShortId(),
            downstreamId: input.downstreamId,
            adTypeId: input.adTypeId,
            seq,
            name: finalName,
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
  throw new Error('generateAndCreateMediaAdOrder: exhausted retries');
}
