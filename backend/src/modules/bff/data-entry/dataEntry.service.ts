import { prisma } from '../../../shared/prisma/client';
import type { Prisma } from '@prisma/client';
import type { Upstream, AdSite, AdType, Downstream, AdSiteDownstream } from '../../../shared/prisma/client';
import type { AdvertiserEntryRow, MediaEntryRow } from './dataEntry.types';
import type { DataEntryStatus, EntryType } from '../bff.types';

export interface ListAdvertiserEntriesParams {
  date: string;
  advertiserId?: string | number;
  adTypeId?: string;
  status?: string;
}

export interface ListMediaEntriesParams {
  date: string;
  mediaId?: string | number;
  adTypeId?: string;
  status?: string;
}

function toNum(d: Prisma.Decimal | null | undefined): number | undefined {
  if (d == null) return undefined;
  return d.toNumber();
}

function toStr(d: Prisma.Decimal | null | undefined): string {
  if (d == null) return '';
  return d.toString();
}

async function adTypeFilterWhere(adTypeId: string): Promise<Prisma.AdSiteWhereInput> {
  const adType = await prisma.adType.findUnique({ where: { id: adTypeId } });
  if (!adType) return { id: '__none__' };
  return { adTypeId: adType.id };
}

export async function listAdvertiserEntries(params: ListAdvertiserEntriesParams) {
  const { date, advertiserId, adTypeId, status } = params;

  const d = new Date(date);
  const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const recordDate = new Date(dateStr);

  const siteWhere: Prisma.AdSiteWhereInput = {
    isArchived: false,
    ...(advertiserId != null && { upstreamId: String(advertiserId) }),
    ...(adTypeId && await adTypeFilterWhere(adTypeId)),
  };

  const adSites = await prisma.adSite.findMany({
    where: siteWhere,
    include: {
      upstream: { include: { defaultAdType: true } },
      adType: true,
    },
    orderBy: { id: 'asc' },
  });

  const dailyInputs = await prisma.dailyInput.findMany({
    where: {
      recordDate,
      ...(status && status !== 'all' && status !== 'unconfirmed' && { status }),
    },
  });
  const diBySiteId = new Map(dailyInputs.map(di => [di.adSiteId, di]));

  const rows: AdvertiserEntryRow[] = adSites.map(site => {
    const di = diBySiteId.get(site.id);
    if (!di) {
      return makeAdvertiserRow(site, recordDate, null);
    }
    if (di.status === 'quarantined' && status !== 'quarantined') {
      return null;
    }
    return makeAdvertiserRow(site, recordDate, di);
  }).filter((r): r is AdvertiserEntryRow => r !== null);

  return rows;
}

function makeAdvertiserRow(
  site: AdSite & { upstream: Upstream & { defaultAdType: AdType | null }; adType?: AdType | null },
  recordDate: Date,
  di: Prisma.DailyInputGetPayload<{}> | null
): AdvertiserEntryRow {
  const upstream = site.upstream;
  const adType = site.adType ?? null;

  const rate = (site.billingMethod === 'CPM' || site.billingMethod === 'CPC' || site.billingMethod === 'CPA')
    ? toStr(di?.unitPriceSnapshot ?? site.currentUnitPrice)
    : toStr(di?.ratioSnapshot ?? site.currentRatio);

  let traffic = '';
  let settlement = '';
  if (di) {
    if (site.billingMethod === 'CPM' || site.billingMethod === 'CPC' || site.billingMethod === 'CPA') {
      traffic = String(di.qty);
    } else {
      traffic = toStr(di.amount1);
      settlement = toStr(di.amount2);
    }
  }

  const receivable = di ? toNum(di.revenue) ?? 0 : 0;
  const id = di?.id ?? '';

  return {
    id,
    date: formatDate(recordDate),
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
    status: (di?.status as DataEntryStatus) ?? 'pending',
    uiKey: `${site.id}-${formatDate(recordDate)}`,
  };
}

