/**
 * MediaAdOrder sequence helpers.
 *
 * The (downstreamId, seq) unique index enforces seq uniqueness per Downstream.
 * On P2002 we retry by re-reading max(seq) for the downstream.
 *
 * Concurrency model: Read Committed + unique index + retry-on-P2002.
 * Serializable is intentionally avoided.
 */

import type { PrismaClient } from '@prisma/client';
import type { MediaAdOrder as PrismaMediaAdOrder } from '@prisma/client';
import { ConflictError, BadRequestError } from '../../../shared/errors/AppError';

const SEQ_UNIQUE_COLUMNS = ['downstreamId', 'seq'];
const MAX_ATTEMPTS = 5;

export interface CreateMediaAdOrderInput {
  downstreamId: string;
  adTypeId?: string | null;
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

export async function generateAndCreateMediaAdOrder(
  prisma: PrismaClient,
  input: CreateMediaAdOrderInput
): Promise<PrismaMediaAdOrder> {
  const finalName = (input.name ?? '').trim();
  // Tên do người dùng tự đặt, bắt buộc, không tự sinh.
  if (!finalName) throw new BadRequestError('Tên đơn quảng cáo là bắt buộc');

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const agg = await tx.mediaAdOrder.aggregate({
          where: { downstreamId: input.downstreamId },
          _max: { seq: true },
        });
        const seq = (agg._max.seq ?? 0) + 1;
        // Media ad order name is unique per downstream (Media), not global.
        const dupe = await tx.mediaAdOrder.findFirst({
          where: { name: { equals: finalName, mode: 'insensitive' }, downstreamId: input.downstreamId },
          select: { id: true },
        });
        if (dupe) throw new ConflictError(`Tên đơn quảng cáo '${finalName}' đã tồn tại trong Media này`);
        const { generateShortId } = await import('../../../shared/ids');
        return await tx.mediaAdOrder.create({
          data: {
            id: generateShortId(),
            downstreamId: input.downstreamId,
            adTypeId: input.adTypeId ?? null,
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
