import type { Request, Response } from 'express';
import { bffData } from '../../shared/response/success';

export function healthCheck(_req: Request, res: Response): void {
  res.json(bffData({ status: 'ok', timestamp: new Date().toISOString() }));
}