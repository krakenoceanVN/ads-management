import type {
  AdId,
  AdOrder,
  Advertiser,
  AdvertiserEntryRow,
  AdvertiserReportParams,
  AdvertiserSettlementParams,
  AdvertiserSettlementRow,
  BffDataResponse,
  BffMutationResponse,
  ConfirmEntryBatchResult,
  CreateAdvertiserInput,
  CreateMediaInput,
  ListAdIdsParams,
  ListAdOrdersParams,
  ListAdvertiserEntriesParams,
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
  SaveAdvertiserEntryBatchPayload,
  SaveEntryBatchResult,
  SaveMediaEntryBatchPayload,
  TotalProfitReportParams,
  TotalProfitReportRow,
  UnconfirmEntryResult,
  UpdateAdvertiserInput,
  UpdateMediaInput,
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

function getAuthToken() {
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
    const errorMessage = typeof payload?.error === 'string' ? payload.error : response.statusText;
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

export async function login(data: LoginInput) {
  return request<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: data,
  });
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

export async function listAdIds(params?: ListAdIdsParams) {
  return unwrapData(await request<BffDataResponse<AdId[]>>('/api/bff/ad-ids', { params }));
}

export async function getAdId(id: number) {
  return unwrapData(await request<BffDataResponse<AdId>>(`/api/bff/ad-ids/${id}`));
}

export async function listMediaIds(params?: ListMediaIdsParams) {
  return unwrapData(await request<BffDataResponse<MediaId[]>>('/api/bff/media-ids', { params }));
}

export async function getMediaId(id: number) {
  return unwrapData(await request<BffDataResponse<MediaId>>(`/api/bff/media-ids/${id}`));
}

export async function listAdvertiserEntries(params: ListAdvertiserEntriesParams) {
  return unwrapData(await request<BffDataResponse<AdvertiserEntryRow[]>>('/api/bff/data-entry/advertisers', { params }));
}

export async function saveAdvertiserEntryBatch(payload: SaveAdvertiserEntryBatchPayload) {
  return request<SaveEntryBatchResult>('/api/bff/data-entry/advertisers/batch', {
    method: 'POST',
    body: payload,
  });
}

export async function confirmAdvertiserEntryBatch(ids: number[]) {
  return request<ConfirmEntryBatchResult>('/api/bff/data-entry/advertisers/confirm-batch', {
    method: 'POST',
    body: { ids },
  });
}

export async function unconfirmAdvertiserEntry(id: number) {
  return request<UnconfirmEntryResult>(`/api/bff/data-entry/advertisers/${id}/unconfirm`, {
    method: 'PUT',
  });
}

export async function listMediaEntries(params: ListMediaEntriesParams) {
  return unwrapData(await request<BffDataResponse<MediaEntryRow[]>>('/api/bff/data-entry/media', { params }));
}

export async function saveMediaEntryBatch(payload: SaveMediaEntryBatchPayload) {
  return request<SaveEntryBatchResult>('/api/bff/data-entry/media/batch', {
    method: 'POST',
    body: payload,
  });
}

export async function confirmMediaEntryBatch(ids: number[]) {
  return request<ConfirmEntryBatchResult>('/api/bff/data-entry/media/confirm-batch', {
    method: 'POST',
    body: { ids },
  });
}

export async function unconfirmMediaEntry(id: number) {
  return request<UnconfirmEntryResult>(`/api/bff/data-entry/media/${id}/unconfirm`, {
    method: 'PUT',
  });
}

export async function getAdvertiserReport(params: AdvertiserReportParams) {
  return unwrapData(await request<BffDataResponse<AdvertiserEntryRow[]>>('/api/bff/reports/advertisers', { params }));
}

export async function getMediaReport(params: MediaReportParams) {
  return unwrapData(await request<BffDataResponse<MediaEntryRow[]>>('/api/bff/reports/media', { params }));
}

export async function getTotalProfitReport(params: TotalProfitReportParams) {
  return unwrapData(await request<BffDataResponse<TotalProfitReportRow[]>>('/api/bff/reports/total-profit', { params }));
}

export async function getOrderProfitReport(params: OrderProfitReportParams) {
  return unwrapData(await request<BffDataResponse<OrderProfitReportRow[]>>('/api/bff/reports/order-profit', { params }));
}

export async function getAdvertiserSettlement(params: AdvertiserSettlementParams) {
  return unwrapData(await request<BffDataResponse<AdvertiserSettlementRow[]>>('/api/bff/settlement/advertisers', { params }));
}

export async function getMediaSettlement(params: MediaSettlementParams) {
  return unwrapData(await request<BffDataResponse<MediaSettlementRow[]>>('/api/bff/settlement/media', { params }));
}

export async function listOperationLogs(params: ListOperationLogsParams) {
  return unwrapData(await request<BffDataResponse<OperationLogResponse>>('/api/bff/operation-logs', { params }));
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
  listAdIds,
  getAdId,
  listMediaIds,
  getMediaId,
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
};
