/**
 * AdType BFF Service
 * Read-only service for listing AdTypes.
 * Write operations (create/update/delete) are in adType.write.service.ts.
 */
export interface AdTypeDto {
    id: number;
    code: string;
    name: string;
    createdAt: string;
    updatedAt: string;
}
export declare function listAdTypes(): Promise<AdTypeDto[]>;
export declare function getAdType(id: number): Promise<AdTypeDto | null>;
//# sourceMappingURL=adType.service.d.ts.map