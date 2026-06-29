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

async function assertNameUniqueForOwner(name: string, upstreamId: string | null, excludeId?: string): Promise<void> {
  const dupe = await prisma.adType.findFirst({
    where: {
      name: { equals: name, mode: 'insensitive' },
      upstreamId,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { id: true },
  });
  if (dupe) throw new ConflictError(`Tên đơn quảng cáo '${name}' đã tồn tại cho nhà quảng cáo này`);
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

  const upstreamId = input.upstreamId ?? null;
  await assertNameUniqueForOwner(name, upstreamId);

  if (upstreamId) {
    const upstream = await prisma.upstream.findUnique({ where: { id: upstreamId } });
    if (!upstream) throw new BadRequestError('Invalid upstreamId');
  }

  const row = await prisma.adType.create({
    data: {
      id: generateShortId(),
      name,
      upstreamId,
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

  const nextName = name ?? existing.name;
  const nextUpstreamId = input.upstreamId !== undefined ? input.upstreamId : existing.upstreamId;
  await assertNameUniqueForOwner(nextName, nextUpstreamId, id);

  if (nextUpstreamId) {
    const upstream = await prisma.upstream.findUnique({ where: { id: nextUpstreamId } });
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

  // Block only when financial records (DailyInput) hang off AdSites that select
  // this AdType (per-AdSite adTypeId) — deleting would corrupt reports.
  const dailyInputCount = await prisma.dailyInput.count({
    where: { adSite: { adTypeId: id } },
  });
  if (dailyInputCount > 0) {
    throw new BadRequestError(`Cannot delete AdType '${existing.name}': it is referenced by existing financial records`);
  }

  // No financial data: detach links instead of failing.
  // Nullable FKs → set null; NOT-NULL junctions → delete the link rows.
  await prisma.$transaction(async (tx) => {
    await tx.adSite.updateMany({ where: { adTypeId: id }, data: { adTypeId: null } });
    await tx.upstream.updateMany({ where: { adTypeId: id }, data: { adTypeId: null } });
    await tx.mediaAdOrder.updateMany({ where: { adTypeId: id }, data: { adTypeId: null } });
    await tx.adSiteDownstream.updateMany({ where: { mediaAdTypeId: id }, data: { mediaAdTypeId: null } });
    await tx.upstreamAdType.deleteMany({ where: { adTypeId: id } });
    await tx.downstreamAdType.deleteMany({ where: { adTypeId: id } });
    await tx.adType.delete({ where: { id } });
  });

  return { deleted: true };
}
