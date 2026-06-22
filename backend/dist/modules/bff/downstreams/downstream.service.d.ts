import type { EntityStatus } from '../bff.types';
export interface ListDownstreamsFilters {
    adTypeCode?: string;
    status?: EntityStatus;
    keyword?: string;
}
export declare const downstreamInclude: {
    adTypeLinks: {
        include: {
            adType: boolean;
        };
        orderBy: {
            adTypeId: "asc";
        };
    };
};
export declare function listDownstreams(filters?: ListDownstreamsFilters): Promise<import("../bff.types").DownstreamDto[]>;
export declare function getDownstreamById(id: number): Promise<import("../bff.types").DownstreamDto | null>;
//# sourceMappingURL=downstream.service.d.ts.map