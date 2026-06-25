/**
 * Phase 4B1/4B2: Settlement Service
 *
 * Advertiser settlement:
 * - confirmed DailyInput only
 * - exclude quarantined
 * - amount = SUM(DailyInput.revenue)
 * - group by advertiser / upstream
 * - DailyInput.revenue is source of truth (no recalculation)
 * - No payout rate logic
 *
 * Media settlement (Phase 4B2):
 * - confirmed DailyInput only
 * - exclude quarantined
 * - one row per media (upstream); revenue counted ONCE per DailyInput
 * - cost = SUM(resolved downstream costs) for all active downstreams of that media
 * - grossProfit = revenue - cost
 * - tax = grossProfit > 0 ? grossProfit * 0.06 : 0
 * - profit = grossProfit - tax
 * - profitRate = profit / revenue
 * - Revenue always from DailyInput.revenue (no recalculation)
 */

import { prisma } from '../../../shared/prisma/client';
import type { Prisma } from '@prisma/client';
import {
  aggregateDownstreamCost,
  calculateProfit,
  type DailyInputWithSite,
} from '../../../shared/services/payout.service';
import type { BillingMethod } from '../../../shared/services/revenue.service';

function actualAdTypeWhere(adTypeId: string): Prisma.AdSiteWhereInput {
  return {
    upstream: { defaultAdType: { id: adTypeId } },
  };
}

export interface AdvertiserSettlementParams {
  period?: string;
  advertiserId?: string;
  adTypeId?: string;
}

export interface AdvertiserSettlementRow {
  period: string;
  advertiserId: string;
  advertiser: string;
  adTypeCode: string | null;
  adTypeName: string | null;
  totalAmount: number;
  recordCount: number;
}

export async function getAdvertiserSettlement(params: AdvertiserSettlementParams): Promise<AdvertiserSettlementRow[]> {
  const { advertiserId, adTypeId } = params;

  let dateFilter: Prisma.DailyInputWhereInput = {};
  if (params.period) {
    const [year, month] = params.period.split('-').map(Number);
    const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    dateFilter = { recordDate: { gte: start, lte: end } };
  }

  const upstreamWhere: Prisma.UpstreamWhereInput = {
    ...(advertiserId != null && { id: advertiserId }),
  };

  const dailyInputs = await prisma.dailyInput.findMany({
    where: {
      ...dateFilter,
      status: 'confirmed',
      adSite: {
        ...(adTypeId && actualAdTypeWhere(adTypeId)),
        upstream: { ...upstreamWhere },
      },
    },
    include: {
      adSite: {
        include: {
          upstream: { include: { defaultAdType: true } },
        },
      },
    },
    orderBy: { recordDate: 'asc' },
  });

  const byAdvertiser = new Map<string, AdvertiserSettlementRow>();

  for (const di of dailyInputs) {
    const upstream = di.adSite.upstream;
    const adType = upstream?.defaultAdType ?? null;
    const code = adType?.name ?? null;
    const name = adType?.name ?? null;
    const key = `${upstream.id}|${code ?? ''}`;

    if (!byAdvertiser.has(key)) {
      byAdvertiser.set(key, {
        period: params.period ?? '',
        advertiserId: String(upstream.id),
        advertiser: upstream.name,
        adTypeCode: code,
        adTypeName: name,
        totalAmount: 0,
        recordCount: 0,
      });
    }
    const row = byAdvertiser.get(key)!;
    const rev = di.revenue ? parseFloat(di.revenue.toString()) || 0 : 0;
    row.totalAmount = Math.round((row.totalAmount + rev) * 100) / 100;
    row.recordCount += 1;
  }

  return Array.from(byAdvertiser.values()).sort((a, b) => String(a.advertiserId).localeCompare(String(b.advertiserId)));
}

export interface MediaSettlementParams {
  period?: string;
  mediaId?: string;
  adTypeId?: string;
}

export interface MediaSettlementRow {
  period: string;
  mediaId: string;
  media: string;
  adTypeCode: string | null;
  adTypeName: string | null;
  downstreamName: string | null;
  revenue: number;
  cost: number;
  grossProfit: number;
  tax: number;
  profit: number;
  profitRate: number;
  recordCount: number;
}

export async function getMediaSettlement(params: MediaSettlementParams): Promise<MediaSettlementRow[]> {
  const { mediaId, adTypeId } = params;

  let dateFilter: Prisma.DailyInputWhereInput = {};
  if (params.period) {
    const [year, month] = params.period.split('-').map(Number);
    const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    dateFilter = { recordDate: { gte: start, lte: end } };
  }

  const upstreamWhere: Prisma.UpstreamWhereInput = {
    ...(mediaId != null && { id: mediaId }),
  };

  const dailyInputs = await prisma.dailyInput.findMany({
    where: {
      ...dateFilter,
      status: 'confirmed',
      adSite: {
        ...(adTypeId && actualAdTypeWhere(adTypeId)),
        upstream: { ...upstreamWhere },
        downstreams: { some: {} },
      },
    },
    include: {
      adSite: {
        include: {
          upstream: { include: { defaultAdType: true } },
          downstreams: {
            include: {
              downstream: true,
            },
          },
        },
      },
    },
    orderBy: { recordDate: 'asc' },
  });

  type GroupKey = string;
  const groups = new Map<GroupKey, {
    period: string;
    mediaId: string;
    media: string;
    adTypeCode: string | null;
    adTypeName: string | null;
    downstreamNames: Set<string>;
    revenueSum: number;
    recordCount: number;
    inputs: DailyInputWithSite[];
  }>();

  for (const di of dailyInputs) {
    const upstream = di.adSite.upstream;
    const adType = upstream?.defaultAdType ?? null;
    const adTypeCodeResolved = adType?.name ?? null;
    const adTypeName = adType?.name ?? null;

    const key = `${upstream.id}|${adTypeCodeResolved ?? ''}`;
    if (!groups.has(key)) {
      groups.set(key, {
        period: params.period ?? '',
        mediaId: String(upstream.id),
        media: upstream.name,
        adTypeCode: adTypeCodeResolved,
        adTypeName,
        downstreamNames: new Set<string>(),
        revenueSum: 0,
        recordCount: 0,
        inputs: [],
      });
    }
    const g = groups.get(key)!;
    g.revenueSum += parseFloat(di.revenue.toString()) || 0;
    g.recordCount += 1;
    g.inputs.push(di as DailyInputWithSite);
    for (const j of di.adSite.downstreams) {
      if (j.downstream?.downstreamType) g.downstreamNames.add(j.downstream.downstreamType);
    }
  }

  const rows: MediaSettlementRow[] = [];

  for (const g of groups.values()) {
    const { totalCost, errors } = await aggregateDownstreamCost(g.inputs);

    if (errors.length > 0) {
      console.warn('Downstream cost errors for media settlement:', errors);
    }

    const profitRes = calculateProfit(g.revenueSum, totalCost);

    const downstreamName = g.downstreamNames.size > 0
      ? Array.from(g.downstreamNames).sort().join(', ')
      : null;

    rows.push({
      period: g.period,
      mediaId: g.mediaId,
      media: g.media,
      adTypeCode: g.adTypeCode,
      adTypeName: g.adTypeName,
      downstreamName,
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
    if (a.mediaId !== b.mediaId) return String(a.mediaId).localeCompare(String(b.mediaId));
    return (a.downstreamName ?? '').localeCompare(b.downstreamName ?? '');
  });
}