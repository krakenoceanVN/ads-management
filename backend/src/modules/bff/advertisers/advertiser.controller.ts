import type { Request, Response } from 'express';
import { listAdvertisers, getAdvertiser } from './advertiser.service';
import { createAdvertiser, updateAdvertiser, deleteAdvertiser } from './advertiser.write.service';
import { bffData } from '../../../shared/response/success';
import { NotFoundError, BadRequestError } from '../../../shared/errors/AppError';
import { recordMasterDataOperation } from '../operation-logs/oplog.write.service';
import type { CreateAdvertiserInput, UpdateAdvertiserInput } from './advertiser.write.service';

export async function getAll(_req: Request, res: Response) {
  const data = await listAdvertisers();
  res.json(bffData(data));
}

export async function getById(req: Request, res: Response) {
  const id = req.params['id'] as string;
  if (!id) throw new NotFoundError('Invalid advertiser id');
  const advertiser = await getAdvertiser(id);
  if (!advertiser) throw new NotFoundError('Advertiser not found');
  res.json(bffData(advertiser));
}

export async function create(req: Request, res: Response) {
  const body = req.body as CreateAdvertiserInput;
  if (!body || !body.name?.trim()) throw new BadRequestError('name is required');
  const adTypeIds = body.adTypeIds?.map(id => id.trim()).filter(Boolean) ?? [];
  const legacyAdTypeId = body.adTypeId?.trim();
  const advertiser = await createAdvertiser({
    name: body.name.trim(),
    contact: body.contact ?? null,
    phone: body.phone ?? null,
    email: body.email ?? null,
    notes: body.notes ?? null,
    status: body.status ?? 'active',
    adTypeId: legacyAdTypeId,
    adTypeIds: adTypeIds.length ? adTypeIds : undefined,
  });
  await recordMasterDataOperation(req, 'CREATE_ADVERTISER', 'advertiser', advertiser.id, advertiser.name);
  res.status(201).json(bffData(advertiser));
}

export async function update(req: Request, res: Response) {
  const id = req.params['id'] as string;
  if (!id) throw new NotFoundError('Invalid advertiser id');
  const body = req.body as UpdateAdvertiserInput;
  const advertiser = await updateAdvertiser(id, {
    name: body.name?.trim(),
    contact: body.contact !== undefined ? body.contact : undefined,
    phone: body.phone !== undefined ? body.phone : undefined,
    email: body.email !== undefined ? body.email : undefined,
    notes: body.notes !== undefined ? body.notes : undefined,
    status: body.status,
    adTypeId: body.adTypeId?.trim(),
    adTypeIds: body.adTypeIds?.map(id => id.trim()).filter(Boolean),
  });
  await recordMasterDataOperation(req, 'UPDATE_ADVERTISER', 'advertiser', advertiser.id, advertiser.name);
  res.json(bffData(advertiser));
}

export async function remove(req: Request, res: Response) {
  const id = req.params['id'] as string;
  if (!id) throw new NotFoundError('Invalid advertiser id');
  const advertiser = await deleteAdvertiser(id);
  await recordMasterDataOperation(req, 'DELETE_ADVERTISER', 'advertiser', id, advertiser.name);
  res.json(bffData({ deleted: true }));
}
