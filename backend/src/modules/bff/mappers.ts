// Shared mappers: DB model → BFF frontend-facing types
// All mappers verified against frontend bffTypes.ts interfaces

import type { Decimal } from '@prisma/client/runtime/library';
import type { Advertiser, Media, AdId, MediaId, DownstreamDto, MediaAdOrderDto } from './bff.types';
import type { Upstream, AdSite, AdSiteDownstream, Downstream, DownstreamAdType, AdType, UpstreamAdType, MediaAdOrder } from '../../shared/prisma/client';
import type { EntityStatus, EntryType } from './bff.types';

function decimalToNum(d: Decimal | null | undefined): number | undefined {
  if (d == null) return undefined;
  const n = Number(d);
  return Number.isFinite(n) ? n : undefined;
}

function decimalToNull(d: Decimal | null | undefined): number | null {
  if (d == null) return null;
  const n = Number(d);
  return Number.isFinite(n) ? n : null;
}

export function mapAdvertiser(upstream: Upstream & { defaultAdType: AdType | null; adTypeLinks?: Array<UpstreamAdType & { adType: AdType }>; ownedAdTypes?: AdType[] }): Advertiser {
  const linkedAdTypes = (upstream.adTypeLinks ?? []).map(link => link.adType).filter(Boolean);
  const ownedAdTypes = (upstream.ownedAdTypes ?? []).filter(Boolean);
  const allAdTypes = [
    ...linkedAdTypes,
    ...ownedAdTypes,
    ...(upstream.defaultAdType ? [upstream.defaultAdType] : []),
  ];
  const uniqueAdTypes = Array.from(new Map(allAdTypes.map(adType => [adType.id, adType])).values());
  const adTypeCodes = Array.from(new Set(uniqueAdTypes.map(adType => adType.name)));
  return {
    id: upstream.id,
    name: upstream.name,
    contact: upstream.contact,
    phone: upstream.phone,
    email: upstream.email,
    notes: upstream.notes,
    status: upstream.status as EntityStatus,
    adTypeCode: upstream.defaultAdType?.name ?? adTypeCodes[0],
    adTypeCodes,
    adTypes: uniqueAdTypes.map(adType => ({ id: adType.id, name: adType.name })),
  };
}

export function mapMedia(site: AdSite & { upstream: Upstream & { defaultAdType: AdType | null } }): Media {
  const adType = site.upstream?.defaultAdType ?? null;
  return {
    id: site.id,
    name: site.name,
    contact: site.upstream?.contact ?? null,
    phone: site.upstream?.phone ?? null,
    email: site.upstream?.email ?? null,
    notes: null,
    status: site.status as EntityStatus,
    upstreamId: site.upstreamId,
    adTypeCode: adType?.name,
    adTypeName: adType?.name ?? null,
    billingMethod: site.billingMethod as EntryType | undefined,
    currentUnitPrice: decimalToNum(site.currentUnitPrice),
    currentRatio: decimalToNum(site.currentRatio),
  };
}

export function mapAdId(
  site: AdSite & { upstream: Upstream & { defaultAdType: AdType | null } }
): AdId {
  const adType = site.upstream?.defaultAdType ?? null;
  const rate = site.billingMethod === 'CPM' || site.billingMethod === 'CPA'
    ? decimalToNull(site.currentUnitPrice)
    : decimalToNull(site.currentRatio);

  return {
    id: site.id,
    slot: site.name,
    type: site.billingMethod as EntryType,
    rate,
    notes: (site as { notes?: string | null }).notes ?? null,
    status: site.status as EntityStatus,
    advertiserId: site.upstreamId,
    advertiserName: site.upstream?.name ?? '',
    adTypeCode: adType?.name ?? '',
    adTypeName: adType?.name ?? null,
    upstreamId: site.upstreamId,
    billingMethod: site.billingMethod as EntryType,
    isActive: site.isActive,
    isArchived: site.isArchived,
  };
}

export function mapMediaId(
  j: AdSiteDownstream & {
    adSite: AdSite & { upstream: Upstream & { defaultAdType: AdType | null } };
    downstream: Downstream;
    mediaAdType?: AdType | null;
  }
): MediaId {
  const adType = j.adSite.upstream?.defaultAdType ?? null;
  return {
    id: j.adSite.id,
    junctionId: j.id,
    slot: j.adSite.name,
    type: j.adSite.billingMethod as EntryType,
    rate: decimalToNull(j.customPrice),
    shareRatio: j.pctHal ? Number(j.pctHal) : null,
    status: j.status as EntityStatus,
    mediaId: j.adSite.id,
    mediaName: j.adSite.name,
    adTypeCode: adType?.name ?? '',
    adTypeName: adType?.name ?? null,
    upstreamId: j.adSite.upstreamId,
    upstreamName: j.adSite.upstream?.name ?? null,
    downstreamId: j.downstreamId,
    downstreamName: j.downstream?.downstreamType ?? null,
    adSiteId: j.adSiteId,
    adSiteName: j.adSite?.name ?? null,
    notes: j.notes ?? null,
    billingMethod: j.adSite.billingMethod as EntryType,
    isActive: j.adSite.isActive,
    isArchived: j.adSite.isArchived,
    mediaAdTypeCode: j.mediaAdType?.name ?? null,
    mediaIdName: j.mediaIdName ?? null,
    pctHal: j.pctHal ? Number(j.pctHal) : null,
  };
}

export function mapDownstream(
  d: Downstream & { adTypeLinks: Array<DownstreamAdType & { adType: AdType }> }
): DownstreamDto {
  const linked = (d.adTypeLinks ?? []).map(l => l.adType).filter(Boolean);
  const adTypes = linked;
  const adTypeCodes = Array.from(new Set(adTypes.map(at => at.name)));
  const primary = adTypes[0];
  return {
    id: d.id,
    downstreamType: d.downstreamType,
    name: d.name ?? null,
    contact: d.contact ?? null,
    phone: d.phone ?? null,
    email: d.email ?? null,
    notes: d.notes ?? null,
    adTypeIds: adTypes.map(at => at.id),
    adTypeCodes,
    adTypes: adTypes.map(at => ({ id: at.id, name: at.name })),
    adTypeCode: primary?.name ?? '',
    adTypeName: primary?.name ?? null,
    payoutRate: null,
    status: d.status as EntityStatus,
  };
}

export function mapMediaAdOrder(
  row: MediaAdOrder & { adType?: AdType | null; downstream?: { name: string | null; downstreamType: string } | null },
  linkCount = 0
): MediaAdOrderDto {
  return {
    id: row.id,
    downstreamId: row.downstreamId,
    adTypeId: row.adTypeId,
    adTypeCode: row.adType?.name ?? '',
    adTypeName: row.adType?.name ?? null,
    seq: row.seq,
    name: row.name,
    notes: row.notes,
    status: row.status as EntityStatus,
    linkCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}