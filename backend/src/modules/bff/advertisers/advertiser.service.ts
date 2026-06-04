import { prisma } from '../../../shared/prisma/client';
import { mapAdvertiser } from '../mappers';
import type { Upstream, AdType } from '../../../shared/prisma/client';

export async function listAdvertisers() {
  const rows = await prisma.upstream.findMany({
    include: { adType: true },
    orderBy: { id: 'asc' },
  });
  return rows.map(r => mapAdvertiser(r as Upstream & { adType: AdType }));
}

export async function getAdvertiser(id: number) {
  const row = await prisma.upstream.findUnique({
    where: { id },
    include: { adType: true },
  });
  if (!row) return null;
  return mapAdvertiser(row as Upstream & { adType: AdType });
}