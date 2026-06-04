import { prisma } from '../../../shared/prisma/client';
import { mapMediaId } from '../mappers';
import type { Prisma } from '@prisma/client';
import type { EntryType } from '../bff.types';

export interface ListMediaIdsFilters {
  mediaId?: number;
  adTypeCode?: string;
  type?: EntryType;
  archived?: boolean;
}

export async function listMediaIds(filters?: ListMediaIdsFilters) {
  const where: Prisma.AdSiteDownstreamWhereInput = {};

  if (filters?.mediaId != null) {
    where.adSiteId = filters.mediaId;
  }

  if (filters?.adTypeCode || filters?.type !== undefined || filters?.archived !== undefined) {
    where.adSite = {
      upstream: filters.adTypeCode ? { adType: { code: filters.adTypeCode } } : undefined,
      billingMethod: filters.type,
      isArchived: filters.archived,
    };
  }

  const rows = await prisma.adSiteDownstream.findMany({
    where,
    include: {
      adSite: {
        include: {
          upstream: { include: { adType: true } },
        },
      },
      downstream: true,
    },
    orderBy: { id: 'asc' },
  });

  return rows.map(r => mapMediaId(r));
}

export async function getMediaId(id: number) {
  const row = await prisma.adSiteDownstream.findUnique({
    where: { id },
    include: {
      adSite: {
        include: {
          upstream: { include: { adType: true } },
        },
      },
      downstream: true,
    },
  });
  if (!row) return null;
  return mapMediaId(row);
}