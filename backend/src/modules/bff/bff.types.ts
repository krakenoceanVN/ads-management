// BFF shared types — mirrors frontend bffTypes.ts interfaces
// These are used by BFF mappers and controllers

export type EntityStatus = 'active' | 'inactive';
export type EntryType = 'CPM' | 'RATIO' | 'CPA' | 'CPS';
export type DataEntryStatus = 'pending' | 'confirmed';
export type DataEntryStatusParam = DataEntryStatus | 'unconfirmed';
export type ReportStatusParam = 'confirmed' | 'unconfirmed' | 'pending' | 'all';
export type AdTypeCode = string;

export interface BffDataResponse<T> {
  success: true;
  data: T;
  error?: never;
  message?: string;
}

// Advertiser → Upstream
export interface Advertiser {
  id: number;
  name: string;
  contact: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  status: EntityStatus;
  adTypeCode?: string;
}

// Media → AdSite
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
  billingMethod?: EntryType;
  currentUnitPrice?: number;
  currentRatio?: number;
}

// AdOrder → AdOrder
export interface AdOrder {
  id: number;
  advId: number;
  name: string;
  adTypeCode: string;
  notes: string | null;
  status: EntityStatus;
  isVirtual?: boolean;
}

// AdId → AdSite (demand side, CPM)
export interface AdId {
  id: number;
  slot: string;
  type: EntryType;
  rate: number | null;
  status: EntityStatus;
  advertiserId: number;
  advertiserName: string;
  adTypeCode: string;
  adOrderId: number | null;
  upstreamId: number;
  billingMethod: EntryType;
  isActive: boolean;
  isArchived: boolean;
}

// MediaId → AdSiteDownstream junction
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
  upstreamId: number;
  billingMethod: EntryType;
  isActive: boolean;
  isArchived: boolean;
  adSiteId: number;
  downstreamId: number;
}

// Downstream → Downstream
export interface DownstreamDto {
  id: number;
  downstreamType: string;
  adTypeId: number;
  adTypeCode: string;
  payoutRate: number | null;
  status: EntityStatus;
}