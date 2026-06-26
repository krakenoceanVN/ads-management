import { prisma } from '../../../shared/prisma/client';
import { ConflictError } from '../../../shared/errors/AppError';
import { mapMediaAdOrder } from '../mappers';
import { generateAndCreateMediaAdOrder } from './seq';
import { isValidId } from '../../../shared/ids';
import type { MediaAdOrder, Downstream, AdType } from '../../../shared/prisma/client';
import type { EntityStatus } from '../bff.types';

export interface CreateMediaAdOrderInput {
  downstreamId: string;
  adTypeId: string;
  name?: string | null;
  notes?: string | null;
  status?: EntityStatus;
}

export interface UpdateMediaAdOrderInput {
  name?: string;
  notes?: string | null;
  status?: EntityStatus;
  downstreamId?: string;
  adTypeId?: string;
}

export async function createMediaAdOrder(input: CreateMediaAdOrderInput) {
  const { downstreamId, adTypeId, ...rest } = input;
  if (!isValidId(downstreamId)) throw new Error('Invalid downstreamId');
  if (!isValidId(adTypeId)) throw new Error('Invalid adTypeId');

  const adType = await prisma.adType.findUnique({ where: { id: adTypeId } });
  if (!adType) throw new Error('Invalid adTypeId');

  const row = await generateAndCreateMediaAdOrder(prisma, {
    downstreamId,
    adTypeId: adType.id,
    name: rest.name ?? null,
    notes: rest.notes ?? null,
    status: rest.status ?? 'active',
  });

  const reloaded = await prisma.mediaAdOrder.findUnique({
    where: { id: row.id },
    include: { downstream: true, adType: true },
  });
  if (!reloaded) throw new Error('MediaAdOrder disappeared after create');
  return mapMediaAdOrder(reloaded as MediaAdOrder & { downstream: Downstream; adType: AdType });
}

export async function updateMediaAdOrder(id: string, input: UpdateMediaAdOrderInput) {
  if (!isValidId(id)) throw new Error('Invalid id');
  const { downstreamId, adTypeId, ...rest } = input;
  const updateData: Record<string, unknown> = {};

  if (rest.name !== undefined) {
    const name = (rest.name ?? '').trim();
    // Tên đơn quảng cáo phải duy nhất toàn hệ thống (không phân biệt hoa/thường).
    if (name) {
      const dupe = await prisma.mediaAdOrder.findFirst({
        where: { name: { equals: name, mode: 'insensitive' }, NOT: { id } },
        select: { id: true },
      });
      if (dupe) throw new ConflictError(`Tên đơn quảng cáo '${name}' đã tồn tại`);
    }
    updateData['name'] = rest.name;
  }
  if (rest.notes !== undefined) updateData['notes'] = rest.notes;
  if (rest.status !== undefined) updateData['status'] = rest.status;
  if (downstreamId !== undefined) {
    if (!isValidId(downstreamId)) throw new Error('Invalid downstreamId');
    updateData['downstreamId'] = downstreamId;
  }
  if (adTypeId !== undefined) {
    if (!isValidId(adTypeId)) throw new Error('Invalid adTypeId');
    updateData['adTypeId'] = adTypeId;
  }

  const row = await prisma.mediaAdOrder.update({
    where: { id },
    data: updateData,
    include: { downstream: true, adType: true },
  });
  return mapMediaAdOrder(row as MediaAdOrder & { downstream: Downstream; adType: AdType });
}

export async function deleteMediaAdOrder(id: string) {
  if (!isValidId(id)) throw new Error('Invalid id');
  // Soft delete: set status to inactive. seq is NOT freed.
  const row = await prisma.mediaAdOrder.update({
    where: { id },
    data: { status: 'inactive' },
    include: { downstream: true, adType: true },
  });
  return mapMediaAdOrder(row as MediaAdOrder & { downstream: Downstream; adType: AdType });
}