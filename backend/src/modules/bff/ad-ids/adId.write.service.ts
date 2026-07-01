import { prisma } from '../../../shared/prisma/client';
import { BadRequestError, ConflictError } from '../../../shared/errors/AppError';
import { mapAdId } from '../mappers';
import { generateShortId, isValidId } from '../../../shared/ids';
import type { AdSite, Upstream, AdType } from '../../../shared/prisma/client';
import { normalizeBillingMethodForStorage, type EntityStatus, type EntryType } from '../bff.types';

async function assertSlotUnique(slot: string, excludeId?: string): Promise<void> {
  const dupe = await prisma.adSite.findFirst({
    where: {
      name: { equals: slot, mode: 'insensitive' },
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { id: true },
  });
  if (dupe) throw new ConflictError(`ID quảng cáo '${slot}' đã tồn tại`);
}

function isAdSiteSlotUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: string; meta?: { target?: string | string[] } };
  if (e.code !== 'P2002') return false;
  const target = e.meta?.target;
  if (Array.isArray(target)) return target.some(t => String(t).toLowerCase().includes('name'));
  return typeof target === 'string' && target.toLowerCase().includes('name');
}

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
      ownedAdTypes: { orderBy: { id: 'asc' } },
    },
  });
  if (!advertiser) throw new BadRequestError('Invalid advertiserId: ' + advertiserId);
  const candidates = [
    ...advertiser.adTypeLinks.map(link => link.adType),
    ...(advertiser.ownedAdTypes ?? []),
    ...(advertiser.defaultAdType ? [advertiser.defaultAdType] : []),
  ].filter((at): at is NonNullable<typeof at> => Boolean(at));
  const byId = new Map<string, typeof candidates[number]>();
  for (const at of candidates) byId.set(at.id, at);
  return Array.from(byId.values());
}

export async function createAdId(input: CreateAdIdInput) {
  const { advertiserId, adTypeId, slot, type, ...rest } = input;
  const billingMethod = normalizeBillingMethodForStorage(type);
  if (!billingMethod) throw new BadRequestError('Invalid billing method: ' + type);

  const advId = String(advertiserId);
  if (!advId) throw new BadRequestError('Invalid advertiserId');

  const trimmedSlot = slot.trim();
  if (!trimmedSlot) throw new BadRequestError('slot is required');
  await assertSlotUnique(trimmedSlot);

  // Validate advertiser + adType linkage (covers legacy IDs like UP001).
  const linkedAdTypes = await getAdvertiserLinkedAdTypes(advId);
  if (adTypeId && !linkedAdTypes.some(at => at.id === adTypeId)) {
    throw new BadRequestError(`adTypeId ${adTypeId} is not linked to advertiserId ${advId}`);
  }
  if (!linkedAdTypes.length && !adTypeId) {
    throw new BadRequestError(`Advertiser ${advId} has no linked adType; please pick one`);
  }

  try {
    const row = await prisma.adSite.create({
      data: {
        id: generateShortId(),
        upstreamId: advId,
        name: trimmedSlot,
        notes: rest.notes ?? null,
        billingMethod,
        currentUnitPrice: (billingMethod === 'CPM' || billingMethod === 'CPC' || billingMethod === 'CPA') ? (rest.unitPrice ?? null) : null,
        currentRatio: billingMethod === 'CPS' ? (rest.ratio ?? null) : null,
        status: rest.status ?? 'active',
        adTypeId: adTypeId ?? null,
      },
      include: {
        upstream: { include: { defaultAdType: true } },
        adType: true,
      },
    });
    return mapAdId(row as AdSite & { upstream: Upstream & { defaultAdType: AdType | null }; adType: AdType | null });
  } catch (err) {
    if (isAdSiteSlotUniqueViolation(err)) {
      throw new ConflictError(`ID quảng cáo '${trimmedSlot}' đã tồn tại`);
    }
    throw err;
  }
}

export async function updateAdId(id: string | number, input: UpdateAdIdInput) {
  if (!isValidId(String(id))) throw new BadRequestError('Invalid id');
  const { type, unitPrice, ratio, ...rest } = input;
  const billingMethod = normalizeBillingMethodForStorage(type);
  if (type !== undefined && !billingMethod) throw new BadRequestError('Invalid billing method: ' + type);

  if (rest.slot !== undefined) {
    const trimmed = rest.slot.trim();
    if (!trimmed) throw new BadRequestError('slot cannot be empty');
    await assertSlotUnique(trimmed, String(id));
    rest.slot = trimmed;
  }

  if (rest.adTypeId) {
    // Resolve which advertiser to validate against: explicit input, else the AdSite's current owner.
    let advForValidation = rest.advertiserId ? String(rest.advertiserId) : undefined;
    if (!advForValidation) {
      const current = await prisma.adSite.findUnique({ where: { id: String(id) }, select: { upstreamId: true } });
      advForValidation = current?.upstreamId;
    }
    if (advForValidation) {
      const linkedAdTypes = await getAdvertiserLinkedAdTypes(advForValidation);
      if (!linkedAdTypes.some(at => at.id === rest.adTypeId)) {
        throw new BadRequestError(`adTypeId ${rest.adTypeId} is not linked to advertiserId ${advForValidation}`);
      }
    }
  }

  try {
    const row = await prisma.adSite.update({
      where: { id: String(id) },
      data: {
        ...(rest.advertiserId !== undefined && { upstreamId: String(rest.advertiserId) }),
        ...(rest.slot !== undefined && { name: rest.slot }),
        ...(rest.notes !== undefined && { notes: rest.notes }),
        ...(billingMethod !== undefined && { billingMethod }),
        ...((billingMethod === 'CPM' || billingMethod === 'CPC' || billingMethod === 'CPA') && unitPrice !== undefined && { currentUnitPrice: unitPrice }),
        ...((billingMethod === 'CPM' || billingMethod === 'CPC' || billingMethod === 'CPA') && unitPrice === undefined && { currentUnitPrice: null }),
        ...(billingMethod === 'CPS' && ratio !== undefined && { currentRatio: ratio }),
        ...(billingMethod === 'CPS' && ratio === undefined && { currentRatio: null }),
        ...(rest.status !== undefined && { status: rest.status }),
        ...(rest.adTypeId !== undefined && { adTypeId: rest.adTypeId || null }),
      },
      include: {
        upstream: { include: { defaultAdType: true } },
        adType: true,
      },
    });
    return mapAdId(row as AdSite & { upstream: Upstream & { defaultAdType: AdType | null }; adType: AdType | null });
  } catch (err) {
    if (isAdSiteSlotUniqueViolation(err)) {
      throw new ConflictError(`ID quảng cáo '${rest.slot ?? ''}' đã tồn tại`);
    }
    throw err;
  }
}

export async function deleteAdId(id: string | number) {
  if (!isValidId(String(id))) throw new BadRequestError('Invalid id');
  // Soft deactivate: set status to inactive
  const row = await prisma.adSite.update({
    where: { id: String(id) },
    data: { status: 'inactive' },
    include: {
      upstream: { include: { defaultAdType: true } },
      adType: true,
    },
  });
  return mapAdId(row as AdSite & { upstream: Upstream & { defaultAdType: AdType | null }; adType: AdType | null });
}
