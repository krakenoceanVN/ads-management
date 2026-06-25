import { type EntityStatus } from '../bff.types';
export interface CreateMediaInput {
    name: string;
    contact?: string | null;
    phone?: string | null;
    email?: string | null;
    notes?: string | null;
    status?: EntityStatus;
    upstreamId: string;
    billingMethod?: string;
    currentUnitPrice?: number | null;
    currentRatio?: number | null;
}
export interface UpdateMediaInput {
    name?: string;
    contact?: string | null;
    phone?: string | null;
    email?: string | null;
    notes?: string | null;
    status?: EntityStatus;
    upstreamId?: string;
    adTypeCode?: string;
    billingMethod?: string;
    currentUnitPrice?: number | null;
    currentRatio?: number | null;
    isArchived?: boolean;
}
export declare function createMedia(input: CreateMediaInput): Promise<import("../bff.types").Media>;
export declare function updateMedia(id: string, input: UpdateMediaInput): Promise<import("../bff.types").Media>;
export declare function deleteMedia(id: string): Promise<import("../bff.types").Media>;
//# sourceMappingURL=media.write.service.d.ts.map