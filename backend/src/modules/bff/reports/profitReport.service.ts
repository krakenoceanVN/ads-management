/**
 * Profit Report Service
 *
 * Implements:
 * - GET total-profit: daily aggregated profit across upstreams
 * - GET order-profit: per-order profit report
 *
 * Revenue always from DailyInput.revenue (no recalculation).
 * Cost calculated via payout.service aggregateDownstreamCost().
 * Tax applied per confirmed rules.
 */

import type { Prisma } from '@prisma/client';
import { prisma } from '../../../shared/prisma/client';
import {
  aggregateDownstreamCost,
  calculateProfit,
  type DailyInputWithSite,
} from '../../../shared/services/payout.service';
import { getYiyiMonthly } from '../../yiyi/yiyi.service';
import type { BillingMethod } from '../../../shared/services/revenue.service';

const TEST_UPSTREAM_NAMES = ['百战-bz'];
const TEST_AD_SITE_NAMES = ['TestCPM', 'TestCPS'];

export async function computeYiyiCost(year: number, month: number): Promise<{ totalYiyiCost: number; yiyiByDate: Map<string, number> }> {
  const rows = await getYiyiMonthly(year, month);
  let totalYiyiCost = 0;
  const yiyiByDate = new Map<string, number>();

  for (const row of rows) {
    const dayTraffic = row['yy-02-01'] + row['yy-02-02'] + row['yy-02-03'] + row['yy-02-04'];
    if (dayTraffic === 0) continue;
    const unitPrice = row.unit_price;
    const profitUnitPrice = row.profit_unit_price;
    const yiyiCost = Math.round((dayTraffic / 1000 * (unitPrice + profitUnitPrice)) * 100) / 100;
    yiyiByDate.set(row.date, yiyiCost);
    totalYiyiCost += yiyiCost;
  }

  totalYiyiCost = Math.round(totalYiyiCost * 100) / 100;
  return { totalYiyiCost, yiyiByDate };
}

function buildDateFilter(params: { date?: string; startDate?: string; endDate?: string }): Prisma.DailyInputWhereInput {
  if (params.date) {
    const d = new Date(params.date + 'T00:00:00.000Z');
    return { recordDate: d };
  }
  if (params.startDate && params.endDate) {
    const start = new Date(params.startDate + 'T00:00:00.000Z');
    const end = new Date(params.endDate + 'T23:59:59.999Z');
    return { recordDate: { gte: start, lte: end } };
  }
  return {};
}

export interface TotalProfitParams {
  date?: string;
  startDate?: string;
  endDate?: string;
  advertiserId?: string;
  upstreamId?: string;
  adTypeCode?: string;
  billingMethod?: BillingMethod;
}

export interface TotalProfitRow {
  date: string;
  upstreamId: string;
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
}

export async function getTotalProfit(params: TotalProfitParams): Promise<TotalProfitRow[]> {
  const dateFilter = buildDateFilter(params);

  let year: number | null = null;
  let month: number | null = null;
  if (params.date) {
    const [y, m] = params.date.split('-');
    year = parseInt(y, 10);
    month = parseInt(m, 10);
  } else if (params.startDate) {
    const [y, m] = params.startDate.split('-');
    year = parseInt(y, 10);
    month = parseInt(m, 10);
  }

  const yiyiByDate = new Map<string, number>();
  if (year != null && month != null) {
    const { yiyiByDate: ybd } = await computeYiyiCost(year, month);
    ybd.forEach((v, k) => yiyiByDate.set(k, v));
  }

  const upstreamWhere: Prisma.UpstreamWhereInput = {
    ...(params.advertiserId != null && { id: params.advertiserId }),
    ...(params.upstreamId != null && { id: params.upstreamId }),
    name: { notIn: TEST_UPSTREAM_NAMES },
  };

  const dailyInputs = await prisma.dailyInput.findMany({
    where: {
      ...dateFilter,
      status: 'confirmed',
      adSite: {
        upstream: { ...upstreamWhere },
        name: { notIn: TEST_AD_SITE_NAMES },
        downstreams: { some: {} },
        ...(params.adTypeCode && { adTypeId: params.adTypeCode }),
        ...(params.billingMethod && { billingMethod: params.billingMethod }),
      },
    },
    include: {
      adSite: {
        include: {
          upstream: { include: { defaultAdType: true } },
          downstreams: { include: { downstream: true } },
          adType: true,
        },
      },
    },
    orderBy: { recordDate: 'asc' },
  });

  type GroupKey = string;
  const groups = new Map<GroupKey, {
    date: string;
    upstreamId: string;
    upstream: string;
    billingMethod: BillingMethod;
    qtySum: number;
    revenueSum: number;
    recordCount: number;
    inputs: DailyInputWithSite[];
  }>();

  for (const di of dailyInputs) {
    const upstream = di.adSite.upstream;
    const key = `${di.recordDate.toISOString().slice(0,10)}|${upstream.id}|${di.adSite.billingMethod}`;
    if (!groups.has(key)) {
      groups.set(key, {
        date: di.recordDate.toISOString().slice(0, 10),
        upstreamId: String(upstream.id),
        upstream: upstream.name,
        billingMethod: di.adSite.billingMethod as BillingMethod,
        qtySum: 0,
        revenueSum: 0,
        recordCount: 0,
        inputs: [],
      });
    }
    const g = groups.get(key)!;
    g.qtySum += parseInt(String(di.qty)) || 0;
    g.revenueSum += parseFloat(di.revenue.toString()) || 0;
    g.recordCount += 1;
    g.inputs.push(di as DailyInputWithSite);
  }

  const rows: TotalProfitRow[] = [];
  const yiyiAppliedDates = new Set<string>();

  for (const g of groups.values()) {
    const { totalCost, errors } = await aggregateDownstreamCost(g.inputs);

    if (errors.length > 0) {
      console.warn('Downstream cost errors for total-profit group:', errors);
    }

    let yiyiCost = 0;
    if (!yiyiAppliedDates.has(g.date)) {
      yiyiCost = yiyiByDate.get(g.date) ?? 0;
      yiyiAppliedDates.add(g.date);
    }
    const totalCostWithYiyi = Math.round((totalCost + yiyiCost) * 100) / 100;

    const profitRes = calculateProfit(g.revenueSum, totalCostWithYiyi);

    rows.push({
      date: g.date,
      upstreamId: g.upstreamId,
      upstream: g.upstream,
      billingMethod: g.billingMethod,
      qty: g.qtySum,
      revenue: profitRes.revenue,
      cost: profitRes.cost,
      grossProfit: profitRes.grossProfit,
      tax: profitRes.tax,
      profit: profitRes.profit,
      profitRate: profitRes.profitRate,
      recordCount: g.recordCount,
    });
  }

  return rows.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return String(a.upstreamId).localeCompare(String(b.upstreamId));
  });
}

