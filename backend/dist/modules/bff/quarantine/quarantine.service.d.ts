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
export interface QuarantineAdvertiserInput {
    advertiserId: number;
    startDate: string;
    endDate: string;
    reason?: string;
    userId: number;
}
export interface QuarantineMediaInput {
    adSiteId: number;
    startDate: string;
    endDate: string;
    reason?: string;
    userId: number;
}
export interface QuarantineResult {
    batchId: number;
    recordCount: number;
    totalRevenue: number;
}
export interface RestoreResult {
    batchId: number;
    restoredCount: number;
}
/**
 * Quarantine confirmed DailyInput records for an advertiser (upstream) within a date range.
 * Only quarantines records with status = 'confirmed'.
 * Creates a DailyInputQuarantineBatch and DailyInputQuarantineRecord snapshots for each record.
 * OperationLog is written inside the transaction.
 */
export declare function quarantineAdvertiser(input: QuarantineAdvertiserInput): Promise<QuarantineResult>;
/**
 * Quarantine confirmed DailyInput records for a media (adSite) within a date range.
 * Same structure as advertiser quarantine.
 */
export declare function quarantineMedia(input: QuarantineMediaInput): Promise<QuarantineResult>;
/**
 * Restore all records in a quarantine batch to their statusBefore.
 * Rejects if batch was already restored (restoredAt IS NOT NULL).
 * OperationLog is written inside the transaction.
 */
export declare function restoreBatch(batchId: number, userId: number): Promise<RestoreResult>;
/**
 * List all quarantine batches (active and restored).
 */
export declare function listQuarantineBatches(): Promise<any[]>;
/**
 * Get records for a specific quarantine batch.
 */
export declare function getBatchRecords(batchId: number): Promise<any[]>;
//# sourceMappingURL=quarantine.service.d.ts.map