import { prisma } from '../../../shared/prisma/client';
import { mapMedia } from '../mappers';
import type { Prisma } from '@prisma/client';

export interface ListMediaFilters {
  upstreamId?: string;
  adTypeId?: string;
}

export async function listMedia(filters?: ListMediaFilters) {
  const where: Prisma.AdSiteWhereInput = {};
  if (filters?.upstreamId) {
    where.upstreamId = filters.upstreamId;
  }
  if (filters?.adTypeId) {
    where.upstream = { defaultAdType: { id: filters.adTypeId } };
  }
  const rows = await prisma.adSite.findMany({
    where,
    include: {
      upstream: { include: { defaultAdType: true } },
    },
    orderBy: { id: 'asc' },
  });
  return rows.map(r => mapMedia(r));
}

export async function getMedia(id: string) {
  const row = await prisma.adSite.findUnique({
    where: { id },
    include: {
      upstream: { include: { defaultAdType: true } },
    },
  });
  if (!row) return null;
  return mapMedia(row);
}