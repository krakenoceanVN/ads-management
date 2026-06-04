import type { EntityStatus } from '../bff.types';
export interface CreateAdOrderInput {
    advertiserId: number;
    name: string;
    adTypeCode: string;
    notes?: string | null;
    status?: EntityStatus;
}
export interface UpdateAdOrderInput {
    name?: string;
    notes?: string | null;
    status?: EntityStatus;
    advertiserId?: number;
    adTypeCode?: string;
}
export declare function createAdOrder(input: CreateAdOrderInput): Promise<import("../bff.types").AdOrder>;
export declare function updateAdOrder(id: number, input: UpdateAdOrderInput): Promise<import("../bff.types").AdOrder>;
export declare function deleteAdOrder(id: number): Promise<import("../bff.types").AdOrder>;
//# sourceMappingURL=adOrder.write.service.d.ts.map