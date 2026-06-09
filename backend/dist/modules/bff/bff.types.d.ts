export type EntityStatus = 'active' | 'inactive';
export type EntryType = 'CPM' | 'RATIO' | 'CPA' | 'CPS';
export type StoredEntryType = 'CPM' | 'RATIO' | 'CPA';
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
    id: number;
    name: string;
    contact: string | null;
    phone: string | null;
    email: string | null;
    notes: string | null;
    status: EntityStatus;
    adTypeCode?: string;
    adTypeCodes?: string[];
    adTypes?: Array<{
        id: number;
        code: string;
        name: string;
    }>;
}
export interface Media {
    id: number;
    name: string;
    contact: string | null;
    phone: string | null;
    email: string | null;
    notes: string | null;
    status: EntityStatus;
    upstreamId?: number;
    adTypeCode?: string;
    adTypeName?: string | null;
    billingMethod?: EntryType;
    currentUnitPrice?: number;
    currentRatio?: number;
}
export interface AdOrder {
    id: number;
    advId: number;
    name: string;
    adTypeCode: string;
    adTypeName?: string | null;
    notes: string | null;
    status: EntityStatus;
    isVirtual?: boolean;
}
export interface AdId {
    id: number;
    slot: string;
    type: EntryType;
    rate: number | null;
    notes: string | null;
    status: EntityStatus;
    advertiserId: number;
    advertiserName: string;
    adTypeCode: string;
    adTypeName?: string | null;
    adOrderId: number | null;
    upstreamId: number;
    billingMethod: EntryType;
    isActive: boolean;
    isArchived: boolean;
}
export interface MediaId {
    id: number;
    junctionId: number;
    slot: string;
    type: EntryType;
    rate: number | null;
    shareRatio: number | null;
    status: EntityStatus;
    mediaId: number;
    mediaName: string;
    adTypeCode: string;
    adTypeName?: string | null;
    upstreamId: number;
    billingMethod: EntryType;
    isActive: boolean;
    isArchived: boolean;
    adSiteId: number;
    downstreamId: number;
}
export interface DownstreamDto {
    id: number;
    downstreamType: string;
    adTypeId: number;
    adTypeCode: string;
    adTypeName?: string | null;
    payoutRate: number | null;
    status: EntityStatus;
}
//# sourceMappingURL=bff.types.d.ts.map