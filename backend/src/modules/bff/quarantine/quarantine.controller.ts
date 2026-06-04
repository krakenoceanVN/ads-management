/**
 * Phase 5A: Quarantine Controller
 *
 * Handles quarantine and restore endpoints.
 * Permission guards via requirePermission middleware (route-level).
 */

import type { Request, Response } from 'express';
import { quarantineAdvertiser, quarantineMedia, restoreBatch, listQuarantineBatches, getBatchRecords } from './quarantine.service';
import { bffData } from '../../../shared/response/success';

// ─── POST /daily-input/quarantine ─────────────────────────────────────────

export async function postQuarantine(req: Request, res: Response) {
  const { scope, advertiserId, adSiteId, startDate, endDate, reason } = req.body as {
    scope?: string;
    advertiserId?: number;
    adSiteId?: number;
    startDate?: string;
    endDate?: string;
    reason?: string;
  };

  if (!scope || !startDate || !endDate) {
    res.status(400).json({ success: false, error: 'scope, startDate, and endDate are required', code: 'BAD_REQUEST' });
    return;
  }

  const userId = (req as any).authUser?.id ?? 0;

  try {
    let result;
    if (scope === 'advertiser') {
      if (!advertiserId) {
        res.status(400).json({ success: false, error: 'advertiserId is required for advertiser scope', code: 'BAD_REQUEST' });
        return;
      }
      result = await quarantineAdvertiser({ advertiserId, startDate, endDate, reason, userId });
    } else if (scope === 'media') {
      if (!adSiteId) {
        res.status(400).json({ success: false, error: 'adSiteId is required for media scope', code: 'BAD_REQUEST' });
        return;
      }
      result = await quarantineMedia({ adSiteId, startDate, endDate, reason, userId });
    } else {
      res.status(400).json({ success: false, error: 'scope must be "advertiser" or "media"', code: 'BAD_REQUEST' });
      return;
    }

    res.json(bffData(result));
  } catch (err: any) {
    if (err.message === 'No confirmed records found for quarantine') {
      res.status(409).json({ success: false, error: err.message, code: 'CONFLICT' });
      return;
    }
    res.status(400).json({ success: false, error: err.message, code: 'BAD_REQUEST' });
  }
}

// ─── POST /daily-input/quarantine/:batchId/restore ─────────────────────────

export async function postRestore(req: Request, res: Response) {
  const batchId = parseInt(req.params['batchId'] as string, 10);
  if (!batchId) {
    res.status(400).json({ success: false, error: 'invalid batchId', code: 'BAD_REQUEST' });
    return;
  }

  const userId = (req as any).authUser?.id ?? 0;

  try {
    const result = await restoreBatch(batchId, userId);
    res.json(bffData(result));
  } catch (err: any) {
    if (err.message === 'Batch was already restored') {
      res.status(409).json({ success: false, error: err.message, code: 'CONFLICT' });
      return;
    }
    if (err.message === 'Batch not found') {
      res.status(404).json({ success: false, error: err.message, code: 'NOT_FOUND' });
      return;
    }
    res.status(400).json({ success: false, error: err.message, code: 'BAD_REQUEST' });
  }
}

// ─── GET /daily-input/quarantine ────────────────────────────────────────────

export async function getQuarantineBatches(req: Request, res: Response) {
  const batches = await listQuarantineBatches();
  res.json(bffData(batches));
}

// ─── GET /daily-input/quarantine/:batchId/records ──────────────────────────

export async function getQuarantineBatchRecords(req: Request, res: Response) {
  const batchId = parseInt(req.params['batchId'] as string, 10);
  if (!batchId) {
    res.status(400).json({ success: false, error: 'invalid batchId', code: 'BAD_REQUEST' });
    return;
  }

  const records = await getBatchRecords(batchId);
  res.json(bffData(records));
}