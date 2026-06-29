import { prisma } from '../../../shared/prisma/client';
import { mapMediaId } from '../mappers';
import type { AdSiteDownstream, AdSite, Upstream, AdType, Downstream } from '../../../shared/prisma/client';
import type { EntityStatus } from '../bff.types';
import { BadRequestError, ConflictError } from '../../../shared/errors/AppError';

export interface CreateMediaIdInput {
  adSiteId: string;
  downstreamId: string;
  mediaAdOrderId?: string | null;
  customPrice?: number | null;
  pctHal?: number | null;
  mediaAdTypeId?: string | null;
  mediaIdName?: string | null;
  status?: EntityStatus;
}

export interface UpdateMediaIdInput {
  mediaAdOrderId?: string | null;
  customPrice?: number | null;
  pctHal?: number | null;
  mediaAdTypeId?: string | null;
  mediaIdName?: string | null;
  status?: EntityStatus;
}

async function validateMediaAdOrder(mediaAdOrderId: string, downstreamId: string) {
  const order = await prisma.mediaAdOrder.findUnique({ where: { id: mediaAdOrderId } });
  if (!order) throw new BadRequestError(`MediaAdOrder with id '${mediaAdOrderId}' does not exist`);
  if (order.downstreamId !== downstreamId) {
    throw new BadRequestError('MediaAdOrder does not belong to the selected downstream');
  }
}

export async function createMediaId(input: CreateMediaIdInput) {
  const { adSiteId, downstreamId, mediaAdOrderId, customPrice, pctHal, mediaAdTypeId, mediaIdName, status } = input;

  if (!adSiteId) throw new BadRequestError('adSiteId is required');
  if (!downstreamId) throw new BadRequestError('downstreamId is required');

  const adSite = await prisma.adSite.findUnique({
    where: { id: adSiteId },
    include: { upstream: true },
  });
  if (!adSite) throw new BadRequestError(`AdSite (ID quảng cáo) with id '${adSiteId}' does not exist`);

  const downstream = await prisma.downstream.findUnique({
    where: { id: downstreamId },
    include: { adTypeLinks: { include: { adType: true } } },
  });
  if (!downstream) throw new BadRequestError(`Downstream with id '${downstreamId}' does not exist`);

  const adSiteAdTypeId = adSite.adTypeId;
  // Only enforce adType match when both sides have an adType set
  if (adSiteAdTypeId && downstream.adTypeLinks.length > 0) {
    const allowedAdTypeIds = new Set<string>(downstream.adTypeLinks.map(link => link.adTypeId));
    if (!allowedAdTypeIds.has(adSiteAdTypeId)) {
      throw new BadRequestError('Media (ID quảng cáo) and downstream must use the same ad type');
    }
  }

  if (downstream.status !== 'active') {
    throw new BadRequestError('Cannot link to an inactive downstream');
  }

  const existing = await prisma.adSiteDownstream.findUnique({
    where: { adSiteId_downstreamId: { adSiteId, downstreamId } },
  });
  if (existing) {
    throw new ConflictError('This ID media (AdSite + downstream) already exists');
  }

  // Validate mediaAdTypeId if provided — must exist in AdType
  if (mediaAdTypeId) {
    const at = await prisma.adType.findUnique({ where: { id: mediaAdTypeId } });
    if (!at) throw new BadRequestError(`AdType with id '${mediaAdTypeId}' does not exist`);
  }

  // Validate mediaAdOrderId if provided — must exist and belong to this downstream
  if (mediaAdOrderId) {
    await validateMediaAdOrder(mediaAdOrderId, downstreamId);
  }

  const { Prisma } = await import('@prisma/client');

  const row = await prisma.adSiteDownstream.create({
    data: {
      id: `asd_${adSiteId}_${downstreamId}`,
      adSiteId,
      downstreamId,
      mediaAdOrderId: mediaAdOrderId ?? null,
      customPrice: customPrice != null ? new Prisma.Decimal(customPrice) : null,
      pctHal: pctHal != null ? new Prisma.Decimal(pctHal) : null,
      mediaAdTypeId: mediaAdTypeId ?? null,
      mediaIdName: mediaIdName ?? null,
      status: status ?? 'active',
    },
    include: {
      adSite: { include: { upstream: { include: { defaultAdType: true } }, adType: true } },
      downstream: true,
      mediaAdType: true,
    },
  });
  return mapMediaId(row as AdSiteDownstream & { adSite: AdSite & { upstream: Upstream & { defaultAdType: AdType | null }; adType: AdType | null }; downstream: Downstream; mediaAdType: AdType | null });
}

export async function updateMediaId(junctionId: string, input: UpdateMediaIdInput) {
  const { mediaAdOrderId, customPrice, pctHal, mediaAdTypeId, mediaIdName, status } = input;
  const { Prisma } = await import('@prisma/client');

  // Validate mediaAdTypeId if provided — must exist in AdType
  if (mediaAdTypeId) {
    const at = await prisma.adType.findUnique({ where: { id: mediaAdTypeId } });
    if (!at) throw new BadRequestError(`AdType with id '${mediaAdTypeId}' does not exist`);
  }

  // Validate mediaAdOrderId if provided — must exist and belong to this junction's downstream
  if (mediaAdOrderId) {
    const junction = await prisma.adSiteDownstream.findUnique({
      where: { id: junctionId },
      select: { downstreamId: true },
    });
    if (!junction) throw new BadRequestError(`MediaId junction '${junctionId}' does not exist`);
    await validateMediaAdOrder(mediaAdOrderId, junction.downstreamId);
  }

  const row = await prisma.adSiteDownstream.update({
    where: { id: junctionId },
    data: {
      ...(mediaAdOrderId !== undefined ? { mediaAdOrderId: mediaAdOrderId ?? null } : {}),
      ...(customPrice !== undefined
        ? (customPrice === null
          ? { customPrice: null }
          : { customPrice: new Prisma.Decimal(customPrice) })
        : {}),
      ...(pctHal !== undefined
        ? (pctHal === null
          ? { pctHal: null }
          : { pctHal: new Prisma.Decimal(pctHal) })
        : {}),
      ...(mediaAdTypeId !== undefined ? { mediaAdTypeId: mediaAdTypeId ?? null } : {}),
      ...(mediaIdName !== undefined ? { mediaIdName: mediaIdName ?? null } : {}),
      ...(status !== undefined ? { status } : {}),
    },
    include: {
      adSite: { include: { upstream: { include: { defaultAdType: true } }, adType: true } },
      downstream: true,
      mediaAdType: true,
    },
  });
  return mapMediaId(row as AdSiteDownstream & { adSite: AdSite & { upstream: Upstream & { defaultAdType: AdType | null }; adType: AdType | null }; downstream: Downstream; mediaAdType: AdType | null });
}

export async function deleteMediaId(_junctionId: string) {
  throw new ConflictError(
    'Cannot delete MediaId: deleting media/downstream mapping is disabled to preserve historical reporting and settlement integrity.'
  );
}