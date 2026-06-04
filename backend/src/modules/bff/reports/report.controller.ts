/**
 * Phase 4A: Reports Controller
 * Read-only report endpoints.
 */

import type { Request, Response } from 'express';
import { getAdvertiserReport, getMediaReport } from './report.service';
import { bffData } from '../../../shared/response/success';

export async function getAdvertisersReport(req: Request, res: Response) {
  const { date, startDate, endDate, advertiserId, adTypeCode, status } = req.query;

  const params = {
    ...(date !== undefined && { date: String(date) }),
    ...(startDate !== undefined && { startDate: String(startDate) }),
    ...(endDate !== undefined && { endDate: String(endDate) }),
    ...(advertiserId !== undefined && { advertiserId: parseInt(String(advertiserId), 10) }),
    ...(adTypeCode !== undefined && { adTypeCode: String(adTypeCode) }),
    ...(status !== undefined && { status: String(status) as any }),
  };

  const rows = await getAdvertiserReport(params);
  res.json(bffData(rows));
}

export async function getMediaReportHandler(req: Request, res: Response) {
  const { date, startDate, endDate, mediaId, adTypeCode, status } = req.query;

  const params = {
    ...(date !== undefined && { date: String(date) }),
    ...(startDate !== undefined && { startDate: String(startDate) }),
    ...(endDate !== undefined && { endDate: String(endDate) }),
    ...(mediaId !== undefined && { mediaId: parseInt(String(mediaId), 10) }),
    ...(adTypeCode !== undefined && { adTypeCode: String(adTypeCode) }),
    ...(status !== undefined && { status: String(status) as any }),
  };

  const rows = await getMediaReport(params);
  res.json(bffData(rows));
}