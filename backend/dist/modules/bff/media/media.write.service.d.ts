import { type EntityStatus } from '../bff.types';
export interface CreateMediaInput {
    name: string;
    contact?: string | null;
    phone?: string | null;
    email?: string | null;
    notes?: string | null;
    status?: EntityStatus;
    upstreamId: number;
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
    upstreamId?: number;
    adTypeCode?: string;
    billingMethod?: string;
    currentUnitPrice?: number | null;
    currentRatio?: number | null;
    isArchived?: boolean;
}
export declare function createMedia(input: CreateMediaInput): Promise<import("../bff.types").Media>;
export declare function updateMedia(id: number, input: UpdateMediaInput): Promise<import("../bff.types").Media>;
export declare function deleteMedia(id: number): Promise<import("../bff.types").Media>;
//# sourceMappingURL=media.write.service.d.ts.map