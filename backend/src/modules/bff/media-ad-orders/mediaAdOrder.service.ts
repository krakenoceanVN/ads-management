import { prisma } from '../../../shared/prisma/client';
import { mapMediaAdOrder } from '../mappers';
import type { Prisma } from '@prisma/client';

export async function listMediaAdOrders(params?: { downstreamId?: string; adTypeId?: string }) {
  const where: Prisma.MediaAdOrderWhereInput = {};

  if (params?.downstreamId != null) {
    where.downstreamId = params.downstreamId;
  }

  if (params?.adTypeId) {
    where.adTypeId = params.adTypeId;
  }

  const rows = await prisma.mediaAdOrder.findMany({
    where,
    include: {
      downstream: true,
      adType: true,
    },
    orderBy: { id: 'asc' },
  });

  const downstreamIds = Array.from(new Set(rows.map(r => r.downstreamId)));
  // linkCount: số MediaId (AdSiteDownstream junction) thuộc các AdSite mà downstream này đang liên kết.
  // Tính bằng cách đếm AdSiteDownstream rows mà adSiteId thuộc tập AdSite của downstream đó.
  const downstreamAdSiteIds = downstreamIds.length
    ? await prisma.adSiteDownstream.findMany({
        where: { downstreamId: { in: downstreamIds } },
        select: { adSiteId: true, downstreamId: true },
      })
    : [];
  // Count MediaId per downstream: number of AdSiteDownstream rows whose adSiteId is linked to that downstream.
  const countMap = new Map<string, number>();
  for (const row of downstreamAdSiteIds) {
    countMap.set(row.downstreamId, (countMap.get(row.downstreamId) ?? 0) + 1);
  }

  return rows.map(r => mapMediaAdOrder(r, countMap.get(r.downstreamId) ?? 0));
}

export async function getMediaAdOrder(id: string) {
  const row = await prisma.mediaAdOrder.findUnique({
    where: { id },
    include: {
      downstream: true,
      adType: true,
    },
  });
  if (!row) return null;
  // linkCount = số MediaId (AdSiteDownstream) của downstream này
  const count = await prisma.adSiteDownstream.count({ where: { downstreamId: row.downstreamId } });
  return mapMediaAdOrder(row, count);
}
