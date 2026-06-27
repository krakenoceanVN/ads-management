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

  // linkCount: số MediaId (AdSiteDownstream) được gắn trực tiếp với đơn QC media này
  // qua AdSiteDownstream.mediaAdOrderId.
  const orderIds = rows.map(r => r.id);
  const counts = orderIds.length
    ? await prisma.adSiteDownstream.groupBy({
        by: ['mediaAdOrderId'],
        where: { mediaAdOrderId: { in: orderIds } },
        _count: { _all: true },
      })
    : [];
  const countMap = new Map<string, number>();
  for (const c of counts) {
    if (c.mediaAdOrderId) countMap.set(c.mediaAdOrderId, c._count._all);
  }

  return rows.map(r => mapMediaAdOrder(r, countMap.get(r.id) ?? 0));
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
  // linkCount = số MediaId (AdSiteDownstream) gắn trực tiếp với đơn QC media này
  const count = await prisma.adSiteDownstream.count({ where: { mediaAdOrderId: row.id } });
  return mapMediaAdOrder(row, count);
}
