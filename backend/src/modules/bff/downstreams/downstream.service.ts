import { prisma } from '../../../shared/prisma/client';
import { mapDownstream } from '../mappers';
import type { Prisma } from '@prisma/client';
import type { EntityStatus } from '../bff.types';

export interface ListDownstreamsFilters {
  adTypeCode?: string;
  status?: EntityStatus;
  keyword?: string;
}

export async function listDownstreams(filters?: ListDownstreamsFilters) {
  const where: Prisma.DownstreamWhereInput = {};

  if (filters?.adTypeCode) {
    where.adType = { code: filters.adTypeCode };
  }

  if (filters?.status) {
    where.status = filters.status;
  }

  if (filters?.keyword) {
    where.downstreamType = { contains: filters.keyword, mode: 'insensitive' };
  }

  const rows = await prisma.downstream.findMany({
    where,
    include: { adType: true },
    orderBy: { id: 'asc' },
  });

  return rows.map(r => mapDownstream(r));
}