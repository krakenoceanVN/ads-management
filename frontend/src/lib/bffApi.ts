import type {
  AdId,
  AdOrder,
  Advertiser,
  AdvertiserEntryRow,
  AdvertiserReportParams,
  AdvertiserSettlementParams,
  AdvertiserSettlementRow,
  AdType,
  BffDataResponse,
  BffMutationResponse,
  ConfirmEntryBatchResult,
  CreateAdIdInput,
  CreateAdOrderInput,
  CreateAdvertiserInput,
  CreateDownstreamInput,
  CreateMediaInput,
  CreateMediaIdInput,
  CreateUserInput,
  DownstreamDto,
  ListAdIdsParams,
  ListAdOrdersParams,
  ListAdvertiserEntriesParams,
  ListDownstreamsParams,
  ListMediaEntriesParams,
  ListMediaIdsParams,
  ListOperationLogsParams,
  LoginInput,
  LoginResponse,
  Media,
  MediaEntryRow,
  MediaId,
  MediaReportParams,
  MediaSettlementParams,
  MediaSettlementRow,
  OperationLogResponse,
  OrderProfitReportParams,
  OrderProfitReportRow,
  Permission,
  QuarantineParams,
  QuarantineResult,
  ResetPasswordInput,
  Role,
  SaveAdvertiserEntryBatchPayload,
  SaveEntryBatchResult,
  SaveMediaEntryBatchPayload,
  TotalProfitReportParams,
  TotalProfitReportRow,
  UnconfirmEntryResult,
  UpdateAdIdInput,
  UpdateAdOrderInput,
  UpdateAdvertiserInput,
  UpdateDownstreamInput,
  UpdateMediaInput,
  UpdateMediaIdInput,
  UpdateUserInput,
  UserManagementUser,
} from './bffTypes';
import { uiTypeToApiType, apiTypeToUiType, type EntryType } from './bffTypes';

export const BFF_AUTH_TOKEN_STORAGE_KEY = 'token';
export const BFF_AUTH_TOKEN_INVALID_EVENT = 'bff-auth-token-invalid';
export const BFF_AUTH_TOKEN_CHANGED_EVENT = 'bff-auth-token-changed';

type QueryValue = string | number | boolean | null | undefined;

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  params?: object;
  body?: unknown;
};

const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
const API_BASE_URL = (env?.VITE_API_URL ?? '').replace(/\/+$/, '');

export class BffApiError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = 'BffApiError';
    this.status = status;
    this.payload = payload;
  }
}

export function getAuthToken() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(BFF_AUTH_TOKEN_STORAGE_KEY);
}

export function clearAuthToken() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(BFF_AUTH_TOKEN_STORAGE_KEY);
  window.dispatchEvent(new Event(BFF_AUTH_TOKEN_INVALID_EVENT));
}

export function getUsernameFromToken(): string {
  try {
    const token = getAuthToken();
    if (!token) return "Admin";
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.username || "Admin";
  } catch {
    return "Admin";
  }
}

function normalizeQueryValue(value: QueryValue) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'boolean') return value ? '1' : '0';
  return String(value);
}

function buildUrl(path: string, params?: object) {
  const pathname = path.startsWith('/') ? path : `/${path}`;
  const searchParams = new URLSearchParams();

  if (params) {
    Object.entries(params as Record<string, QueryValue>).forEach(([key, value]) => {
      const normalized = normalizeQueryValue(value);
      if (normalized !== null) searchParams.set(key, normalized);
    });
  }

  const queryString = searchParams.toString();
  return `${API_BASE_URL}${pathname}${queryString ? `?${queryString}` : ''}`;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers();
  const token = getAuthToken();

  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body !== undefined) headers.set('Content-Type', 'application/json');

  const response = await fetch(buildUrl(path, options.params), {
    method: options.method ?? 'GET',
    headers,
    credentials: 'include',
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const rawError = payload && typeof payload === 'object'
      ? ((payload as Record<string,unknown>).error ?? (payload as Record<string,unknown>).message)
      : null;
    const errorMessage = typeof rawError === 'string' ? rawError : response.statusText;
    if (response.status === 401 && path.startsWith('/api/bff/')) {
      clearAuthToken();
    }
    throw new BffApiError(errorMessage, response.status, payload);
  }

  return payload as T;
}

