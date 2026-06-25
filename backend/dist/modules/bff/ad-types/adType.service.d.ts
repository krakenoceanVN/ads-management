/**
 * AdType BFF Service
 * Read-only service for listing AdTypes.
 * Write operations (create/update/delete) are in adType.write.service.ts.
 *
 * Per docx mục 1.2: AdType giữ vai trò "đơn quảng cáo của nhà QC".
 */
export interface AdTypeDto {
    id: string;
    name: string;
    upstreamId: string | null;
    upstreamName?: string | null;
    notes: string | null;
    status: string;
    adSiteCount?: number;
    createdAt: string;
    updatedAt: string;
}
export declare function listAdTypes(): Promise<AdTypeDto[]>;
export declare function getAdType(id: string): Promise<AdTypeDto | null>;
//# sourceMappingURL=adType.service.d.ts.map