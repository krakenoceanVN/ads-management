/**
 * Phase 6A: Yiyi Controller
 *
 * Endpoints at /api/yiyi-data (NOT /api/bff)
 * - GET /yiyi-data?date=YYYY-MM-DD
 * - GET /yiyi-data/monthly?year=YYYY&month=M
 * - POST /yiyi-data/batch
 */
import type { Request, Response } from 'express';
export declare function getYiyiDailyHandler(req: Request, res: Response): Promise<void>;
export declare function getYiyiMonthlyHandler(req: Request, res: Response): Promise<void>;
export declare function postYiyiBatch(req: Request, res: Response): Promise<void>;
//# sourceMappingURL=yiyi.controller.d.ts.map