import type { Request, Response } from 'express';
import { listAdIds, getAdId } from './adId.service';
import { createAdId, updateAdId, deleteAdId } from './adId.write.service';
import { bffData } from '../../../shared/response/success';
import { NotFoundError, BadRequestError } from '../../../shared/errors/AppError';
import { recordMasterDataOperation } from '../operation-logs/oplog.write.service';
import { normalizeBillingMethodForStorage } from '../bff.types';
import type { CreateAdIdInput, UpdateAdIdInput } from './adId.write.service';

export async function getAll(req: Request, res: Response) {
  const { advertiserId, adTypeId, type, archived } = req.query;

  const filters = {
    advertiserId: advertiserId ? parseInt(String(advertiserId), 10) : undefined,
    adTypeId: adTypeId ? String(adTypeId) : undefined,
    type: type ? (String(type) as 'CPM' | 'CPS' | 'CPA') : undefined,
    archived: archived !== undefined ? archived === 'true' : undefined,
  };

  const data = await listAdIds(filters);
  res.json(bffData(data));
}

export async function getById(req: Request, res: Response) {
  const id = req.params['id'] as string;
  if (!id) throw new NotFoundError('Invalid ad id');
  const adId = await getAdId(id);
  if (!adId) throw new NotFoundError('Ad id not found');
  res.json(bffData(adId));
}

export async function create(req: Request, res: Response) {
  const body = req.body as CreateAdIdInput;
  if (!body || !body.advertiserId) throw new BadRequestError('advertiserId is required');
  if (!body.adTypeId) throw new BadRequestError('adTypeId is required');
  if (!body.slot?.trim()) throw new BadRequestError('slot is required');
  if (!body.type) throw new BadRequestError('type is required');
  const canonicalType = normalizeBillingMethodForStorage(body.type);
  if (!canonicalType) throw new BadRequestError('Invalid billing method: ' + body.type);
  if ((canonicalType === 'CPM' || canonicalType === 'CPA') && (body.unitPrice === undefined || body.unitPrice === null || isNaN(Number(body.unitPrice)) || Number(body.unitPrice) <= 0)) {
    throw new BadRequestError('unitPrice is required and must be greater than 0 for ' + canonicalType);
  }
  if (canonicalType === 'CPS' && (body.ratio === undefined || body.ratio === null || isNaN(Number(body.ratio)) || Number(body.ratio) <= 0)) {
    throw new BadRequestError('ratio is required and must be greater than 0 for CPS');
  }

  const adId = await createAdId({
    advertiserId: body.advertiserId,
    adTypeId: body.adTypeId,
    slot: body.slot.trim(),
    type: body.type,
    unitPrice: body.unitPrice ?? null,
    ratio: body.ratio ?? null,
    notes: body.notes ?? null,
    status: body.status ?? 'active',
  });
  await recordMasterDataOperation(req, 'CREATE_AD_ID', 'adId', adId.id, adId.slot);
  res.status(201).json(bffData(adId));
}

export async function update(req: Request, res: Response) {
  const id = req.params['id'] as string;
  if (!id) throw new NotFoundError('Invalid ad id');
  const body = req.body as UpdateAdIdInput;

  const adId = await updateAdId(id, {
    advertiserId: body.advertiserId,
    adTypeId: body.adTypeId,
    slot: body.slot?.trim(),
    type: body.type,
    unitPrice: body.unitPrice,
    ratio: body.ratio,
    notes: body.notes !== undefined ? body.notes : undefined,
    status: body.status,
  });
  await recordMasterDataOperation(req, 'UPDATE_AD_ID', 'adId', adId.id, adId.slot);
  res.json(bffData(adId));
}

export async function remove(req: Request, res: Response) {
  const id = req.params['id'] as string;
  if (!id) throw new NotFoundError('Invalid ad id');
  const adId = await deleteAdId(id);
  await recordMasterDataOperation(req, 'DELETE_AD_ID', 'adId', id, adId.slot);
  res.json(bffData({ deleted: true }));
}