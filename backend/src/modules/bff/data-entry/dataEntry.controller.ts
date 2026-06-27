import type { Request, Response } from 'express';
import { listAdvertiserEntries, listMediaEntries } from './dataEntry.service';
import { bffData } from '../../../shared/response/success';
import type { ListAdvertiserEntriesParams, ListMediaEntriesParams } from './dataEntry.service';

export async function getAdvertiserEntries(req: Request, res: Response) {
  const { date, advertiserId, adTypeCode, status } = req.query;

  if (!date) {
    res.status(400).json({ success: false, error: 'date query param is required', code: 'BAD_REQUEST' });
    return;
  }

  const params: ListAdvertiserEntriesParams = {
    date: String(date),
    // id là String (6-char) — không parseInt; adType filter dùng field `adTypeId`.
    ...(advertiserId !== undefined && { advertiserId: String(advertiserId) }),
    ...(adTypeCode !== undefined && { adTypeId: String(adTypeCode) }),
    ...(status !== undefined && { status: String(status) }),
  };

  const rows = await listAdvertiserEntries(params);
  res.json(bffData(rows));
}

export async function getMediaEntries(req: Request, res: Response) {
  const { date, mediaId, adTypeCode, status } = req.query;

  if (!date) {
    res.status(400).json({ success: false, error: 'date query param is required', code: 'BAD_REQUEST' });
    return;
  }

  const params: ListMediaEntriesParams = {
    date: String(date),
    // id là String (6-char) — không parseInt; adType filter dùng field `adTypeId`.
    ...(mediaId !== undefined && { mediaId: String(mediaId) }),
    ...(adTypeCode !== undefined && { adTypeId: String(adTypeCode) }),
    ...(status !== undefined && { status: String(status) }),
  };

  const rows = await listMediaEntries(params);
  res.json(bffData(rows));
}
