/**
 * Downstream BFF Write Service
 * Handles create and update for Downstream (下游).
 * A downstream is a payout channel (ML | LE | YIYI) that owns a set of AdTypes
 * via the DownstreamAdType junction (mirrors UpstreamAdType). Phase-2 dropped
 * the legacy scalar Downstream.adTypeId — the junction is the single source of
 * truth.
 */

import { prisma } from '../../../shared/prisma/client';
import { mapDownstream } from '../mappers';
import { BadRequestError, ConflictError, NotFoundError } from '../../../shared/errors/AppError';
import { downstreamInclude } from './downstream.service';
import type { Prisma } from '@prisma/client';
import type { DownstreamDto } from '../bff.types';

const ALLOWED_STATUSES = ['active', 'inactive'] as const;

type Tx = Prisma.TransactionClient;

export interface CreateDownstreamInput {
  adTypeCodes: string[];
  downstreamType: string;
  payoutRate?: number;
  status?: string;
}

export interface UpdateDownstreamInput {
  downstreamType?: string;
  payoutRate?: number;
  status?: string;
  adTypeCodes?: string[];
}

function normalizeType(raw: string): string {
  const value = raw?.trim().toUpperCase();
  if (!value) throw new BadRequestError('downstreamType is required');
  if (!/^[A-Z0-9_]{1,20}$/.test(value)) {
    throw new BadRequestError('downstreamType must be 1–20 chars: A–Z, 0–9, _ only');
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

function normalizeAdTypeCodes(input: { adTypeCodes?: string[] }) {
  if (input.adTypeCodes === undefined) return [];
  return Array.from(new Set(input.adTypeCodes.map(c => c.trim()).filter(Boolean)));
}

async function resolveAdTypesByCodes(codes: string[], tx: Tx) {
  if (!codes.length) throw new BadRequestError('at least one adTypeCode is required');
  const adTypes = await tx.adType.findMany({ where: { code: { in: codes } }, orderBy: { id: 'asc' } });
  const found = new Set(adTypes.map(t => t.code));
  const missing = codes.filter(c => !found.has(c));
  if (missing.length) throw new BadRequestError(`Invalid adTypeCode: ${missing.join(', ')}`);
  return codes.map(code => adTypes.find(t => t.code === code)!);
}

async function syncDownstreamAdTypes(downstreamId: number, adTypeIds: number[], tx: Tx) {
  await tx.downstreamAdType.deleteMany({ where: { downstreamId, adTypeId: { notIn: adTypeIds } } });
  await Promise.all(adTypeIds.map(adTypeId => tx.downstreamAdType.upsert({
    where: { downstreamId_adTypeId: { downstreamId, adTypeId } },
    update: {},
    create: { downstreamId, adTypeId },
  })));
}

export async function createDownstream(input: CreateDownstreamInput): Promise<DownstreamDto> {
  const downstreamType = normalizeType(input.downstreamType);
  const payoutRate = input.payoutRate ?? 0.8;
  validatePayoutRate(payoutRate);
  const status = validateStatus(input.status ?? 'active');
  const adTypeCodes = normalizeAdTypeCodes(input);

  const row = await prisma.$transaction(async tx => {
    await resolveAdTypesByCodes(adTypeCodes, tx);

    // DB-level partial unique on (downstreamType) where status='active' will also
    // throw P2002 — catch that here for a clean 409.
    let created;
    try {
      created = await tx.downstream.create({
        data: { downstreamType, payoutRate, status },
      });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new ConflictError(`Downstream '${downstreamType}' already exists`);
      }
      throw err;
    }
    const adTypes = await resolveAdTypesByCodes(adTypeCodes, tx);
    await syncDownstreamAdTypes(created.id, adTypes.map(t => t.id), tx);
    return tx.downstream.findUniqueOrThrow({ where: { id: created.id }, include: downstreamInclude });
  });

  return mapDownstream(row);
}

export async function updateDownstream(id: number, input: UpdateDownstreamInput): Promise<DownstreamDto> {
  if (!id || Number.isNaN(id)) throw new BadRequestError('Invalid id');

  const existing = await prisma.downstream.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Downstream not found');

  const data: { downstreamType?: string; payoutRate?: number; status?: string } = {};

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
    data.payoutRate = input.payoutRate;
  }

  if (input.status !== undefined) {
    data.status = validateStatus(input.status);
  }

  const shouldSyncAdTypes = input.adTypeCodes !== undefined;

  const row = await prisma.$transaction(async tx => {
    if (shouldSyncAdTypes) {
      const codes = normalizeAdTypeCodes(input);
      const adTypes = await resolveAdTypesByCodes(codes, tx);
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
  | { mode: 'deleted'; id: number }
  | { mode: 'deactivated'; id: number; references: { mediaIds: number; periods: number; dailyRates: number } };

export async function deleteDownstream(id: number): Promise<DeleteDownstreamResult> {
  if (!id || Number.isNaN(id)) throw new BadRequestError('Invalid id');

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