export interface OrderProfitParams {
  date?: string;
  startDate?: string;
  endDate?: string;
  advertiserId?: string;
  upstreamId?: string;
  adTypeCode?: string;
  billingMethod?: BillingMethod;
}

export interface OrderProfitRow {
  date: string;
  orderId: number | null;
  orderName: string | null;
  adTypeCode: string | null;
  adTypeName: string | null;
  upstreamId: string;
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
}

export async function getOrderProfit(params: OrderProfitParams): Promise<OrderProfitRow[]> {
  const dateFilter = buildDateFilter(params);

  const upstreamWhere: Prisma.UpstreamWhereInput = {
    ...(params.advertiserId != null && { id: params.advertiserId }),
    ...(params.upstreamId != null && { id: params.upstreamId }),
    name: { notIn: TEST_UPSTREAM_NAMES },
  };

  const dailyInputs = await prisma.dailyInput.findMany({
    where: {
      ...dateFilter,
      status: 'confirmed',
      adSite: {
        upstream: { ...upstreamWhere },
        name: { notIn: TEST_AD_SITE_NAMES },
        downstreams: { some: {} },
        ...(params.adTypeCode && { adTypeId: params.adTypeCode }),
        ...(params.billingMethod && { billingMethod: params.billingMethod }),
      },
    },
    include: {
      adSite: {
        include: {
          upstream: { include: { defaultAdType: true } },
          downstreams: { include: { downstream: true } },
          adType: true,
        },
      },
    },
    orderBy: { recordDate: 'asc' },
  });

  type GroupKey = string;
  const groups = new Map<GroupKey, {
    date: string;
    adTypeCode: string | null;
    adTypeName: string | null;
    upstreamId: string;
    upstream: string;
    billingMethod: BillingMethod;
    qtySum: number;
    revenueSum: number;
    recordCount: number;
    inputs: DailyInputWithSite[];
  }>();

  for (const di of dailyInputs) {
    const upstream = di.adSite.upstream;
    const adType = di.adSite.adType ?? null;
    const key = `${di.recordDate.toISOString().slice(0,10)}|${adType?.id ?? ''}|${upstream.id}|${di.adSite.billingMethod}`;

    if (!groups.has(key)) {
      groups.set(key, {
        date: di.recordDate.toISOString().slice(0, 10),
        adTypeCode: adType?.name ?? null,
        adTypeName: adType?.name ?? null,
        upstreamId: String(upstream.id),
        upstream: upstream.name,
        billingMethod: di.adSite.billingMethod as BillingMethod,
        qtySum: 0,
        revenueSum: 0,
        recordCount: 0,
        inputs: [],
      });
    }
    const g = groups.get(key)!;
    g.qtySum += parseInt(String(di.qty)) || 0;
    g.revenueSum += parseFloat(di.revenue.toString()) || 0;
    g.recordCount += 1;
    g.inputs.push(di as DailyInputWithSite);
  }

  const rows: OrderProfitRow[] = [];

  for (const g of groups.values()) {
    const { totalCost, errors } = await aggregateDownstreamCost(g.inputs);

    if (errors.length > 0) {
      console.warn('Downstream cost errors for order-profit group:', errors);
    }

    const profitRes = calculateProfit(g.revenueSum, totalCost);

    rows.push({
      date: g.date,
      orderId: null,
      orderName: null,
      adTypeCode: g.adTypeCode,
      adTypeName: g.adTypeName,
      upstreamId: g.upstreamId,
      upstream: g.upstream,
      billingMethod: g.billingMethod,
      qty: g.qtySum,
      revenue: profitRes.revenue,
      cost: profitRes.cost,
      grossProfit: profitRes.grossProfit,
      tax: profitRes.tax,
      profit: profitRes.profit,
      profitRate: profitRes.profitRate,
      recordCount: g.recordCount,
    });
  }

  return rows.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return String(a.upstreamId).localeCompare(String(b.upstreamId));
  });
}