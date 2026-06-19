// Shared mappers: DB model → BFF frontend-facing types
// All mappers verified against frontend bffTypes.ts interfaces

import type { Decimal } from '@prisma/client/runtime/library';
import type { Advertiser, Media, AdOrder, AdId, MediaId, DownstreamDto } from './bff.types';
import type { Upstream, AdSite, AdOrder as PrismaAdOrder, AdSiteDownstream, Downstream, DownstreamAdType, AdType, UpstreamAdType } from '../../shared/prisma/client';
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

export function mapAdvertiser(upstream: Upstream & { adType: AdType; adTypeLinks?: Array<UpstreamAdType & { adType: AdType }> }): Advertiser {
  const linkedAdTypes = (upstream.adTypeLinks ?? []).map(link => link.adType).filter(Boolean);
  const adTypes = linkedAdTypes.length ? linkedAdTypes : upstream.adType ? [upstream.adType] : [];
  const adTypeCodes = Array.from(new Set(adTypes.map(adType => adType.code)));
  return {
    id: upstream.id,
    name: upstream.name,
    contact: upstream.contact,
    phone: upstream.phone,
    email: upstream.email,
    notes: upstream.notes,
    status: upstream.status as EntityStatus,
    adTypeCode: upstream.adType?.code ?? adTypeCodes[0],
    adTypeCodes,
    adTypes: adTypes.map(adType => ({ id: adType.id, code: adType.code, name: adType.name })),
  };
}

function actualAdType(site: { adOrder?: { adType?: AdType | null } | null; upstream?: { adType?: AdType | null } | null }) {
  return site.adOrder?.adType ?? site.upstream?.adType ?? null;
}

export function mapMedia(site: AdSite & { upstream: Upstream & { adType: AdType }; adOrder?: (PrismaAdOrder & { adType: AdType }) | null }): Media {
  const adType = actualAdType(site);
  return {
    id: site.id,
    name: site.name,
    contact: site.upstream?.contact ?? null,
    phone: site.upstream?.phone ?? null,
    email: site.upstream?.email ?? null,
    notes: null,
    status: site.status as EntityStatus,
    upstreamId: site.upstreamId,
    adTypeCode: adType?.code,
    adTypeName: adType?.name ?? null,
    billingMethod: site.billingMethod as EntryType | undefined,
    currentUnitPrice: decimalToNum(site.currentUnitPrice),
    currentRatio: decimalToNum(site.currentRatio),
  };
}

export function mapAdOrder(
  order: PrismaAdOrder & { upstream: Upstream; adType: AdType; _count?: { adSites: number } },
  billingMethods: string[] = []
): AdOrder {
  return {
    id: order.id,
    advId: order.upstreamId,
    name: order.name,
    adTypeCode: order.adType?.code ?? '',
    adTypeName: order.adType?.name ?? null,
    notes: order.notes,
    status: order.status as EntityStatus,
    isVirtual: (order as { isVirtual?: boolean }).isVirtual,
    advertiserName: order.upstream?.name ?? undefined,
    adSiteCount: order._count?.adSites ?? 0,
    billingMethods: Array.isArray(billingMethods) ? billingMethods : [],
    createdAt: order.createdAt ? order.createdAt.toISOString() : undefined,
  };
}

export function mapAdId(
  site: AdSite & { upstream: Upstream & { adType: AdType }; adOrder: (PrismaAdOrder & { adType?: AdType }) | null }
): AdId {
  // slot field — schema has no separate slot column; use adSite.name as slot identifier
  // rate — currentUnitPrice for CPM/CPA, currentRatio for RATIO
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
    adTypeCode: actualAdType(site)?.code ?? '',
    adTypeName: actualAdType(site)?.name ?? null,
    adOrderId: site.adOrderId ?? null,
    upstreamId: site.upstreamId,
    billingMethod: site.billingMethod as EntryType,
    isActive: site.isActive,
    isArchived: site.isArchived,
  };
}

export function mapMediaId(
  j: AdSiteDownstream & {
    adSite: AdSite & { upstream: Upstream & { adType: AdType }; adOrder?: (PrismaAdOrder & { adType?: AdType }) | null };
    downstream: Downstream;
  }
): MediaId {
  return {
    id: j.adSite.id,
    junctionId: j.id,
    slot: j.adSite.name,
    type: j.adSite.billingMethod as EntryType,
    rate: decimalToNull(j.customPrice) ?? decimalToNull(j.downstream.payoutRate),
    shareRatio: decimalToNull(j.downstream.payoutRate),
    status: 'active' as EntityStatus, // AdSiteDownstream has no status column → default active
    mediaId: j.adSite.id,
    mediaName: j.adSite.name,
    adTypeCode: actualAdType(j.adSite)?.code ?? '',
    adTypeName: actualAdType(j.adSite)?.name ?? null,
    upstreamId: j.adSite.upstreamId,
    billingMethod: j.adSite.billingMethod as EntryType,
    isActive: j.adSite.isActive,
    isArchived: j.adSite.isArchived,
    adSiteId: j.adSiteId,
    downstreamId: j.downstreamId,
  };
}

export function mapDownstream(
  d: Downstream & { adTypeLinks: Array<DownstreamAdType & { adType: AdType }> }
): DownstreamDto {
  const linked = (d.adTypeLinks ?? []).map(l => l.adType).filter(Boolean);
  const adTypes = linked;
  const adTypeCodes = Array.from(new Set(adTypes.map(at => at.code)));
  const primary = adTypes[0];
  return {
    id: d.id,
    downstreamType: d.downstreamType,
    adTypeIds: adTypes.map(at => at.id),
    adTypeCodes,
    adTypes: adTypes.map(at => ({ id: at.id, code: at.code, name: at.name })),
    adTypeCode: primary?.code ?? '',
    adTypeName: primary?.name ?? null,
    payoutRate: Number(d.payoutRate),
    status: d.status as EntityStatus,
  };
}