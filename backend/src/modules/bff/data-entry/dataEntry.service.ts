import { prisma } from '../../../shared/prisma/client';
import type { Prisma } from '@prisma/client';
import type { Upstream, AdSite, AdType, Downstream, AdSiteDownstream } from '../../../shared/prisma/client';
import type { AdvertiserEntryRow, MediaEntryRow } from './dataEntry.types';
import type { DataEntryStatus, EntryType } from '../bff.types';

export interface ListAdvertiserEntriesParams {
  date?: string;
  startDate?: string;
  endDate?: string;
  advertiserId?: string | number;
  adTypeId?: string;
  status?: string;
}

export interface ListMediaEntriesParams {
  date?: string;
  startDate?: string;
  endDate?: string;
  mediaId?: string | number;
  adTypeId?: string;
  status?: string;
}

function buildRecordDates(params: { date?: string; startDate?: string; endDate?: string }): Date[] {
  const start = params.startDate || params.date;
  const end = params.endDate || params.date;
  if (!start || !end) return [];
  const startDate = new Date(start + 'T00:00:00.000Z');
  const endDate = new Date(end + 'T00:00:00.000Z');
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return [];
  const [from, to] = startDate <= endDate ? [startDate, endDate] : [endDate, startDate];
  const out: Date[] = [];
  const cursor = new Date(from);
  while (cursor <= to) {
    out.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
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
  const { advertiserId, adTypeId, status } = params;
  const recordDates = buildRecordDates(params);
  if (!recordDates.length) return [];

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

  const siteIds = adSites.map(s => s.id);
  const dailyInputs = siteIds.length
    ? await prisma.dailyInput.findMany({
        where: {
          recordDate: { in: recordDates },
          adSiteId: { in: siteIds },
          ...(status && status !== 'all' && status !== 'unconfirmed' && { status }),
        },
      })
    : [];
  const diByKey = new Map(dailyInputs.map(di => [`${di.recordDate.toISOString()}|${di.adSiteId}`, di]));

  const wantOnlyFilled = !!status && status !== 'all';
  const rows: AdvertiserEntryRow[] = [];
  for (const site of adSites) {
    for (const recordDate of recordDates) {
      const key = `${recordDate.toISOString()}|${site.id}`;
      const di = diByKey.get(key) ?? null;
      if (!di) {
        if (wantOnlyFilled) continue;
        rows.push(makeAdvertiserRow(site, recordDate, null));
        continue;
      }
      if (di.status === 'quarantined' && status !== 'quarantined') continue;
      if (status && status !== 'all' && status !== 'unconfirmed' && di.status !== status) continue;
      rows.push(makeAdvertiserRow(site, recordDate, di));
    }
  }

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

  const recordDates = buildRecordDates(params);
  if (!recordDates.length) return [];

  const minDate = recordDates[0];
  const maxDate = recordDates[recordDates.length - 1];

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
  const dailyInputs = siteIds.length
    ? await prisma.dailyInput.findMany({
        where: {
          recordDate: { in: recordDates },
          adSiteId: { in: siteIds },
          status: status && status !== 'all' && status !== 'unconfirmed' ? status : undefined,
        },
      })
    : [];
  const diByKey = new Map(dailyInputs.map(di => [`${di.recordDate.toISOString()}|${di.adSiteId}`, di]));

  const junctionIds = adSites.flatMap(s => s.downstreams.map(d => d.id));
  const mediaDailyInputs = junctionIds.length
    ? await prisma.mediaDailyInput.findMany({
        where: { recordDate: { in: recordDates }, adSiteDownstreamId: { in: junctionIds } },
      })
    : [];
  const mdiByKey = new Map(mediaDailyInputs.map(m => [`${m.recordDate.toISOString()}|${m.adSiteDownstreamId}`, m]));

  const downstreamIds = adSites.flatMap(s => s.downstreams.map(d => d.downstreamId));
  const periods = downstreamIds.length
    ? await prisma.downstreamPeriod.findMany({
        where: {
          downstreamId: { in: downstreamIds },
          startDate: { lte: maxDate },
          OR: [{ endDate: null }, { endDate: { gte: minDate } }],
        },
        orderBy: [{ startDate: 'desc' }, { id: 'asc' }],
      })
    : [];
  const periodByDownstreamId = new Map<string, typeof periods>();
  for (const p of periods) {
    const list = periodByDownstreamId.get(p.downstreamId);
    if (list) list.push(p);
    else periodByDownstreamId.set(p.downstreamId, [p]);
  }

  const wantOnlyFilled = !!status && status !== 'all';
  const rows: MediaEntryRow[] = [];
  for (const site of adSites) {
    for (const junction of site.downstreams) {
      for (const recordDate of recordDates) {
        const diKey = `${recordDate.toISOString()}|${site.id}`;
        const di = diByKey.get(diKey) ?? null;
        if (!di) {
          if (wantOnlyFilled) continue;
          // Media row luôn cần advertiser DailyInput (traffic/settlement/revenue).
          continue;
        }
        if (di.status === 'quarantined' && status !== 'quarantined') continue;
        if (status && status !== 'all' && status !== 'unconfirmed' && di.status !== status) continue;

        const activePeriod = periodByDownstreamId.get(junction.downstreamId)?.[0] ?? null;
        const mdiKey = `${recordDate.toISOString()}|${junction.id}`;
        const mdi = mdiByKey.get(mdiKey) ?? null;
        const row = makeMediaRow(site, junction, activePeriod, recordDate, di, mdi);
        rows.push(row);
      }
    }
  }

  return rows;
}

function makeMediaRow(
  site: AdSite & { upstream: Upstream & { defaultAdType: AdType | null }; downstreams: (AdSiteDownstream & { downstream: Downstream })[]; adType?: AdType | null },
  junction: AdSiteDownstream & { downstream: Downstream },
  activePeriod: { pctHal: Prisma.Decimal; unitPrice: Prisma.Decimal | null } | null,
  recordDate: Date,
  di: Prisma.DailyInputGetPayload<{}> | null,
  mdi: Prisma.MediaDailyInputGetPayload<{}> | null
): MediaEntryRow {
  const upstream = site.upstream;
  const adType = site.adType ?? null;

  const adTypeCode = adType?.name ?? null;
  const adTypeName = adType?.name ?? null;

  const customPriceNum = junction.customPrice != null ? toNum(junction.customPrice) : undefined;
  const periodPriceNum = activePeriod?.unitPrice != null ? toNum(activePeriod.unitPrice) : undefined;
  const resolvedRate = customPriceNum ?? periodPriceNum;
  const rate = resolvedRate != null ? String(resolvedRate) : '';

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

  const junctionPctHal = junction.pctHal != null ? toNum(junction.pctHal) : undefined;
  const periodPctHal = activePeriod?.pctHal != null ? toNum(activePeriod.pctHal) : undefined;
  const shareRatioNum = junctionPctHal ?? periodPctHal ?? 1;
  const shareRatio = shareRatioNum === 1 ? '1' : String(shareRatioNum);

  const dataCoefficientNum = mdi ? toNum(mdi.dataCoefficient) ?? 1 : 1;
  const dataCoefficient = dataCoefficientNum === 1 ? '1' : String(dataCoefficientNum);

  const actualReceived = receivable
    ? Number((receivable * shareRatioNum * dataCoefficientNum).toFixed(3))
    : null;

  const id = mdi?.id ?? '';

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
    junctionId: junction.id,
    rate,
    traffic,
    settlement,
    dataCoefficient,
    receivable: receivable || '',
    shareRatio,
    shareRatioNum,
    actualReceived,
    status: (mdi?.status as DataEntryStatus | undefined) ?? 'pending',
    uiKey: `${junction.id}-${formatDate(recordDate)}`,
  };
}

function formatDate(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}