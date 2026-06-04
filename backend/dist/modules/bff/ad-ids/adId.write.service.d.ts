import type { EntityStatus, EntryType } from '../bff.types';
export interface CreateAdIdInput {
    advertiserId: number;
    adOrderId?: number;
    adTypeCode?: string;
    slot: string;
    type: EntryType;
    unitPrice?: number | null;
    ratio?: number | null;
    status?: EntityStatus;
}
export interface UpdateAdIdInput {
    advertiserId?: number;
    adOrderId?: number;
    adTypeCode?: string;
    slot?: string;
    type?: EntryType;
    unitPrice?: number | null;
    ratio?: number | null;
    status?: EntityStatus;
}
export declare function createAdId(input: CreateAdIdInput): Promise<import("../bff.types").AdId>;
export declare function updateAdId(id: number, input: UpdateAdIdInput): Promise<import("../bff.types").AdId>;
export declare function deleteAdId(id: number): Promise<import("../bff.types").AdId>;
//# sourceMappingURL=adId.write.service.d.ts.map