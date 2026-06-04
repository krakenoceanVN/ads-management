/**
 * Downstream BFF Write Service
 * Handles create and update for Downstream (下游).
 * A downstream is a payout channel (ML | LE | YIYI) attached to an AdType.
 */

import { prisma } from '../../../shared/prisma/client';
import { mapDownstream } from '../mappers';
import { BadRequestError, ConflictError, NotFoundError } from '../../../shared/errors/AppError';
import type { DownstreamDto } from '../bff.types';

// downstreamType is free-form (new types like LS/LI can be added without a code
// change); ML/LE/YIYI are just UI suggestions on the frontend.
const ALLOWED_STATUSES = ['active', 'inactive'] as const;

export interface CreateDownstreamInput {
  adTypeId: number;
  downstreamType: string;
  payoutRate?: number;
  status?: string;
}

export interface UpdateDownstreamInput {
  downstreamType?: string;
  payoutRate?: number;
  status?: string;
}

function normalizeType(raw: string): string {
  const value = raw?.trim().toUpperCase();
  if (!value) throw new BadRequestError('downstreamType is required');
  // Free-form code (so new types can be added without a code change) — but kept
  // to a clean, normalized shape to avoid typos like trailing spaces.
  if (!/^[A-Z0-9_]{1,20}$/.test(value)) {
    throw new BadRequestError('downstreamType must be 1–20 chars: A–Z, 0–9, _ only');
  }
  return value;
}

function validatePayoutRate(rate: number): void {
  if (typeof rate !== 'number' || Number.isNaN(rate)) {
    throw new BadRequestError('payoutRate must be a number');
  }
  // Rate is a ratio, not capped at 1 — real data has rates above 100% (e.g. 1.45).
  // Only guard against negatives and absurd typos.
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

async function loadWithAdType(id: number): Promise<DownstreamDto> {
  const row = await prisma.downstream.findUnique({ where: { id }, include: { adType: true } });
  if (!row) throw new NotFoundError('Downstream not found');
  return mapDownstream(row);
}

export async function createDownstream(input: CreateDownstreamInput): Promise<DownstreamDto> {
  const adTypeId = Number(input.adTypeId);
  if (!adTypeId || Number.isNaN(adTypeId)) throw new BadRequestError('adTypeId is required');

  const adType = await prisma.adType.findUnique({ where: { id: adTypeId } });
  if (!adType) throw new BadRequestError(`AdType with id '${adTypeId}' does not exist`);

  const downstreamType = normalizeType(input.downstreamType);
  const payoutRate = input.payoutRate ?? 0.8;
  validatePayoutRate(payoutRate);
  const status = validateStatus(input.status ?? 'active');

  // One downstreamType per AdType
  const existing = await prisma.downstream.findFirst({ where: { adTypeId, downstreamType } });
  if (existing) {
    throw new ConflictError(`Downstream '${downstreamType}' already exists for this ad type`);
  }

  const created = await prisma.downstream.create({
    data: { adTypeId, downstreamType, payoutRate, status },
    include: { adType: true },
  });

  return mapDownstream(created);
}

export async function updateDownstream(id: number, input: UpdateDownstreamInput): Promise<DownstreamDto> {
  if (!id || Number.isNaN(id)) throw new BadRequestError('Invalid id');

  const existing = await prisma.downstream.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Downstream not found');

  const data: { downstreamType?: string; payoutRate?: number; status?: string } = {};

  if (input.downstreamType !== undefined) {
    const downstreamType = normalizeType(input.downstreamType);
    if (downstreamType !== existing.downstreamType) {
      const duplicate = await prisma.downstream.findFirst({
        where: { adTypeId: existing.adTypeId, downstreamType, id: { not: id } },
      });
      if (duplicate) {
        throw new ConflictError(`Downstream '${downstreamType}' already exists for this ad type`);
      }
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

  await prisma.downstream.update({ where: { id }, data });
  return loadWithAdType(id);
}

export type DeleteDownstreamResult =
  | { mode: 'deleted'; id: number }
  | { mode: 'deactivated'; id: number; references: { mediaIds: number; periods: number; dailyRates: number } };

export async function deleteDownstream(id: number): Promise<DeleteDownstreamResult> {
  if (!id || Number.isNaN(id)) throw new BadRequestError('Invalid id');

  const existing = await prisma.downstream.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Downstream not found');

  // Count every relation that carries operational/financial meaning.
  const [mediaIds, periods, dailyRates] = await Promise.all([
    prisma.adSiteDownstream.count({ where: { downstreamId: id } }),
    prisma.downstreamPeriod.count({ where: { downstreamId: id } }),
    prisma.dailyDownstreamRate.count({ where: { downstreamId: id } }),
  ]);

  // Only hard-delete when the downstream is completely unused; otherwise soft-delete
  // (set inactive) so historical reporting/settlement data stays intact.
  if (mediaIds === 0 && periods === 0 && dailyRates === 0) {
    await prisma.downstream.delete({ where: { id } });
    return { mode: 'deleted', id };
  }

  await prisma.downstream.update({ where: { id }, data: { status: 'inactive' } });
  return { mode: 'deactivated', id, references: { mediaIds, periods, dailyRates } };
}
