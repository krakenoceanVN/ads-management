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

export interface AdvertiserSettlementParams {
  period?: string;       // YYYY-MM
  advertiserId?: number;
  adTypeCode?: string;
}

// ─── Advertiser Settlement ────────────────────────────────────────────────────

export interface AdvertiserSettlementRow {
  advertiserId: number;
  advertiser: string;
  adTypeCode: string | null;
  totalAmount: number;  // SUM(DailyInput.revenue), no recalculation
  recordCount: number;
}

export async function getAdvertiserSettlement(params: AdvertiserSettlementParams): Promise<AdvertiserSettlementRow[]> {
  const { advertiserId, adTypeCode } = params;

  // Build period date filter (UTC, consistent with how recordDate is stored)
  let dateFilter: Prisma.DailyInputWhereInput = {};
  if (params.period) {
    const [year, month] = params.period.split('-').map(Number);
    const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    dateFilter = { recordDate: { gte: start, lte: end } };
  }

  // Build upstream filter
  const upstreamWhere: Prisma.UpstreamWhereInput = {
    ...(advertiserId != null && { id: advertiserId }),
    ...(adTypeCode && { adType: { code: adTypeCode } }),
  };

  const dailyInputs = await prisma.dailyInput.findMany({
    where: {
      ...dateFilter,
      status: 'confirmed',
      adSite: {
        upstream: { ...upstreamWhere },
      },
    },
    include: {
      adSite: {
        include: {
          upstream: { include: { adType: true } },
        },
      },
    },
    orderBy: { recordDate: 'asc' },
  });

  const byAdvertiser = new Map<number, AdvertiserSettlementRow>();

  for (const di of dailyInputs) {
    const upstream = di.adSite.upstream;
    const code = upstream.adType?.code ?? null;

    if (!byAdvertiser.has(upstream.id)) {
      byAdvertiser.set(upstream.id, {
        advertiserId: upstream.id,
        advertiser: upstream.name,
        adTypeCode: code,
        totalAmount: 0,
        recordCount: 0,
      });
    }
    const row = byAdvertiser.get(upstream.id)!;
    const rev = di.revenue ? parseFloat(di.revenue.toString()) || 0 : 0;
    row.totalAmount = Math.round((row.totalAmount + rev) * 100) / 100;
    row.recordCount += 1;
  }

  return Array.from(byAdvertiser.values()).sort((a, b) => a.advertiserId - b.advertiserId);
}

// ─── Media Settlement ──────────────────────────────────────────────────────────

export interface MediaSettlementParams {
  period?: string;       // YYYY-MM
  mediaId?: number;
  adTypeCode?: string;
}

export interface MediaSettlementRow {
  mediaId: number;
  media: string;
  adTypeCode: string | null;
  downstreamName: string | null;
  revenue: number;        // SUM(DailyInput.revenue)
  cost: number;          // SUM(resolved downstream costs)
  grossProfit: number;
  tax: number;
  profit: number;
  profitRate: number;
  recordCount: number;
}

export async function getMediaSettlement(params: MediaSettlementParams): Promise<MediaSettlementRow[]> {
  const { mediaId, adTypeCode } = params;

  // Build period date filter (UTC, consistent with how recordDate is stored)
  let dateFilter: Prisma.DailyInputWhereInput = {};
  if (params.period) {
    const [year, month] = params.period.split('-').map(Number);
    const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    dateFilter = { recordDate: { gte: start, lte: end } };
  }

  const upstreamWhere: Prisma.UpstreamWhereInput = {
    ...(mediaId != null && { id: mediaId }),
    ...(adTypeCode && { adType: { code: adTypeCode } }),
  };

  // Only adSites that have at least one downstream junction
  const dailyInputs = await prisma.dailyInput.findMany({
    where: {
      ...dateFilter,
      status: 'confirmed',
      adSite: {
        upstream: { ...upstreamWhere },
        downstreams: { some: {} },
      },
    },
    include: {
      adSite: {
        include: {
          upstream: { include: { adType: true } },
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

  // Group by media (upstream) only — one row per media.
  // Revenue is counted ONCE per DailyInput, and cost is the SUM of all active
  // downstream costs for that media (via aggregateDownstreamCost). Grouping by
  // (media, downstream) previously duplicated both revenue and cost when an
  // adSite had multiple downstream junctions.
  type GroupKey = string;
  const groups = new Map<GroupKey, {
    mediaId: number;
    media: string;
    adTypeCode: string | null;
    downstreamNames: Set<string>;
    revenueSum: number;
    recordCount: number;
    inputs: DailyInputWithSite[];
  }>();

  for (const di of dailyInputs) {
    const upstream = di.adSite.upstream;
    const adTypeCode = upstream.adType?.code ?? null;

    const key = `${upstream.id}`;
    if (!groups.has(key)) {
      groups.set(key, {
        mediaId: upstream.id,
        media: upstream.name,
        adTypeCode,
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
    // Collect distinct downstream names for display
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
      mediaId: g.mediaId,
      media: g.media,
      adTypeCode: g.adTypeCode,
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
    if (a.mediaId !== b.mediaId) return a.mediaId - b.mediaId;
    return (a.downstreamName ?? '').localeCompare(b.downstreamName ?? '');
  });
}
