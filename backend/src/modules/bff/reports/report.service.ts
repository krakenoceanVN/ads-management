/**
 * Phase 4A: Reports Read Service
 *
 * - advertiser report: entry-level per-DailyInput rows (not grouped), using stored DailyInput.revenue
 * - media report: grouped by media, using stored DailyInput.revenue
 *
 * Rules:
 * - Uses stored DailyInput.revenue as source of truth (no recalculation)
 * - Excludes quarantined records
 * - Includes confirmed records by default
 * - Does not hide inactive advertisers with confirmed historical data
 * - Does not hide archived media with confirmed historical data
 * - No DailyInput writes
 */

import { prisma } from '../../../shared/prisma/client';
import type { Prisma } from '@prisma/client';
import type { Upstream, AdSite, AdType, Downstream, AdSiteDownstream } from '../../../shared/prisma/client';
import type { AdvertiserEntryRow, MediaEntryRow } from '../data-entry/dataEntry.types';
import type { DataEntryStatus, EntryType } from '../bff.types';

export interface AdvertiserReportParams {
  date?: string;
  startDate?: string;
  endDate?: string;
  advertiserId?: string;
  adTypeCode?: string;
  status?: 'confirmed' | 'unconfirmed' | 'pending' | 'all';
}

export interface MediaReportParams {
  date?: string;
  startDate?: string;
  endDate?: string;
  mediaId?: string;
  adTypeCode?: string;
  status?: 'confirmed' | 'unconfirmed' | 'pending' | 'all';
}

function toNum(d: Prisma.Decimal | null | undefined): number | undefined {
  if (d == null) return undefined;
  return d.toNumber();
}

