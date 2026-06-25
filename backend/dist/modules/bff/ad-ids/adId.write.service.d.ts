import { type EntityStatus, type EntryType } from '../bff.types';
export interface CreateAdIdInput {
    advertiserId: string | number;
    adTypeId?: string;
    slot: string;
    type: EntryType;
    unitPrice?: number | null;
    ratio?: number | null;
    notes?: string | null;
    status?: EntityStatus;
}
export interface UpdateAdIdInput {
    advertiserId?: string | number;
    adTypeId?: string;
    slot?: string;
    type?: EntryType;
    unitPrice?: number | null;
    ratio?: number | null;
    notes?: string | null;
    status?: EntityStatus;
}
export declare function createAdId(input: CreateAdIdInput): Promise<import("../bff.types").AdId>;
export declare function updateAdId(id: string | number, input: UpdateAdIdInput): Promise<import("../bff.types").AdId>;
export declare function deleteAdId(id: string | number): Promise<import("../bff.types").AdId>;
//# sourceMappingURL=adId.write.service.d.ts.map