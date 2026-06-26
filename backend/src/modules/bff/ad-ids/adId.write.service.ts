import { prisma } from '../../../shared/prisma/client';
import { BadRequestError } from '../../../shared/errors/AppError';
import { mapAdId } from '../mappers';
import { generateShortId, isValidId } from '../../../shared/ids';
import type { AdSite, Upstream, AdType } from '../../../shared/prisma/client';
import { normalizeBillingMethodForStorage, type EntityStatus, type EntryType } from '../bff.types';

export interface CreateAdIdInput {
  advertiserId: string | number;
  adTypeId?: string;
  slot: string;
  type: EntryType;
  unitPrice?: number | null;
  ratio?: number | null;
  notes?: string | null;
  status?: EntityStatus;
}

export interface UpdateAdIdInput {
  advertiserId?: string | number;
  adTypeId?: string;
  slot?: string;
  type?: EntryType;
  unitPrice?: number | null;
  ratio?: number | null;
  notes?: string | null;
  status?: EntityStatus;
}

async function getAdvertiserLinkedAdTypes(advertiserId: string) {
  const advertiser = await prisma.upstream.findUnique({
    where: { id: advertiserId },
    include: {
      defaultAdType: true,
      adTypeLinks: { include: { adType: true }, orderBy: { adTypeId: 'asc' } },
    },
  });
  if (!advertiser) throw new BadRequestError('Invalid advertiserId: ' + advertiserId);
  const linkedAdTypes = advertiser.adTypeLinks.map(link => link.adType);
  return linkedAdTypes.length ? linkedAdTypes : advertiser.defaultAdType ? [advertiser.defaultAdType] : [];
}

export async function createAdId(input: CreateAdIdInput) {
  const { advertiserId, adTypeId, slot, type, ...rest } = input;
  const billingMethod = normalizeBillingMethodForStorage(type);
  if (!billingMethod) throw new BadRequestError('Invalid billing method: ' + type);

  const advId = String(advertiserId);
  if (!isValidId(advId)) throw new BadRequestError('Invalid advertiserId');

  if (adTypeId) {
    const linkedAdTypes = await getAdvertiserLinkedAdTypes(advId);
    if (!linkedAdTypes.some(at => at.id === adTypeId)) {
      throw new BadRequestError(`adTypeId ${adTypeId} is not linked to advertiserId ${advId}`);
    }
  }

  const row = await prisma.adSite.create({
    data: {
      id: generateShortId(),
      upstreamId: advId,
      name: slot.trim(),
      notes: rest.notes ?? null,
      billingMethod,
      currentUnitPrice: (billingMethod === 'CPM' || billingMethod === 'CPA') ? (rest.unitPrice ?? null) : null,
      currentRatio: billingMethod === 'CPS' ? (rest.ratio ?? null) : null,
      status: rest.status ?? 'active',
    },
    include: {
      upstream: { include: { defaultAdType: true } },
    },
  });
  return mapAdId(row as AdSite & { upstream: Upstream & { defaultAdType: AdType | null } });
}

export async function updateAdId(id: string | number, input: UpdateAdIdInput) {
  if (!isValidId(String(id))) throw new BadRequestError('Invalid id');
  const { type, unitPrice, ratio, ...rest } = input;
  const billingMethod = normalizeBillingMethodForStorage(type);
  if (type !== undefined && !billingMethod) throw new BadRequestError('Invalid billing method: ' + type);

  if (rest.advertiserId && rest.adTypeId) {
    const linkedAdTypes = await getAdvertiserLinkedAdTypes(String(rest.advertiserId));
    if (!linkedAdTypes.some(at => at.id === rest.adTypeId)) {
      throw new BadRequestError(`adTypeId ${rest.adTypeId} is not linked to advertiserId ${rest.advertiserId}`);
    }
  }

  const row = await prisma.adSite.update({
    where: { id: String(id) },
    data: {
      ...(rest.advertiserId !== undefined && { upstreamId: String(rest.advertiserId) }),
      ...(rest.slot !== undefined && { name: rest.slot.trim() }),
      ...(rest.notes !== undefined && { notes: rest.notes }),
      ...(billingMethod !== undefined && { billingMethod }),
      ...((billingMethod === 'CPM' || billingMethod === 'CPA') && unitPrice !== undefined && { currentUnitPrice: unitPrice }),
      ...((billingMethod === 'CPM' || billingMethod === 'CPA') && unitPrice === undefined && { currentUnitPrice: null }),
      ...(billingMethod === 'CPS' && ratio !== undefined && { currentRatio: ratio }),
      ...(billingMethod === 'CPS' && ratio === undefined && { currentRatio: null }),
      ...(rest.status !== undefined && { status: rest.status }),
    },
    include: {
      upstream: { include: { defaultAdType: true } },
    },
  });
  return mapAdId(row as AdSite & { upstream: Upstream & { defaultAdType: AdType | null } });
}

export async function deleteAdId(id: string | number) {
  if (!isValidId(String(id))) throw new BadRequestError('Invalid id');
  // Soft deactivate: set status to inactive
  const row = await prisma.adSite.update({
    where: { id: String(id) },
    data: { status: 'inactive' },
    include: {
      upstream: { include: { defaultAdType: true } },
    },
  });
  return mapAdId(row as AdSite & { upstream: Upstream & { defaultAdType: AdType | null } });
}
