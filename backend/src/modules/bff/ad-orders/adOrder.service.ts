import { prisma } from '../../../shared/prisma/client';
import { mapAdOrder } from '../mappers';
import type { Prisma } from '@prisma/client';

const ACTIVE_SITE_FILTER = { status: 'active', isArchived: false } as const;

async function fetchBillingMethodsByOrder(adOrderIds: number[]): Promise<Map<number, string[]>> {
  const result = new Map<number, string[]>();
  if (adOrderIds.length === 0) return result;

  for (const id of adOrderIds) result.set(id, []);

  const groups = await prisma.adSite.groupBy({
    by: ['adOrderId', 'billingMethod'],
    where: {
      adOrderId: { in: adOrderIds },
      ...ACTIVE_SITE_FILTER,
    },
  });

  for (const g of groups) {
    if (g.adOrderId == null) continue;
    const list = result.get(g.adOrderId);
    if (!list || list.includes(g.billingMethod)) continue;
    list.push(g.billingMethod);
  }

  for (const list of result.values()) list.sort();
  return result;
}

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
      _count: {
        select: {
          adSites: { where: ACTIVE_SITE_FILTER },
        },
      },
    },
    orderBy: { id: 'asc' },
  });

  const billingMap = await fetchBillingMethodsByOrder(rows.map(r => r.id));
  return rows.map(r => mapAdOrder(r, billingMap.get(r.id) ?? []));
}

export async function getAdOrder(id: number) {
  const row = await prisma.adOrder.findUnique({
    where: { id },
    include: {
      upstream: true,
      adType: true,
      _count: {
        select: {
          adSites: { where: ACTIVE_SITE_FILTER },
        },
      },
    },
  });
  if (!row) return null;

  const billingMap = await fetchBillingMethodsByOrder([row.id]);
  return mapAdOrder(row, billingMap.get(row.id) ?? []);
}