function unwrapData<T>(response: BffDataResponse<T>) {
  return response.data;
}

export async function login(data: LoginInput): Promise<{ token: string; user: LoginResponse['user']; error?: string }> {
  // Backend returns BffDataResponse<LoginResponse>: { success, data: { token, user } }
  // Support legacy flat shape too: { success, token, user }
  const raw = await request<{ success: boolean; data?: unknown; token?: string; user?: unknown; error?: string }>('/api/auth/login', {
    method: 'POST',
    body: data,
  });
  if (raw.data && typeof raw.data === 'object') {
    const d = raw.data as { token?: string; user?: LoginResponse['user'] };
    if (d.token) return { token: d.token, user: d.user };
  }
  // Legacy flat shape
  if (raw.token) return { token: raw.token, user: raw.user as LoginResponse['user'] };
  // Server returned success:false with error message
  return { token: '', user: undefined, error: raw.error };
}

export async function listAdvertisers() {
  return unwrapData(await request<BffDataResponse<Advertiser[]>>('/api/bff/advertisers'));
}

export async function getAdvertiser(id: number) {
  return unwrapData(await request<BffDataResponse<Advertiser>>(`/api/bff/advertisers/${id}`));
}

export async function createAdvertiser(data: CreateAdvertiserInput) {
  return unwrapData(await request<BffDataResponse<Advertiser>>('/api/bff/advertisers', {
    method: 'POST',
    body: data,
  }));
}

export async function updateAdvertiser(id: number, data: UpdateAdvertiserInput) {
  return unwrapData(await request<BffDataResponse<Advertiser>>(`/api/bff/advertisers/${id}`, {
    method: 'PUT',
    body: data,
  }));
}

export async function deleteAdvertiser(id: number) {
  return request<BffMutationResponse>(`/api/bff/advertisers/${id}`, { method: 'DELETE' });
}

export async function listMedia() {
  return unwrapData(await request<BffDataResponse<Media[]>>('/api/bff/media'));
}

export async function getMedia(id: number) {
  return unwrapData(await request<BffDataResponse<Media>>(`/api/bff/media/${id}`));
}

export async function createMedia(data: CreateMediaInput) {
  return unwrapData(await request<BffDataResponse<Media>>('/api/bff/media', {
    method: 'POST',
    body: data,
  }));
}

export async function updateMedia(id: number, data: UpdateMediaInput) {
  return unwrapData(await request<BffDataResponse<Media>>(`/api/bff/media/${id}`, {
    method: 'PUT',
    body: data,
  }));
}

export async function deleteMedia(id: number) {
  return request<BffMutationResponse>(`/api/bff/media/${id}`, { method: 'DELETE' });
}

export async function listAdOrders(params?: ListAdOrdersParams) {
  return unwrapData(await request<BffDataResponse<AdOrder[]>>('/api/bff/ad-orders', { params }));
}

export async function getAdOrder(id: number) {
  return unwrapData(await request<BffDataResponse<AdOrder>>(`/api/bff/ad-orders/${id}`));
}

export async function createAdOrder(data: CreateAdOrderInput) {
  return unwrapData(await request<BffDataResponse<AdOrder>>('/api/bff/ad-orders', {
    method: 'POST',
    body: data,
  }));
}

export async function updateAdOrder(id: number, data: UpdateAdOrderInput) {
  return unwrapData(await request<BffDataResponse<AdOrder>>(`/api/bff/ad-orders/${id}`, {
    method: 'PUT',
    body: data,
  }));
}

export async function deleteAdOrder(id: number) {
  return request<BffMutationResponse>(`/api/bff/ad-orders/${id}`, { method: 'DELETE' });
}

export async function listAdIds(params?: ListAdIdsParams) {
  return unwrapData(await request<BffDataResponse<AdId[]>>('/api/bff/ad-ids', { params }));
}

