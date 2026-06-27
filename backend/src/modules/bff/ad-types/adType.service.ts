/**
 * AdType BFF Service
 * Read-only service for listing AdTypes.
 * Write operations (create/update/delete) are in adType.write.service.ts.
 *
 * Per docx mục 1.2: AdType giữ vai trò "đơn quảng cáo của nhà QC".
 */

import { prisma } from '../../../shared/prisma/client';
import type { AdType } from '../../../shared/prisma/client';

export interface AdTypeDto {
  id: string;
  name: string;
  upstreamId: string | null;
  upstreamName?: string | null;
  notes: string | null;
  status: string;
  adSiteCount?: number;
  createdAt: string;
  updatedAt: string;
}

function toDto(adType: AdType & { upstream?: { name: string } | null; _count?: { adSites: number } }): AdTypeDto {
  return {
    id: adType.id,
    name: adType.name,
    upstreamId: adType.upstreamId,
    upstreamName: adType.upstream?.name ?? null,
    notes: adType.notes,
    status: adType.status,
    adSiteCount: adType._count?.adSites ?? 0,
    createdAt: adType.createdAt.toISOString(),
    updatedAt: adType.updatedAt.toISOString(),
  };
}

export async function listAdTypes(): Promise<AdTypeDto[]> {
  const rows = await prisma.adType.findMany({
    orderBy: { id: 'asc' },
  });
  const ownerIds = rows.map(r => r.upstreamId).filter((x): x is string => Boolean(x));
  const owners = await prisma.upstream.findMany({
    where: { id: { in: ownerIds } },
    select: { id: true, name: true },
  });
  const ownerMap = new Map(owners.map(o => [o.id, o.name]));
  // "Số lượng link" = số ID quảng cáo (AdSite) thuộc nhà QC sở hữu đơn QC này.
  // AdSite gắn với Upstream; đơn QC suy ra qua owner (AdType.upstreamId).
  const adSiteCounts = ownerIds.length
    ? await prisma.adSite.groupBy({
        by: ['upstreamId'],
        where: { upstreamId: { in: ownerIds } },
        _count: { _all: true },
      })
    : [];
  const adSiteCountByUpstream = new Map(adSiteCounts.map(c => [c.upstreamId, c._count._all]));
  return rows.map(r => ({
    ...toDto(r),
    upstreamName: r.upstreamId ? (ownerMap.get(r.upstreamId) ?? null) : null,
    adSiteCount: r.upstreamId ? (adSiteCountByUpstream.get(r.upstreamId) ?? 0) : 0,
  }));
}

export async function getAdType(id: string): Promise<AdTypeDto | null> {
  const row = await prisma.adType.findUnique({ where: { id } });
  if (!row) return null;
  const owner = row.upstreamId
    ? await prisma.upstream.findUnique({ where: { id: row.upstreamId }, select: { name: true } })
    : null;
  // "Số lượng link" = số AdSite thuộc nhà QC sở hữu đơn QC này.
  const adSiteCount = row.upstreamId
    ? await prisma.adSite.count({ where: { upstreamId: row.upstreamId } })
    : 0;
  return {
    ...toDto(row),
    upstreamName: owner?.name ?? null,
    adSiteCount,
  };
}