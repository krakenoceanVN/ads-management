import type { EntryType } from '../bff.types';
export interface ListAdIdsFilters {
    advertiserId?: number;
    adOrderId?: number;
    adTypeCode?: string;
    type?: EntryType;
    archived?: boolean;
}
export declare function listAdIds(filters?: ListAdIdsFilters): Promise<import("../bff.types").AdId[]>;
export declare function getAdId(id: number): Promise<import("../bff.types").AdId | null>;
//# sourceMappingURL=adId.service.d.ts.map