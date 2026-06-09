import { prisma } from '../../../shared/prisma/client';
import { mapMedia } from '../mappers';

export async function listMedia() {
  const rows = await prisma.adSite.findMany({
    include: {
      upstream: { include: { adType: true } },
      adOrder: { include: { adType: true } },
    },
    orderBy: { id: 'asc' },
  });
  return rows.map(r => mapMedia(r));
}

export async function getMedia(id: number) {
  const row = await prisma.adSite.findUnique({
    where: { id },
    include: {
      upstream: { include: { adType: true } },
      adOrder: { include: { adType: true } },
    },
  });
  if (!row) return null;
  return mapMedia(row);
}
