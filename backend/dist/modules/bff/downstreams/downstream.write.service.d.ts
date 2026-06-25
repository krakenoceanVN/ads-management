/**
 * Downstream BFF Write Service
 * Handles create and update for Downstream (下游).
 * A downstream is a payout channel (ML | LE | YIYI) that owns a set of AdTypes
 * via the DownstreamAdType junction. payoutRate is now stored on
 * DownstreamPeriod (per-period), not on Downstream itself.
 */
import type { DownstreamDto } from '../bff.types';
export interface CreateDownstreamInput {
    adTypeIds: string[];
    downstreamType: string;
    name?: string | null;
    contact?: string | null;
    phone?: string | null;
    email?: string | null;
    notes?: string | null;
    payoutRate?: number;
    status?: string;
}
export interface UpdateDownstreamInput {
    downstreamType?: string;
    name?: string | null;
    contact?: string | null;
    phone?: string | null;
    email?: string | null;
    notes?: string | null;
    payoutRate?: number;
    status?: string;
    adTypeIds?: string[];
}
export declare function createDownstream(input: CreateDownstreamInput): Promise<DownstreamDto>;
export declare function updateDownstream(id: string, input: UpdateDownstreamInput): Promise<DownstreamDto>;
export type DeleteDownstreamResult = {
    mode: 'deleted';
    id: string;
} | {
    mode: 'deactivated';
    id: string;
    references: {
        mediaIds: number;
        periods: number;
        dailyRates: number;
    };
};
export declare function deleteDownstream(id: string): Promise<DeleteDownstreamResult>;
//# sourceMappingURL=downstream.write.service.d.ts.map