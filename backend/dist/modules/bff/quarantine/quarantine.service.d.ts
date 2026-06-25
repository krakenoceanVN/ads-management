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
export declare function quarantineAdvertiser(input: QuarantineAdvertiserInput): Promise<QuarantineResult>;
export declare function quarantineMedia(input: QuarantineMediaInput): Promise<QuarantineResult>;
export declare function restoreBatch(batchId: string, userId: string): Promise<RestoreResult>;
export declare function listQuarantineBatches(): Promise<any[]>;
export declare function getBatchRecords(batchId: string): Promise<any[]>;
//# sourceMappingURL=quarantine.service.d.ts.map