import type { Request, Response } from 'express';
import { listAdvertiserEntries, listMediaEntries } from './dataEntry.service';
import { bffData } from '../../../shared/response/success';
import type { ListAdvertiserEntriesParams, ListMediaEntriesParams } from './dataEntry.service';

const DATE_RANGE_MAX_DAYS = 31;

function resolveRange(
  res: Response,
  rawDate: unknown,
  rawStart: unknown,
  rawEnd: unknown
): { startDate?: string; endDate?: string; date?: string } | null {
  const start = rawStart ? String(rawStart) : '';
  const end = rawEnd ? String(rawEnd) : '';
  if (start && end) {
    if (end < start) {
      res.status(400).json({ success: false, error: 'endDate must be >= startDate', code: 'BAD_REQUEST' });
      return null;
    }
    const startMs = Date.parse(start + 'T00:00:00.000Z');
    const endMs = Date.parse(end + 'T00:00:00.000Z');
    if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
      res.status(400).json({ success: false, error: 'invalid startDate or endDate', code: 'BAD_REQUEST' });
      return null;
    }
    const days = Math.round((endMs - startMs) / 86400000) + 1;
    if (days > DATE_RANGE_MAX_DAYS) {
      res.status(400).json({
        success: false,
        error: `date range cannot exceed ${DATE_RANGE_MAX_DAYS} days`,
        code: 'BAD_REQUEST',
      });
      return null;
    }
    return { startDate: start, endDate: end };
  }
  if (start) return { date: start };
  if (rawDate) return { date: String(rawDate) };
  res.status(400).json({ success: false, error: 'date query param is required', code: 'BAD_REQUEST' });
  return null;
}

export async function getAdvertiserEntries(req: Request, res: Response) {
  const { advertiserId, adTypeCode, status } = req.query;
  const range = resolveRange(res, req.query['date'], req.query['startDate'], req.query['endDate']);
  if (!range) return;

  const params: ListAdvertiserEntriesParams = {
    ...range,
    // id là String (6-char) — không parseInt; adType filter dùng field `adTypeId`.
    ...(advertiserId !== undefined && { advertiserId: String(advertiserId) }),
    ...(adTypeCode !== undefined && { adTypeId: String(adTypeCode) }),
    ...(status !== undefined && { status: String(status) }),
  };

  const rows = await listAdvertiserEntries(params);
  res.json(bffData(rows));
}

export async function getMediaEntries(req: Request, res: Response) {
  const { mediaId, adTypeCode, status } = req.query;
  const range = resolveRange(res, req.query['date'], req.query['startDate'], req.query['endDate']);
  if (!range) return;

  const params: ListMediaEntriesParams = {
    ...range,
    // id là String (6-char) — không parseInt; adType filter dùng field `adTypeId`.
    ...(mediaId !== undefined && { mediaId: String(mediaId) }),
    ...(adTypeCode !== undefined && { adTypeId: String(adTypeCode) }),
    ...(status !== undefined && { status: String(status) }),
  };

  const rows = await listMediaEntries(params);
  res.json(bffData(rows));
}
