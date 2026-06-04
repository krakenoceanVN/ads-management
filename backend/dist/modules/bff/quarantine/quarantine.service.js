"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.quarantineAdvertiser = quarantineAdvertiser;
exports.quarantineMedia = quarantineMedia;
exports.restoreBatch = restoreBatch;
exports.listQuarantineBatches = listQuarantineBatches;
exports.getBatchRecords = getBatchRecords;
const client_1 = require("@prisma/client");
const client_2 = require("../../../shared/prisma/client");
/**
 * Quarantine confirmed DailyInput records for an advertiser (upstream) within a date range.
 * Only quarantines records with status = 'confirmed'.
 * Creates a DailyInputQuarantineBatch and DailyInputQuarantineRecord snapshots for each record.
 * OperationLog is written inside the transaction.
 */
async function quarantineAdvertiser(input) {
    const { advertiserId, startDate, endDate, reason, userId } = input;
    const start = new Date(startDate + 'T00:00:00.000Z');
    const end = new Date(endDate + 'T23:59:59.999Z');
    return client_2.prisma.$transaction(async (tx) => {
        // Find all confirmed DailyInputs for this advertiser within date range
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
        const totalRevenue = confirmedRecords.reduce((sum, r) => sum + (parseFloat(r.revenue.toString()) || 0), 0);
        // Create quarantine batch
        const batch = await tx.dailyInputQuarantineBatch.create({
            data: {
                scopeType: 'advertiser',
                advertiserId,
                startDate: start,
                endDate: end,
                reason: reason ?? null,
                recordCount: confirmedRecords.length,
                totalRevenue: new client_1.Prisma.Decimal(totalRevenue),
                createdBy: userId,
            },
        });
        // Create snapshot records and update DailyInput status
        const snapshotPromises = confirmedRecords.map(async (record) => {
            await tx.dailyInputQuarantineRecord.create({
                data: {
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
        });
        await Promise.all(snapshotPromises);
        // Write OperationLog inside the transaction
        await tx.operationLog.create({
            data: {
                userId,
                username: null, // resolved by caller if needed
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
/**
 * Quarantine confirmed DailyInput records for a media (adSite) within a date range.
 * Same structure as advertiser quarantine.
 */
async function quarantineMedia(input) {
    const { adSiteId, startDate, endDate, reason, userId } = input;
    const start = new Date(startDate + 'T00:00:00.000Z');
    const end = new Date(endDate + 'T23:59:59.999Z');
    return client_2.prisma.$transaction(async (tx) => {
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
        const totalRevenue = confirmedRecords.reduce((sum, r) => sum + (parseFloat(r.revenue.toString()) || 0), 0);
        const batch = await tx.dailyInputQuarantineBatch.create({
            data: {
                scopeType: 'media',
                adSiteId,
                startDate: start,
                endDate: end,
                reason: reason ?? null,
                recordCount: confirmedRecords.length,
                totalRevenue: new client_1.Prisma.Decimal(totalRevenue),
                createdBy: userId,
            },
        });
        const snapshotPromises = confirmedRecords.map(async (record) => {
            await tx.dailyInputQuarantineRecord.create({
                data: {
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
        });
        await Promise.all(snapshotPromises);
        await tx.operationLog.create({
            data: {
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
/**
 * Restore all records in a quarantine batch to their statusBefore.
 * Rejects if batch was already restored (restoredAt IS NOT NULL).
 * OperationLog is written inside the transaction.
 */
async function restoreBatch(batchId, userId) {
    return client_2.prisma.$transaction(async (tx) => {
        // Check batch exists and not already restored
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
        // Restore each record to its statusBefore — but ONLY if it is still
        // quarantined AND still belongs to THIS batch. A record that was
        // re-quarantined into a newer batch must not be touched here, otherwise
        // we would clear the newer batch's link and resurrect a stale status.
        const restoreCounts = await Promise.all(batch.records.map((snapshot) => tx.dailyInput.updateMany({
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
        })));
        const restoredCount = restoreCounts.reduce((sum, r) => sum + r.count, 0);
        // Mark batch as restored
        await tx.dailyInputQuarantineBatch.update({
            where: { id: batchId },
            data: {
                restoredAt: new Date(),
                restoredBy: userId,
            },
        });
        // Write OperationLog inside the transaction
        await tx.operationLog.create({
            data: {
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
/**
 * List all quarantine batches (active and restored).
 */
async function listQuarantineBatches() {
    const batches = await client_2.prisma.dailyInputQuarantineBatch.findMany({
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
/**
 * Get records for a specific quarantine batch.
 */
async function getBatchRecords(batchId) {
    const records = await client_2.prisma.dailyInputQuarantineRecord.findMany({
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
//# sourceMappingURL=quarantine.service.js.map