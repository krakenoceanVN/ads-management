/**
 * Downstream BFF Write Service
 * Handles create and update for Downstream (下游).
 * A downstream is a payout channel (ML | LE | YIYI) that owns a set of AdTypes
 * via the DownstreamAdType junction. payoutRate is now stored on
 * DownstreamPeriod (per-period), not on Downstream itself.
 */

import { prisma } from '../../../shared/prisma/client';
import { mapDownstream } from '../mappers';
import { downstreamInclude } from './downstream.service';
import { BadRequestError, ConflictError, NotFoundError } from '../../../shared/errors/AppError';
import { generateShortId } from '../../../shared/ids';
import type { Prisma } from '@prisma/client';
import type { DownstreamDto } from '../bff.types';

const ALLOWED_STATUSES = ['active', 'inactive'] as const;

type Tx = Prisma.TransactionClient;

export interface CreateDownstreamInput {
  adTypeIds: string[];
  downstreamType: string;
  name?: string | null;
  contact?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  payoutRate?: number;
  status?: string;
}

export interface UpdateDownstreamInput {
  downstreamType?: string;
  name?: string | null;
  contact?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  payoutRate?: number;
  status?: string;
  adTypeIds?: string[];
}

function normalizeType(raw: string): string {
  const value = raw?.trim();
  if (!value) throw new BadRequestError('name is required');
  if (value.length > 100) {
    throw new BadRequestError('name must be at most 100 chars');
  }
  return value;
}

function validatePayoutRate(rate: number): void {
  if (typeof rate !== 'number' || Number.isNaN(rate)) {
    throw new BadRequestError('payoutRate must be a number');
  }
  if (rate < 0 || rate > 100) {
    throw new BadRequestError('payoutRate must be 0 or greater');
  }
}

function validateStatus(status: string): string {
  if (!ALLOWED_STATUSES.includes(status as (typeof ALLOWED_STATUSES)[number])) {
    throw new BadRequestError(`status must be one of: ${ALLOWED_STATUSES.join(', ')}`);
  }
  return status;
}

function normalizeAdTypeIds(input: { adTypeIds?: string[] }) {
  if (input.adTypeIds === undefined) return [];
  return Array.from(new Set(input.adTypeIds.map(id => id.trim()).filter(Boolean)));
}

async function resolveAdTypesByIds(ids: string[], tx: Tx) {
  if (!ids.length) return [];
  const adTypes = await tx.adType.findMany({ where: { id: { in: ids } }, orderBy: { id: 'asc' } });
  const found = new Set(adTypes.map(t => t.id));
  const missing = ids.filter(id => !found.has(id));
  if (missing.length) throw new BadRequestError(`Invalid adTypeId: ${missing.join(', ')}`);
  return ids.map(id => adTypes.find(t => t.id === id)!);
}

async function syncDownstreamAdTypes(downstreamId: string, adTypeIds: string[], tx: Tx) {
  await tx.downstreamAdType.deleteMany({ where: { downstreamId, adTypeId: { notIn: adTypeIds } } });
  await Promise.all(adTypeIds.map(adTypeId => tx.downstreamAdType.upsert({
    where: { downstreamId_adTypeId: { downstreamId, adTypeId } },
    update: {},
    create: { id: `dat_${downstreamId}_${adTypeId}`, downstreamId, adTypeId },
  })));
}

export async function createDownstream(input: CreateDownstreamInput): Promise<DownstreamDto> {
  const downstreamType = normalizeType(input.downstreamType);
  const payoutRate = input.payoutRate ?? 0.8;
  validatePayoutRate(payoutRate);
  const status = validateStatus(input.status ?? 'active');
  const adTypeIds = normalizeAdTypeIds(input);

  const row = await prisma.$transaction(async tx => {
    const adTypes = await resolveAdTypesByIds(adTypeIds, tx);

    let created;
    try {
      created = await tx.downstream.create({
        data: {
          id: generateShortId(),
          downstreamType,
          status,
          name: input.name ?? null,
          contact: input.contact ?? null,
          phone: input.phone ?? null,
          email: input.email ?? null,
          notes: input.notes ?? null,
        },
      });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new ConflictError(`Downstream '${downstreamType}' already exists`);
      }
      throw err;
    }
    await syncDownstreamAdTypes(created.id, adTypes.map(t => t.id), tx);
    return tx.downstream.findUniqueOrThrow({ where: { id: created.id }, include: downstreamInclude });
  });

  return mapDownstream(row);
}

