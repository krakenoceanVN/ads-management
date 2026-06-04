/**
 * Dashboard Controller
 *
 * GET /api/bff/dashboard/monthly?year=YYYY&month=M
 *
 * Reuses getTotalProfit() internally — no duplicate payout/cost logic.
 * Revenue from DailyInput.revenue, confirmed records only.
 */
import type { Request, Response } from 'express';
export declare function getDashboardMonthly(req: Request, res: Response): Promise<void>;
//# sourceMappingURL=dashboard.controller.d.ts.map