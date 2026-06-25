/**
 * AdType BFF Controller
 * Handles HTTP endpoints for AdType CRUD.
 */

import type { Request, Response } from 'express';
import { listAdTypes, getAdType } from './adType.service';
import { createAdType, updateAdType, deleteAdType } from './adType.write.service';
import { bffData } from '../../../shared/response/success';
import { NotFoundError, BadRequestError } from '../../../shared/errors/AppError';
import { recordMasterDataOperation } from '../operation-logs/oplog.write.service';

export async function getAll(_req: Request, res: Response) {
  const data = await listAdTypes();
  res.json(bffData(data));
}

export async function getById(req: Request, res: Response) {
  const id = req.params['id'] as string;
  if (!id) throw new NotFoundError('Invalid adType id');
  const adType = await getAdType(id);
  if (!adType) throw new NotFoundError('AdType not found');
  res.json(bffData(adType));
}

export async function create(req: Request, res: Response) {
  const { name, upstreamId, notes, status } = req.body as {
    name?: string; upstreamId?: string; notes?: string; status?: string;
  };
  if (!name) throw new BadRequestError('name is required');
  const result = await createAdType({ name, upstreamId, notes, status: status as 'active' | 'inactive' | undefined });
  await recordMasterDataOperation(req, 'CREATE_AD_TYPE', 'adType', result.id, result.name);
  res.status(201).json(bffData(result));
}

export async function update(req: Request, res: Response) {
  const id = req.params['id'] as string;
  if (!id) throw new NotFoundError('Invalid adType id');
  const { name, upstreamId, notes, status } = req.body as {
    name?: string; upstreamId?: string | null; notes?: string | null; status?: string;
  };
  const result = await updateAdType(id, {
    name,
    upstreamId: upstreamId ?? undefined,
    notes: notes ?? undefined,
    status: status as 'active' | 'inactive' | undefined,
  });
  await recordMasterDataOperation(req, 'UPDATE_AD_TYPE', 'adType', result.id, result.name);
  res.json(bffData(result));
}

export async function remove(req: Request, res: Response) {
  const id = req.params['id'] as string;
  if (!id) throw new NotFoundError('Invalid adType id');
  await deleteAdType(id);
  await recordMasterDataOperation(req, 'DELETE_AD_TYPE', 'adType', id, null);
  res.json(bffData({ deleted: true }));
}