function toStr(d: Prisma.Decimal | null | undefined): string {
  if (d == null) return '';
  return d.toString();
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function actualAdType(site: { upstream: { defaultAdType?: AdType | null } | null }) {
  return site.upstream?.defaultAdType ?? null;
}

function actualAdTypeWhere(adTypeId: string): Prisma.AdSiteWhereInput {
  return {
    upstream: { defaultAdType: { id: adTypeId } },
  };
}

function makeReportAdvertiserRow(di: Prisma.DailyInputGetPayload<{
  include: {
    adSite: {
      include: {
        upstream: { include: { defaultAdType: true } };
      };
    };
  };
}>): AdvertiserEntryRow {
  const site = di.adSite;
  const upstream = site.upstream;
  const adType = actualAdType(site);

  const rate = (site.billingMethod === 'CPM' || site.billingMethod === 'CPA')
    ? toStr(di.unitPriceSnapshot ?? site.currentUnitPrice)
    : toStr(di.ratioSnapshot ?? site.currentRatio);

  let traffic = '';
  let settlement = '';
  if (site.billingMethod === 'CPM' || site.billingMethod === 'CPA') {
    traffic = String(di.qty);
  } else {
    traffic = toStr(di.amount1);
    settlement = toStr(di.amount2);
  }

  const receivable = toNum(di.revenue) ?? 0;

  return {
    id: di.id,
    date: formatDate(di.recordDate),
    advertiser: upstream.name,
    advertiserId: upstream.id,
    adTypeName: adType?.name ?? '',
    adTypeCode: adType?.name ?? null,
    type: site.billingMethod as EntryType,
    adId: site.name,
    adIdNum: site.id,
    rate,
    traffic,
    settlement,
    receivable: receivable || '',
    status: di.status as DataEntryStatus,
    uiKey: `${di.id}-${site.id}`,
  };
}

export async function getAdvertiserReport(params: AdvertiserReportParams): Promise<AdvertiserEntryRow[]> {
  const { advertiserId, adTypeCode, status } = params;

  let dateFilter: Prisma.DailyInputWhereInput = {};
  if (params.date) {
    const d = new Date(params.date + 'T00:00:00.000Z');
    dateFilter = { recordDate: d };
  } else if (params.startDate && params.endDate) {
    const start = new Date(params.startDate + 'T00:00:00.000Z');
    const end = new Date(params.endDate + 'T00:00:00.000Z');
    dateFilter = { recordDate: { gte: start, lte: end } };
  }

  const statusFilter: Prisma.DailyInputWhereInput = {};
  if (status && status !== 'all') {
    statusFilter.status = status;
  } else {
    statusFilter.status = 'confirmed';
  }

  const upstreamWhere: Prisma.UpstreamWhereInput = {
    ...(advertiserId != null && { id: advertiserId }),
  };

  const dailyInputs = await prisma.dailyInput.findMany({
    where: {
      ...dateFilter,
      ...statusFilter,
      status: { not: 'quarantined' },
      adSite: {
        ...(adTypeCode && actualAdTypeWhere(adTypeCode)),
        upstream: {
          ...upstreamWhere,
        },
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

  return dailyInputs.map(di => makeReportAdvertiserRow(di));
}

function makeReportMediaRow(
  di: Prisma.DailyInputGetPayload<{
    include: {
      adSite: {
        include: {
          upstream: { include: { defaultAdType: true } };
          downstreams: { include: { downstream: true } };
        };
      };
    };
  }>,
  site: Prisma.AdSiteGetPayload<{ include: { upstream: { include: { defaultAdType: true } }; downstreams: { include: { downstream: true } } } }>,
  upstream: Prisma.UpstreamGetPayload<{ include: { defaultAdType: true } }>,
  junction: Prisma.AdSiteDownstreamGetPayload<{ include: { downstream: true } }>,
  payoutRate: number,
): MediaEntryRow {
  const adTypeCode = actualAdType(site)?.name ?? null;
  const adTypeName = actualAdType(site)?.name ?? null;

  const rate = site.billingMethod === 'CPM' || site.billingMethod === 'CPA'
    ? toStr(di.unitPriceSnapshot ?? site.currentUnitPrice)
    : toStr(di.ratioSnapshot ?? site.currentRatio);

  let traffic = '';
  let settlement = '';
  if (site.billingMethod === 'CPM' || site.billingMethod === 'CPA') {
    traffic = String(di.qty);
  } else {
    traffic = toStr(di.amount1);
    settlement = toStr(di.amount2);
  }

  const receivable = toNum(di.revenue) ?? 0;
  const shareRatioNum = payoutRate;
  const shareRatio = shareRatioNum === 1 ? '1' : String(shareRatioNum);
  const actualReceived = receivable && shareRatioNum
    ? Number((receivable * shareRatioNum).toFixed(3))
    : null;

  return {
    id: di.id,
    date: formatDate(di.recordDate),
    media: upstream.name,
    mediaId: upstream.id,
    mediaAdTypeName: adTypeName ?? '',
    mediaAdTypeCode: adTypeCode,
    type: site.billingMethod as EntryType,
    mediaIdStr: site.name,
    upstreamAdId: site.name,
    upstreamAdIdNum: site.id,
    rate,
    traffic,
    settlement,
    dataCoefficient: '',
    receivable: receivable || '',
    shareRatio,
    shareRatioNum,
    actualReceived,
    status: di.status as DataEntryStatus,
    uiKey: `${di.id}-${junction.id}`,
  };
}

export async function getMediaReport(params: MediaReportParams): Promise<MediaEntryRow[]> {
  const { mediaId, adTypeCode, status } = params;

  let dateFilter: Prisma.DailyInputWhereInput = {};
  if (params.date) {
    const d = new Date(params.date + 'T00:00:00.000Z');
    dateFilter = { recordDate: d };
  } else if (params.startDate && params.endDate) {
    const start = new Date(params.startDate + 'T00:00:00.000Z');
    const end = new Date(params.endDate + 'T00:00:00.000Z');
    dateFilter = { recordDate: { gte: start, lte: end } };
  }

  const statusFilter: Prisma.DailyInputWhereInput = {};
  if (status && status !== 'all') {
    statusFilter.status = status;
  } else {
    statusFilter.status = 'confirmed';
  }

  const dailyInputs = await prisma.dailyInput.findMany({
    where: {
      ...dateFilter,
      ...statusFilter,
      status: { not: 'quarantined' },
      adSite: {
        downstreams: { some: {} },
        ...(mediaId != null && { upstreamId: mediaId }),
        ...(adTypeCode && actualAdTypeWhere(adTypeCode)),
      },
    },
    include: {
      adSite: {
        include: {
          upstream: { include: { defaultAdType: true } },
          downstreams: {
            include: { downstream: true },
          },
        },
      },
    },
    orderBy: { recordDate: 'asc' },
  });

  const rows: MediaEntryRow[] = [];
  for (const di of dailyInputs) {
    const site = di.adSite;
    if (!site.downstreams || site.downstreams.length === 0) continue;
    for (const junction of site.downstreams) {
      const payoutRate = 0.8; // payoutRate moved to DownstreamPeriod; fixed default for now
      rows.push(makeReportMediaRow(di, site, site.upstream, junction, payoutRate));
    }
  }
  return rows;
}