import { prisma } from '../../../shared/prisma/client';
import { mapMedia } from '../mappers';
import { normalizeBillingMethodForStorage, type EntityStatus } from '../bff.types';
import { generateShortId } from '../../../shared/ids';

export interface CreateMediaInput {
  name: string;
  contact?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  status?: EntityStatus;
  upstreamId: string;
  billingMethod?: string;
  currentUnitPrice?: number | null;
  currentRatio?: number | null;
}

export interface UpdateMediaInput {
  name?: string;
  contact?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  status?: EntityStatus;
  upstreamId?: string;
  adTypeCode?: string;
  billingMethod?: string;
  currentUnitPrice?: number | null;
  currentRatio?: number | null;
  isArchived?: boolean;
}

export async function createMedia(input: CreateMediaInput) {
  const upstream = await prisma.upstream.findUnique({ where: { id: input.upstreamId } });
  if (!upstream) throw new Error('Invalid upstreamId: ' + input.upstreamId);
  const billingMethod = normalizeBillingMethodForStorage(input.billingMethod ?? 'CPM');
  if (!billingMethod) throw new Error('Invalid billingMethod: ' + input.billingMethod);
  const row = await prisma.adSite.create({
    data: {
      id: generateShortId(),
      name: input.name,
      upstreamId: input.upstreamId,
      billingMethod,
      currentUnitPrice: input.currentUnitPrice ?? null,
      currentRatio: input.currentRatio ?? null,
      status: input.status ?? 'active',
    },
    include: { upstream: { include: { defaultAdType: true } }, adType: true },
  });
  return mapMedia(row);
}

export async function updateMedia(id: string, input: UpdateMediaInput) {
  if (input.upstreamId) {
    const upstream = await prisma.upstream.findUnique({ where: { id: input.upstreamId } });
    if (!upstream) throw new Error('Invalid upstreamId: ' + input.upstreamId);
  }
  const billingMethod = normalizeBillingMethodForStorage(input.billingMethod);
  if (input.billingMethod !== undefined && !billingMethod) throw new Error('Invalid billingMethod: ' + input.billingMethod);
  const row = await prisma.adSite.update({
    where: { id },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.upstreamId !== undefined && { upstreamId: input.upstreamId }),
      ...(billingMethod !== undefined && { billingMethod }),
      ...(input.currentUnitPrice !== undefined && { currentUnitPrice: input.currentUnitPrice }),
      ...(input.currentRatio !== undefined && { currentRatio: input.currentRatio }),
      ...(input.isArchived !== undefined && { isArchived: input.isArchived }),
    },
    include: { upstream: { include: { defaultAdType: true } }, adType: true },
  });
  return mapMedia(row);
}

export async function deleteMedia(id: string) {
  const row = await prisma.adSite.update({
    where: { id },
    data: { isArchived: true },
    include: { upstream: { include: { defaultAdType: true } }, adType: true },
  });
  return mapMedia(row);
}