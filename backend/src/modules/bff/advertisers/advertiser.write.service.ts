import { prisma } from '../../../shared/prisma/client';
import { BadRequestError } from '../../../shared/errors/AppError';
import { mapAdvertiser } from '../mappers';
import type { Prisma } from '@prisma/client';
import type { EntityStatus } from '../bff.types';

export interface CreateAdvertiserInput {
  name: string;
  contact?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  status?: EntityStatus;
  adTypeCode?: string;
  adTypeCodes?: string[];
}

export interface UpdateAdvertiserInput {
  name?: string;
  contact?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  status?: EntityStatus;
  adTypeCode?: string;
  adTypeCodes?: string[];
}

const advertiserInclude = {
  adType: true,
  adTypeLinks: { include: { adType: true }, orderBy: { adTypeId: 'asc' as const } },
};

type Tx = Prisma.TransactionClient;

function normalizeAdTypeCodes(input: { adTypeCode?: string; adTypeCodes?: string[] }) {
  const rawCodes = input.adTypeCodes !== undefined ? input.adTypeCodes : input.adTypeCode ? [input.adTypeCode] : [];
  return Array.from(new Set(rawCodes.map(code => code.trim()).filter(Boolean)));
}

async function resolveAdTypesByCodes(codes: string[], tx: Tx) {
  if (!codes.length) throw new BadRequestError('at least one adTypeCode is required');
  const adTypes = await tx.adType.findMany({ where: { code: { in: codes } }, orderBy: { id: 'asc' } });
  const foundCodes = new Set(adTypes.map(adType => adType.code));
  const missing = codes.filter(code => !foundCodes.has(code));
  if (missing.length) throw new BadRequestError(`Invalid adTypeCode: ${missing.join(', ')}`);
  return codes.map(code => adTypes.find(adType => adType.code === code)!);
}

async function syncUpstreamAdTypes(upstreamId: number, adTypeIds: number[], tx: Tx) {
  await tx.upstreamAdType.deleteMany({ where: { upstreamId, adTypeId: { notIn: adTypeIds } } });
  await Promise.all(adTypeIds.map(adTypeId => tx.upstreamAdType.upsert({
    where: { upstreamId_adTypeId: { upstreamId, adTypeId } },
    update: {},
    create: { upstreamId, adTypeId },
  })));
}

export async function createAdvertiser(input: CreateAdvertiserInput) {
  const adTypeCodes = normalizeAdTypeCodes(input);
  const row = await prisma.$transaction(async tx => {
    const adTypes = await resolveAdTypesByCodes(adTypeCodes, tx);
    const primaryAdType = adTypes[0];
    const created = await tx.upstream.create({
      data: {
        name: input.name,
        contact: input.contact ?? null,
        phone: input.phone ?? null,
        email: input.email ?? null,
        notes: input.notes ?? null,
        status: input.status ?? 'active',
        adTypeId: primaryAdType.id,
      },
    });
    await syncUpstreamAdTypes(created.id, adTypes.map(adType => adType.id), tx);
    return tx.upstream.findUniqueOrThrow({ where: { id: created.id }, include: advertiserInclude });
  });
  return mapAdvertiser(row);
}

export async function updateAdvertiser(id: number, input: UpdateAdvertiserInput) {
  const shouldSyncAdTypes = input.adTypeCodes !== undefined || input.adTypeCode !== undefined;
  const adTypeCodes = shouldSyncAdTypes ? normalizeAdTypeCodes(input) : [];
  const row = await prisma.$transaction(async tx => {
    const adTypes = shouldSyncAdTypes ? await resolveAdTypesByCodes(adTypeCodes, tx) : [];
    await tx.upstream.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.contact !== undefined && { contact: input.contact }),
        ...(input.phone !== undefined && { phone: input.phone }),
        ...(input.email !== undefined && { email: input.email }),
        ...(input.notes !== undefined && { notes: input.notes }),
        ...(input.status !== undefined && { status: input.status }),
        ...(shouldSyncAdTypes && { adTypeId: adTypes[0].id }),
      },
    });
    if (shouldSyncAdTypes) {
      await syncUpstreamAdTypes(id, adTypes.map(adType => adType.id), tx);
    }
    return tx.upstream.findUniqueOrThrow({ where: { id }, include: advertiserInclude });
  });
  return mapAdvertiser(row);
}

export async function deleteAdvertiser(id: number) {
  const row = await prisma.upstream.update({
    where: { id },
    data: { status: 'inactive' },
    include: advertiserInclude,
  });
  return mapAdvertiser(row);
}
