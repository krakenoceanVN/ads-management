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
    mediaId: mediaId ? parseInt(String(mediaId), 10) : undefined,
    adTypeCode: adTypeCode ? String(adTypeCode) : undefined,
    type: type ? (String(type) as 'CPM' | 'CPS' | 'CPA') : undefined,
    archived: archived !== undefined ? archived === 'true' : undefined,
  };

  const data = await listMediaIds(filters);
  res.json(bffData(data));
}

export async function getById(req: Request, res: Response) {
  const id = parseInt(req.params['id'] as string, 10);
  if (isNaN(id)) throw new NotFoundError('Invalid media id');
  const mediaId = await getMediaId(id);
  if (!mediaId) throw new NotFoundError('Media id not found');
  res.json(bffData(mediaId));
}

export async function create(req: Request, res: Response) {
  const body = req.body as CreateMediaIdInput;
  if (!body || !body.adSiteId) throw new BadRequestError('adSiteId is required');
  if (!body.downstreamId) throw new BadRequestError('downstreamId is required');

  // Reject status="inactive" on create
  if ((body as any).status && (body as any).status !== 'active') {
    throw new BadRequestError('status must be "active" — MediaId.status is a read-only compatibility field');
  }

  const mediaId = await createMediaId({
    adSiteId: body.adSiteId,
    downstreamId: body.downstreamId,
    customPrice: body.customPrice ?? null,
  });
  await recordMasterDataOperation(req, 'CREATE_MEDIA_ID', 'mediaId', mediaId.id, mediaId.slot);
  res.status(201).json(bffData(mediaId));
}

export async function update(req: Request, res: Response) {
  const id = parseInt(req.params['id'] as string, 10);
  if (isNaN(id)) throw new NotFoundError('Invalid media id');
  const body = req.body as UpdateMediaIdInput;

  // Reject status="inactive" on PUT
  if ((body as any).status !== undefined && (body as any).status !== 'active') {
    throw new BadRequestError('status must be "active" — MediaId.status is a read-only compatibility field');
  }

  const mediaId = await updateMediaId(id, {
    customPrice: body.customPrice,
    status: (body as any).status,
  });
  await recordMasterDataOperation(req, 'UPDATE_MEDIA_ID', 'mediaId', mediaId.id, mediaId.slot);
  res.json(bffData(mediaId));
}

export async function remove(req: Request, res: Response) {
  const id = parseInt(req.params['id'] as string, 10);
  if (isNaN(id)) throw new NotFoundError('Invalid media id');
  await deleteMediaId(id);
  res.json(bffData({ deleted: true }));
}
