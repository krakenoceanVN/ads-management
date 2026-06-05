import type { Request, Response } from 'express';
import { listDownstreams } from './downstream.service';
import { createDownstream, updateDownstream, deleteDownstream } from './downstream.write.service';
import { bffData } from '../../../shared/response/success';
import { BadRequestError, NotFoundError } from '../../../shared/errors/AppError';
import { recordMasterDataOperation } from '../operation-logs/oplog.write.service';
import type { EntityStatus } from '../bff.types';

export async function getAll(req: Request, res: Response) {
  const { adTypeCode, status, keyword } = req.query;

  const filters = {
    adTypeCode: adTypeCode ? String(adTypeCode) : undefined,
    status: status ? (String(status) as EntityStatus) : undefined,
    keyword: keyword ? String(keyword) : undefined,
  };

  const data = await listDownstreams(filters);
  res.json(bffData(data));
}

export async function create(req: Request, res: Response) {
  const { adTypeId, downstreamType, payoutRate, status } = req.body as {
    adTypeId?: number;
    downstreamType?: string;
    payoutRate?: number;
    status?: string;
  };
  if (!adTypeId) throw new BadRequestError('adTypeId is required');
  if (!downstreamType) throw new BadRequestError('downstreamType is required');
  const result = await createDownstream({ adTypeId, downstreamType, payoutRate, status });
  await recordMasterDataOperation(req, 'CREATE_DOWNSTREAM', 'downstream', result.id, result.downstreamType);
  res.status(201).json(bffData(result));
}

export async function update(req: Request, res: Response) {
  const id = parseInt(req.params['id'] as string, 10);
  if (isNaN(id)) throw new NotFoundError('Invalid downstream id');
  const { downstreamType, payoutRate, status } = req.body as {
    downstreamType?: string;
    payoutRate?: number;
    status?: string;
  };
  const result = await updateDownstream(id, { downstreamType, payoutRate, status });
  await recordMasterDataOperation(req, 'UPDATE_DOWNSTREAM', 'downstream', result.id, result.downstreamType);
  res.json(bffData(result));
}

export async function remove(req: Request, res: Response) {
  const id = parseInt(req.params['id'] as string, 10);
  if (isNaN(id)) throw new NotFoundError('Invalid downstream id');
  const result = await deleteDownstream(id);
  await recordMasterDataOperation(req, 'DELETE_DOWNSTREAM', 'downstream', id, result.mode);
  res.json(bffData(result));
}
