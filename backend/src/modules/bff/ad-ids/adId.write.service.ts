import { prisma } from '../../../shared/prisma/client';
import { mapAdId } from '../mappers';
import type { Prisma } from '@prisma/client';
import type { AdSite, Upstream, AdType, AdOrder } from '../../../shared/prisma/client';
import type { EntityStatus, EntryType } from '../bff.types';

export interface CreateAdIdInput {
  advertiserId: number;
  adOrderId?: number;
  adTypeCode?: string;
  slot: string;
  type: EntryType;
  unitPrice?: number | null;
  ratio?: number | null;
  status?: EntityStatus;
}

export interface UpdateAdIdInput {
  advertiserId?: number;
  adOrderId?: number;
  adTypeCode?: string;
  slot?: string;
  type?: EntryType;
  unitPrice?: number | null;
  ratio?: number | null;
  status?: EntityStatus;
}

async function resolveAdOrderId(advertiserId: number, adTypeCode?: string, existingAdOrderId?: number): Promise<number> {
  if (existingAdOrderId) return existingAdOrderId;
  if (!adTypeCode) throw new Error('Either adOrderId or adTypeCode must be provided');

  const adType = await prisma.adType.findUnique({ where: { code: adTypeCode } });
  if (!adType) throw new Error('Invalid adTypeCode: ' + adTypeCode);

  // Find existing internal AdOrder for this advertiser + AdType
  const existing = await prisma.adOrder.findFirst({
    where: { upstreamId: advertiserId, adTypeId: adType.id },
  });
  if (existing) return existing.id;

  // Auto-create the internal AdOrder record
  const created = await prisma.adOrder.create({
    data: {
      upstreamId: advertiserId,
      adTypeId: adType.id,
      name: adType.name ?? adTypeCode,
      status: 'active',
    },
  });
  return created.id;
}

export async function createAdId(input: CreateAdIdInput) {
  const { advertiserId, adOrderId, adTypeCode, slot, type, ...rest } = input;
  const billingMethod = type;
  const resolvedAdOrderId = await resolveAdOrderId(advertiserId, adTypeCode, adOrderId);

  const row = await prisma.adSite.create({
    data: {
      upstreamId: advertiserId,
      adOrderId: resolvedAdOrderId,
      name: slot.trim(),
      billingMethod,
      currentUnitPrice: (type === 'CPM' || type === 'CPA') ? (rest.unitPrice ?? null) : null,
      currentRatio: type === 'RATIO' ? (rest.ratio ?? null) : null,
      status: rest.status ?? 'active',
    },
    include: {
      upstream: { include: { adType: true } },
      adOrder: true,
    },
  });
  return mapAdId(row as AdSite & { upstream: Upstream & { adType: AdType }; adOrder: AdOrder });
}

export async function updateAdId(id: number, input: UpdateAdIdInput) {
  const { type, unitPrice, ratio, ...rest } = input;
  const billingMethod = type ?? undefined;

  // If adTypeCode is provided in update, resolve it to adOrderId
  let resolvedAdOrderId = rest.adOrderId;
  if (rest.adTypeCode && !rest.adOrderId) {
    // reading current record to get advertiserId
    const current = await prisma.adSite.findUnique({ where: { id }, include: { upstream: true } });
    if (current) {
      resolvedAdOrderId = await resolveAdOrderId(current.upstreamId, rest.adTypeCode, undefined);
    }
  }

  const row = await prisma.adSite.update({
    where: { id },
    data: {
      ...(rest.advertiserId !== undefined && { upstreamId: rest.advertiserId }),
      ...(resolvedAdOrderId !== undefined && { adOrderId: resolvedAdOrderId }),
      ...(rest.slot !== undefined && { name: rest.slot.trim() }),
      ...(billingMethod !== undefined && { billingMethod }),
      ...((type === 'CPM' || type === 'CPA') && unitPrice !== undefined && { currentUnitPrice: unitPrice }),
      ...((type === 'CPM' || type === 'CPA') && unitPrice === undefined && { currentUnitPrice: null }),
      ...(type === 'RATIO' && ratio !== undefined && { currentRatio: ratio }),
      ...(type === 'RATIO' && ratio === undefined && { currentRatio: null }),
      ...(rest.status !== undefined && { status: rest.status }),
    },
    include: {
      upstream: { include: { adType: true } },
      adOrder: true,
    },
  });
  return mapAdId(row as AdSite & { upstream: Upstream & { adType: AdType }; adOrder: AdOrder });
}

export async function deleteAdId(id: number) {
  // Soft deactivate: set status to inactive
  const row = await prisma.adSite.update({
    where: { id },
    data: { status: 'inactive' },
    include: {
      upstream: { include: { adType: true } },
      adOrder: true,
    },
  });
  return mapAdId(row as AdSite & { upstream: Upstream & { adType: AdType }; adOrder: AdOrder });
}