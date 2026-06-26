/**
 * AdType BFF Write Service
 * Handles create, update, and delete for AdType.
 * Delete is soft-blocked if referenced by business records.
 *
 * Per docx mục 1.2: AdType giữ vai trò "đơn quảng cáo của nhà QC".
 * Không còn field `code` — `id` (6-char alphanumeric) là identifier duy nhất.
 */

import { prisma } from '../../../shared/prisma/client';
import { BadRequestError, ConflictError } from '../../../shared/errors/AppError';
import { generateShortId } from '../../../shared/ids';

// Tên đơn quảng cáo (AdType) phải duy nhất toàn hệ thống, so khớp không phân biệt hoa/thường.
async function assertNameUnique(name: string, excludeId?: string): Promise<void> {
  const dupe = await prisma.adType.findFirst({
    where: {
      name: { equals: name, mode: 'insensitive' },
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { id: true },
  });
  if (dupe) throw new ConflictError(`Tên đơn quảng cáo '${name}' đã tồn tại`);
}

export interface CreateAdTypeInput {
  name: string;
  upstreamId?: string | null;
  notes?: string | null;
  status?: 'active' | 'inactive';
}

export interface UpdateAdTypeInput {
  name?: string;
  upstreamId?: string | null;
  notes?: string | null;
  status?: 'active' | 'inactive';
}

// Check if adType is referenced by any business table (by id)
async function isIdReferenced(id: string): Promise<boolean> {
  const [upstream, upstreamAdType, adSite, downstreamAdType, mediaAdOrder] = await Promise.all([
    prisma.upstream.count({ where: { defaultAdType: { id } } }),
    prisma.upstreamAdType.count({ where: { adTypeId: id } }),
    prisma.adSite.count({ where: { upstream: { defaultAdType: { id } } } }),
    prisma.downstreamAdType.count({ where: { adTypeId: id } }),
    prisma.mediaAdOrder.count({ where: { adTypeId: id } }),
  ]);
  return upstream > 0 || upstreamAdType > 0 || adSite > 0 || downstreamAdType > 0 || mediaAdOrder > 0;
}

export interface AdTypeDto {
  id: string;
  name: string;
  upstreamId: string | null;
  notes: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

function toDto(row: { id: string; name: string; upstreamId: string | null; notes: string | null; status: string; createdAt: Date; updatedAt: Date }): AdTypeDto {
  return {
    id: row.id,
    name: row.name,
    upstreamId: row.upstreamId,
    notes: row.notes,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function createAdType(input: CreateAdTypeInput): Promise<AdTypeDto> {
  const name = input.name?.trim();
  if (!name) throw new BadRequestError('name is required');

  await assertNameUnique(name);

  if (input.upstreamId) {
    const upstream = await prisma.upstream.findUnique({ where: { id: input.upstreamId } });
    if (!upstream) throw new BadRequestError('Invalid upstreamId');
  }

  const row = await prisma.adType.create({
    data: {
      id: generateShortId(),
      name,
      upstreamId: input.upstreamId ?? null,
      notes: input.notes ?? null,
      status: input.status ?? 'active',
    },
  });

  return toDto(row);
}

export async function updateAdType(id: string, input: UpdateAdTypeInput): Promise<AdTypeDto> {
  if (!id) throw new BadRequestError('Invalid id');

  const existing = await prisma.adType.findUnique({ where: { id } });
  if (!existing) throw new BadRequestError('AdType not found');

  const name = input.name?.trim();
  if (input.name !== undefined && !name) throw new BadRequestError('name cannot be empty');

  if (name) await assertNameUnique(name, id);

  if (input.upstreamId) {
    const upstream = await prisma.upstream.findUnique({ where: { id: input.upstreamId } });
    if (!upstream) throw new BadRequestError('Invalid upstreamId');
  }

  const updated = await prisma.adType.update({
    where: { id },
    data: {
      ...(name && { name }),
      ...(input.upstreamId !== undefined && { upstreamId: input.upstreamId }),
      ...(input.notes !== undefined && { notes: input.notes }),
      ...(input.status !== undefined && { status: input.status }),
    },
  });

  return toDto(updated);
}

export async function deleteAdType(id: string): Promise<{ deleted: boolean }> {
  if (!id) throw new BadRequestError('Invalid id');

  const existing = await prisma.adType.findUnique({ where: { id } });
  if (!existing) throw new BadRequestError('AdType not found');

  const referenced = await isIdReferenced(id);
  if (referenced) {
    throw new BadRequestError(`Cannot delete AdType '${existing.name}': it is referenced by existing business records`);
  }

  await prisma.adType.delete({ where: { id } });
  return { deleted: true };
}
