import { prisma } from '../../../shared/prisma/client';
import { mapAdvertiser } from '../mappers';

const advertiserInclude = {
  adType: true,
  adTypeLinks: { include: { adType: true }, orderBy: { adTypeId: 'asc' as const } },
};

export async function listAdvertisers() {
  const rows = await prisma.upstream.findMany({
    include: advertiserInclude,
    orderBy: { id: 'asc' },
  });
  return rows.map(r => mapAdvertiser(r));
}

export async function getAdvertiser(id: number) {
  const row = await prisma.upstream.findUnique({
    where: { id },
    include: advertiserInclude,
  });
  if (!row) return null;
  return mapAdvertiser(row);
}
