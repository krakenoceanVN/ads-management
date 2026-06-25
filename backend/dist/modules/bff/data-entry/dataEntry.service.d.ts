import type { AdvertiserEntryRow, MediaEntryRow } from './dataEntry.types';
export interface ListAdvertiserEntriesParams {
    date: string;
    advertiserId?: string | number;
    adTypeId?: string;
    status?: string;
}
export interface ListMediaEntriesParams {
    date: string;
    mediaId?: string | number;
    adTypeId?: string;
    status?: string;
}
export declare function listAdvertiserEntries(params: ListAdvertiserEntriesParams): Promise<AdvertiserEntryRow[]>;
export declare function listMediaEntries(params: ListMediaEntriesParams): Promise<MediaEntryRow[]>;
//# sourceMappingURL=dataEntry.service.d.ts.map