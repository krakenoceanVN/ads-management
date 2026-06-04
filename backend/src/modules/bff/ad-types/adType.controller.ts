/**
 * AdType BFF Controller
 * Handles HTTP endpoints for AdType CRUD.
 */

import type { Request, Response } from 'express';
import { listAdTypes, getAdType } from './adType.service';
import { createAdType, updateAdType, deleteAdType } from './adType.write.service';
import { bffData } from '../../../shared/response/success';
import { NotFoundError, BadRequestError } from '../../../shared/errors/AppError';

export async function getAll(_req: Request, res: Response) {
  const data = await listAdTypes();
  res.json(bffData(data));
}

export async function getById(req: Request, res: Response) {
  const id = parseInt(req.params['id'] as string, 10);
  if (isNaN(id)) throw new NotFoundError('Invalid adType id');
  const adType = await getAdType(id);
  if (!adType) throw new NotFoundError('AdType not found');
  res.json(bffData(adType));
}

export async function create(req: Request, res: Response) {
  const { code, name } = req.body as { code?: string; name?: string };
  if (!code) throw new BadRequestError('code is required');
  if (!name) throw new BadRequestError('name is required');
  const result = await createAdType({ code, name });
  res.status(201).json(bffData(result));
}

export async function update(req: Request, res: Response) {
  const id = parseInt(req.params['id'] as string, 10);
  if (isNaN(id)) throw new NotFoundError('Invalid adType id');
  const { code, name } = req.body as { code?: string; name?: string };
  const result = await updateAdType(id, { code, name });
  res.json(bffData(result));
}

export async function remove(req: Request, res: Response) {
  const id = parseInt(req.params['id'] as string, 10);
  if (isNaN(id)) throw new NotFoundError('Invalid adType id');
  await deleteAdType(id);
  res.json(bffData({ deleted: true }));
}