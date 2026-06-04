/**
 * Phase 3C: Hard Delete Controller
 *
 * Handles hard delete HTTP endpoints.
 * Permission guard via requirePermission middleware (route-level).
 */

import type { Request, Response } from 'express';
import {
  hardDeleteAdvertiser,
  hardDeleteAdType,
  hardDeleteAdSite,
  hardDeleteAdOrder,
  hardDeleteMediaId,
} from './hardDelete.service';
import type { HardDeleteResult } from './hardDelete.types';

function getUserId(req: Request): number {
  return (req as any).authUser?.id ?? 0;
}

function getUsername(req: Request): string | null {
  return (req as any).authUser?.username ?? null;
}

function sendResult(res: Response, result: HardDeleteResult) {
  if (result.success) {
    res.json(result);
    return;
  }

  switch (result.code) {
    case 'NOT_FOUND':
      res.status(404).json(result);
      break;
    case 'ENTITY_HAS_FINANCIAL_DATA':
    case 'ENTITY_HAS_DEPENDENCIES':
      res.status(409).json(result);
      break;
    case 'LIMITATION':
      res.status(501).json(result);
      break;
    default:
      res.status(500).json({ success: false, code: 'INTERNAL_ERROR', message: 'Unexpected error' });
  }
}

// ─── DELETE /api/bff/hard-delete/advertisers/:id ─────────────────────────────────

export async function deleteAdvertiser(req: Request, res: Response) {
  const id = parseInt(req.params['id'] as string, 10);
  if (!id || isNaN(id)) {
    res.status(400).json({ success: false, code: 'BAD_REQUEST', message: 'Invalid id' });
    return;
  }

  try {
    const result = await hardDeleteAdvertiser(id, { userId: getUserId(req), username: getUsername(req) });
    sendResult(res, result);
  } catch (err: any) {
    if (err.message?.includes('Record to delete does not exist')) {
      res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Không tìm thấy bản ghi cần xóa.' });
      return;
    }
    res.status(500).json({ success: false, code: 'INTERNAL_ERROR', message: err.message });
  }
}

// ─── DELETE /api/bff/hard-delete/ad-types/:id ─────────────────────────────────

export async function deleteAdType(req: Request, res: Response) {
  const id = parseInt(req.params['id'] as string, 10);
  if (!id || isNaN(id)) {
    res.status(400).json({ success: false, code: 'BAD_REQUEST', message: 'Invalid id' });
    return;
  }

  try {
    const result = await hardDeleteAdType(id, { userId: getUserId(req), username: getUsername(req) });
    sendResult(res, result);
  } catch (err: any) {
    if (err.message?.includes('Record to delete does not exist')) {
      res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Không tìm thấy bản ghi cần xóa.' });
      return;
    }
    res.status(500).json({ success: false, code: 'INTERNAL_ERROR', message: err.message });
  }
}

// ─── DELETE /api/bff/hard-delete/ad-ids/:id ───────────────────────────────────

export async function deleteAdId(req: Request, res: Response) {
  const id = parseInt(req.params['id'] as string, 10);
  if (!id || isNaN(id)) {
    res.status(400).json({ success: false, code: 'BAD_REQUEST', message: 'Invalid id' });
    return;
  }

  try {
    const result = await hardDeleteAdSite(id, { userId: getUserId(req), username: getUsername(req) }, 'adId');
    sendResult(res, result);
  } catch (err: any) {
    if (err.message?.includes('Record to delete does not exist')) {
      res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Không tìm thấy bản ghi cần xóa.' });
      return;
    }
    res.status(500).json({ success: false, code: 'INTERNAL_ERROR', message: err.message });
  }
}

// ─── DELETE /api/bff/hard-delete/media/:id ─────────────────────────────────────

export async function deleteMedia(req: Request, res: Response) {
  const id = parseInt(req.params['id'] as string, 10);
  if (!id || isNaN(id)) {
    res.status(400).json({ success: false, code: 'BAD_REQUEST', message: 'Invalid id' });
    return;
  }

  try {
    const result = await hardDeleteAdSite(id, { userId: getUserId(req), username: getUsername(req) }, 'media');
    sendResult(res, result);
  } catch (err: any) {
    if (err.message?.includes('Record to delete does not exist')) {
      res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Không tìm thấy bản ghi cần xóa.' });
      return;
    }
    res.status(500).json({ success: false, code: 'INTERNAL_ERROR', message: err.message });
  }
}

// ─── DELETE /api/bff/hard-delete/media-ad-orders/:id ──────────────────────────

export async function deleteMediaAdOrder(req: Request, res: Response) {
  const id = parseInt(req.params['id'] as string, 10);
  if (!id || isNaN(id)) {
    res.status(400).json({ success: false, code: 'BAD_REQUEST', message: 'Invalid id' });
    return;
  }

  try {
    const result = await hardDeleteAdOrder(id, { userId: getUserId(req), username: getUsername(req) });
    sendResult(res, result);
  } catch (err: any) {
    res.status(500).json({ success: false, code: 'INTERNAL_ERROR', message: err.message });
  }
}

// ─── DELETE /api/bff/hard-delete/media-ids/:id ────────────────────────────────

export async function deleteMediaId(req: Request, res: Response) {
  const id = parseInt(req.params['id'] as string, 10);
  if (!id || isNaN(id)) {
    res.status(400).json({ success: false, code: 'BAD_REQUEST', message: 'Invalid id' });
    return;
  }

  try {
    const result = await hardDeleteMediaId(id, { userId: getUserId(req), username: getUsername(req) });
    sendResult(res, result);
  } catch (err: any) {
    res.status(500).json({ success: false, code: 'INTERNAL_ERROR', message: err.message });
  }
}
