import { prisma } from '../../../shared/prisma/client';
import { mapAdvertiser } from '../mappers';
import type { Upstream, AdType } from '../../../shared/prisma/client';
import type { EntityStatus } from '../bff.types';

export interface CreateAdvertiserInput {
  name: string;
  contact?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  status?: EntityStatus;
  adTypeCode: string;
}

export interface UpdateAdvertiserInput {
  name?: string;
  contact?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  status?: EntityStatus;
  adTypeCode?: string;
}

export async function createAdvertiser(input: CreateAdvertiserInput) {
  const { adTypeCode, ...rest } = input;
  const row = await prisma.upstream.create({
    data: {
      name: rest.name,
      contact: rest.contact ?? null,
      phone: rest.phone ?? null,
      email: rest.email ?? null,
      notes: rest.notes ?? null,
      status: rest.status ?? 'active',
      adType: { connect: { code: adTypeCode } },
    },
    include: { adType: true },
  });
  return mapAdvertiser(row as Upstream & { adType: AdType });
}

export async function updateAdvertiser(id: number, input: UpdateAdvertiserInput) {
  const { adTypeCode, ...rest } = input;
  const row = await prisma.upstream.update({
    where: { id },
    data: {
      ...(rest.name !== undefined && { name: rest.name }),
      ...(rest.contact !== undefined && { contact: rest.contact }),
      ...(rest.phone !== undefined && { phone: rest.phone }),
      ...(rest.email !== undefined && { email: rest.email }),
      ...(rest.notes !== undefined && { notes: rest.notes }),
      ...(rest.status !== undefined && { status: rest.status }),
      ...(adTypeCode !== undefined && { adType: { connect: { code: adTypeCode } } }),
    },
    include: { adType: true },
  });
  return mapAdvertiser(row as Upstream & { adType: AdType });
}

export async function deleteAdvertiser(id: number) {
  // Soft delete: set status to inactive
  const row = await prisma.upstream.update({
    where: { id },
    data: { status: 'inactive' },
    include: { adType: true },
  });
  return mapAdvertiser(row as Upstream & { adType: AdType });
}