export async function getAdId(id: number) {
  return unwrapData(await request<BffDataResponse<AdId>>(`/api/bff/ad-ids/${id}`));
}

export async function createAdId(data: CreateAdIdInput) {
  return unwrapData(await request<BffDataResponse<AdId>>('/api/bff/ad-ids', {
    method: 'POST',
    body: data,
  }));
}

export async function updateAdId(id: number, data: UpdateAdIdInput) {
  return unwrapData(await request<BffDataResponse<AdId>>(`/api/bff/ad-ids/${id}`, {
    method: 'PUT',
    body: data,
  }));
}

export async function deleteAdId(id: number) {
  return request<BffMutationResponse>(`/api/bff/ad-ids/${id}`, { method: 'DELETE' });
}

export async function listMediaIds(params?: ListMediaIdsParams) {
  return unwrapData(await request<BffDataResponse<MediaId[]>>('/api/bff/media-ids', { params }));
}

export async function getMediaId(id: number) {
  return unwrapData(await request<BffDataResponse<MediaId>>(`/api/bff/media-ids/${id}`));
}

export async function createMediaId(data: CreateMediaIdInput) {
  return unwrapData(await request<BffDataResponse<MediaId>>('/api/bff/media-ids', {
    method: 'POST',
    body: data,
  }));
}

export async function updateMediaId(id: number, data: UpdateMediaIdInput) {
  return unwrapData(await request<BffDataResponse<MediaId>>(`/api/bff/media-ids/${id}`, {
    method: 'PUT',
    body: data,
  }));
}

export async function deleteMediaId(id: number) {
  return request<BffMutationResponse>(`/api/bff/media-ids/${id}`, { method: 'DELETE' });
}

export async function listDownstreams(params?: ListDownstreamsParams) {
  return unwrapData(await request<BffDataResponse<DownstreamDto[]>>('/api/bff/downstreams', { params }));
}

export async function getDownstream(id: number) {
  return unwrapData(await request<BffDataResponse<DownstreamDto>>(`/api/bff/downstreams/${id}`));
}

export async function createDownstream(input: CreateDownstreamInput) {
  return unwrapData(await request<BffDataResponse<DownstreamDto>>('/api/bff/downstreams', { method: 'POST', body: input }));
}

export async function updateDownstream(id: number, input: UpdateDownstreamInput) {
  return unwrapData(await request<BffDataResponse<DownstreamDto>>(`/api/bff/downstreams/${id}`, { method: 'PUT', body: input }));
}

export interface DeleteDownstreamResult {
  mode: 'deleted' | 'deactivated';
  id: number;
  references?: { mediaIds: number; periods: number; dailyRates: number };
}

export async function deleteDownstream(id: number) {
  return unwrapData(await request<BffDataResponse<DeleteDownstreamResult>>(`/api/bff/downstreams/${id}`, { method: 'DELETE' }));
}

export async function listAdvertiserEntries(params: ListAdvertiserEntriesParams) {
  const data = await unwrapData(await request<BffDataResponse<AdvertiserEntryRow[]>>('/api/bff/data-entry/advertisers', { params }));
  return data.map(row => {
    const base = { ...row, type: apiTypeToUiType(row.type as 'CPM' | 'RATIO' | 'CPA') as EntryType };
    // uiKey = stable unique key per (adSite, date). adIdNum = AdSite id.
    // Using adIdNum + date ensures unique identity even when id=0 (unsaved rows).
    (base as Record<string, unknown>).uiKey = `advertiser-${row.adIdNum}-${row.date}`;
    return base as AdvertiserEntryRow;
  });
}

