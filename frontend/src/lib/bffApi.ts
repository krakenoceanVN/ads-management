import type {
  AdId,
  Advertiser,
  AdvertiserEntryRow,
  AdvertiserReportParams,
  DependencyCounts,
  AdvertiserSettlementParams,
  AdvertiserSettlementRow,
  AdType,
  BffDataResponse,
  BffMutationResponse,
  ConfirmEntryBatchResult,
  CreateAdIdInput,
  CreateAdvertiserInput,
  CreateDownstreamInput,
  CreateMediaInput,
  CreateMediaIdInput,
  CreateMediaAdOrderInput,
  CreateUserInput,
  DownstreamDto,
  EntityStatus,
  EntryType,
  ListAdIdsParams,
  ListAdvertiserEntriesParams,
  ListDownstreamsParams,
  ListMediaEntriesParams,
  ListMediaIdsParams,
  ListMediaParams,
  ListOperationLogsParams,
  LoginInput,
  LoginResponse,
  Media,
  MediaAdOrder,
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
  UpdateAdvertiserInput,
  UpdateDownstreamInput,
  UpdateMediaInput,
  UpdateMediaIdInput,
  UpdateMediaAdOrderInput,
  UpdateUserInput,
  UserManagementUser,
} from './bffTypes';

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
  return value;
}

function buildQuery(params?: object): string {
  if (!params) return '';
  const entries = Object.entries(params)
    .map(([k, v]) => [k, normalizeQueryValue(v as QueryValue)] as [string, QueryValue])
    .filter(([, v]) => v !== null);
  if (entries.length === 0) return '';
  const usp = new URLSearchParams();
  for (const [k, v] of entries) usp.append(k, String(v));
  return `?${usp.toString()}`;
}

function readErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') return fallback;
  const obj = payload as { error?: string; message?: string };
  return obj.error || obj.message || fallback;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const url = `${API_BASE_URL}${path}${buildQuery(options.params)}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const token = getAuthToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url, {
    method: options.method ?? 'GET',
    headers,
    credentials: 'include',
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const text = await res.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { raw: text };
    }
  }

  if (!res.ok) {
    if (res.status === 401) {
      window.dispatchEvent(new Event(BFF_AUTH_TOKEN_INVALID_EVENT));
    }
    throw new BffApiError(readErrorMessage(payload, `Request failed: ${res.status}`), res.status, payload);
  }

  return payload as T;
}

function unwrapData<T>(payload: unknown): T {
  if (payload && typeof payload === 'object' && 'data' in (payload as Record<string, unknown>)) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

export async function login(input: LoginInput): Promise<LoginResponse> {
  return unwrapData(await request<BffDataResponse<LoginResponse>>('/api/auth/login', { method: 'POST', body: input }));
}

export async function getCurrentUser(): Promise<LoginResponse['user']> {
  return unwrapData(await request<BffDataResponse<LoginResponse['user']>>('/api/auth/me'));
}

export async function listAdvertisers(): Promise<Advertiser[]> {
  return unwrapData(await request<BffDataResponse<Advertiser[]>>('/api/bff/advertisers'));
}

export async function getAdvertiser(id: string) {
  return unwrapData(await request<BffDataResponse<Advertiser>>(`/api/bff/advertisers/${id}`));
}

export async function createAdvertiser(data: CreateAdvertiserInput): Promise<Advertiser> {
  return unwrapData(await request<BffDataResponse<Advertiser>>('/api/bff/advertisers', {
    method: 'POST',
    body: data,
  }));
}

export async function updateAdvertiser(id: string, data: UpdateAdvertiserInput): Promise<Advertiser> {
  return unwrapData(await request<BffDataResponse<Advertiser>>(`/api/bff/advertisers/${id}`, {
    method: 'PUT',
    body: data,
  }));
}

export async function deleteAdvertiser(id: string) {
  return request<BffMutationResponse>(`/api/bff/advertisers/${id}`, { method: 'DELETE' });
}

export async function listMedia(params?: ListMediaParams): Promise<Media[]> {
  return unwrapData(await request<BffDataResponse<Media[]>>('/api/bff/media', { params }));
}

export async function getMedia(id: string): Promise<Media> {
  return unwrapData(await request<BffDataResponse<Media>>(`/api/bff/media/${id}`));
}

export async function createMedia(data: CreateMediaInput): Promise<Media> {
  return unwrapData(await request<BffDataResponse<Media>>('/api/bff/media', {
    method: 'POST',
    body: data,
  }));
}

export async function updateMedia(id: string, data: UpdateMediaInput): Promise<Media> {
  return unwrapData(await request<BffDataResponse<Media>>(`/api/bff/media/${id}`, {
    method: 'PUT',
    body: data,
  }));
}

export async function deleteMedia(id: string) {
  return request<BffMutationResponse>(`/api/bff/media/${id}`, { method: 'DELETE' });
}

export async function listMediaAdOrders(params?: { downstreamId?: string; adTypeId?: string; status?: EntityStatus; keyword?: string }): Promise<MediaAdOrder[]> {
  return unwrapData(await request<BffDataResponse<MediaAdOrder[]>>('/api/bff/media-ad-orders', { params }));
}

export async function getMediaAdOrder(id: string): Promise<MediaAdOrder> {
  return unwrapData(await request<BffDataResponse<MediaAdOrder>>(`/api/bff/media-ad-orders/${id}`));
}

export async function createMediaAdOrder(data: CreateMediaAdOrderInput): Promise<MediaAdOrder> {
  return unwrapData(await request<BffDataResponse<MediaAdOrder>>('/api/bff/media-ad-orders', {
    method: 'POST',
    body: data,
  }));
}

export async function updateMediaAdOrder(id: string, data: UpdateMediaAdOrderInput): Promise<MediaAdOrder> {
  return unwrapData(await request<BffDataResponse<MediaAdOrder>>(`/api/bff/media-ad-orders/${id}`, {
    method: 'PUT',
    body: data,
  }));
}

export async function deleteMediaAdOrder(id: string) {
  return request<BffMutationResponse>(`/api/bff/media-ad-orders/${id}`, { method: 'DELETE' });
}

export async function listAdIds(params?: ListAdIdsParams): Promise<AdId[]> {
  return unwrapData(await request<BffDataResponse<AdId[]>>('/api/bff/ad-ids', { params }));
}

export async function getAdId(id: string) {
  return unwrapData(await request<BffDataResponse<AdId>>(`/api/bff/ad-ids/${id}`));
}

export async function createAdId(data: CreateAdIdInput): Promise<AdId> {
  return unwrapData(await request<BffDataResponse<AdId>>('/api/bff/ad-ids', {
    method: 'POST',
    body: data,
  }));
}

export async function updateAdId(id: string, data: UpdateAdIdInput): Promise<AdId> {
  return unwrapData(await request<BffDataResponse<AdId>>(`/api/bff/ad-ids/${id}`, {
    method: 'PUT',
    body: data,
  }));
}

export async function deleteAdId(id: string) {
  return request<BffMutationResponse>(`/api/bff/ad-ids/${id}`, { method: 'DELETE' });
}

export async function listMediaIds(params?: ListMediaIdsParams): Promise<MediaId[]> {
  return unwrapData(await request<BffDataResponse<MediaId[]>>('/api/bff/media-ids', { params }));
}

export async function getMediaId(id: string): Promise<MediaId> {
  return unwrapData(await request<BffDataResponse<MediaId>>(`/api/bff/media-ids/${id}`));
}

export async function createMediaId(data: CreateMediaIdInput): Promise<MediaId> {
  return unwrapData(await request<BffDataResponse<MediaId>>('/api/bff/media-ids', {
    method: 'POST',
    body: data,
  }));
}

export async function updateMediaId(id: string, data: UpdateMediaIdInput): Promise<MediaId> {
  return unwrapData(await request<BffDataResponse<MediaId>>(`/api/bff/media-ids/${id}`, {
    method: 'PUT',
    body: data,
  }));
}

export async function deleteMediaId(id: string) {
  return request<BffMutationResponse>(`/api/bff/media-ids/${id}`, { method: 'DELETE' });
}

export async function listDownstreams(params?: ListDownstreamsParams): Promise<DownstreamDto[]> {
  return unwrapData(await request<BffDataResponse<DownstreamDto[]>>('/api/bff/downstreams', { params }));
}

export async function createDownstream(data: CreateDownstreamInput) {
  return unwrapData(await request<BffDataResponse<DownstreamDto>>('/api/bff/downstreams', {
    method: 'POST',
    body: data,
  }));
}

export async function updateDownstream(id: string, data: UpdateDownstreamInput) {
  return unwrapData(await request<BffDataResponse<DownstreamDto>>(`/api/bff/downstreams/${id}`, {
    method: 'PUT',
    body: data,
  }));
}

export async function deleteDownstream(id: string) {
  return request<BffMutationResponse>(`/api/bff/downstreams/${id}`, { method: 'DELETE' });
}

export async function listAdvertiserEntries(params: ListAdvertiserEntriesParams): Promise<AdvertiserEntryRow[]> {
  return unwrapData(await request<BffDataResponse<AdvertiserEntryRow[]>>('/api/bff/data-entry/advertisers', { params }));
}

export async function saveAdvertiserEntryBatch(payload: SaveAdvertiserEntryBatchPayload): Promise<SaveEntryBatchResult> {
  // Backend expects { items: [...] }; translate { date, adTypeCode, records }
  const items = payload.records.map(r => ({
    adSiteId: r.adId,
    recordDate: r.recordDate,
    qty: r.traffic,
    unitPrice: r.rate,
    amount1: r.type === 'CPS' ? r.traffic : r.settlement,
    amount2: r.type === 'CPS' ? r.settlement : undefined,
    ratio: r.type === 'CPS' ? r.rate : undefined,
    type: r.type,
    note: undefined,
  }));
  return unwrapData(await request<BffDataResponse<SaveEntryBatchResult>>('/api/bff/data-entry/advertisers/batch', {
    method: 'POST',
    body: { items },
  }));
}

export async function confirmAdvertiserEntryBatch(payload: { date: string; adSiteIds: string[] }): Promise<ConfirmEntryBatchResult> {
  return unwrapData(await request<BffDataResponse<ConfirmEntryBatchResult>>('/api/bff/data-entry/advertisers/confirm-batch', {
    method: 'POST',
    body: { recordDate: payload.date, adSiteIds: payload.adSiteIds },
  }));
}

export async function unconfirmAdvertiserEntry(id: string): Promise<UnconfirmEntryResult> {
  return unwrapData(await request<BffDataResponse<UnconfirmEntryResult>>(`/api/bff/data-entry/advertisers/${id}/unconfirm`, {
    method: 'PUT',
  }));
}

export async function listMediaEntries(params: ListMediaEntriesParams): Promise<MediaEntryRow[]> {
  return unwrapData(await request<BffDataResponse<MediaEntryRow[]>>('/api/bff/data-entry/media', { params }));
}

export async function confirmMediaEntryBatch(payload: { date: string; adSiteDownstreamIds: string[] }): Promise<ConfirmEntryBatchResult> {
  return unwrapData(await request<BffDataResponse<ConfirmEntryBatchResult>>('/api/bff/data-entry/media/confirm-batch', {
    method: 'POST',
    body: { recordDate: payload.date, adSiteDownstreamIds: payload.adSiteDownstreamIds },
  }));
}

export async function unconfirmMediaEntry(id: string): Promise<UnconfirmEntryResult> {
  return unwrapData(await request<BffDataResponse<UnconfirmEntryResult>>(`/api/bff/data-entry/media/${id}/unconfirm`, {
    method: 'PUT',
  }));
}

export async function saveMediaEntryBatch(payload: SaveMediaEntryBatchPayload): Promise<SaveEntryBatchResult> {
  const items = payload.records.map(r => ({
    adSiteDownstreamId: r.adSiteDownstreamId,
    recordDate: r.recordDate,
    dataCoefficient: r.dataCoefficient,
  }));
  return unwrapData(await request<BffDataResponse<SaveEntryBatchResult>>('/api/bff/data-entry/media/batch', {
    method: 'POST',
    body: { items },
  }));
}

export async function getAdvertiserReport(params: AdvertiserReportParams): Promise<AdvertiserEntryRow[]> {
  return unwrapData(await request<BffDataResponse<AdvertiserEntryRow[]>>('/api/bff/reports/advertisers', { params }));
}

export async function getMediaReport(params: MediaReportParams): Promise<MediaEntryRow[]> {
  return unwrapData(await request<BffDataResponse<MediaEntryRow[]>>('/api/bff/reports/media', { params }));
}

export async function getTotalProfitReport(params: TotalProfitReportParams): Promise<TotalProfitReportRow[]> {
  return unwrapData(await request<BffDataResponse<TotalProfitReportRow[]>>('/api/bff/reports/total-profit', { params }));
}

export async function getOrderProfitReport(params: OrderProfitReportParams): Promise<OrderProfitReportRow[]> {
  return unwrapData(await request<BffDataResponse<OrderProfitReportRow[]>>('/api/bff/reports/order-profit', { params }));
}

export async function getAdvertiserSettlement(params: AdvertiserSettlementParams): Promise<AdvertiserSettlementRow[]> {
  return unwrapData(await request<BffDataResponse<AdvertiserSettlementRow[]>>('/api/bff/settlement/advertisers', { params }));
}

export async function getMediaSettlement(params: MediaSettlementParams): Promise<MediaSettlementRow[]> {
  return unwrapData(await request<BffDataResponse<MediaSettlementRow[]>>('/api/bff/settlement/media', { params }));
}

export async function listOperationLogs(params: ListOperationLogsParams): Promise<OperationLogResponse> {
  return unwrapData(await request<OperationLogResponse>('/api/bff/oplog', { params }));
}

export async function getUsers(): Promise<UserManagementUser[]> {
  return unwrapData(await request<BffDataResponse<UserManagementUser[]>>('/api/users'));
}

export async function createUser(data: CreateUserInput): Promise<UserManagementUser> {
  return unwrapData(await request<BffDataResponse<UserManagementUser>>('/api/users', { method: 'POST', body: data }));
}

export async function updateUser(id: string, data: UpdateUserInput): Promise<UserManagementUser> {
  return unwrapData(await request<BffDataResponse<UserManagementUser>>(`/api/users/${id}`, { method: 'PUT', body: data }));
}

export async function resetUserPassword(id: string, data: ResetPasswordInput): Promise<{ success: boolean }> {
  return unwrapData(await request<BffDataResponse<{ success: boolean }>>(`/api/users/${id}/reset-password`, { method: 'POST', body: data }));
}

export async function getRoles(): Promise<Role[]> {
  return unwrapData(await request<BffDataResponse<Role[]>>('/api/roles'));
}

export async function getPermissions(): Promise<Permission[]> {
  return unwrapData(await request<BffDataResponse<Permission[]>>('/api/permissions'));
}

export async function updateRolePermissions(id: string, permissionKeys: string[]): Promise<Role> {
  return unwrapData(await request<BffDataResponse<Role>>(`/api/roles/${id}/permissions`, { method: 'PUT', body: { permissionKeys } }));
}

export async function quarantineRecords(params: QuarantineParams): Promise<QuarantineResult> {
  return unwrapData(await request<BffDataResponse<QuarantineResult>>('/api/bff/daily-input/quarantine', { method: 'POST', body: params }));
}

export async function listQuarantineBatches(params?: { scope?: 'advertiser' | 'media'; page?: number; pageSize?: number }): Promise<QuarantineResult[]> {
  return unwrapData(await request<BffDataResponse<QuarantineResult[]>>('/api/bff/daily-input/quarantine', { params }));
}

export async function restoreQuarantineBatch(id: string): Promise<{ success: boolean }> {
  return unwrapData(await request<BffDataResponse<{ success: boolean }>>(`/api/bff/daily-input/quarantine/${id}/restore`, { method: 'POST' }));
}

// ─── AdType CRUD ──────────────────────────────────────────────────────────────

export async function listAdTypes(): Promise<AdType[]> {
  return unwrapData(await request<BffDataResponse<AdType[]>>('/api/bff/ad-types'));
}

export async function getAdType(id: string) {
  return unwrapData(await request<BffDataResponse<AdType>>(`/api/bff/ad-types/${id}`));
}

export async function createAdType(input: { name: string; upstreamId?: string; notes?: string; status?: EntityStatus }): Promise<BffDataResponse<AdType>> {
  return request<BffDataResponse<AdType>>(
    '/api/bff/ad-types',
    { method: 'POST', body: input }
  );
}

export async function updateAdType(id: string, input: { name?: string; upstreamId?: string | null; notes?: string | null; status?: EntityStatus }): Promise<BffDataResponse<AdType>> {
  return request<BffDataResponse<AdType>>(
    `/api/bff/ad-types/${id}`,
    { method: 'PUT', body: input }
  );
}

export async function deleteAdType(id: string) {
  return request<BffDataResponse<{ deleted: boolean }>>(
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
  listMediaAdOrders,
  getMediaAdOrder,
  createMediaAdOrder,
  updateMediaAdOrder,
  deleteMediaAdOrder,
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
  listQuarantineBatches,
  restoreQuarantineBatch,
  listAdTypes,
  getAdType,
  createAdType,
  updateAdType,
  deleteAdType,
};

export type { QuarantineParams, QuarantineResult, AdType, MediaAdOrder };

// ─── Hard Delete ────────────────────────────────────────────────────────────────

export type HardDeleteSuccess = {
  success: true;
  data: { deleted: true; entityType: string; entityId: string | number };
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

async function hardDelete(path: string, id: string | number): Promise<HardDeleteResult> {
  try {
    return await request<HardDeleteResult>(`/api/bff/hard-delete/${path}/${id}`, { method: 'DELETE' });
  } catch (error) {
    if (error instanceof BffApiError) {
      const payload = (error.payload ?? {}) as Record<string, unknown>;
      if (error.status === 403) {
        return { success: false, code: 'FORBIDDEN', message: 'Bạn không có quyền xóa cứng.' };
      }
      if (error.status === 400) {
        return { success: false, code: 'BAD_REQUEST', message: error.message || 'Yêu cầu không hợp lệ.' };
      }
      return {
        success: false,
        code: (payload.code as HardDeleteError['code']) ?? 'INTERNAL_ERROR',
        message: error.message || 'Đã xảy ra lỗi.',
        data: payload,
      };
    }
    throw error;
  }
}

export const hardDeleteAdvertiser = (id: string | number) => hardDelete('advertisers', id);
export const hardDeleteAdType = (id: string | number) => hardDelete('ad-types', id);
export const hardDeleteAdId = (id: string | number) => hardDelete('ad-ids', id);
export const hardDeleteMedia = (id: string | number) => hardDelete('media', id);
export const hardDeleteMediaAdOrder = (id: string | number) => hardDelete('media-ad-orders', id);
export const hardDeleteMediaId = (id: string | number) => hardDelete('media-ids', id);

export async function getAdvertiserDependencies(id: string): Promise<DependencyCounts> {
  return unwrapData(await request<BffDataResponse<DependencyCounts>>(`/api/bff/hard-delete/advertisers/${id}/dependencies`, { method: 'GET' }));
}
export async function getAdTypeDependencies(id: string): Promise<DependencyCounts> {
  return unwrapData(await request<BffDataResponse<DependencyCounts>>(`/api/bff/hard-delete/ad-types/${id}/dependencies`, { method: 'GET' }));
}
export async function getAdIdDependencies(id: string): Promise<DependencyCounts> {
  return unwrapData(await request<BffDataResponse<DependencyCounts>>(`/api/bff/hard-delete/ad-ids/${id}/dependencies`, { method: 'GET' }));
}
export async function getMediaDependencies(id: string): Promise<DependencyCounts> {
  return unwrapData(await request<BffDataResponse<DependencyCounts>>(`/api/bff/hard-delete/media/${id}/dependencies`, { method: 'GET' }));
}
