import type { EntityStatus } from '../bff.types';
export interface CreateAdOrderInput {
    advertiserId: string;
    name?: string | null;
    adTypeCode: string;
    notes?: string | null;
    status?: EntityStatus;
}
export interface UpdateAdOrderInput {
    name?: string;
    notes?: string | null;
    status?: EntityStatus;
    advertiserId?: string;
    adTypeCode?: string;
}
export declare function createAdOrder(input: CreateAdOrderInput): Promise<import("../bff.types").AdOrder>;
export declare function updateAdOrder(id: string, input: UpdateAdOrderInput): Promise<import("../bff.types").AdOrder>;
export declare function deleteAdOrder(id: string): Promise<import("../bff.types").AdOrder>;
//# sourceMappingURL=adOrder.write.service.d.ts.map