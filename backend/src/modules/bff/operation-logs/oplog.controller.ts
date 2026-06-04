/**
 * Phase 5B: Operation Log Controller
 *
 * GET /api/bff/operation-logs — read-only with filtering and pagination.
 */

import type { Request, Response } from 'express';
import { listOperationLogs } from './oplog.service';

export async function getOperationLogs(req: Request, res: Response) {
  const { startDate, endDate, keyword, module, action, page, pageSize } = req.query;

  const params = {
    ...(startDate !== undefined && { startDate: String(startDate) }),
    ...(endDate !== undefined && { endDate: String(endDate) }),
    ...(keyword !== undefined && { keyword: String(keyword) }),
    ...(module !== undefined && { module: String(module) }),
    ...(action !== undefined && { action: String(action) }),
    ...(page !== undefined && { page: parseInt(String(page), 10) }),
    ...(pageSize !== undefined && { pageSize: parseInt(String(pageSize), 10) }),
  };

  const result = await listOperationLogs(params);
  res.json(result);
}