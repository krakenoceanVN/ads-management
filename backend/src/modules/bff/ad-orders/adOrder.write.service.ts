import { prisma } from '../../../shared/prisma/client';
import { mapAdOrder } from '../mappers';
import type { AdOrder, Upstream, AdType } from '../../../shared/prisma/client';
import type { EntityStatus } from '../bff.types';

export interface CreateAdOrderInput {
  advertiserId: number;
  name: string;
  adTypeCode: string;
  notes?: string | null;
  status?: EntityStatus;
}

export interface UpdateAdOrderInput {
  name?: string;
  notes?: string | null;
  status?: EntityStatus;
  advertiserId?: number;
  adTypeCode?: string;
}

export async function createAdOrder(input: CreateAdOrderInput) {
  const { advertiserId, adTypeCode, ...rest } = input;

  // Resolve adTypeId from adTypeCode
  const adType = await prisma.adType.findUnique({ where: { code: adTypeCode } });
  if (!adType) throw new Error('Invalid adTypeCode');

  const row = await prisma.adOrder.create({
    data: {
      upstreamId: advertiserId,
      adTypeId: adType.id,
      name: rest.name,
      notes: rest.notes ?? null,
      status: rest.status ?? 'active',
    },
    include: { upstream: true, adType: true },
  });
  return mapAdOrder(row as AdOrder & { upstream: Upstream; adType: AdType });
}

export async function updateAdOrder(id: number, input: UpdateAdOrderInput) {
  const { advertiserId, adTypeCode, ...rest } = input;
  const updateData: Record<string, unknown> = {};

  if (rest.name !== undefined) updateData['name'] = rest.name;
  if (rest.notes !== undefined) updateData['notes'] = rest.notes;
  if (rest.status !== undefined) updateData['status'] = rest.status;
  if (advertiserId !== undefined) updateData['upstreamId'] = advertiserId;
  if (adTypeCode !== undefined) {
    const adType = await prisma.adType.findUnique({ where: { code: adTypeCode } });
    if (!adType) throw new Error('Invalid adTypeCode');
    updateData['adTypeId'] = adType.id;
  }

  const row = await prisma.adOrder.update({
    where: { id },
    data: updateData,
    include: { upstream: true, adType: true },
  });
  return mapAdOrder(row as AdOrder & { upstream: Upstream; adType: AdType });
}

export async function deleteAdOrder(id: number) {
  // Soft delete: set status to inactive
  const row = await prisma.adOrder.update({
    where: { id },
    data: { status: 'inactive' },
    include: { upstream: true, adType: true },
  });
  return mapAdOrder(row as AdOrder & { upstream: Upstream; adType: AdType });
}
