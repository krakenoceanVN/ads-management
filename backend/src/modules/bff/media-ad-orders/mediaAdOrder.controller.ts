import type { Request, Response } from 'express';
import { listMediaAdOrders, getMediaAdOrder } from './mediaAdOrder.service';
import { createMediaAdOrder, updateMediaAdOrder, deleteMediaAdOrder } from './mediaAdOrder.write.service';
import { bffData } from '../../../shared/response/success';
import { NotFoundError, BadRequestError } from '../../../shared/errors/AppError';
import { recordMasterDataOperation } from '../operation-logs/oplog.write.service';
import { isValidId } from '../../../shared/ids';
import type { CreateMediaAdOrderInput, UpdateMediaAdOrderInput } from './mediaAdOrder.write.service';

export async function getAll(req: Request, res: Response) {
  const { adTypeId } = req.query;
  const downstreamId = req.query['downstreamId'] ? String(req.query['downstreamId']) : undefined;
  const params = {
    downstreamId: downstreamId && isValidId(downstreamId) ? downstreamId : undefined,
    adTypeId: adTypeId ? String(adTypeId) : undefined,
  };
  const data = await listMediaAdOrders(params);
  res.json(bffData(data));
}

export async function getById(req: Request, res: Response) {
  const id = req.params['id'] as string;
  if (!isValidId(id)) throw new NotFoundError('Invalid media ad order id');
  const order = await getMediaAdOrder(id);
  if (!order) throw new NotFoundError('Media ad order not found');
  res.json(bffData(order));
}

export async function create(req: Request, res: Response) {
  const body = req.body as CreateMediaAdOrderInput;
  if (!body || !body.downstreamId) throw new BadRequestError('downstreamId is required');
  if (!body.adTypeId?.trim()) throw new BadRequestError('adTypeId is required');
  const order = await createMediaAdOrder({
    downstreamId: body.downstreamId,
    adTypeId: body.adTypeId.trim(),
    name: body.name,
    notes: body.notes ?? null,
    status: body.status ?? 'active',
  });
  await recordMasterDataOperation(req, 'CREATE_MEDIA_AD_ORDER', 'mediaAdOrder', order.id, order.name);
  res.status(201).json(bffData(order));
}

export async function update(req: Request, res: Response) {
  const id = req.params['id'] as string;
  if (!isValidId(id)) throw new NotFoundError('Invalid media ad order id');
  const body = req.body as UpdateMediaAdOrderInput;
  const order = await updateMediaAdOrder(id, {
    name: body.name,
    notes: body.notes,
    status: body.status,
    downstreamId: body.downstreamId,
    adTypeId: body.adTypeId?.trim(),
  });
  await recordMasterDataOperation(req, 'UPDATE_MEDIA_AD_ORDER', 'mediaAdOrder', order.id, order.name);
  res.json(bffData(order));
}

export async function remove(req: Request, res: Response) {
  const id = req.params['id'] as string;
  if (!isValidId(id)) throw new NotFoundError('Invalid media ad order id');
  const order = await deleteMediaAdOrder(id);
  await recordMasterDataOperation(req, 'DELETE_MEDIA_AD_ORDER', 'mediaAdOrder', id, order.name);
  res.json(bffData({ deleted: true }));
}