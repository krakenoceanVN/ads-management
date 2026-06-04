import { prisma } from '../../../shared/prisma/client';
import { mapMediaId } from '../mappers';
import type { AdSiteDownstream, AdSite, Upstream, AdType, Downstream } from '../../../shared/prisma/client';
import type { EntityStatus } from '../bff.types';
import { BadRequestError, ConflictError } from '../../../shared/errors/AppError';

export interface CreateMediaIdInput {
  adSiteId: number;
  downstreamId: number;
  customPrice?: number | null;
}

export interface UpdateMediaIdInput {
  customPrice?: number | null;
  status?: EntityStatus;
}

export async function createMediaId(input: CreateMediaIdInput) {
  const { adSiteId, downstreamId, customPrice } = input;

  if (!adSiteId || Number.isNaN(adSiteId)) throw new BadRequestError('adSiteId is required');
  if (!downstreamId || Number.isNaN(downstreamId)) throw new BadRequestError('downstreamId is required');

  // Both foreign keys must point to existing rows — return a clean 400 instead of a raw FK crash.
  const adSite = await prisma.adSite.findUnique({
    where: { id: adSiteId },
    include: { upstream: true },
  });
  if (!adSite) throw new BadRequestError(`AdSite (ID quảng cáo) with id '${adSiteId}' does not exist`);

  const downstream = await prisma.downstream.findUnique({ where: { id: downstreamId } });
  if (!downstream) throw new BadRequestError(`Downstream with id '${downstreamId}' does not exist`);

  // The AdSite (via its upstream) and the Downstream must belong to the same AdType.
  if (adSite.upstream.adTypeId !== downstream.adTypeId) {
    throw new BadRequestError('Media (ID quảng cáo) and downstream must use the same ad type');
  }

  // Do not allow creating NEW links to an inactive downstream.
  // (Existing historical links are untouched — this only guards new creates.)
  if (downstream.status !== 'active') {
    throw new BadRequestError('Cannot link to an inactive downstream');
  }

  // Uniqueness enforced by schema (@@unique([adSiteId, downstreamId])); pre-check for a clean error.
  const existing = await prisma.adSiteDownstream.findUnique({
    where: { adSiteId_downstreamId: { adSiteId, downstreamId } },
  });
  if (existing) {
    throw new ConflictError('This ID media (AdSite + downstream) already exists');
  }

  const row = await prisma.adSiteDownstream.create({
    data: {
      adSiteId,
      downstreamId,
      customPrice: customPrice ?? null,
    },
    include: {
      adSite: { include: { upstream: { include: { adType: true } } } },
      downstream: true,
    },
  });
  return mapMediaId(row as AdSiteDownstream & { adSite: AdSite & { upstream: Upstream & { adType: AdType } }; downstream: Downstream });
}

export async function updateMediaId(junctionId: number, input: UpdateMediaIdInput) {
  const { customPrice, status } = input;

  // Note: status validation is done in the controller before calling this service.
  // status is read-only per compatibility decision; only customPrice can be updated.

  const row = await prisma.adSiteDownstream.update({
    where: { id: junctionId },
    data: {
      ...(customPrice !== undefined && { customPrice: customPrice }),
    },
    include: {
      adSite: { include: { upstream: { include: { adType: true } } } },
      downstream: true,
    },
  });
  return mapMediaId(row as AdSiteDownstream & { adSite: AdSite & { upstream: Upstream & { adType: AdType } }; downstream: Downstream });
}

export async function deleteMediaId(_junctionId: number) {
  throw new ConflictError(
    'Cannot delete MediaId: deleting media/downstream mapping is disabled to preserve historical reporting and settlement integrity.'
  );
}
