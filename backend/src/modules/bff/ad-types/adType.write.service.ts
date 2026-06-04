/**
 * AdType BFF Write Service
 * Handles create, update, and delete for AdType.
 * Delete is soft-blocked if referenced by business records.
 */

import { prisma } from '../../../shared/prisma/client';
import { BadRequestError, ConflictError } from '../../../shared/errors/AppError';

export interface CreateAdTypeInput {
  code: string;
  name: string;
}

export interface UpdateAdTypeInput {
  code?: string;
  name?: string;
}

// Check if adType code is referenced by any business table
async function isCodeReferenced(code: string): Promise<boolean> {
  const [upstream, adOrder, adSite, downstream] = await Promise.all([
    prisma.upstream.count({ where: { adType: { code } } }),
    prisma.adOrder.count({ where: { adType: { code } } }),
    prisma.adSite.count({ where: { upstream: { adType: { code } } } }),
    prisma.downstream.count({ where: { adType: { code } } }),
  ]);
  return upstream > 0 || adOrder > 0 || adSite > 0 || downstream > 0;
}

export async function createAdType(input: CreateAdTypeInput): Promise<{ id: number; code: string; name: string }> {
  const code = input.code?.trim().toUpperCase();
  const name = input.name?.trim();

  if (!code) throw new BadRequestError('code is required');
  if (!name) throw new BadRequestError('name is required');
  if (!/^[A-Z0-9_]+$/.test(code)) {
    throw new BadRequestError('code must contain only uppercase letters, numbers, and underscores (pattern: ^[A-Z0-9_]+)');
  }

  const existing = await prisma.adType.findUnique({ where: { code } });
  if (existing) throw new ConflictError(`AdType with code '${code}' already exists`);

  // AdType.id has no auto-increment — must provide explicit id.
  // Find next available id to avoid conflicts.
  const maxRow = await prisma.adType.findFirst({ orderBy: { id: 'desc' }, select: { id: true } });
  const nextId = (maxRow?.id ?? 0) + 1;

  let row: { id: number; code: string; name: string };
  try {
    row = await prisma.adType.create({
      data: { id: nextId, code, name },
      select: { id: true, code: true, name: true },
    });
  } catch (err: any) {
    // Handle race condition where id is taken between our check and insert
    if (err.code === '2002' || err.message?.includes('duplicate key')) {
      throw new ConflictError(`AdType with code '${code}' already exists`);
    }
    throw err;
  }

  return { id: row.id, code: row.code, name: row.name };
}

export async function updateAdType(id: number, input: UpdateAdTypeInput): Promise<{ id: number; code: string; name: string }> {
  if (!id || isNaN(id)) throw new BadRequestError('Invalid id');

  const existing = await prisma.adType.findUnique({ where: { id } });
  if (!existing) throw new BadRequestError('AdType not found');

  let code = input.code?.trim().toUpperCase();
  const name = input.name?.trim();

  if (input.code !== undefined && !code) throw new BadRequestError('code cannot be empty');
  if (input.name !== undefined && !name) throw new BadRequestError('name cannot be empty');
  if (code && !/^[A-Z0-9_]+$/.test(code)) {
    throw new BadRequestError('code must contain only uppercase letters, numbers, and underscores (pattern: ^[A-Z0-9_]+)');
  }

  // If code is changing, check it's not referenced
  if (code && code !== existing.code) {
    const referenced = await isCodeReferenced(existing.code);
    if (referenced) {
      throw new ConflictError(`Cannot change code: AdType '${existing.code}' is referenced by existing business records`);
    }
    const duplicate = await prisma.adType.findUnique({ where: { code } });
    if (duplicate) throw new ConflictError(`AdType with code '${code}' already exists`);
  }

  const updated = await prisma.adType.update({
    where: { id },
    data: {
      ...(code && { code }),
      ...(name && { name }),
    },
    select: { id: true, code: true, name: true },
  });

  return { id: updated.id, code: updated.code, name: updated.name };
}

export async function deleteAdType(id: number): Promise<{ deleted: boolean }> {
  if (!id || isNaN(id)) throw new BadRequestError('Invalid id');

  const existing = await prisma.adType.findUnique({ where: { id } });
  if (!existing) throw new BadRequestError('AdType not found');

  // Check if referenced before blocking delete
  const referenced = await isCodeReferenced(existing.code);
  if (referenced) {
    throw new ConflictError(`Cannot delete AdType '${existing.code}': it is referenced by existing business records`);
  }

  await prisma.adType.delete({ where: { id } });
  return { deleted: true };
}