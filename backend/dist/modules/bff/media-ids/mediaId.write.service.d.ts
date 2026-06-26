import type { EntityStatus } from '../bff.types';
export interface CreateMediaIdInput {
    adSiteId: string;
    downstreamId: string;
    customPrice?: number | null;
    pctHal?: number | null;
    mediaAdTypeId?: string | null;
    mediaIdName?: string | null;
    status?: EntityStatus;
}
export interface UpdateMediaIdInput {
    customPrice?: number | null;
    pctHal?: number | null;
    mediaAdTypeId?: string | null;
    mediaIdName?: string | null;
    status?: EntityStatus;
}
export declare function createMediaId(input: CreateMediaIdInput): Promise<import("../bff.types").MediaId>;
export declare function updateMediaId(junctionId: string, input: UpdateMediaIdInput): Promise<import("../bff.types").MediaId>;
export declare function deleteMediaId(_junctionId: string): Promise<void>;
//# sourceMappingURL=mediaId.write.service.d.ts.map