import { prisma } from '../../../shared/prisma/client';
import { mapMedia } from '../mappers';
import type { AdSite, Upstream, AdType } from '../../../shared/prisma/client';
import type { EntityStatus } from '../bff.types';

export interface CreateMediaInput {
  name: string;
  contact?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  status?: EntityStatus;
  upstreamId: number; // required, validated > 0 in controller
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
  upstreamId?: number;
  adTypeCode?: string;
  billingMethod?: string;
  currentUnitPrice?: number | null;
  currentRatio?: number | null;
  isArchived?: boolean;
}

export async function createMedia(input: CreateMediaInput) {
  const upstream = await prisma.upstream.findUnique({ where: { id: input.upstreamId } });
  if (!upstream) throw new Error('Invalid upstreamId: ' + input.upstreamId);
  const row = await prisma.adSite.create({
    data: {
      name: input.name,
      upstreamId: input.upstreamId,
      billingMethod: input.billingMethod ?? 'CPM',
      currentUnitPrice: input.currentUnitPrice ?? null,
      currentRatio: input.currentRatio ?? null,
      status: input.status ?? 'active',
    },
    include: { upstream: { include: { adType: true } } },
  });
  return mapMedia(row as AdSite & { upstream: Upstream & { adType: AdType } });
}

export async function updateMedia(id: number, input: UpdateMediaInput) {
  if (input.upstreamId !== undefined) {
    const upstream = await prisma.upstream.findUnique({ where: { id: input.upstreamId } });
    if (!upstream) throw new Error('Invalid upstreamId: ' + input.upstreamId);
  }
  const row = await prisma.adSite.update({
    where: { id },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.upstreamId !== undefined && { upstreamId: input.upstreamId }),
      ...(input.billingMethod !== undefined && { billingMethod: input.billingMethod }),
      ...(input.currentUnitPrice !== undefined && { currentUnitPrice: input.currentUnitPrice }),
      ...(input.currentRatio !== undefined && { currentRatio: input.currentRatio }),
      ...(input.isArchived !== undefined && { isArchived: input.isArchived }),
    },
    include: { upstream: { include: { adType: true } } },
  });
  return mapMedia(row as AdSite & { upstream: Upstream & { adType: AdType } });
}

export async function deleteMedia(id: number) {
  // Soft archive: set isArchived=true, do not hard-delete AdSite
  const row = await prisma.adSite.update({
    where: { id },
    data: { isArchived: true },
    include: { upstream: { include: { adType: true } } },
  });
  return mapMedia(row as AdSite & { upstream: Upstream & { adType: AdType } });
}
