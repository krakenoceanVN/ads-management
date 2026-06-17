import { prisma } from '../../../shared/prisma/client';
import { mapDownstream } from '../mappers';
import type { Prisma } from '@prisma/client';
import type { EntityStatus } from '../bff.types';

export interface ListDownstreamsFilters {
  adTypeCode?: string;
  status?: EntityStatus;
  keyword?: string;
}

export const downstreamInclude = {
  adTypeLinks: { include: { adType: true }, orderBy: { adTypeId: 'asc' as const } },
};

export async function listDownstreams(filters?: ListDownstreamsFilters) {
  const where: Prisma.DownstreamWhereInput = {};

  if (filters?.adTypeCode) {
    where.adTypeLinks = { some: { adType: { code: filters.adTypeCode } } };
  }

  if (filters?.status) {
    where.status = filters.status;
  }

  if (filters?.keyword) {
    where.downstreamType = { contains: filters.keyword, mode: 'insensitive' };
  }

  const rows = await prisma.downstream.findMany({
    where,
    include: downstreamInclude,
    orderBy: { id: 'asc' },
  });

  return rows.map(r => mapDownstream(r));
}

export async function getDownstreamById(id: number) {
  const row = await prisma.downstream.findUnique({
    where: { id },
    include: downstreamInclude,
  });
  return row ? mapDownstream(row) : null;
}
