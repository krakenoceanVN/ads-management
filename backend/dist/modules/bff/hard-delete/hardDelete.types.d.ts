/**
 * Phase 3C: Hard Delete Types
 *
 * Shared types for hard delete responses and dependency checks.
 */
export type EntityType = 'advertiser' | 'adType' | 'adId' | 'media' | 'mediaAdOrder' | 'mediaId';
export type HardDeleteSuccess = {
    success: true;
    data: {
        deleted: true;
        entityType: EntityType;
        entityId: string | number;
    };
    message: string;
};
export type HardDeleteNotFound = {
    success: false;
    code: 'NOT_FOUND';
    message: string;
};
export type HardDeleteFinancialBlock = {
    success: false;
    code: 'ENTITY_HAS_FINANCIAL_DATA';
    message: string;
    data: {
        entityType: EntityType;
        entityId: string | number;
        dailyInputCount: number;
        confirmedCount: number;
        unconfirmedCount: number;
        quarantinedCount: number;
        suggestedAction: 'quarantine';
        quarantineTarget?: {
            scope: 'advertiser' | 'media';
            advertiserId?: string;
            adSiteId?: string;
        };
    };
};
export type HardDeleteDependencyBlock = {
    success: false;
    code: 'ENTITY_HAS_DEPENDENCIES';
    message: string;
    data: {
        entityType: EntityType;
        entityId: string | number;
        dependencies: Record<string, number>;
        suggestedAction: 'delete_children_first_or_archive';
    };
};
export type HardDeleteLimitation = {
    success: false;
    code: 'LIMITATION';
    message: string;
};
export type HardDeleteResult = HardDeleteSuccess | HardDeleteNotFound | HardDeleteFinancialBlock | HardDeleteDependencyBlock | HardDeleteLimitation;
export interface DependencyCounts {
    adSiteCount: number;
    upstreamCount: number;
    downstreamCount: number;
    adSiteDownstreamCount: number;
    rebateRateCount: number;
    adSiteEventCount: number;
    mediaAdOrderCount: number;
    dailyInputCount: number;
    confirmedCount: number;
    unconfirmedCount: number;
    quarantinedCount: number;
}
//# sourceMappingURL=hardDelete.types.d.ts.map