// BFF shared types — mirrors frontend bffTypes.ts interfaces
// These are used by BFF mappers and controllers

export type EntityStatus = 'active' | 'inactive';
export type EntryType = 'CPM' | 'CPS' | 'CPA';
export type StoredEntryType = 'CPM' | 'CPS' | 'CPA';
export type DataEntryStatus = 'pending' | 'confirmed';

/**
 * Canonicalizes an incoming billing-method value before persisting.
 *
 * The DB now stores a single canonical value per method. The legacy
 * 'RATIO' literal is still accepted here (for old imports / partner systems
 * that may still send it) and mapped to 'CPS' — never persisted as RATIO.
 *
 * Anything not in {CPM, CPS, CPA, RATIO} is rejected with `undefined`.
 */
export function normalizeBillingMethodForStorage(type: EntryType | string | undefined): StoredEntryType | undefined {
  if (type === undefined) return undefined;
  if (type === 'CPM' || type === 'CPS' || type === 'CPA') return type;
  if (type === 'RATIO') return 'CPS'; // legacy alias from old data
  return undefined;
}
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
  adTypeCodes?: string[];
  adTypes?: Array<{ id: number; code: string; name: string }>;
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
  adOrderId?: number | null;
  adTypeCode?: string;
  adTypeName?: string | null;
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
  adTypeName?: string | null;
  notes: string | null;
  status: EntityStatus;
  isVirtual?: boolean;
  advertiserName?: string;
  adSiteCount: number;
  billingMethods: string[];
  createdAt?: string;
}

// AdId → AdSite (demand side, CPM)
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
  adTypeName?: string | null;
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
  adTypeIds: number[];
  adTypeCodes: string[];
  adTypes: Array<{ id: number; code: string; name: string }>;
  adTypeCode: string;
  adTypeName: string | null;
  payoutRate: number | null;
  status: EntityStatus;
}