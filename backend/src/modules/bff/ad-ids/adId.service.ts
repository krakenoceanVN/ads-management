import { prisma } from '../../../shared/prisma/client';
import { mapAdId } from '../mappers';
import type { Prisma } from '@prisma/client';
import type { EntryType } from '../bff.types';

export interface ListAdIdsFilters {
  advertiserId?: string | number;
  adTypeId?: string;
  type?: EntryType;
  archived?: boolean;
}

export async function listAdIds(filters?: ListAdIdsFilters) {
  const where: Prisma.AdSiteWhereInput = {};

  if (filters?.advertiserId != null) {
    where.upstreamId = String(filters.advertiserId);
  }

  if (filters?.adTypeId) {
    where.adTypeId = filters.adTypeId;
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
      upstream: { include: { defaultAdType: true, ownedAdTypes: true } },
      adType: true,
    },
    orderBy: { id: 'asc' },
  });

  return rows.map(r => mapAdId(r));
}

export async function getAdId(id: string) {
  const row = await prisma.adSite.findUnique({
    where: { id },
    include: {
      upstream: { include: { defaultAdType: true, ownedAdTypes: true } },
      adType: true,
    },
  });
  if (!row) return null;
  return mapAdId(row);
}