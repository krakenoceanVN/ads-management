/**
 * Profit Report Controller
 *
 * GET /api/bff/reports/total-profit
 * GET /api/bff/reports/order-profit
 */

import type { Request, Response } from 'express';
import { getTotalProfit, getOrderProfit, type TotalProfitParams, type OrderProfitParams } from './profitReport.service';
import { bffData } from '../../../shared/response/success';

export async function getTotalProfitReport(req: Request, res: Response) {
  const { date, startDate, endDate, advertiserId, upstreamId, adTypeCode } = req.query;

  const params: TotalProfitParams = {
    ...(date !== undefined && { date: String(date) }),
    ...(startDate !== undefined && { startDate: String(startDate) }),
    ...(endDate !== undefined && { endDate: String(endDate) }),
    ...(advertiserId !== undefined && { advertiserId: String(advertiserId) }),
    ...(upstreamId !== undefined && { upstreamId: String(upstreamId) }),
    ...(adTypeCode !== undefined && { adTypeCode: String(adTypeCode) }),
  };

  try {
    const rows = await getTotalProfit(params);
    res.json(bffData(rows));
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message, code: 'INTERNAL' });
  }
}

export async function getOrderProfitReport(req: Request, res: Response) {
  const { date, startDate, endDate, advertiserId, upstreamId, adTypeCode, billingMethod } = req.query;

  const params: OrderProfitParams = {
    ...(date !== undefined && { date: String(date) }),
    ...(startDate !== undefined && { startDate: String(startDate) }),
    ...(endDate !== undefined && { endDate: String(endDate) }),
    ...(advertiserId !== undefined && { advertiserId: String(advertiserId) }),
    ...(upstreamId !== undefined && { upstreamId: String(upstreamId) }),
    ...(adTypeCode !== undefined && { adTypeCode: String(adTypeCode) }),
    ...(billingMethod !== undefined && { billingMethod: String(billingMethod) as OrderProfitParams['billingMethod'] }),
  };

  try {
    const rows = await getOrderProfit(params);
    res.json(bffData(rows));
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message, code: 'INTERNAL' });
  }
}