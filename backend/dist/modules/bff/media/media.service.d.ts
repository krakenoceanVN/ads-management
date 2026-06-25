export interface ListMediaFilters {
    upstreamId?: string;
    adTypeId?: string;
}
export declare function listMedia(filters?: ListMediaFilters): Promise<import("../bff.types").Media[]>;
export declare function getMedia(id: string): Promise<import("../bff.types").Media | null>;
//# sourceMappingURL=media.service.d.ts.map