export async function listMediaEntries(params: ListMediaEntriesParams) {
  const { mediaId, adTypeId, status } = params;

  const dateStr = `${params.date}`.slice(0, 10);
  const recordDate = new Date(dateStr + 'T00:00:00.000Z');

  const siteWhere: Prisma.AdSiteWhereInput = {
    isArchived: false,
    ...(mediaId != null && { id: String(mediaId) }),
    ...(adTypeId && await adTypeFilterWhere(adTypeId)),
    downstreams: { some: {} },
  };

  const adSites = await prisma.adSite.findMany({
    where: siteWhere,
    include: {
      upstream: { include: { defaultAdType: true } },
      downstreams: {
        include: { downstream: true },
        orderBy: { id: 'asc' },
      },
      adType: true,
    },
    orderBy: { id: 'asc' },
  });

  const siteIds = adSites.map(s => s.id);
  const dailyInputs = await prisma.dailyInput.findMany({
    where: {
      recordDate,
      adSiteId: { in: siteIds },
      ...(status && status !== 'all' && status !== 'unconfirmed' && { status }),
    },
  });
  const diBySiteId = new Map(dailyInputs.map(di => [di.adSiteId, di]));

  const downstreamIds = adSites.flatMap(s => s.downstreams.map(d => d.downstreamId));
  const periods = await prisma.downstreamPeriod.findMany({
    where: {
      downstreamId: { in: downstreamIds },
      startDate: { lte: recordDate },
      OR: [{ endDate: null }, { endDate: { gte: recordDate } }],
    },
    orderBy: { startDate: 'desc' },
  });
  const rateByDownstreamId = new Map(periods.map(p => [p.downstreamId, toNum(p.unitPrice) ?? 0]));

  const rows: MediaEntryRow[] = [];
  for (const site of adSites) {
    for (const junction of site.downstreams) {
      const di = diBySiteId.get(site.id) ?? null;
      if (!di && status && status !== 'all') continue;
      if (di?.status === 'quarantined' && status !== 'quarantined') continue;

      const payoutRate = rateByDownstreamId.get(junction.downstreamId) ?? 0;
      const shareRatioResolved = 1;
      const row = makeMediaRow(site, junction, payoutRate, shareRatioResolved, recordDate, di);
      rows.push(row);
    }
  }

  return rows;
}

function makeMediaRow(
  site: AdSite & { upstream: Upstream & { defaultAdType: AdType | null }; downstreams: (AdSiteDownstream & { downstream: Downstream })[]; adType?: AdType | null },
  junction: AdSiteDownstream & { downstream: Downstream },
  payoutRate: number,
  shareRatioResolved: number,
  recordDate: Date,
  di: Prisma.DailyInputGetPayload<{}> | null
): MediaEntryRow {
  const upstream = site.upstream;
  const adType = site.adType ?? null;

  const adTypeCode = adType?.name ?? null;
  const adTypeName = adType?.name ?? null;

  const rate = site.billingMethod === 'CPM' || site.billingMethod === 'CPC' || site.billingMethod === 'CPA'
    ? toStr(di?.unitPriceSnapshot ?? site.currentUnitPrice)
    : toStr(di?.ratioSnapshot ?? site.currentRatio);

  let traffic = '';
  let settlement = '';
  if (di) {
    if (site.billingMethod === 'CPM' || site.billingMethod === 'CPC' || site.billingMethod === 'CPA') {
      traffic = String(di.qty);
    } else {
      traffic = toStr(di.amount1);
      settlement = toStr(di.amount2);
    }
  }

  const receivable = di ? toNum(di.revenue) ?? 0 : 0;

  const shareRatioNum = shareRatioResolved;
  const shareRatio = shareRatioNum === 1 ? '1' : String(shareRatioNum);

  const actualReceived = receivable && shareRatioNum
    ? Number((receivable * shareRatioNum).toFixed(3))
    : null;

  const id = di?.id ?? '';

  return {
    id,
    date: formatDate(recordDate),
    media: upstream.name,
    mediaId: upstream.id,
    mediaAdTypeName: adTypeName ?? '',
    mediaAdTypeCode: adTypeCode,
    type: site.billingMethod as MediaEntryRow['type'],
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
    status: (di?.status as DataEntryStatus) ?? 'pending',
    uiKey: `${junction.id}-${formatDate(recordDate)}`,
  };
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}