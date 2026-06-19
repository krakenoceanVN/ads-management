import { prisma } from '../../../shared/prisma/client';
import { mapMedia } from '../mappers';
import type { Prisma } from '@prisma/client';

export interface ListMediaFilters {
  adOrderId?: number;
}

export async function listMedia(filters?: ListMediaFilters) {
  const where: Prisma.AdSiteWhereInput = {};
  if (filters?.adOrderId != null) {
    where.adOrderId = filters.adOrderId;
  }
  const rows = await prisma.adSite.findMany({
    where,
    include: {
      upstream: { include: { adType: true } },
      adOrder: { include: { adType: true } },
    },
    orderBy: { id: 'asc' },
  });
  return rows.map(r => mapMedia(r));
}

export async function getMedia(id: number) {
  const row = await prisma.adSite.findUnique({
    where: { id },
    include: {
      upstream: { include: { adType: true } },
      adOrder: { include: { adType: true } },
    },
  });
  if (!row) return null;
  return mapMedia(row);
}
