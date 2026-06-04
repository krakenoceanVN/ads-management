import type { EntityStatus } from '../bff.types';
export interface CreateAdvertiserInput {
    name: string;
    contact?: string | null;
    phone?: string | null;
    email?: string | null;
    notes?: string | null;
    status?: EntityStatus;
    adTypeCode: string;
}
export interface UpdateAdvertiserInput {
    name?: string;
    contact?: string | null;
    phone?: string | null;
    email?: string | null;
    notes?: string | null;
    status?: EntityStatus;
    adTypeCode?: string;
}
export declare function createAdvertiser(input: CreateAdvertiserInput): Promise<import("../bff.types").Advertiser>;
export declare function updateAdvertiser(id: number, input: UpdateAdvertiserInput): Promise<import("../bff.types").Advertiser>;
export declare function deleteAdvertiser(id: number): Promise<import("../bff.types").Advertiser>;
//# sourceMappingURL=advertiser.write.service.d.ts.map