import { prisma } from '../../../shared/prisma/client';
import { mapAdOrder } from '../mappers';
import { generateAndCreateAdOrder } from './seq';
import type { AdOrder, Upstream, AdType } from '../../../shared/prisma/client';
import type { EntityStatus } from '../bff.types';

export interface CreateAdOrderInput {
  advertiserId: number;
  name?: string | null;
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

  const adType = await prisma.adType.findUnique({ where: { code: adTypeCode } });
  if (!adType) throw new Error('Invalid adTypeCode');

  const row = await generateAndCreateAdOrder(prisma, {
    upstreamId: advertiserId,
    adTypeId: adType.id,
    adTypeCode: adType.code,
    name: rest.name ?? null,
    notes: rest.notes ?? null,
    status: rest.status ?? 'active',
  });

  // Reload with the joins the mapper needs (upstream, adType).
  const reloaded = await prisma.adOrder.findUnique({
    where: { id: row.id },
    include: { upstream: true, adType: true },
  });
  if (!reloaded) throw new Error('AdOrder disappeared after create');
  return mapAdOrder(reloaded as AdOrder & { upstream: Upstream; adType: AdType });
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
  // Soft delete: set status to inactive. seq is NOT freed — gaps are allowed
  // and intentional (we never want a future row to claim a stale seq).
  const row = await prisma.adOrder.update({
    where: { id },
    data: { status: 'inactive' },
    include: { upstream: true, adType: true },
  });
  return mapAdOrder(row as AdOrder & { upstream: Upstream; adType: AdType });
}