export async function saveAdvertiserEntryBatch(payload: SaveAdvertiserEntryBatchPayload) {
  const apiPayload = {
    items: payload.records.map(r => {
      const billingMethod = uiTypeToApiType(r.type);
      // traffic maps to qty for CPM/CPA, and amount1 for revenue-share entries.
      const item: Record<string, unknown> = {
        adSiteId: r.adId,
        recordDate: r.recordDate,
      };
      if (billingMethod === 'CPM') {
        item.qty = Number(r.traffic) || 0;
        item.unitPrice = Number(r.rate) || 0;
      } else if (billingMethod === 'CPA') {
        item.qty = Number(r.traffic) || 0;
        item.unitPrice = Number(r.rate) || 0;
      } else {
        item.amount1 = Number(r.traffic) || 0;
        item.amount2 = Number(r.settlement) || 0;
        item.ratio = Number(r.rate) || 0;
      }
      return item;
    }),
  };
  return unwrapData(await request<BffDataResponse<SaveEntryBatchResult>>('/api/bff/data-entry/advertisers/batch', {
    method: 'POST',
    body: apiPayload,
  }));
}

export async function confirmAdvertiserEntryBatch(payload: { recordDate: string; adSiteIds: number[] }) {
  return unwrapData(await request<BffDataResponse<ConfirmEntryBatchResult>>('/api/bff/data-entry/advertisers/confirm-batch', {
    method: 'POST',
    body: payload,
  }));
}

export async function unconfirmAdvertiserEntry(id: number) {
  return request<UnconfirmEntryResult>(`/api/bff/data-entry/advertisers/${id}/unconfirm`, {
    method: 'PUT',
  });
}

export async function listMediaEntries(params: ListMediaEntriesParams) {
  const data = await unwrapData(await request<BffDataResponse<MediaEntryRow[]>>('/api/bff/data-entry/media', { params }));
  return data.map((row, idx) => {
    const base = { ...row, type: apiTypeToUiType(row.type as 'CPM' | 'RATIO' | 'CPA') as EntryType };
    // uiKey = stable unique key per row. Use upstreamAdIdNum (AdSite id) + index suffix when id=0
    // to distinguish multiple downstream rows for the same site. Index is stable per render
    // since rows are in insertion order and no row is deleted without full reload.
    const unique = row.id !== 0
      ? `media-${row.upstreamAdIdNum}`
      : `media-${row.upstreamAdIdNum}-idx${idx}`;
    (base as Record<string, unknown>).uiKey = unique;
    return base as MediaEntryRow;
  });
}

export async function saveMediaEntryBatch(payload: SaveMediaEntryBatchPayload) {
  const apiPayload = {
    items: payload.records.map(r => {
      const billingMethod = uiTypeToApiType(r.type);
      const item: Record<string, unknown> = {
        adSiteId: r.mediaId,
        recordDate: r.recordDate,
      };
      if (billingMethod === 'CPM') {
        item.qty = Number(r.traffic) || 0;
        item.unitPrice = Number(r.rate) || 0;
      } else if (billingMethod === 'CPA') {
        item.qty = Number(r.traffic) || 0;
        item.unitPrice = Number(r.rate) || 0;
      } else {
        item.amount1 = Number(r.traffic) || 0;
        item.amount2 = Number(r.settlement) || 0;
        item.ratio = Number(r.rate) || 0;
      }
      return item;
    }),
  };
  return unwrapData(await request<BffDataResponse<SaveEntryBatchResult>>('/api/bff/data-entry/media/batch', {
    method: 'POST',
    body: apiPayload,
  }));
}

export async function confirmMediaEntryBatch(payload: { recordDate: string; adSiteIds: number[] }) {
  return unwrapData(await request<BffDataResponse<ConfirmEntryBatchResult>>('/api/bff/data-entry/media/confirm-batch', {
    method: 'POST',
    body: payload,
  }));
}

export async function unconfirmMediaEntry(id: number) {
  return request<UnconfirmEntryResult>(`/api/bff/data-entry/media/${id}/unconfirm`, {
    method: 'PUT',
  });
}

export async function getAdvertiserReport(params: AdvertiserReportParams) {
  const data = await unwrapData(await request<BffDataResponse<AdvertiserEntryRow[]>>('/api/bff/reports/advertisers', { params }));
  return data.map(row => ({ ...row, type: apiTypeToUiType(row.type as 'CPM' | 'RATIO' | 'CPA') as EntryType }));
}

