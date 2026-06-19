import type { Request, Response } from 'express';
import { listMedia, getMedia } from './media.service';
import { createMedia, updateMedia, deleteMedia } from './media.write.service';
import { bffData } from '../../../shared/response/success';
import { NotFoundError, BadRequestError } from '../../../shared/errors/AppError';
import { recordMasterDataOperation } from '../operation-logs/oplog.write.service';
import { normalizeBillingMethodForStorage } from '../bff.types';
import type { CreateMediaInput, UpdateMediaInput } from './media.write.service';

export async function getAll(req: Request, res: Response) {
  const adOrderIdRaw = req.query['adOrderId'];
  const adOrderId = adOrderIdRaw ? parseInt(String(adOrderIdRaw), 10) : undefined;
  const data = await listMedia(adOrderId != null && !Number.isNaN(adOrderId) ? { adOrderId } : undefined);
  res.json(bffData(data));
}

export async function getById(req: Request, res: Response) {
  const id = parseInt(req.params['id'] as string, 10);
  if (isNaN(id)) throw new NotFoundError('Invalid media id');
  const media = await getMedia(id);
  if (!media) throw new NotFoundError('Media not found');
  res.json(bffData(media));
}

export async function create(req: Request, res: Response) {
  const body = req.body as CreateMediaInput;
  if (!body || !body.name?.trim()) throw new BadRequestError('name is required');
  if (!body.upstreamId || body.upstreamId <= 0) throw new BadRequestError('upstreamId is required');
  if ((body.billingMethod === 'CPM' || body.billingMethod === 'CPA') &&
      (body.currentUnitPrice === undefined || body.currentUnitPrice === null || isNaN(Number(body.currentUnitPrice)) || Number(body.currentUnitPrice) <= 0)) {
    throw new BadRequestError('currentUnitPrice is required and must be greater than 0 for ' + body.billingMethod);
  }
  const canonicalBilling = body.billingMethod ? normalizeBillingMethodForStorage(body.billingMethod) : undefined;
  if (!canonicalBilling) throw new BadRequestError('Invalid billing method: ' + body.billingMethod);
  if (canonicalBilling === 'CPS' &&
      (body.currentRatio === undefined || body.currentRatio === null || isNaN(Number(body.currentRatio)) || Number(body.currentRatio) <= 0)) {
    throw new BadRequestError('currentRatio is required and must be greater than 0 for CPS');
  }
  const media = await createMedia({
    name: body.name.trim(),
    contact: body.contact ?? null,
    phone: body.phone ?? null,
    email: body.email ?? null,
    notes: body.notes ?? null,
    status: body.status ?? 'active',
    upstreamId: body.upstreamId as number,
    billingMethod: canonicalBilling,
    currentUnitPrice: body.currentUnitPrice ?? null,
    currentRatio: body.currentRatio ?? null,
  });
  await recordMasterDataOperation(req, 'CREATE_MEDIA', 'media', media.id, media.name);
  res.status(201).json(bffData(media));
}

export async function update(req: Request, res: Response) {
  const id = parseInt(req.params['id'] as string, 10);
  if (isNaN(id)) throw new NotFoundError('Invalid media id');
  const body = req.body as UpdateMediaInput;
  if (body.upstreamId !== undefined && body.upstreamId <= 0) throw new BadRequestError('upstreamId must be greater than 0');
  if (body.billingMethod !== undefined && !normalizeBillingMethodForStorage(body.billingMethod)) {
    throw new BadRequestError('Invalid billing method: ' + body.billingMethod);
  }
  const media = await updateMedia(id, {
    name: body.name?.trim(),
    contact: body.contact !== undefined ? body.contact : undefined,
    phone: body.phone !== undefined ? body.phone : undefined,
    email: body.email !== undefined ? body.email : undefined,
    notes: body.notes !== undefined ? body.notes : undefined,
    status: body.status,
    upstreamId: body.upstreamId,
    adTypeCode: body.adTypeCode?.trim(),
    billingMethod: body.billingMethod,
    currentUnitPrice: body.currentUnitPrice,
    currentRatio: body.currentRatio,
    isArchived: body.isArchived,
  });
  await recordMasterDataOperation(req, 'UPDATE_MEDIA', 'media', media.id, media.name);
  res.json(bffData(media));
}

export async function remove(req: Request, res: Response) {
  const id = parseInt(req.params['id'] as string, 10);
  if (isNaN(id)) throw new NotFoundError('Invalid media id');
  const media = await deleteMedia(id);
  await recordMasterDataOperation(req, 'DELETE_MEDIA', 'media', id, media.name);
  res.json(bffData({ deleted: true }));
}
