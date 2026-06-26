export type EntityStatus = 'active' | 'inactive';
export type EntryType = 'CPM' | 'CPS' | 'CPA';

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
    role: UserRole;
    roleId?: number;
    roleCode?: string;
    roleName?: string;
    permissions?: string[];
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
  adTypeCode?: string; // display label sourced from AdType.name
  adTypeCodes?: string[];
  adTypes?: Array<{ id: string; name: string }>;
}

export interface CreateAdvertiserInput {
  name: string;
  adTypeId?: string;
  adTypeIds?: string[];
  status?: EntityStatus;
  contact?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
}

export interface UpdateAdvertiserInput {
  name?: string;
  adTypeId?: string;
  adTypeIds?: string[];
  status?: EntityStatus;
  contact?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
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

export interface ListMediaParams {
  upstreamId?: number;
  adTypeId?: string;
}

export interface AdType {
  id: string;
  name: string;
  upstreamId: string | null;
  upstreamName?: string | null;
  notes: string | null;
  status: string;
  adSiteCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAdTypeInput {
  name: string;
  upstreamId?: string | null;
  notes?: string | null;
  status?: EntityStatus;
}

export interface UpdateAdTypeInput {
  name?: string;
  upstreamId?: string | null;
  notes?: string | null;
  status?: EntityStatus;
}

export interface CreateMediaInput {
  name: string;
  upstreamId: string | number;
  billingMethod: EntryType;
  status?: EntityStatus;
  currentUnitPrice?: number;
  currentRatio?: number;
}

export interface UpdateMediaInput {
  name?: string;
  upstreamId?: string | number;
  billingMethod?: EntryType;
  status?: EntityStatus;
  currentUnitPrice?: number;
  currentRatio?: number;
}

export interface AdId {
  id: number;
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

export interface ListAdIdsParams {
  advertiserId?: string;
  adTypeId?: string;
  type?: EntryType;
  archived?: boolean;
}

export interface CreateAdIdInput {
  advertiserId: string | number;
  adTypeId?: string;
  slot: string;
  type: 'CPM' | 'CPS' | 'CPA';
  unitPrice?: number;
  ratio?: number;
  notes?: string | null;
  status?: EntityStatus;
}

export interface UpdateAdIdInput {
  advertiserId?: string | number;
  adTypeId?: string;
  slot?: string;
  type?: 'CPM' | 'CPS' | 'CPA';
  unitPrice?: number;
  ratio?: number;
  notes?: string | null;
  status?: EntityStatus;
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
  // Extended fields for "Tạo ID media" form
  mediaAdTypeCode?: string | null;
  mediaIdName?: string | null;
  pctHal?: number | null;
}

export interface MediaAdOrder {
  id: string;
  downstreamId: string;
  adTypeId: string;
  adTypeCode: string; // display label sourced from AdType.name
  adTypeName?: string | null;
  seq: number;
  name: string;
  notes: string | null;
  status: EntityStatus;
  linkCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMediaAdOrderInput {
  downstreamId: string;
  adTypeId: string;
  name?: string | null;
  notes?: string | null;
  status?: EntityStatus;
}

export interface UpdateMediaAdOrderInput {
  downstreamId?: string;
  adTypeId?: string;
  name?: string | null;
  notes?: string | null;
  status?: EntityStatus;
}

export interface ListMediaIdsParams {
  mediaId?: number;
  adTypeId?: string;
  type?: EntryType;
  archived?: boolean;
}

export interface CreateMediaIdInput {
  adSiteId: string;
  downstreamId: string;
  customPrice?: number | null;
  pctHal?: number | null;
  mediaAdTypeId?: string | null;
  mediaIdName?: string | null;
  status?: EntityStatus;
}

export interface UpdateMediaIdInput {
  customPrice?: number | null;
  pctHal?: number | null;
  mediaAdTypeId?: string | null;
  mediaIdName?: string | null;
  status?: EntityStatus;
}

export interface DownstreamDto {
  id: number;
  downstreamType: string;
  name: string | null;
  contact: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  adTypeIds: string[];
  adTypeCodes: string[]; // display labels sourced from AdType.name
  adTypes: Array<{ id: string; name: string }>;
  adTypeCode: string;
  adTypeName: string | null;
  payoutRate: number | null;
  status: EntityStatus;
}

export interface CreateDownstreamInput {
  adTypeIds: string[];
  downstreamType: string;
  name?: string | null;
  contact?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  payoutRate?: number;
  status?: EntityStatus;
}

export interface UpdateDownstreamInput {
  downstreamType?: string;
  name?: string | null;
  contact?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  payoutRate?: number;
  status?: EntityStatus;
  adTypeIds?: string[];
}

export interface ListDownstreamsParams {
  adTypeId?: string;
  status?: EntityStatus;
  keyword?: string;
}

export interface ListAdvertiserEntriesParams {
  date: string;
  advertiserId?: string;
  adTypeId?: string;
  status?: DataEntryStatusParam;
}

export interface ListMediaEntriesParams {
  date: string;
  mediaId?: number;
  adTypeId?: string;
  status?: DataEntryStatusParam;
}

export interface AdvertiserEntryRow {
  id: number;
  date: string;
  advertiser: string;
  advertiserId: string;
  adTypeName: string;
  adTypeCode: string | null;
  type: EntryType;
  adId: string;
  adIdNum: number;
  rate: string;
  traffic: string;
  settlement: string;
  receivable: number | '';
  status: DataEntryStatus;
  uiKey: string;
}

export interface MediaEntryRow {
  id: number;
  date: string;
  media: string;
  mediaId: number;
  mediaAdTypeName: string;
  mediaAdTypeCode: string | null;
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
  uiKey: string;
}

export interface AdvertiserEntryBatchRecord {
  adId: number;
  type: EntryType;
  rate: string;
  traffic: string;
  settlement: string;
  recordDate: string;
  dataCoefficient?: unknown;
}

export interface MediaEntryBatchRecord {
  mediaId: number;
  type: EntryType;
  rate: string;
  traffic: string;
  settlement: string;
  recordDate: string;
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
  confirmed: number;
  errors: string[];
}

export interface UnconfirmEntryResult {
  success: boolean;
  message: string;
  error?: string;
}

export interface AdvertiserReportParams {
  date?: string;
  startDate?: string;
  endDate?: string;
  advertiserId?: string;
  adTypeCode?: AdTypeCode;
  status?: ReportStatusParam;
}

export interface MediaReportParams {
  date?: string;
  startDate?: string;
  endDate?: string;
  mediaId?: number;
  adTypeCode?: AdTypeCode;
  status?: ReportStatusParam;
}

export interface TotalProfitReportParams {
  date?: string;
  startDate?: string;
  endDate?: string;
  adTypeCode?: AdTypeCode;
}

export interface OrderProfitReportParams {
  date?: string;
  startDate?: string;
  endDate?: string;
  adTypeCode?: AdTypeCode;
  billingMethod?: string;
}

export interface TotalProfitReportRow {
  date: string;
  upstream: string;
  upstreamId: number;
  billingMethod: string;
  qty: number;
  revenue: number;
  cost: number;
  grossProfit: number;
  tax: number;
  profit: number;
  profitRate: number;
  recordCount: number;
}

export interface OrderProfitReportRow {
  date: string;
  orderId: number | null;
  orderName: string | null;
  advertiser: string;
  advertiserId: string;
  billingMethod: string;
  adTypeCode: string;
  adTypeName: string;
  qty: number;
  revenue: number;
  cost: number;
  grossProfit: number;
  tax: number;
  profit: number;
  profitRate: number;
  recordCount: number;
}

export interface AdvertiserSettlementParams {
  period: string;
  advertiserId?: string;
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
  advertiserId: string;
  adTypeCode: string | null;
  adTypeName?: string | null;
  totalAmount: number;
  recordCount: number;
}

export interface MediaSettlementRow {
  period: string;
  downstreamName: string | null;
  mediaId: string;
  media: string;
  adTypeCode: string | null;
  adTypeName?: string | null;
  revenue: number;
  cost: number;
  grossProfit: number;
  tax: number;
  profit: number;
  profitRate: number;
  recordCount: number;
}

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
  data: OperationLogDto[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  total: number;
}

export type UserRole = 'ADMIN' | 'EDITOR' | 'VIEWER' | 'SUPER_ADMIN' | 'MANAGER' | 'OPERATOR';

export interface Permission {
  id: number;
  key: string;
  module: string;
  action: string;
  name: string;
  description?: string;
}

export interface Role {
  id: number;
  code: string;
  name: string;
  description?: string;
  isSystem: boolean;
  permissions?: Permission[];
}

export interface UserManagementUser {
  id: number;
  username: string;
  role: UserRole;
  roleId: number;
  roleCode: string;
  roleName: string;
  permissions?: string[];
  perm_data_input: boolean;
  perm_data_confirm: boolean;
  perm_admin: boolean;
  status: EntityStatus;
  last_login_at?: string;
  created_at: string;
}

export interface CreateUserInput {
  username: string;
  password: string;
  roleId: number;
  status?: EntityStatus;
}

export interface UpdateUserInput {
  password?: string;
  roleId?: number;
  status?: EntityStatus;
}

export interface ResetPasswordInput {
  password: string;
}

export interface DependencyCounts {
  adSiteCount: number;
  upstreamCount: number;
  downstreamCount: number;
  adSiteDownstreamCount: number;
  rebateRateCount: number;
  adSiteEventCount: number;
  mediaAdOrderCount: number;
  dailyInputCount: number;
  confirmedCount: number;
  unconfirmedCount: number;
  quarantinedCount: number;
}

export type QuarantineScope = 'advertiser' | 'media';

export interface QuarantineParams {
  scope: QuarantineScope;
  advertiserId?: string;
  adSiteId?: string;
  startDate: string;
  endDate: string;
  reason?: string;
}

export interface QuarantineResult {
  id: number;
  scopeType: string;
  advertiserId: number | null;
  adSiteId: number | null;
  startDate: string;
  endDate: string;
  reason: string | null;
  recordCount: number;
  totalRevenue: string;
  createdBy: number | null;
  createdAt: string;
  restoredAt: string | null;
  restoredBy: number | null;
}