/**
 * Downstream BFF Write Service
 * Handles create and update for Downstream (下游).
 * A downstream is a payout channel (ML | LE | YIYI) attached to an AdType.
 */
import type { DownstreamDto } from '../bff.types';
export interface CreateDownstreamInput {
    adTypeId: number;
    downstreamType: string;
    payoutRate?: number;
    status?: string;
}
export interface UpdateDownstreamInput {
    downstreamType?: string;
    payoutRate?: number;
    status?: string;
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