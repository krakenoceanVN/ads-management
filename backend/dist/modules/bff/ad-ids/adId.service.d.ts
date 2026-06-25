import type { EntryType } from '../bff.types';
export interface ListAdIdsFilters {
    advertiserId?: string | number;
    adTypeId?: string;
    type?: EntryType;
    archived?: boolean;
}
export declare function listAdIds(filters?: ListAdIdsFilters): Promise<import("../bff.types").AdId[]>;
export declare function getAdId(id: string): Promise<import("../bff.types").AdId | null>;
//# sourceMappingURL=adId.service.d.ts.map