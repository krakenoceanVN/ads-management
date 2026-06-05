import type { Request, Response } from 'express';
import { listAdOrders, getAdOrder } from './adOrder.service';
import { createAdOrder, updateAdOrder, deleteAdOrder } from './adOrder.write.service';
import { bffData } from '../../../shared/response/success';
import { NotFoundError, BadRequestError } from '../../../shared/errors/AppError';
import { recordMasterDataOperation } from '../operation-logs/oplog.write.service';
import type { CreateAdOrderInput, UpdateAdOrderInput } from './adOrder.write.service';

export async function getAll(req: Request, res: Response) {
  const { advertiserId, adTypeCode } = req.query;
  const params = {
    advertiserId: advertiserId ? parseInt(String(advertiserId), 10) : undefined,
    adTypeCode: adTypeCode ? String(adTypeCode) : undefined,
  };
  const data = await listAdOrders(params);
  res.json(bffData(data));
}

export async function getById(req: Request, res: Response) {
  const id = parseInt(req.params['id'] as string, 10);
  if (isNaN(id)) throw new NotFoundError('Invalid ad order id');
  const order = await getAdOrder(id);
  if (!order) throw new NotFoundError('Ad order not found');
  res.json(bffData(order));
}

export async function create(req: Request, res: Response) {
  const body = req.body as CreateAdOrderInput;
  if (!body || !body.advertiserId) throw new BadRequestError('advertiserId is required');
  if (!body.name?.trim()) throw new BadRequestError('name is required');
  if (!body.adTypeCode?.trim()) throw new BadRequestError('adTypeCode is required');
  const order = await createAdOrder({
    advertiserId: body.advertiserId,
    name: body.name.trim(),
    adTypeCode: body.adTypeCode.trim(),
    notes: body.notes ?? null,
    status: body.status ?? 'active',
  });
  await recordMasterDataOperation(req, 'CREATE_AD_ORDER', 'adOrder', order.id, order.name);
  res.status(201).json(bffData(order));
}

export async function update(req: Request, res: Response) {
  const id = parseInt(req.params['id'] as string, 10);
  if (isNaN(id)) throw new NotFoundError('Invalid ad order id');
  const body = req.body as UpdateAdOrderInput;
  const order = await updateAdOrder(id, {
    name: body.name?.trim(),
    notes: body.notes !== undefined ? body.notes : undefined,
    status: body.status,
    advertiserId: body.advertiserId,
    adTypeCode: body.adTypeCode?.trim(),
  });
  await recordMasterDataOperation(req, 'UPDATE_AD_ORDER', 'adOrder', order.id, order.name);
  res.json(bffData(order));
}

export async function remove(req: Request, res: Response) {
  const id = parseInt(req.params['id'] as string, 10);
  if (isNaN(id)) throw new NotFoundError('Invalid ad order id');
  const order = await deleteAdOrder(id);
  await recordMasterDataOperation(req, 'DELETE_AD_ORDER', 'adOrder', id, order.name);
  res.json(bffData({ deleted: true }));
}
