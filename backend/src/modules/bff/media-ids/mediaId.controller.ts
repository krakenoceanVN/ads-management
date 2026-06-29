import type { Request, Response } from 'express';
import { listMediaIds, getMediaId } from './mediaId.service';
import { createMediaId, updateMediaId, deleteMediaId } from './mediaId.write.service';
import { bffData } from '../../../shared/response/success';
import { NotFoundError, BadRequestError } from '../../../shared/errors/AppError';
import { recordMasterDataOperation } from '../operation-logs/oplog.write.service';
import type { CreateMediaIdInput, UpdateMediaIdInput } from './mediaId.write.service';

export async function getAll(req: Request, res: Response) {
  const { mediaId, adTypeCode, type, archived } = req.query;

  const filters = {
    mediaId: mediaId ? String(mediaId) : undefined,
    adTypeCode: adTypeCode ? String(adTypeCode) : undefined,
    type: type ? (String(type) as 'CPM' | 'CPC' | 'CPS' | 'CPA') : undefined,
    archived: archived !== undefined ? archived === 'true' : undefined,
  };

  const data = await listMediaIds(filters);
  res.json(bffData(data));
}

export async function getById(req: Request, res: Response) {
  const id = req.params['id'] as string;
  if (!id) throw new NotFoundError('Invalid media id');
  const mediaId = await getMediaId(String(id));
  if (!mediaId) throw new NotFoundError('Media id not found');
  res.json(bffData(mediaId));
}

export async function create(req: Request, res: Response) {
  const body = req.body as CreateMediaIdInput;
  if (!body || !body.adSiteId) throw new BadRequestError('adSiteId is required');
  if (!body.downstreamId) throw new BadRequestError('downstreamId is required');

  const mediaId = await createMediaId({
    adSiteId: body.adSiteId,
    downstreamId: body.downstreamId,
    mediaAdOrderId: body.mediaAdOrderId ?? null,
    customPrice: body.customPrice ?? null,
    pctHal: body.pctHal ?? null,
    mediaAdTypeId: body.mediaAdTypeId ?? null,
    mediaIdName: body.mediaIdName ?? null,
    status: body.status,
  });
  await recordMasterDataOperation(req, 'CREATE_MEDIA_ID', 'mediaId', mediaId.id, mediaId.slot);
  res.status(201).json(bffData(mediaId));
}

export async function update(req: Request, res: Response) {
  const id = req.params['id'] as string;
  if (!id) throw new NotFoundError('Invalid media id');
  const body = req.body as UpdateMediaIdInput;

  const mediaId = await updateMediaId(String(id), {
    mediaAdOrderId: body.mediaAdOrderId,
    customPrice: body.customPrice,
    pctHal: body.pctHal,
    mediaAdTypeId: body.mediaAdTypeId,
    mediaIdName: body.mediaIdName,
    status: body.status,
  });
  await recordMasterDataOperation(req, 'UPDATE_MEDIA_ID', 'mediaId', mediaId.id, mediaId.slot);
  res.json(bffData(mediaId));
}

export async function remove(req: Request, res: Response) {
  const id = req.params['id'] as string;
  if (!id) throw new NotFoundError('Invalid media id');
  await deleteMediaId(String(id));
  res.json(bffData({ deleted: true }));
}
