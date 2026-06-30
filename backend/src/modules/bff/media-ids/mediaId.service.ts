import { prisma } from '../../../shared/prisma/client';
import { mapMediaId } from '../mappers';
import type { Prisma } from '@prisma/client';
import type { EntityStatus, EntryType } from '../bff.types';

export interface ListMediaIdsFilters {
  mediaId?: string;
  advertiserId?: string;
  adTypeId?: string;
  adTypeCode?: string;
  adSiteId?: string;
  downstreamId?: string;
  mediaAdOrderId?: string;
  mediaIdName?: string;
  status?: EntityStatus;
  keyword?: string;
  type?: EntryType;
  archived?: boolean;
}

function buildAdSiteWhere(filters?: ListMediaIdsFilters): Prisma.AdSiteWhereInput | undefined {
  const adSiteWhere: Prisma.AdSiteWhereInput = {};

  const adSiteId = filters?.adSiteId ?? filters?.mediaId;
  if (adSiteId) adSiteWhere.id = adSiteId;
  if (filters?.advertiserId) adSiteWhere.upstreamId = filters.advertiserId;
  if (filters?.adTypeId) adSiteWhere.adTypeId = filters.adTypeId;
  if (filters?.adTypeCode) adSiteWhere.adType = { name: filters.adTypeCode };
  if (filters?.type !== undefined) adSiteWhere.billingMethod = filters.type;
  if (filters?.archived !== undefined) adSiteWhere.isArchived = filters.archived;

  return Object.keys(adSiteWhere).length ? adSiteWhere : undefined;
}

export async function listMediaIds(filters?: ListMediaIdsFilters) {
  const where: Prisma.AdSiteDownstreamWhereInput = {};

  const adSiteWhere = buildAdSiteWhere(filters);
  if (adSiteWhere) where.adSite = adSiteWhere;

  if (filters?.downstreamId) where.downstreamId = filters.downstreamId;
  if (filters?.mediaAdOrderId) where.mediaAdOrderId = filters.mediaAdOrderId;
  if (filters?.mediaIdName) where.mediaIdName = { contains: filters.mediaIdName, mode: 'insensitive' };
  if (filters?.status) where.status = filters.status;

  if (filters?.keyword) {
    const keywordFilter: Prisma.AdSiteDownstreamWhereInput = {
      OR: [
        { mediaIdName: { contains: filters.keyword, mode: 'insensitive' } },
        { notes: { contains: filters.keyword, mode: 'insensitive' } },
        { adSite: { name: { contains: filters.keyword, mode: 'insensitive' } } },
        { adSite: { upstream: { name: { contains: filters.keyword, mode: 'insensitive' } } } },
        { adSite: { adType: { name: { contains: filters.keyword, mode: 'insensitive' } } } },
        { downstream: { name: { contains: filters.keyword, mode: 'insensitive' } } },
        { downstream: { downstreamType: { contains: filters.keyword, mode: 'insensitive' } } },
        { mediaAdOrder: { name: { contains: filters.keyword, mode: 'insensitive' } } },
      ],
    };
    where.AND = [...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []), keywordFilter];
  }

  const rows = await prisma.adSiteDownstream.findMany({
    where,
    include: {
      adSite: {
        include: {
          upstream: { include: { defaultAdType: true } },
          adType: true,
        },
      },
      downstream: true,
      mediaAdType: true,
      mediaAdOrder: true,
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
          adType: true,
        },
      },
      downstream: true,
      mediaAdType: true,
      mediaAdOrder: true,
    },
  });
  if (!row) return null;
  return mapMediaId(row);
}
