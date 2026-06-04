import type { EntityStatus } from '../bff.types';
export interface ListDownstreamsFilters {
    adTypeCode?: string;
    status?: EntityStatus;
    keyword?: string;
}
export declare function listDownstreams(filters?: ListDownstreamsFilters): Promise<import("../bff.types").DownstreamDto[]>;
//# sourceMappingURL=downstream.service.d.ts.map