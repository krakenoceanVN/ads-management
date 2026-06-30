import { prisma } from '../../../shared/prisma/client';
import { BadRequestError, ConflictError } from '../../../shared/errors/AppError';
import { mapAdvertiser } from '../mappers';
import { generateShortId } from '../../../shared/ids';
import type { Prisma } from '@prisma/client';
import type { EntityStatus } from '../bff.types';

export interface CreateAdvertiserInput {
  name: string;
  contact?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  status?: EntityStatus;
  adTypeId?: string;
  adTypeIds?: string[];
}

export interface UpdateAdvertiserInput {
  name?: string;
  contact?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  status?: EntityStatus;
  adTypeId?: string;
  adTypeIds?: string[];
}

const advertiserInclude = {
  defaultAdType: true,
  adTypeLinks: { include: { adType: true }, orderBy: { adTypeId: 'asc' as const } },
  ownedAdTypes: { orderBy: { id: 'asc' as const } },
};

type Tx = Prisma.TransactionClient;

function normalizeAdTypeIds(input: { adTypeId?: string; adTypeIds?: string[] }) {
  const rawIds = input.adTypeIds !== undefined ? input.adTypeIds : input.adTypeId ? [input.adTypeId] : [];
  return Array.from(new Set(rawIds.map(id => id.trim()).filter(Boolean)));
}

async function resolveAdTypesByIds(ids: string[], tx: Tx) {
  if (!ids.length) return [];
  const adTypes = await tx.adType.findMany({ where: { id: { in: ids } }, orderBy: { id: 'asc' } });
  const foundIds = new Set(adTypes.map(adType => adType.id));
  const missing = ids.filter(id => !foundIds.has(id));
  if (missing.length) throw new BadRequestError(`Invalid adTypeId: ${missing.join(', ')}`);
  return ids.map(id => adTypes.find(adType => adType.id === id)!);
}

async function syncUpstreamAdTypes(upstreamId: string, adTypeIds: string[], tx: Tx) {
  await tx.upstreamAdType.deleteMany({ where: { upstreamId, adTypeId: { notIn: adTypeIds } } });
  await Promise.all(adTypeIds.map(adTypeId => tx.upstreamAdType.upsert({
    where: { upstreamId_adTypeId: { upstreamId, adTypeId } },
    update: {},
    create: { id: `uat_${upstreamId}_${adTypeId}`, upstreamId, adTypeId },
  })));
}

async function assertNameUnique(name: string, excludeId?: string): Promise<void> {
  const dupe = await prisma.upstream.findFirst({
    where: {
      name: { equals: name, mode: 'insensitive' },
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { id: true },
  });
  if (dupe) throw new ConflictError(`Tên nhà quảng cáo '${name}' đã tồn tại`);
}

function isUpstreamNameUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: string; meta?: { target?: string | string[] } };
  if (e.code !== 'P2002') return false;
  const target = e.meta?.target;
  if (Array.isArray(target)) return target.some(t => String(t).toLowerCase().includes('name'));
  return typeof target === 'string' && target.toLowerCase().includes('name');
}

export async function createAdvertiser(input: CreateAdvertiserInput) {
  const adTypeIds = normalizeAdTypeIds(input);
  const name = input.name?.trim();
  if (!name) throw new BadRequestError('name is required');
  await assertNameUnique(name);

  try {
    const row = await prisma.$transaction(async tx => {
      const adTypes = await resolveAdTypesByIds(adTypeIds, tx);
      const created = await tx.upstream.create({
        data: {
          id: generateShortId(),
          name,
          contact: input.contact ?? null,
          phone: input.phone ?? null,
          email: input.email ?? null,
          notes: input.notes ?? null,
          status: input.status ?? 'active',
        },
      });
      await syncUpstreamAdTypes(created.id, adTypes.map(adType => adType.id), tx);
      return tx.upstream.findUniqueOrThrow({ where: { id: created.id }, include: advertiserInclude });
    });
    return mapAdvertiser(row);
  } catch (err) {
    if (isUpstreamNameUniqueViolation(err)) {
      throw new ConflictError(`Tên nhà quảng cáo '${name}' đã tồn tại`);
    }
    throw err;
  }
}

export async function updateAdvertiser(id: string, input: UpdateAdvertiserInput) {
  if (!id) throw new BadRequestError('Invalid id');

  const shouldSyncAdTypes = input.adTypeIds !== undefined || input.adTypeId !== undefined;
  const adTypeIds = shouldSyncAdTypes ? normalizeAdTypeIds(input) : [];

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new BadRequestError('name cannot be empty');
    await assertNameUnique(name, id);
  }

  try {
    const row = await prisma.$transaction(async tx => {
      const adTypes = shouldSyncAdTypes ? await resolveAdTypesByIds(adTypeIds, tx) : [];
      await tx.upstream.update({
        where: { id },
        data: {
          ...(input.name !== undefined && { name: input.name.trim() }),
          ...(input.contact !== undefined && { contact: input.contact }),
          ...(input.phone !== undefined && { phone: input.phone }),
          ...(input.email !== undefined && { email: input.email }),
          ...(input.notes !== undefined && { notes: input.notes }),
          ...(input.status !== undefined && { status: input.status }),
        },
      });
      if (shouldSyncAdTypes) {
        await syncUpstreamAdTypes(id, adTypes.map(adType => adType.id), tx);
      }
      return tx.upstream.findUniqueOrThrow({ where: { id }, include: advertiserInclude });
    });
    return mapAdvertiser(row);
  } catch (err) {
    if (isUpstreamNameUniqueViolation(err)) {
      throw new ConflictError(`Tên nhà quảng cáo '${input.name?.trim() ?? ''}' đã tồn tại`);
    }
    throw err;
  }
}

export async function deleteAdvertiser(id: string) {
  const row = await prisma.upstream.update({
    where: { id },
    data: { status: 'inactive' },
    include: advertiserInclude,
  });
  return mapAdvertiser(row);
}