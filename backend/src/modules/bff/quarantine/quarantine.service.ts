/**
 * Phase 5A: Quarantine Service
 *
 * Implements quarantine and restore for DailyInput records.
 * All operations are soft — no hard deletes.
 *
 * Transaction behavior:
 * - Quarantine/restore operations wrap both DailyInput updates AND OperationLog writes
 * - If OperationLog fails inside the transaction, the entire transaction rolls back
 *
 * OperationLog is written AFTER successful quarantine/restore within the same transaction.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../../../shared/prisma/client';
import { generateShortId } from '../../../shared/ids';

export interface QuarantineAdvertiserInput {
  advertiserId: string;
  startDate: string;
  endDate: string;
  reason?: string;
  userId: string;
}

export interface QuarantineMediaInput {
  adSiteId: string;
  startDate: string;
  endDate: string;
  reason?: string;
  userId: string;
}

export interface QuarantineResult {
  batchId: string;
  recordCount: number;
  totalRevenue: number;
}

export interface RestoreResult {
  batchId: string;
  restoredCount: number;
}

export async function quarantineAdvertiser(input: QuarantineAdvertiserInput): Promise<QuarantineResult> {
  const { advertiserId, startDate, endDate, reason, userId } = input;

  const start = new Date(startDate + 'T00:00:00.000Z');
  const end = new Date(endDate + 'T23:59:59.999Z');

  return prisma.$transaction(async (tx) => {
    const confirmedRecords = await tx.dailyInput.findMany({
      where: {
        recordDate: { gte: start, lte: end },
        status: 'confirmed',
        adSite: {
          upstreamId: advertiserId,
        },
      },
      include: {
        adSite: {
          include: { upstream: true },
        },
      },
    });

    if (confirmedRecords.length === 0) {
      throw new Error('No confirmed records found for quarantine');
    }

    const totalRevenue = confirmedRecords.reduce(
      (sum, r) => sum + (parseFloat(r.revenue.toString()) || 0),
      0
    );

    const batch = await tx.dailyInputQuarantineBatch.create({
      data: {
        id: generateShortId(),
        scopeType: 'advertiser',
        advertiserId,
        startDate: start,
        endDate: end,
        reason: reason ?? null,
        recordCount: confirmedRecords.length,
        totalRevenue: new Prisma.Decimal(totalRevenue),
        createdBy: userId,
      },
    });

    for (const record of confirmedRecords) {
      await tx.dailyInputQuarantineRecord.create({
        data: {
          id: generateShortId(),
          batchId: batch.id,
          dailyInputId: record.id,
          statusBefore: record.status,
          revenueSnapshot: record.revenue,
        },
      });

      await tx.dailyInput.update({
        where: { id: record.id },
        data: {
          status: 'quarantined',
          quarantineBatchId: batch.id,
          quarantinedAt: new Date(),
          quarantinedBy: userId,
          quarantineReason: reason ?? null,
        },
      });
    }

    await tx.operationLog.create({
      data: {
        id: generateShortId(),
        userId,
        username: null,
        action: 'QUARANTINE_ADVERTISER',
        module: 'quarantine',
        targetType: 'DailyInputQuarantineBatch',
        targetId: String(batch.id),
        detail: `Quarantined ${confirmedRecords.length} records for advertiserId=${advertiserId}, dateRange=${startDate} to ${endDate}`,
      },
    });

    return {
      batchId: batch.id,
      recordCount: confirmedRecords.length,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
    };
  });
}

export async function quarantineMedia(input: QuarantineMediaInput): Promise<QuarantineResult> {
  const { adSiteId, startDate, endDate, reason, userId } = input;

  const start = new Date(startDate + 'T00:00:00.000Z');
  const end = new Date(endDate + 'T23:59:59.999Z');

  return prisma.$transaction(async (tx) => {
    const confirmedRecords = await tx.dailyInput.findMany({
      where: {
        recordDate: { gte: start, lte: end },
        status: 'confirmed',
        adSiteId,
      },
      include: {
        adSite: {
          include: { upstream: true },
        },
      },
    });

    if (confirmedRecords.length === 0) {
      throw new Error('No confirmed records found for quarantine');
    }

    const totalRevenue = confirmedRecords.reduce(
      (sum, r) => sum + (parseFloat(r.revenue.toString()) || 0),
      0
    );

    const batch = await tx.dailyInputQuarantineBatch.create({
      data: {
        id: generateShortId(),
        scopeType: 'media',
        adSiteId,
        startDate: start,
        endDate: end,
        reason: reason ?? null,
        recordCount: confirmedRecords.length,
        totalRevenue: new Prisma.Decimal(totalRevenue),
        createdBy: userId,
      },
    });

    for (const record of confirmedRecords) {
      await tx.dailyInputQuarantineRecord.create({
        data: {
          id: generateShortId(),
          batchId: batch.id,
          dailyInputId: record.id,
          statusBefore: record.status,
          revenueSnapshot: record.revenue,
        },
      });

      await tx.dailyInput.update({
        where: { id: record.id },
        data: {
          status: 'quarantined',
          quarantineBatchId: batch.id,
          quarantinedAt: new Date(),
          quarantinedBy: userId,
          quarantineReason: reason ?? null,
        },
      });
    }

    await tx.operationLog.create({
      data: {
        id: generateShortId(),
        userId,
        username: null,
        action: 'QUARANTINE_MEDIA',
        module: 'quarantine',
        targetType: 'DailyInputQuarantineBatch',
        targetId: String(batch.id),
        detail: `Quarantined ${confirmedRecords.length} records for adSiteId=${adSiteId}, dateRange=${startDate} to ${endDate}`,
      },
    });

    return {
      batchId: batch.id,
      recordCount: confirmedRecords.length,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
    };
  });
}

export async function restoreBatch(batchId: string, userId: string): Promise<RestoreResult> {
  return prisma.$transaction(async (tx) => {
    const batch = await tx.dailyInputQuarantineBatch.findUnique({
      where: { id: batchId },
      include: { records: true },
    });

    if (!batch) {
      throw new Error('Batch not found');
    }

    if (batch.restoredAt !== null) {
      throw new Error('Batch was already restored');
    }

    if (batch.records.length === 0) {
      throw new Error('Batch has no records to restore');
    }

    const restoreCounts = await Promise.all(
      batch.records.map((snapshot) =>
        tx.dailyInput.updateMany({
          where: {
            id: snapshot.dailyInputId,
            quarantineBatchId: batchId,
            status: 'quarantined',
          },
          data: {
            status: snapshot.statusBefore,
            quarantineBatchId: null,
            quarantinedAt: null,
            quarantinedBy: null,
            quarantineReason: null,
          },
        })
      )
    );
    const restoredCount = restoreCounts.reduce((sum, r) => sum + r.count, 0);

    await tx.dailyInputQuarantineBatch.update({
      where: { id: batchId },
      data: {
        restoredAt: new Date(),
        restoredBy: userId,
      },
    });

    await tx.operationLog.create({
      data: {
        id: generateShortId(),
        userId,
        username: null,
        action: 'RESTORE_QUARANTINE_BATCH',
        module: 'quarantine',
        targetType: 'DailyInputQuarantineBatch',
        targetId: String(batchId),
        detail: `Restored ${restoredCount} of ${batch.records.length} records in batch ${batchId}`,
      },
    });

    return {
      batchId,
      restoredCount,
    };
  });
}

export async function listQuarantineBatches(): Promise<any[]> {
  const batches = await prisma.dailyInputQuarantineBatch.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { records: true } },
    },
  });

  return batches.map(b => ({
    id: b.id,
    scopeType: b.scopeType,
    advertiserId: b.advertiserId,
    adSiteId: b.adSiteId,
    startDate: b.startDate,
    endDate: b.endDate,
    reason: b.reason,
    recordCount: b.recordCount,
    totalRevenue: parseFloat(b.totalRevenue.toString()),
    createdAt: b.createdAt,
    restoredAt: b.restoredAt,
    restoredBy: b.restoredBy,
    isRestored: b.restoredAt !== null,
    recordCount_: b._count.records,
  }));
}

export async function getBatchRecords(batchId: string): Promise<any[]> {
  const records = await prisma.dailyInputQuarantineRecord.findMany({
    where: { batchId },
    include: {
      dailyInput: {
        include: {
          adSite: {
            include: { upstream: true },
          },
        },
      },
    },
    orderBy: { id: 'asc' },
  });

  return records.map(r => ({
    id: r.id,
    batchId: r.batchId,
    dailyInputId: r.dailyInputId,
    statusBefore: r.statusBefore,
    revenueSnapshot: parseFloat(r.revenueSnapshot.toString()),
    recordDate: r.dailyInput.recordDate,
    adSiteName: r.dailyInput.adSite.name,
    advertiserName: r.dailyInput.adSite.upstream.name,
    revenue: parseFloat(r.dailyInput.revenue.toString()),
    currentStatus: r.dailyInput.status,
  }));
}