export type EntityStatus = 'active' | 'inactive';
export type EntryType = 'CPM' | 'RATIO' | 'CPA' | 'CPS';

/**
 * Maps UI-facing label to backend API value
 * CPS (user-facing) → RATIO (backend)
 */
export function uiTypeToApiType(type: EntryType): 'CPM' | 'RATIO' | 'CPA' {
    if (type === 'CPS') return 'RATIO';
    return type;
}

/**
 * Maps backend API value to UI-facing label
 * RATIO (backend) → CPS (user-facing)
 */
export function apiTypeToUiType(type: 'CPM' | 'RATIO' | 'CPA'): 'CPM' | 'CPS' | 'CPA' {
    if (type === 'RATIO') return 'CPS';
    return type;
}
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
  adTypeCode?: string;
  adTypeCodes?: string[];
  adTypes?: Array<{ id: number; code: string; name: string }>;
}

export interface CreateAdvertiserInput {
  name: string;
  adTypeCode?: AdTypeCode;
  adTypeCodes?: AdTypeCode[];
  status?: EntityStatus;
  contact?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
}

export interface UpdateAdvertiserInput {
  name?: string;
  adTypeCode?: AdTypeCode;
  adTypeCodes?: AdTypeCode[];
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
  adTypeCode?: string;          // From upstream.adType.code
  adTypeName?: string | null;   // Business display name
  billingMethod?: EntryType;
  currentUnitPrice?: number;
  currentRatio?: number;
}

export interface AdType {
  id: number;
  code: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAdTypeInput {
  code: string;
  name: string;
}

export interface UpdateAdTypeInput {
  code?: string;
  name?: string;
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
  advId: number;
  name: string;
  adTypeCode: string;
  adTypeName?: string | null;
  notes: string | null;
  status: EntityStatus;
  isVirtual?: boolean;
}

export interface ListAdOrdersParams {
  advertiserId?: number;
  adTypeCode?: string;
}

export interface CreateAdOrderInput {
  advertiserId: number;
  adTypeCode: string;
  name: string;
  notes?: string | null;
  status?: EntityStatus;
}

export interface UpdateAdOrderInput {
  name?: string;
  adTypeCode?: string;
  notes?: string | null;
  status?: EntityStatus;
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

export interface ListAdIdsParams {
  advertiserId?: number;
  adOrderId?: number;
  adTypeCode?: AdTypeCode;
  type?: EntryType;
  archived?: boolean;
}

export interface CreateAdIdInput {
  advertiserId: number;
  adOrderId?: number;
  adTypeCode?: string;
  slot: string;
  type: 'CPM' | 'RATIO' | 'CPA';
  unitPrice?: number;
  ratio?: number;
  notes?: string | null;
  status?: EntityStatus;
}

export interface UpdateAdIdInput {
  advertiserId?: number;
  adOrderId?: number | null;
  adTypeCode?: string;
  slot?: string;
  type?: 'CPM' | 'RATIO' | 'CPA';
  unitPrice?: number;
  ratio?: number;
  notes?: string | null;
  status?: EntityStatus;
}

export interface MediaId {
  id: number;
  junctionId: number; // AdSiteDownstream.id — used for edit/delete
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

export interface ListMediaIdsParams {
  mediaId?: number;
  adTypeCode?: AdTypeCode;
  type?: EntryType;
  archived?: boolean;
}

export interface CreateMediaIdInput {
  adSiteId: number;
  downstreamId: number;
  customPrice?: number | null;
  status?: EntityStatus;
}

export interface UpdateMediaIdInput {
  customPrice?: number | null;
  status?: EntityStatus;
}

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

export interface CreateDownstreamInput {
  adTypeCodes: AdTypeCode[];
  downstreamType: string;
  payoutRate?: number;
  status?: EntityStatus;
}

export interface UpdateDownstreamInput {
  downstreamType?: string;
  payoutRate?: number;
  status?: EntityStatus;
  adTypeCodes?: AdTypeCode[];
}

export interface ListDownstreamsParams {
  adTypeCode?: AdTypeCode;
  status?: EntityStatus;
  keyword?: string;
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
  adOrderId: number | null;
  adOrderCode: string | null; // business order code: SM | 360 | BAIDU_JS | OTHER | iqiyi | yolo
  adOrderName?: string | null; // business display name
  type: EntryType;
  adId: string;
  adIdNum: number;
  rate: string;
  traffic: string;
  settlement: string;
  receivable: number | '';
  status: DataEntryStatus;
  // Frontend-only stable key for UI row identity — used even when id=0 (unsaved rows)
  uiKey: string;
}

export interface MediaEntryRow {
  id: number;
  date: string;
  media: string;
  mediaId: number;
  mediaAdOrder: string;
  mediaAdOrderId: number | null;
  mediaAdOrderCode: string | null; // business order code: SM | 360 | BAIDU_JS | OTHER | iqiyi | yolo
  mediaAdOrderName?: string | null; // business display name
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
  // Frontend-only stable key for UI row identity — used even when id=0 (unsaved rows)
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
  advertiserId?: number;
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
  advertiserId: number;
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
  adTypeCode: string | null;
  adTypeName?: string | null;
  totalAmount: number;
  recordCount: number;
}

export interface MediaSettlementRow {
  period: string;
  downstreamName: string | null;
  mediaId: number;
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
  data: OperationLogDto[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  total: number;
}

// ============================================================
// RBAC types
// ============================================================
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

// ---------------------------------------------------------------------------
// Quarantine types
// ---------------------------------------------------------------------------

export type QuarantineScope = 'advertiser' | 'media';

export interface QuarantineParams {
  scope: QuarantineScope;
  advertiserId?: number;
  adSiteId?: number;
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
