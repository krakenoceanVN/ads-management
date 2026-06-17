import type { Request, Response } from 'express';
import { listDownstreams, getDownstreamById } from './downstream.service';
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

export async function getById(req: Request, res: Response) {
  const id = parseInt(req.params['id'] as string, 10);
  if (isNaN(id)) throw new NotFoundError('Invalid downstream id');
  const row = await getDownstreamById(id);
  if (!row) throw new NotFoundError('Downstream not found');
  res.json(bffData(row));
}

export async function create(req: Request, res: Response) {
  const body = req.body as {
    adTypeCodes?: string[];
    downstreamType?: string;
    payoutRate?: number;
    status?: string;
  };
  if (!body.downstreamType) throw new BadRequestError('downstreamType is required');
  const adTypeCodes = body.adTypeCodes?.map(c => c.trim()).filter(Boolean) ?? [];
  if (!adTypeCodes.length) {
    throw new BadRequestError('adTypeCodes is required (at least one)');
  }

  const result = await createDownstream({
    adTypeCodes,
    downstreamType: body.downstreamType,
    payoutRate: body.payoutRate,
    status: body.status,
  });
  await recordMasterDataOperation(req, 'CREATE_DOWNSTREAM', 'downstream', result.id, result.downstreamType);
  res.status(201).json(bffData(result));
}

export async function update(req: Request, res: Response) {
  const id = parseInt(req.params['id'] as string, 10);
  if (isNaN(id)) throw new NotFoundError('Invalid downstream id');
  const body = req.body as {
    downstreamType?: string;
    payoutRate?: number;
    status?: string;
    adTypeCodes?: string[];
  };
  const result = await updateDownstream(id, {
    downstreamType: body.downstreamType,
    payoutRate: body.payoutRate,
    status: body.status,
    adTypeCodes: body.adTypeCodes,
  });
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
