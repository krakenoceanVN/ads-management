export type EntityStatus = 'active' | 'inactive';
export type EntryType = 'CPM' | 'RATIO';
export type DataEntryStatus = 'pending' | 'confirmed';
export type DataEntryStatusParam = DataEntryStatus | 'unconfirmed';
export type ReportStatusParam = 'confirmed' | 'unconfirmed' | 'pending' | 'all';
export type AdTypeCode = string;

export interface BffDataResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  message?: string;
}

export interface BffMutationResponse {
  success: boolean;
  message?: string;
  error?: string;
  deactivated?: boolean;
  archived?: boolean;
}

export interface LoginInput {
  username: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  token?: string;
  user?: {
    id: number;
    username: string;
    role: string;
    perm_data_input: boolean;
    perm_data_confirm: boolean;
    perm_admin: boolean;
    status: string;
  };
  error?: string;
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
}

export interface CreateAdvertiserInput {
  name: string;
  adTypeCode: AdTypeCode;
  status?: EntityStatus;
}

export interface UpdateAdvertiserInput {
  name?: string;
  adTypeCode?: AdTypeCode;
  status?: EntityStatus;
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
  billingMethod?: EntryType;
}

export interface CreateMediaInput {
  name: string;
  upstreamId: number;
  billingMethod: EntryType;
  status?: EntityStatus;
  currentUnitPrice?: number;
  currentRatio?: number;
}

export interface UpdateMediaInput {
  name?: string;
  upstreamId?: number;
  billingMethod?: EntryType;
  status?: EntityStatus;
  currentUnitPrice?: number;
  currentRatio?: number;
}

export interface AdOrder {
  id: number;
  advId: number | null;
  name: string;
  adTypeCode: string;
  notes: string | null;
}

export interface ListAdOrdersParams {
  advId?: number;
}

export interface AdId {
  id: number;
  slot: string;
  type: EntryType;
  rate: number | null;
  status: EntityStatus;
  advertiserId: number;
  advertiserName: string;
  adTypeCode: string;
  upstreamId: number;
  billingMethod: EntryType;
  isActive: boolean;
  isArchived: boolean;
}

export interface ListAdIdsParams {
  advertiserId?: number;
  adTypeCode?: AdTypeCode;
  type?: EntryType;
  archived?: boolean;
}

export interface MediaId {
  id: number;
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
}

export interface ListMediaIdsParams {
  mediaId?: number;
  adTypeCode?: AdTypeCode;
  type?: EntryType;
  archived?: boolean;
}

export interface ListAdvertiserEntriesParams {
  date: string;
  advertiserId?: number;
  adTypeCode?: AdTypeCode;
  status?: DataEntryStatusParam;
}

export interface ListMediaEntriesParams {
  date: string;
  mediaId?: number;
  adTypeCode?: AdTypeCode;
  status?: DataEntryStatusParam;
}

export interface AdvertiserEntryRow {
  id: number;
  date: string;
  advertiser: string;
  advertiserId: number;
  adOrder: string;
  adOrderId: number;
  type: EntryType;
  adId: string;
  adIdNum: number;
  rate: string;
  traffic: string;
  settlement: string;
  receivable: number | '';
  status: DataEntryStatus;
}

export interface MediaEntryRow {
  id: number;
  date: string;
  media: string;
  mediaId: number;
  mediaAdOrder: string;
  mediaAdOrderId: number;
  type: EntryType;
  mediaIdStr: string;
  upstreamAdId: string;
  upstreamAdIdNum: number;
  rate: string;
  traffic: string;
  settlement: string;
  dataCoefficient: string;
  receivable: number | '';
  shareRatio: string;
  shareRatioNum: number | null;
  actualReceived: number | null;
  status: DataEntryStatus;
}

export interface AdvertiserEntryBatchRecord {
  adId: number;
  type: EntryType;
  rate: string;
  traffic: string;
  settlement: string;
  dataCoefficient?: unknown;
}

export interface MediaEntryBatchRecord {
  mediaId: number;
  type: EntryType;
  rate: string;
  traffic: string;
  settlement: string;
  dataCoefficient?: unknown;
}

export interface SaveAdvertiserEntryBatchPayload {
  date: string;
  adTypeCode: AdTypeCode;
  records: AdvertiserEntryBatchRecord[];
}

export interface SaveMediaEntryBatchPayload {
  date: string;
  adTypeCode: AdTypeCode;
  records: MediaEntryBatchRecord[];
}

export interface SaveEntryBatchResult {
  success: boolean;
  saved: number;
  errors: Array<{
    ad_site_id: number;
    message: string;
  }>;
}

export interface ConfirmEntryBatchResult {
  success: boolean;
  updated: number;
  error?: string;
}

export interface UnconfirmEntryResult {
  success: boolean;
  message: string;
  error?: string;
}

export interface AdvertiserReportParams {
  date: string;
  advertiserId?: number;
  adTypeCode?: AdTypeCode;
  status?: ReportStatusParam;
}

export interface MediaReportParams {
  date: string;
  mediaId?: number;
  adTypeCode?: AdTypeCode;
  status?: ReportStatusParam;
}

export interface TotalProfitReportParams {
  date: string;
  adTypeCode?: AdTypeCode;
}

export interface OrderProfitReportParams {
  date: string;
  adTypeCode?: AdTypeCode;
}

export interface TotalProfitReportRow {
  date: string;
  revenue: number;
  ml_payout: number;
  le_payout?: number;
  yiyi_payout?: number;
  cost: number;
  tax: number;
  profit: number;
  profit_rate: number;
}

export interface OrderProfitReportRow {
  advertiser: string;
  advertiserId: number;
  adTypeCode: string;
  adTypeName: string;
  totalRevenue: number;
  totalQty: number;
  recordCount: number;
}

export interface AdvertiserSettlementParams {
  period: string;
  advertiserId?: number;
  adTypeCode?: AdTypeCode;
}

export interface MediaSettlementParams {
  period: string;
  mediaId?: number;
  adTypeCode?: AdTypeCode;
}

export interface AdvertiserSettlementRow {
  period: string;
  advertiser: string;
  advertiserId: number;
  adTypeCode: string;
  adTypeName: string;
  amount: number;
  recordCount: number;
}

export interface MediaSettlementRow {
  period: string;
  media: string;
  mediaId: number;
  adTypeCode: string;
  adTypeName: string;
  receivable: number;
  actualReceived: number;
  shareRatio: number | null;
  recordCount: number;
}

// ============================================================
// Operation Log types
// ============================================================
export interface OperationLogDto {
  id: number;
  userId: number | null;
  username: string | null;
  action: string;
  module: string;
  targetType: string | null;
  targetId: string | null;
  detail: string | null;
  createdAt: string;
}

export interface ListOperationLogsParams {
  startDate?: string;
  endDate?: string;
  keyword?: string;
  module?: string;
  action?: string;
  page?: number;
  pageSize?: number;
}

export interface OperationLogResponse {
  items: OperationLogDto[];
  total: number;
  page: number;
  pageSize: number;
}
