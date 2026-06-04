import type { BffDataResponse } from '../lib/bffTypes';

const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
const API_BASE_URL = (env?.VITE_API_URL ?? '').replace(/\/+$/, '');

type QueryValue = string | number | boolean | null | undefined;

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  params?: Record<string, QueryValue>;
  body?: unknown;
  headers?: Record<string, string>;
};

function getAuthToken() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('token');
}

function buildUrl(path: string, params?: Record<string, QueryValue>) {
  const pathname = path.startsWith('/') ? path : `/${path}`;
  const searchParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.set(key, String(value));
      }
    });
  }
  const queryString = searchParams.toString();
  return `${API_BASE_URL}${pathname}${queryString ? `?${queryString}` : ''}`;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const token = getAuthToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const url = buildUrl(path, options.params);

  const response = await fetch(url, {
    method: options.method ?? 'GET',
    headers: { ...headers, ...options.headers },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const errorMessage = typeof payload?.error === 'string' ? payload.error : response.statusText;
    throw new Error(errorMessage);
  }

  return payload as T;
}

export interface YiyiChannelData {
  channel: string;
  qty: number;
  hasData: boolean;
}

export interface YiyiDailyPricingData {
  unit_price: number;
  profit_unit_price: number;
}

export interface YiyiMonthlyRow {
  date: string;
  unit_price: number;
  profit_unit_price: number;
  'yy-02-01': number;
  'yy-02-02': number;
  'yy-02-03': number;
  'yy-02-04': number;
}

export async function getYiyiDailyData(date: string): Promise<YiyiChannelData[]> {
  const data = await request<{ success: boolean; data: YiyiChannelData[] }>(`/api/yiyi-data?date=${date}`);
  return data.data;
}

export async function getYiyiMonthlyData(params: { year: number; month: number }): Promise<YiyiMonthlyRow[]> {
  const data = await request<{ success: boolean; data: YiyiMonthlyRow[] }>('/api/yiyi-data/monthly', {
    params,
  });
  return data.data;
}

export async function saveYiyiDailyData(params: {
  date: string;
  channels: Array<{ channel: string; qty: number }>;
  unit_price?: number;
  profit_unit_price?: number;
}) {
  return request<{ success: boolean; saved: number }>('/api/yiyi-data/batch', {
    method: 'POST',
    body: {
      date: params.date,
      items: params.channels,
      pricing: {
        unitPrice: params.unit_price,
        profitUnitPrice: params.profit_unit_price,
      },
    },
  });
}

export async function getYiyiDailyPricing(date: string): Promise<YiyiDailyPricingData | null> {
  const data = await request<{ success: boolean; data: YiyiChannelData[] }>(`/api/yiyi-data?date=${date}`);
  // GET /api/yiyi-data only returns channel data, not pricing
  // Pricing is set via the batch endpoint alongside channel data
  return null;
}
