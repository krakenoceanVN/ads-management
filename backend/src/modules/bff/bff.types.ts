// BFF shared types — mirrors frontend bffTypes.ts interfaces
// These are used by BFF mappers and controllers

export type EntityStatus = 'active' | 'inactive';
export type EntryType = 'CPM' | 'CPC' | 'CPS' | 'CPA';
export type StoredEntryType = 'CPM' | 'CPC' | 'CPS' | 'CPA';
export type DataEntryStatus = 'pending' | 'confirmed';

export function normalizeBillingMethodForStorage(type: EntryType | string | undefined): StoredEntryType | undefined {
  if (type === undefined) return undefined;
  if (type === 'CPM' || type === 'CPC' || type === 'CPS' || type === 'CPA') return type;
  if (type === 'RATIO') return 'CPS';
  return undefined;
}
export type DataEntryStatusParam = DataEntryStatus | 'unconfirmed';
export type ReportStatusParam = 'confirmed' | 'unconfirmed' | 'pending' | 'all';
export type AdTypeCode = string; // Display label (now sourced from AdType.name)

export interface BffDataResponse<T> {
  success: true;
  data: T;
  error?: never;
  message?: string;
}

// Advertiser → Upstream
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
  adTypes?: Array<{ id: string; name: string }>;
}

// Media → AdSite
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

// AdId → AdSite (demand side)
export interface AdId {
  id: string;
  slot: string;
  type: EntryType;
  rate: number | null;
  notes: string | null;
  status: EntityStatus;
  advertiserId: string;
  advertiserName: string;
  adTypeId?: string | null;
  adTypeCode: string;
  adTypeName?: string | null;
  upstreamId: string;
  billingMethod: EntryType;
  isActive: boolean;
  isArchived: boolean;
}

// MediaId → AdSiteDownstream junction
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
  // Extended fields for "Tạo ID media" form (docx §2.3)
  mediaAdOrderId?: string | null;
  mediaAdTypeCode?: string | null;
  mediaIdName?: string | null;
  pctHal?: number | null;
}

// Downstream → Downstream
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
  adTypes: Array<{ id: string; name: string }>;
  adTypeCode: string;
  adTypeName: string | null;
  payoutRate: number | null;
  status: EntityStatus;
  mediaAdOrders?: Array<{ id: string; name: string }>;
}

// MediaAdOrder → MediaAdOrder (per-AdSite ad order)
export interface MediaAdOrderDto {
  id: string;
  downstreamId: string;
  adTypeId: string | null;
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