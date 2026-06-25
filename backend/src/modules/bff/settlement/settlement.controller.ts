/**
 * Settlement Controller
 *
 * GET /api/bff/settlement/advertisers — confirmed advertiser settlement
 * GET /api/bff/settlement/media — confirmed media settlement with payout cost
 */

import type { Request, Response } from 'express';
import { getAdvertiserSettlement, getMediaSettlement } from './settlement.service';
import { bffData } from '../../../shared/response/success';

export async function getAdvertiserSettlementHandler(req: Request, res: Response) {
  const { period, advertiserId, adTypeId } = req.query;

  const params = {
    ...(period !== undefined && { period: String(period) }),
    ...(advertiserId !== undefined && { advertiserId: String(advertiserId) }),
    ...(adTypeId !== undefined && { adTypeId: String(adTypeId) }),
  };

  try {
    const rows = await getAdvertiserSettlement(params);
    res.json(bffData(rows));
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message, code: 'INTERNAL' });
  }
}

export async function getMediaSettlementHandler(req: Request, res: Response) {
  const { period, mediaId, adTypeId } = req.query;

  const params = {
    ...(period !== undefined && { period: String(period) }),
    ...(mediaId !== undefined && { mediaId: String(mediaId) }),
    ...(adTypeId !== undefined && { adTypeId: String(adTypeId) }),
  };

  try {
    const rows = await getMediaSettlement(params);
    res.json(bffData(rows));
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message, code: 'INTERNAL' });
  }
}