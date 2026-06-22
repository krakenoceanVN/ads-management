/**
 * Downstream BFF Write Service
 * Handles create and update for Downstream (下游).
 * A downstream is a payout channel (ML | LE | YIYI) that owns a set of AdTypes
 * via the DownstreamAdType junction (mirrors UpstreamAdType). Phase-2 dropped
 * the legacy scalar Downstream.adTypeId — the junction is the single source of
 * truth.
 */
import type { DownstreamDto } from '../bff.types';
export interface CreateDownstreamInput {
    adTypeCodes: string[];
    downstreamType: string;
    payoutRate?: number;
    status?: string;
}
export interface UpdateDownstreamInput {
    downstreamType?: string;
    payoutRate?: number;
    status?: string;
    adTypeCodes?: string[];
}
export declare function createDownstream(input: CreateDownstreamInput): Promise<DownstreamDto>;
export declare function updateDownstream(id: number, input: UpdateDownstreamInput): Promise<DownstreamDto>;
export type DeleteDownstreamResult = {
    mode: 'deleted';
    id: number;
} | {
    mode: 'deactivated';
    id: number;
    references: {
        mediaIds: number;
        periods: number;
        dailyRates: number;
    };
};
export declare function deleteDownstream(id: number): Promise<DeleteDownstreamResult>;
//# sourceMappingURL=downstream.write.service.d.ts.map