export async function getMediaReport(params: MediaReportParams) {
  const data = await unwrapData(await request<BffDataResponse<MediaEntryRow[]>>('/api/bff/reports/media', { params }));
  return data.map(row => ({ ...row, type: apiTypeToUiType(row.type as 'CPM' | 'RATIO' | 'CPA') as EntryType }));
}

export async function getTotalProfitReport(params: TotalProfitReportParams) {
  // Backend returns TotalProfitRow[] with fields: date, upstreamId, upstream, billingMethod, qty, revenue, cost, grossProfit, tax, profit, profitRate, recordCount
  // Frontend TotalProfitReportRow matches this shape exactly (updated to match backend)
  return unwrapData(await request<BffDataResponse<TotalProfitReportRow[]>>('/api/bff/reports/total-profit', { params }));
}

export async function getOrderProfitReport(params: OrderProfitReportParams) {
  type BackendOrderProfitRow = {
    date: string;
    orderId: number | null;
    orderName: string | null;
    adTypeCode: string | null;
    adTypeName: string | null;
    upstreamId: number;
    upstream: string;
    billingMethod: string;
    qty: number;
    revenue: number;
    cost: number;
    grossProfit: number;
    tax: number;
    profit: number;
    profitRate: number;
    recordCount: number;
  };

  const backendRows = await unwrapData(await request<BffDataResponse<BackendOrderProfitRow[]>>('/api/bff/reports/order-profit', { params }));

  return backendRows.map(row => ({
    date: row.date,
    orderId: row.orderId,
    orderName: row.orderName,
    advertiser: row.upstream,
    advertiserId: row.upstreamId,
    billingMethod: row.billingMethod,
    adTypeCode: row.adTypeCode ?? '',
    adTypeName: row.adTypeName ?? row.adTypeCode ?? '',
    qty: row.qty,
    revenue: row.revenue,
    cost: row.cost,
    grossProfit: row.grossProfit,
    tax: row.tax,
    profit: row.profit,
    profitRate: row.profitRate,
    recordCount: row.recordCount,
  }));
}

export async function getAdvertiserSettlement(params: AdvertiserSettlementParams) {
  // Backend returns rows with: advertiserId, advertiser, adTypeCode, adTypeName, totalAmount, recordCount
  // Frontend type adds period (from query param)
  type BackendAdvSettlementRow = {
    advertiserId: number;
    advertiser: string;
    adTypeCode: string | null;
    adTypeName?: string | null;
    totalAmount: number;
    recordCount: number;
  };
  const rows = await unwrapData(await request<BffDataResponse<BackendAdvSettlementRow[]>>('/api/bff/settlement/advertisers', { params }));
  const period = params.period ?? '';
  return rows.map(row => ({
    period,
    advertiser: row.advertiser,
    advertiserId: row.advertiserId,
    adTypeCode: row.adTypeCode,
    adTypeName: row.adTypeName ?? null,
    totalAmount: row.totalAmount,
    recordCount: row.recordCount,
  }));
}

export async function getMediaSettlement(params: MediaSettlementParams) {
  // Backend returns rows with: mediaId, media, adTypeCode, adTypeName, downstreamName, revenue, cost, grossProfit, tax, profit, profitRate, recordCount
  // Frontend type uses different field names, add period from query param
  type BackendMediaSettlementRow = {
    mediaId: number;
    media: string;
    adTypeCode: string | null;
    adTypeName?: string | null;
    downstreamName: string | null;
    revenue: number;
    cost: number;
    grossProfit: number;
    tax: number;
    profit: number;
    profitRate: number;
    recordCount: number;
  };
  const rows = await unwrapData(await request<BffDataResponse<BackendMediaSettlementRow[]>>('/api/bff/settlement/media', { params }));
  const period = params.period ?? '';
  return rows.map(row => ({
    period,
    downstreamName: row.downstreamName,
    mediaId: row.mediaId,
    media: row.media,
    adTypeCode: row.adTypeCode,
    adTypeName: row.adTypeName ?? null,
    revenue: row.revenue,
    cost: row.cost,
    grossProfit: row.grossProfit,
    tax: row.tax,
    profit: row.profit,
    profitRate: row.profitRate,
    recordCount: row.recordCount,
  }));
}

