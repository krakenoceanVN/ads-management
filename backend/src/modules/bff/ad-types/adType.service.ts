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
  const ids = rows.map(r => r.id);
  const counts = await prisma.upstreamAdType.groupBy({
    by: ['adTypeId'],
    where: { adTypeId: { in: ids } },
    _count: { _all: true },
  });
  const countMap = new Map(counts.map(c => [c.adTypeId, c._count._all]));
  const ownerIds = rows.map(r => r.upstreamId).filter((x): x is string => Boolean(x));
  const owners = await prisma.upstream.findMany({
    where: { id: { in: ownerIds } },
    select: { id: true, name: true },
  });
  const ownerMap = new Map(owners.map(o => [o.id, o.name]));
  return rows.map(r => ({
    ...toDto(r),
    upstreamName: r.upstreamId ? (ownerMap.get(r.upstreamId) ?? null) : null,
    adSiteCount: countMap.get(r.id) ?? 0,
  }));
}

export async function getAdType(id: string): Promise<AdTypeDto | null> {
  const row = await prisma.adType.findUnique({ where: { id } });
  if (!row) return null;
  const linkCount = await prisma.upstreamAdType.count({ where: { adTypeId: id } });
  const owner = row.upstreamId
    ? await prisma.upstream.findUnique({ where: { id: row.upstreamId }, select: { name: true } })
    : null;
  return {
    ...toDto(row),
    upstreamName: owner?.name ?? null,
    adSiteCount: linkCount,
  };
}