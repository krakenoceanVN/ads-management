import { prisma } from '../../../shared/prisma/client';
import { mapAdId } from '../mappers';
import type { Prisma } from '@prisma/client';
import type { EntryType } from '../bff.types';

export interface ListAdIdsFilters {
  advertiserId?: number;
  adOrderId?: number;
  adTypeCode?: string;
  type?: EntryType;
  archived?: boolean;
}

export async function listAdIds(filters?: ListAdIdsFilters) {
  const where: Prisma.AdSiteWhereInput = {};

  if (filters?.advertiserId != null) {
    where.upstreamId = filters.advertiserId;
  }

  if (filters?.adOrderId != null) {
    where.adOrderId = filters.adOrderId;
  }

  if (filters?.adTypeCode) {
    where.upstream = { adType: { code: filters.adTypeCode } };
  }

  if (filters?.type) {
    where.billingMethod = filters.type;
  }

  if (filters?.archived !== undefined) {
    where.isArchived = filters.archived;
  }

  const rows = await prisma.adSite.findMany({
    where,
    include: {
      upstream: { include: { adType: true } },
      adOrder: true,
    },
    orderBy: { id: 'asc' },
  });

  return rows.map(r => mapAdId(r));
}

export async function getAdId(id: number) {
  const row = await prisma.adSite.findUnique({
    where: { id },
    include: {
      upstream: { include: { adType: true } },
      adOrder: true,
    },
  });
  if (!row) return null;
  return mapAdId(row);
}