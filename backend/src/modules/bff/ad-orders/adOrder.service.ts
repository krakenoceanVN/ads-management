import { prisma } from '../../../shared/prisma/client';
import { mapAdOrder } from '../mappers';
import type { Prisma } from '@prisma/client';

export async function listAdOrders(params?: { advertiserId?: number; adTypeCode?: string }) {
  const where: Prisma.AdOrderWhereInput = {};

  if (params?.advertiserId != null) {
    where.upstreamId = params.advertiserId;
  }

  if (params?.adTypeCode) {
    where.adType = { code: params.adTypeCode };
  }

  const rows = await prisma.adOrder.findMany({
    where,
    include: {
      upstream: true,
      adType: true,
    },
    orderBy: { id: 'asc' },
  });

  return rows.map(r => mapAdOrder(r));
}

export async function getAdOrder(id: number) {
  const row = await prisma.adOrder.findUnique({
    where: { id },
    include: {
      upstream: true,
      adType: true,
    },
  });
  if (!row) return null;
  return mapAdOrder(row);
}