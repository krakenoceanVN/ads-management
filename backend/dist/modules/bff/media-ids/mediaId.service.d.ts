import type { EntryType } from '../bff.types';
export interface ListMediaIdsFilters {
    mediaId?: string;
    adTypeCode?: string;
    type?: EntryType;
    archived?: boolean;
}
export declare function listMediaIds(filters?: ListMediaIdsFilters): Promise<import("../bff.types").MediaId[]>;
export declare function getMediaId(id: string): Promise<import("../bff.types").MediaId | null>;
//# sourceMappingURL=mediaId.service.d.ts.map