export async function listOperationLogs(params: ListOperationLogsParams) {
  // Backend returns { data: [...], pagination: {...} } directly without BFF wrapper
  return request<OperationLogResponse>('/api/bff/operation-logs', { params });
}

export async function getUsers() {
  return unwrapData(await request<BffDataResponse<UserManagementUser[]>>('/api/users'));
}

export async function createUser(data: CreateUserInput) {
  return unwrapData(await request<BffDataResponse<UserManagementUser>>('/api/users', { method: 'POST', body: data }));
}

export async function updateUser(id: number, data: UpdateUserInput) {
  return unwrapData(await request<BffDataResponse<UserManagementUser>>(`/api/users/${id}`, { method: 'PUT', body: data }));
}

export async function resetUserPassword(id: number, data: ResetPasswordInput) {
  return request<BffMutationResponse>(`/api/users/${id}/reset-password`, { method: 'POST', body: data });
}

export async function getRoles() {
  return unwrapData(await request<BffDataResponse<Role[]>>('/api/roles'));
}

export async function getCurrentUser() {
  // Backend returns BffDataResponse<AuthUser>: { success, data: AuthUser }
  // AuthUser field names: role, permDataInput, permDataConfirm, permAdmin, roleId, permissions
  // CurrentUserInfo (frontend): perm_data_input, perm_data_confirm, perm_admin
  type AuthUserRaw = {
    id: number;
    username: string;
    role: string;
    permDataInput: boolean;
    permDataConfirm: boolean;
    permAdmin: boolean;
    status: string;
    roleId: number | null;
    permissions: string[];
  };

  const raw = await request<{ success: boolean; data?: unknown; error?: string }>('/api/auth/me');
  if (raw.data && typeof raw.data === 'object') {
    const d = raw.data as AuthUserRaw;
    // Map to CurrentUserInfo field names
    return {
      id: d.id,
      username: d.username,
      role: d.role,
      roleId: d.roleId ?? undefined,
      roleCode: undefined,
      roleName: undefined,
      permissions: d.permissions ?? [],
      perm_data_input: d.permDataInput,
      perm_data_confirm: d.permDataConfirm,
      perm_admin: d.permAdmin,
    };
  }
  return null;
}

export async function getPermissions() {
  return unwrapData(await request<BffDataResponse<Permission[]>>('/api/permissions'));
}

export async function updateRolePermissions(roleId: number, permissionKeys: string[]) {
  return unwrapData(await request<BffDataResponse<Role>>(`/api/roles/${roleId}/permissions`, { method: 'PUT', body: { permissionKeys } }));
}

export async function quarantineRecords(params: QuarantineParams): Promise<QuarantineResult> {
  return request<QuarantineResult>('/api/bff/daily-input/quarantine', {
    method: 'POST',
    body: params,
  });
}

export async function listQuarantineBatches() {
  return unwrapData(await request<BffDataResponse<QuarantineResult[]>>('/api/bff/daily-input/quarantine'));
}

export async function restoreQuarantineBatch(batchId: number) {
  return request<{ success: boolean; batchId: number; restoredCount: number; error?: string }>(
    `/api/bff/daily-input/quarantine/${batchId}/restore`,
    { method: 'POST' }
  );
}

// ─── AdType CRUD ──────────────────────────────────────────────────────────────

export async function listAdTypes() {
  return unwrapData(await request<BffDataResponse<AdType[]>>('/api/bff/ad-types'));
}

export async function getAdType(id: number) {
  return unwrapData(await request<BffDataResponse<AdType>>(`/api/bff/ad-types/${id}`));
}

export async function createAdType(input: { code: string; name: string }) {
  return request<{ success: boolean; data: { id: number; code: string; name: string }; error?: string }>(
    '/api/bff/ad-types',
    { method: 'POST', body: input }
  );
}

export async function updateAdType(id: number, input: { code?: string; name?: string }) {
  return request<{ success: boolean; data: { id: number; code: string; name: string }; error?: string }>(
    `/api/bff/ad-types/${id}`,
    { method: 'PUT', body: input }
  );
}

