/**
 * Phase 3B/3C: Media Data Entry Write Service (Đợt 2 — read-only coefficient)
 *
 * Media rows no longer write DailyInput. They only persist dataCoefficient
 * and status on MediaDailyInput, keyed by (recordDate, adSiteDownstreamId).
 * Traffic/settlement/rate stay read-only and are derived by the listing
 * service from the advertiser DailyInput + media configuration.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../../../shared/prisma/client';
import type { EntryType } from '../bff.types';

export interface MediaBatchItem {
  adSiteDownstreamId: string;
  recordDate: string;
  dataCoefficient?: number | string | null;
}

export interface MediaBatchResult {
  success: boolean;
  saved: number;
  updated: number;
  skipped: number;
  errors: string[];
}

function normalizeDataCoefficient(raw: unknown): number {
  if (raw === null || raw === undefined) return 1;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    if (raw <= 0) throw new Error('dataCoefficient must be > 0');
    return raw;
  }
  const text = String(raw).trim();
  if (!text) return 1;
  const cleaned = text.replace(/%/g, '').trim();
  if (cleaned === '' || cleaned === '0') return 1;
  const value = Number(cleaned);
  if (!Number.isFinite(value)) throw new Error('dataCoefficient must be numeric');
  if (value <= 0) throw new Error('dataCoefficient must be > 0');
  if (value > 1 && value <= 100) return value / 100;
  return value;
}

function mediaDailyInputId(junctionId: string, recordDate: string): string {
  return `mdi_${junctionId}_${recordDate.replace(/-/g, '')}`;
}

export async function saveMediaBatch(
  items: MediaBatchItem[],
  userId: string
): Promise<MediaBatchResult> {
  const result: MediaBatchResult = { success: true, saved: 0, updated: 0, skipped: 0, errors: [] };

  const junctionIds = [...new Set(items.map(i => String(i.adSiteDownstreamId)))];
  const junctions = junctionIds.length
    ? await prisma.adSiteDownstream.findMany({
        where: { id: { in: junctionIds } },
        select: { id: true },
      })
    : [];
  const junctionIdSet = new Set(junctions.map(j => j.id));

  for (const item of items) {
    try {
      const junctionId = String(item.adSiteDownstreamId);
      if (!junctionIdSet.has(junctionId)) {
        result.skipped++;
        result.errors.push(`AdSiteDownstream ${junctionId} not found`);
        continue;
      }

      const recordDate = new Date(item.recordDate + 'T00:00:00.000Z');
      const dataCoefficient = normalizeDataCoefficient(item.dataCoefficient);
      const id = mediaDailyInputId(junctionId, item.recordDate);

      const existing = await prisma.mediaDailyInput.findUnique({ where: { id } });
      if (existing) {
        if (existing.status === 'confirmed') {
          result.skipped++;
          result.errors.push(`AdSiteDownstream ${junctionId} on ${item.recordDate}: confirmed record cannot be edited`);
          continue;
        }
        if (existing.status === 'quarantined') {
          result.skipped++;
          result.errors.push(`AdSiteDownstream ${junctionId} on ${item.recordDate}: quarantined record cannot be edited`);
          continue;
        }
        await prisma.mediaDailyInput.update({
          where: { id },
          data: {
            dataCoefficient: new Prisma.Decimal(dataCoefficient),
          },
        });
        result.updated++;
      } else {
        await prisma.mediaDailyInput.create({
          data: {
            id,
            recordDate,
            adSiteDownstreamId: junctionId,
            dataCoefficient: new Prisma.Decimal(dataCoefficient),
            status: 'unconfirmed',
            createdBy: userId,
          },
        });
        result.saved++;
      }
    } catch (err: any) {
      result.errors.push(`AdSiteDownstream ${item.adSiteDownstreamId}: ${err.message}`);
    }
  }

  return result;
}

export async function confirmMediaBatch(
  recordDate: string,
  adSiteDownstreamIds: string[],
  userId: string
): Promise<{ success: boolean; confirmed: number; errors: string[] }> {
  const date = new Date(recordDate + 'T00:00:00.000Z');

  return prisma.$transaction(async (tx) => {
    const records = await tx.mediaDailyInput.findMany({
      where: {
        recordDate: date,
        adSiteDownstreamId: { in: adSiteDownstreamIds },
        status: 'unconfirmed',
      },
    });

    if (records.length === 0) {
      return { success: true, confirmed: 0, errors: [] };
    }

    const ids = records.map(r => r.id);
    await tx.mediaDailyInput.updateMany({
      where: { id: { in: ids } },
      data: { status: 'confirmed' },
    });

    await tx.operationLog.create({
      data: {
        id: `opl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        userId: userId || null,
        username: null,
        action: 'CONFIRM_MEDIA_COEF',
        module: 'dataEntry',
        targetType: 'MediaDailyInput',
        targetId: ids.join(','),
        detail: `Confirmed ${ids.length} media coefficient records on ${recordDate} for junctions=${adSiteDownstreamIds.join(',')}`,
      },
    });

    return { success: true, confirmed: ids.length, errors: [] };
  });
}

export async function unconfirmMedia(id: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    const record = await tx.mediaDailyInput.findUnique({ where: { id } });
    if (!record) {
      throw new Error('Record not found');
    }
    if (record.status !== 'confirmed') {
      throw new Error(`Cannot unconfirm: record status is '${record.status}', must be 'confirmed'`);
    }
    const updated = await tx.mediaDailyInput.update({
      where: { id },
      data: { status: 'unconfirmed' },
    });

    await tx.operationLog.create({
      data: {
        id: `opl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        userId: userId || null,
        username: null,
        action: 'UNCONFIRM_MEDIA_COEF',
        module: 'dataEntry',
        targetType: 'MediaDailyInput',
        targetId: String(id),
        detail: `Unconfirmed media coefficient record id=${id}`,
      },
    });

    return { success: true, id: updated.id, previousStatus: 'confirmed', newStatus: updated.status };
  });
}

export type { EntryType };