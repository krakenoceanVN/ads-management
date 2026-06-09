import { prisma } from '../../../shared/prisma/client';
import { BadRequestError } from '../../../shared/errors/AppError';
import { mapAdId } from '../mappers';
import type { Prisma } from '@prisma/client';
import type { AdSite, Upstream, AdType, AdOrder } from '../../../shared/prisma/client';
import { normalizeBillingMethodForStorage, type EntityStatus, type EntryType } from '../bff.types';

export interface CreateAdIdInput {
  advertiserId: number;
  adOrderId?: number;
  adTypeCode?: string;
  slot: string;
  type: EntryType;
  unitPrice?: number | null;
  ratio?: number | null;
  notes?: string | null;
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
  notes?: string | null;
  status?: EntityStatus;
}

async function getAdvertiserLinkedAdTypes(advertiserId: number) {
  const advertiser = await prisma.upstream.findUnique({
    where: { id: advertiserId },
    include: { adType: true, adTypeLinks: { include: { adType: true }, orderBy: { adTypeId: 'asc' } } },
  });
  if (!advertiser) throw new BadRequestError('Invalid advertiserId: ' + advertiserId);
  const linkedAdTypes = advertiser.adTypeLinks.map(link => link.adType);
  return linkedAdTypes.length ? linkedAdTypes : advertiser.adType ? [advertiser.adType] : [];
}

async function resolveAdOrderId(advertiserId: number, adTypeCode?: string, existingAdOrderId?: number): Promise<number> {
  const linkedAdTypes = await getAdvertiserLinkedAdTypes(advertiserId);
  const linkedCodes = linkedAdTypes.map(adType => adType.code);
  const requestedAdTypeCode = adTypeCode ?? linkedCodes[0];

  if (!requestedAdTypeCode) throw new BadRequestError('Either adOrderId or adTypeCode must be provided');
  if (!linkedCodes.includes(requestedAdTypeCode)) {
    throw new BadRequestError(`adTypeCode ${requestedAdTypeCode} is not linked to advertiserId ${advertiserId}`);
  }

  if (existingAdOrderId) {
    const adOrder = await prisma.adOrder.findUnique({
      where: { id: existingAdOrderId },
      include: { adType: true },
    });
    if (!adOrder) throw new BadRequestError('Invalid adOrderId: ' + existingAdOrderId);
    if (adOrder.upstreamId !== advertiserId) {
      throw new BadRequestError('adOrderId does not belong to advertiserId ' + advertiserId);
    }
    if (adOrder.adType?.code !== requestedAdTypeCode) {
      throw new BadRequestError(`adOrderId adTypeCode ${adOrder.adType?.code ?? ''} does not match advertiser adTypeCode ${requestedAdTypeCode}`);
    }
    return existingAdOrderId;
  }

  const adType = linkedAdTypes.find(item => item.code === requestedAdTypeCode);
  if (!adType) throw new BadRequestError('Invalid adTypeCode: ' + requestedAdTypeCode);

  const existing = await prisma.adOrder.findFirst({
    where: { upstreamId: advertiserId, adTypeId: adType.id },
  });
  if (existing) return existing.id;

  const created = await prisma.adOrder.create({
    data: {
      upstreamId: advertiserId,
      adTypeId: adType.id,
      name: adType.name ?? requestedAdTypeCode,
      status: 'active',
    },
  });
  return created.id;
}

export async function createAdId(input: CreateAdIdInput) {
  const { advertiserId, adOrderId, adTypeCode, slot, type, ...rest } = input;
  const billingMethod = normalizeBillingMethodForStorage(type);
  if (!billingMethod) throw new BadRequestError('Invalid billing method: ' + type);
  const resolvedAdOrderId = await resolveAdOrderId(advertiserId, adTypeCode, adOrderId);

  const row = await prisma.adSite.create({
    data: {
      upstreamId: advertiserId,
      adOrderId: resolvedAdOrderId,
      name: slot.trim(),
      notes: rest.notes ?? null,
      billingMethod,
      currentUnitPrice: (billingMethod === 'CPM' || billingMethod === 'CPA') ? (rest.unitPrice ?? null) : null,
      currentRatio: billingMethod === 'RATIO' ? (rest.ratio ?? null) : null,
      status: rest.status ?? 'active',
    } as Prisma.AdSiteUncheckedCreateInput,
    include: {
      upstream: { include: { adType: true } },
      adOrder: { include: { adType: true } },
    },
  });
  return mapAdId(row as AdSite & { upstream: Upstream & { adType: AdType }; adOrder: AdOrder });
}

export async function updateAdId(id: number, input: UpdateAdIdInput) {
  const { type, unitPrice, ratio, ...rest } = input;
  const billingMethod = normalizeBillingMethodForStorage(type);
  if (type !== undefined && !billingMethod) throw new BadRequestError('Invalid billing method: ' + type);

  let resolvedAdOrderId = rest.adOrderId;
  if (rest.adTypeCode || rest.adOrderId || rest.advertiserId) {
    const current = await prisma.adSite.findUnique({ where: { id } });
    if (!current) throw new BadRequestError('Invalid ad id: ' + id);
    const advertiserId = rest.advertiserId ?? current.upstreamId;
    resolvedAdOrderId = await resolveAdOrderId(advertiserId, rest.adTypeCode, rest.adOrderId ?? undefined);
  }

  const row = await prisma.adSite.update({
    where: { id },
    data: {
      ...(rest.advertiserId !== undefined && { upstreamId: rest.advertiserId }),
      ...(resolvedAdOrderId !== undefined && { adOrderId: resolvedAdOrderId }),
      ...(rest.slot !== undefined && { name: rest.slot.trim() }),
      ...(rest.notes !== undefined && { notes: rest.notes }),
      ...(billingMethod !== undefined && { billingMethod }),
      ...((billingMethod === 'CPM' || billingMethod === 'CPA') && unitPrice !== undefined && { currentUnitPrice: unitPrice }),
      ...((billingMethod === 'CPM' || billingMethod === 'CPA') && unitPrice === undefined && { currentUnitPrice: null }),
      ...(billingMethod === 'RATIO' && ratio !== undefined && { currentRatio: ratio }),
      ...(billingMethod === 'RATIO' && ratio === undefined && { currentRatio: null }),
      ...(rest.status !== undefined && { status: rest.status }),
    },
    include: {
      upstream: { include: { adType: true } },
      adOrder: { include: { adType: true } },
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
      adOrder: { include: { adType: true } },
    },
  });
  return mapAdId(row as AdSite & { upstream: Upstream & { adType: AdType }; adOrder: AdOrder });
}