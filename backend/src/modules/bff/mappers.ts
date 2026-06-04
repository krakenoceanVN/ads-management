// Shared mappers: DB model → BFF frontend-facing types
// All mappers verified against frontend bffTypes.ts interfaces

import type { Decimal } from '@prisma/client/runtime/library';
import type { Advertiser, Media, AdOrder, AdId, MediaId, DownstreamDto } from './bff.types';
import type { Upstream, AdSite, AdOrder as PrismaAdOrder, AdSiteDownstream, Downstream, AdType } from '../../shared/prisma/client';
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

export function mapAdvertiser(upstream: Upstream & { adType: AdType }): Advertiser {
  return {
    id: upstream.id,
    name: upstream.name,
    contact: upstream.contact,
    phone: upstream.phone,
    email: upstream.email,
    notes: upstream.notes,
    status: upstream.status as EntityStatus,
    adTypeCode: upstream.adType?.code,
  };
}

export function mapMedia(site: AdSite & { upstream: Upstream & { adType: AdType } }): Media {
  return {
    id: site.id,
    name: site.name,
    contact: site.upstream?.contact ?? null,
    phone: site.upstream?.phone ?? null,
    email: site.upstream?.email ?? null,
    notes: null,
    status: site.status as EntityStatus,
    upstreamId: site.upstreamId,
    adTypeCode: site.upstream?.adType?.code,
    billingMethod: site.billingMethod as EntryType | undefined,
    currentUnitPrice: decimalToNum(site.currentUnitPrice),
    currentRatio: decimalToNum(site.currentRatio),
  };
}

export function mapAdOrder(order: PrismaAdOrder & { upstream: Upstream; adType: AdType }): AdOrder {
  return {
    id: order.id,
    advId: order.upstreamId,
    name: order.name,
    adTypeCode: order.adType?.code ?? '',
    notes: order.notes,
    status: order.status as EntityStatus,
  };
}

export function mapAdId(
  site: AdSite & { upstream: Upstream & { adType: AdType }; adOrder: PrismaAdOrder | null }
): AdId {
  // slot field — schema has no separate slot column; use adSite.name as slot identifier
  // rate — currentUnitPrice for CPM, currentRatio for RATIO
  const rate = site.billingMethod === 'CPM'
    ? decimalToNull(site.currentUnitPrice)
    : decimalToNull(site.currentRatio);

  return {
    id: site.id,
    slot: site.name,
    type: site.billingMethod as EntryType,
    rate,
    status: site.status as EntityStatus,
    advertiserId: site.upstreamId,
    advertiserName: site.upstream?.name ?? '',
    adTypeCode: site.upstream?.adType?.code ?? '',
    adOrderId: site.adOrderId ?? null,
    upstreamId: site.upstreamId,
    billingMethod: site.billingMethod as EntryType,
    isActive: site.isActive,
    isArchived: site.isArchived,
  };
}

export function mapMediaId(
  j: AdSiteDownstream & {
    adSite: AdSite & { upstream: Upstream & { adType: AdType } };
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
    adTypeCode: j.adSite.upstream?.adType?.code ?? '',
    upstreamId: j.adSite.upstreamId,
    billingMethod: j.adSite.billingMethod as EntryType,
    isActive: j.adSite.isActive,
    isArchived: j.adSite.isArchived,
    adSiteId: j.adSiteId,
    downstreamId: j.downstreamId,
  };
}

export function mapDownstream(d: Downstream & { adType: AdType }): DownstreamDto {
  return {
    id: d.id,
    downstreamType: d.downstreamType,
    adTypeId: d.adTypeId,
    adTypeCode: d.adType?.code ?? '',
    payoutRate: Number(d.payoutRate),
    status: d.status as EntityStatus,
  };
}