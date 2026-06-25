import { prisma } from '../../../shared/prisma/client';
import { mapMediaId } from '../mappers';
import type { Prisma } from '@prisma/client';
import type { EntryType } from '../bff.types';

export interface ListMediaIdsFilters {
  mediaId?: string;
  adTypeCode?: string;
  type?: EntryType;
  archived?: boolean;
}

export async function listMediaIds(filters?: ListMediaIdsFilters) {
  const where: Prisma.AdSiteDownstreamWhereInput = {};

  if (filters?.mediaId) {
    where.adSiteId = filters.mediaId;
  }

  if (filters?.adTypeCode || filters?.type !== undefined || filters?.archived !== undefined) {
    where.adSite = {
      ...(filters.adTypeCode ? { upstream: { defaultAdType: { name: filters.adTypeCode } } } : {}),
      ...(filters.type !== undefined ? { billingMethod: filters.type } : {}),
      ...(filters.archived !== undefined ? { isArchived: filters.archived } : {}),
    };
  }

  const rows = await prisma.adSiteDownstream.findMany({
    where,
    include: {
      adSite: {
        include: {
          upstream: { include: { defaultAdType: true } },
        },
      },
      downstream: true,
      mediaAdType: true,
    },
    orderBy: { id: 'asc' },
  });

  return rows.map(r => mapMediaId(r));
}

export async function getMediaId(id: string) {
  const row = await prisma.adSiteDownstream.findUnique({
    where: { id },
    include: {
      adSite: {
        include: {
          upstream: { include: { defaultAdType: true } },
        },
      },
      downstream: true,
      mediaAdType: true,
    },
  });
  if (!row) return null;
  return mapMediaId(row);
}