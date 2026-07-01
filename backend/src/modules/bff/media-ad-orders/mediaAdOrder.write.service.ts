import { prisma } from '../../../shared/prisma/client';
import { ConflictError } from '../../../shared/errors/AppError';
import { mapMediaAdOrder } from '../mappers';
import { generateAndCreateMediaAdOrder } from './seq';
import { isValidId } from '../../../shared/ids';
import type { MediaAdOrder, Downstream, AdType } from '../../../shared/prisma/client';
import type { EntityStatus } from '../bff.types';

export interface CreateMediaAdOrderInput {
  downstreamId: string;
  adTypeId?: string | null;
  name?: string | null;
  notes?: string | null;
  status?: EntityStatus;
}

export interface UpdateMediaAdOrderInput {
  name?: string;
  notes?: string | null;
  status?: EntityStatus;
  downstreamId?: string;
  adTypeId?: string | null;
}

export async function createMediaAdOrder(input: CreateMediaAdOrderInput) {
  const { downstreamId, adTypeId, ...rest } = input;
  // Validate by existence, not id format — legacy ids (e.g. "DS001") are valid.
  if (!downstreamId) throw new Error('Invalid downstreamId');
  const downstream = await prisma.downstream.findUnique({ where: { id: downstreamId } });
  if (!downstream) throw new Error('Invalid downstreamId');

  let resolvedAdTypeId: string | null = null;
  if (adTypeId != null && adTypeId !== '') {
    const adType = await prisma.adType.findUnique({ where: { id: adTypeId } });
    if (!adType) throw new Error('Invalid adTypeId');
    resolvedAdTypeId = adType.id;
  }

  const row = await generateAndCreateMediaAdOrder(prisma, {
    downstreamId,
    adTypeId: resolvedAdTypeId,
    name: rest.name ?? null,
    notes: rest.notes ?? null,
    status: rest.status ?? 'active',
  });

  const reloaded = await prisma.mediaAdOrder.findUnique({
    where: { id: row.id },
    include: { downstream: true, adType: true },
  });
  if (!reloaded) throw new Error('MediaAdOrder disappeared after create');
  return mapMediaAdOrder(reloaded as MediaAdOrder & { downstream: Downstream; adType: AdType | null });
}

export async function updateMediaAdOrder(id: string, input: UpdateMediaAdOrderInput) {
  if (!isValidId(id)) throw new Error('Invalid id');
  const { downstreamId, adTypeId, ...rest } = input;
  const updateData: Record<string, unknown> = {};

  if (rest.name !== undefined) {
    const name = (rest.name ?? '').trim();
    // Media ad order name is unique per downstream (Media), not global.
    if (name) {
      const targetDownstream = downstreamId ?? existing.downstreamId;
      const dupe = await prisma.mediaAdOrder.findFirst({
        where: { name: { equals: name, mode: 'insensitive' }, downstreamId: targetDownstream, NOT: { id } },
        select: { id: true },
      });
      if (dupe) throw new ConflictError(`Tên đơn quảng cáo '${name}' đã tồn tại trong Media này`);
    }
    updateData['name'] = rest.name;
  }
  if (rest.notes !== undefined) updateData['notes'] = rest.notes;
  if (rest.status !== undefined) updateData['status'] = rest.status;
  if (downstreamId !== undefined) {
    const downstream = await prisma.downstream.findUnique({ where: { id: downstreamId } });
    if (!downstream) throw new Error('Invalid downstreamId');
    updateData['downstreamId'] = downstreamId;
  }
  if (adTypeId !== undefined) {
    if (adTypeId == null || adTypeId === '') {
      updateData['adTypeId'] = null;
    } else {
      const adType = await prisma.adType.findUnique({ where: { id: adTypeId } });
      if (!adType) throw new Error('Invalid adTypeId');
      updateData['adTypeId'] = adTypeId;
    }
  }

  const row = await prisma.mediaAdOrder.update({
    where: { id },
    data: updateData,
    include: { downstream: true, adType: true },
  });
  return mapMediaAdOrder(row as MediaAdOrder & { downstream: Downstream; adType: AdType | null });
}

export async function deleteMediaAdOrder(id: string) {
  if (!isValidId(id)) throw new Error('Invalid id');
  // Soft delete: set status to inactive. seq is NOT freed.
  const row = await prisma.mediaAdOrder.update({
    where: { id },
    data: { status: 'inactive' },
    include: { downstream: true, adType: true },
  });
  return mapMediaAdOrder(row as MediaAdOrder & { downstream: Downstream; adType: AdType | null });
}