export async function updateDownstream(id: string, input: UpdateDownstreamInput): Promise<DownstreamDto> {
  if (!id) throw new BadRequestError('Invalid id');

  const existing = await prisma.downstream.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Downstream not found');

  const data: { downstreamType?: string; status?: string; name?: string | null; contact?: string | null; phone?: string | null; email?: string | null; notes?: string | null } = {};

  if (input.downstreamType !== undefined) {
    const downstreamType = normalizeType(input.downstreamType);
    if (downstreamType !== existing.downstreamType) {
      const dup = await prisma.downstream.findFirst({
        where: { downstreamType, id: { not: id }, status: 'active' },
      });
      if (dup) throw new ConflictError(`Downstream '${downstreamType}' already exists`);
    }
    data.downstreamType = downstreamType;
  }

  if (input.payoutRate !== undefined) {
    validatePayoutRate(input.payoutRate);
    // payoutRate is no longer stored on Downstream; it lives on DownstreamPeriod.
    // No-op here (kept for API compatibility).
  }

  if (input.status !== undefined) {
    data.status = validateStatus(input.status);
  }

  if (input.name !== undefined) data.name = input.name ?? null;
  if (input.contact !== undefined) data.contact = input.contact ?? null;
  if (input.phone !== undefined) data.phone = input.phone ?? null;
  if (input.email !== undefined) data.email = input.email ?? null;
  if (input.notes !== undefined) data.notes = input.notes ?? null;

  const shouldSyncAdTypes = input.adTypeIds !== undefined;

  const row = await prisma.$transaction(async tx => {
    if (shouldSyncAdTypes) {
      const ids = normalizeAdTypeIds(input);
      const adTypes = await resolveAdTypesByIds(ids, tx);
      await syncDownstreamAdTypes(id, adTypes.map(t => t.id), tx);
    }
    if (Object.keys(data).length) {
      try {
        await tx.downstream.update({ where: { id }, data });
      } catch (err: any) {
        if (err?.code === 'P2002') {
          throw new ConflictError(`Downstream '${data.downstreamType ?? existing.downstreamType}' already exists`);
        }
        throw err;
      }
    }
    return tx.downstream.findUniqueOrThrow({ where: { id }, include: downstreamInclude });
  });

  return mapDownstream(row);
}

export type DeleteDownstreamResult =
  | { mode: 'deleted'; id: string }
  | { mode: 'deactivated'; id: string; references: { mediaIds: number; periods: number; dailyRates: number } };

export async function deleteDownstream(id: string): Promise<DeleteDownstreamResult> {
  if (!id) throw new BadRequestError('Invalid id');

  const existing = await prisma.downstream.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Downstream not found');

  const [mediaIds, periods, dailyRates] = await Promise.all([
    prisma.adSiteDownstream.count({ where: { downstreamId: id } }),
    prisma.downstreamPeriod.count({ where: { downstreamId: id } }),
    prisma.dailyDownstreamRate.count({ where: { downstreamId: id } }),
  ]);

  if (mediaIds === 0 && periods === 0 && dailyRates === 0) {
    await prisma.downstream.delete({ where: { id } });
    return { mode: 'deleted', id };
  }

  await prisma.downstream.update({ where: { id }, data: { status: 'inactive' } });
  return { mode: 'deactivated', id, references: { mediaIds, periods, dailyRates } };
}