import type { EntityStatus } from '../bff.types';
export interface CreateAdvertiserInput {
    name: string;
    contact?: string | null;
    phone?: string | null;
    email?: string | null;
    notes?: string | null;
    status?: EntityStatus;
    adTypeId?: string;
    adTypeIds?: string[];
}
export interface UpdateAdvertiserInput {
    name?: string;
    contact?: string | null;
    phone?: string | null;
    email?: string | null;
    notes?: string | null;
    status?: EntityStatus;
    adTypeId?: string;
    adTypeIds?: string[];
}
export declare function createAdvertiser(input: CreateAdvertiserInput): Promise<import("../bff.types").Advertiser>;
export declare function updateAdvertiser(id: string, input: UpdateAdvertiserInput): Promise<import("../bff.types").Advertiser>;
export declare function deleteAdvertiser(id: string): Promise<import("../bff.types").Advertiser>;
//# sourceMappingURL=advertiser.write.service.d.ts.map