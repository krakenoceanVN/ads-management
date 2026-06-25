/**
 * Phase 3B/3C: Data Entry Write Controller
 * Handles advertiser and media batch save/confirm/unconfirm.
 * Permission guards are applied at route level via requirePermission middleware.
 */

import type { Request, Response } from 'express';
import { saveAdvertiserBatch, confirmAdvertiserBatch, unconfirmAdvertiser } from './advertiserBatch.service';
import { saveMediaBatch, confirmMediaBatch, unconfirmMedia } from './mediaBatch.service';
import { bffData } from '../../../shared/response/success';

// ─── Advertiser Batch Save ───────────────────────────────────────────────────

export async function postAdvertiserBatch(req: Request, res: Response) {
  const { items } = req.body as { items: any[] };
  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ success: false, error: 'items must be a non-empty array', code: 'BAD_REQUEST' });
    return;
  }

  const userId = String((req as any).authUser?.id ?? '');
  try {
    const result = await saveAdvertiserBatch(items, userId);
    res.json(bffData(result));
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message, code: 'BAD_REQUEST' });
  }
}

// ─── Advertiser Confirm Batch ────────────────────────────────────────────────

export async function postAdvertiserConfirmBatch(req: Request, res: Response) {
  const { recordDate, adSiteIds } = req.body as { recordDate: string; adSiteIds: string[] };
  if (!recordDate || !Array.isArray(adSiteIds) || adSiteIds.length === 0) {
    res.status(400).json({ success: false, error: 'recordDate and adSiteIds[] are required', code: 'BAD_REQUEST' });
    return;
  }

  const userId = String((req as any).authUser?.id ?? '');
  const result = await confirmAdvertiserBatch(recordDate, adSiteIds, userId);
  res.json(bffData(result));
}

// ─── Advertiser Unconfirm ────────────────────────────────────────────────────

export async function putAdvertiserUnconfirm(req: Request, res: Response) {
  const id = req.params['id'] as string;
  if (!id) {
    res.status(400).json({ success: false, error: 'invalid id', code: 'BAD_REQUEST' });
    return;
  }

  const userId = (req as any).authUser?.id ?? 0;
  try {
    const result = await unconfirmAdvertiser(id, userId);
    res.json(bffData(result));
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message, code: 'BAD_REQUEST' });
  }
}

// ─── Media Batch Save ────────────────────────────────────────────────────────

export async function postMediaBatch(req: Request, res: Response) {
  const { items } = req.body as { items: any[] };
  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ success: false, error: 'items must be a non-empty array', code: 'BAD_REQUEST' });
    return;
  }

  const userId = String((req as any).authUser?.id ?? '');
  try {
    const result = await saveMediaBatch(items, userId);
    res.json(bffData(result));
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message, code: 'BAD_REQUEST' });
  }
}

// ─── Media Confirm Batch ─────────────────────────────────────────────────────

export async function postMediaConfirmBatch(req: Request, res: Response) {
  const { recordDate, adSiteIds } = req.body as { recordDate: string; adSiteIds: string[] };
  if (!recordDate || !Array.isArray(adSiteIds) || adSiteIds.length === 0) {
    res.status(400).json({ success: false, error: 'recordDate and adSiteIds[] are required', code: 'BAD_REQUEST' });
    return;
  }

  const userId = String((req as any).authUser?.id ?? '');
  const result = await confirmMediaBatch(recordDate, adSiteIds, userId);
  res.json(bffData(result));
}

// ─── Media Unconfirm ─────────────────────────────────────────────────────────

export async function putMediaUnconfirm(req: Request, res: Response) {
  const id = req.params['id'] as string;
  if (!id) {
    res.status(400).json({ success: false, error: 'invalid id', code: 'BAD_REQUEST' });
    return;
  }

  const userId = (req as any).authUser?.id ?? 0;
  try {
    const result = await unconfirmMedia(id, userId);
    res.json(bffData(result));
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message, code: 'BAD_REQUEST' });
  }
}