export async function deleteAdType(id: number) {
  return request<{ success: boolean; data: { deleted: boolean }; error?: string }>(
    `/api/bff/ad-types/${id}`,
    { method: 'DELETE' }
  );
}

export const bffApi = {
  login,
  listAdvertisers,
  getAdvertiser,
  createAdvertiser,
  updateAdvertiser,
  deleteAdvertiser,
  listMedia,
  getMedia,
  createMedia,
  updateMedia,
  deleteMedia,
  listAdOrders,
  getAdOrder,
  createAdOrder,
  updateAdOrder,
  deleteAdOrder,
  listAdIds,
  getAdId,
  createAdId,
  updateAdId,
  deleteAdId,
  listMediaIds,
  getMediaId,
  createMediaId,
  updateMediaId,
  deleteMediaId,
  listDownstreams,
  createDownstream,
  updateDownstream,
  deleteDownstream,
  listAdvertiserEntries,
  saveAdvertiserEntryBatch,
  confirmAdvertiserEntryBatch,
  unconfirmAdvertiserEntry,
  listMediaEntries,
  saveMediaEntryBatch,
  confirmMediaEntryBatch,
  unconfirmMediaEntry,
  getAdvertiserReport,
  getMediaReport,
  getTotalProfitReport,
  getOrderProfitReport,
  getAdvertiserSettlement,
  getMediaSettlement,
  listOperationLogs,
  getUsers,
  createUser,
  updateUser,
  resetUserPassword,
  getRoles,
  getPermissions,
  updateRolePermissions,
  getCurrentUser,
  quarantineRecords,
  listQuarantineBatches,
  restoreQuarantineBatch,
  listAdTypes,
  getAdType,
  createAdType,
  updateAdType,
  deleteAdType,
};

export type { QuarantineParams, QuarantineResult, AdType };

// ─── Hard Delete ────────────────────────────────────────────────────────────────

export type HardDeleteSuccess = {
  success: true;
  data: { deleted: true; entityType: string; entityId: number };
  message: string;
};

export type HardDeleteError = {
  success: false;
  code:
    | 'NOT_FOUND'
    | 'ENTITY_HAS_FINANCIAL_DATA'
    | 'ENTITY_HAS_DEPENDENCIES'
    | 'LIMITATION'
    | 'FORBIDDEN'
    | 'BAD_REQUEST'
    | 'INTERNAL_ERROR';
  message: string;
  data?: Record<string, unknown>;
};

export type HardDeleteResult = HardDeleteSuccess | HardDeleteError;

async function hardDelete(path: string, id: number): Promise<HardDeleteResult> {
  try {
    return await request<HardDeleteResult>(`/api/bff/hard-delete/${path}/${id}`, { method: 'DELETE' });
  } catch (error) {
    if (error instanceof BffApiError) {
      const payload = error.payload;
      if (
        payload &&
        typeof payload === 'object' &&
        (payload as Record<string, unknown>).success === false &&
        typeof (payload as Record<string, unknown>).code === 'string'
      ) {
        return payload as HardDeleteError;
      }
      if (error.status === 403) {
        return { success: false, code: 'FORBIDDEN', message: 'Bạn không có quyền xóa cứng.' };
      }
      if (error.status === 400) {
        return { success: false, code: 'BAD_REQUEST', message: error.message || 'Yêu cầu không hợp lệ.' };
      }
      return { success: false, code: 'INTERNAL_ERROR', message: error.message || 'Đã xảy ra lỗi.' };
    }
    throw error;
  }
}

export const hardDeleteAdvertiser = (id: number) => hardDelete('advertisers', id);
export const hardDeleteAdType = (id: number) => hardDelete('ad-types', id);
export const hardDeleteAdId = (id: number) => hardDelete('ad-ids', id);
export const hardDeleteMedia = (id: number) => hardDelete('media', id);
export const hardDeleteMediaAdOrder = (id: number) => hardDelete('media-ad-orders', id);
export const hardDeleteMediaId = (id: number) => hardDelete('media-ids', id);
