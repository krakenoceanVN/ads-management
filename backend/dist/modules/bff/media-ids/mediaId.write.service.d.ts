import type { EntityStatus } from '../bff.types';
export interface CreateMediaIdInput {
    adSiteId: number;
    downstreamId: number;
    customPrice?: number | null;
}
export interface UpdateMediaIdInput {
    customPrice?: number | null;
    status?: EntityStatus;
}
export declare function createMediaId(input: CreateMediaIdInput): Promise<import("../bff.types").MediaId>;
export declare function updateMediaId(junctionId: number, input: UpdateMediaIdInput): Promise<import("../bff.types").MediaId>;
export declare function deleteMediaId(_junctionId: number): Promise<void>;
//# sourceMappingURL=mediaId.write.service.d.ts.map