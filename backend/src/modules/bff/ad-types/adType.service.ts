/**
 * AdType BFF Service
 * Read-only service for listing AdTypes.
 * Write operations (create/update/delete) are in adType.write.service.ts.
 */

import { prisma } from '../../../shared/prisma/client';
import type { AdType } from '../../../shared/prisma/client';

export interface AdTypeDto {
  id: number;
  code: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

function toDto(adType: AdType): AdTypeDto {
  return {
    id: adType.id,
    code: adType.code,
    name: adType.name,
    createdAt: adType.createdAt.toISOString(),
    updatedAt: adType.updatedAt.toISOString(),
  };
}

export async function listAdTypes(): Promise<AdTypeDto[]> {
  const rows = await prisma.adType.findMany({
    orderBy: { id: 'asc' },
  });
  return rows.map(toDto);
}

export async function getAdType(id: number): Promise<AdTypeDto | null> {
  const row = await prisma.adType.findUnique({ where: { id } });
  return row ? toDto(row) : null;
}