export type EntityStatus = 'active' | 'inactive';
export type EntryType = 'CPM' | 'CPS' | 'CPA';
export type StoredEntryType = 'CPM' | 'CPS' | 'CPA';
export type DataEntryStatus = 'pending' | 'confirmed';
export declare function normalizeBillingMethodForStorage(type: EntryType | string | undefined): StoredEntryType | undefined;
export type DataEntryStatusParam = DataEntryStatus | 'unconfirmed';
export type ReportStatusParam = 'confirmed' | 'unconfirmed' | 'pending' | 'all';
export type AdTypeCode = string;
export interface BffDataResponse<T> {
    success: true;
    data: T;
    error?: never;
    message?: string;
}
export interface Advertiser {
    id: string;
    name: string;
    contact: string | null;
    phone: string | null;
    email: string | null;
    notes: string | null;
    status: EntityStatus;
    adTypeCode?: string;
    adTypeCodes?: string[];
    adTypes?: Array<{
        id: string;
        name: string;
    }>;
}
export interface Media {
    id: string;
    name: string;
    contact: string | null;
    phone: string | null;
    email: string | null;
    notes: string | null;
    status: EntityStatus;
    upstreamId?: string;
    adTypeCode?: string;
    adTypeName?: string | null;
    billingMethod?: EntryType;
    currentUnitPrice?: number;
    currentRatio?: number;
}
export interface AdId {
    id: string;
    slot: string;
    type: EntryType;
    rate: number | null;
    notes: string | null;
    status: EntityStatus;
    advertiserId: string;
    advertiserName: string;
    adTypeCode: string;
    adTypeName?: string | null;
    upstreamId: string;
    billingMethod: EntryType;
    isActive: boolean;
    isArchived: boolean;
}
export interface MediaId {
    id: string;
    junctionId: string;
    slot: string;
    type: EntryType;
    rate: number | null;
    shareRatio: number | null;
    status: EntityStatus;
    mediaId: string;
    mediaName: string;
    adTypeCode: string;
    adTypeName?: string | null;
    upstreamId: string;
    upstreamName?: string | null;
    downstreamId: string;
    downstreamName?: string | null;
    adSiteId: string;
    adSiteName?: string | null;
    notes: string | null;
    billingMethod: EntryType;
    isActive: boolean;
    isArchived: boolean;
    mediaAdTypeCode?: string | null;
    mediaIdName?: string | null;
    pctHal?: number | null;
}
export interface DownstreamDto {
    id: string;
    downstreamType: string;
    name: string | null;
    contact: string | null;
    phone: string | null;
    email: string | null;
    notes: string | null;
    adTypeIds: string[];
    adTypeCodes: string[];
    adTypes: Array<{
        id: string;
        name: string;
    }>;
    adTypeCode: string;
    adTypeName: string | null;
    payoutRate: number | null;
    status: EntityStatus;
}
export interface MediaAdOrderDto {
    id: string;
    downstreamId: string;
    adTypeId: string;
    adTypeCode: string;
    adTypeName: string | null;
    seq: number;
    name: string;
    notes: string | null;
    status: EntityStatus;
    linkCount?: number;
    createdAt: string;
    updatedAt: string;
}
//# sourceMappingURL=bff.types.d.ts.map