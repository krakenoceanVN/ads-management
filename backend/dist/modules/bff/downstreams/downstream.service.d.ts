import type { EntityStatus } from '../bff.types';
export interface ListDownstreamsFilters {
    adTypeId?: string;
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
export declare function getDownstreamById(id: string): Promise<import("../bff.types").DownstreamDto | null>;
//# sourceMappingURL=downstream.service.d.ts.map