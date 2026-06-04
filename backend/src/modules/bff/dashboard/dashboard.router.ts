import type { Router } from 'express';
import { requireAuth } from '../../../middleware/requireAuth';
import { requirePermission } from '../../../middleware/requirePermission';
import { getDashboardMonthly } from './dashboard.controller';

export function dashboardRouter(router: Router) {
  // GET /api/bff/dashboard/monthly?year=YYYY&month=M
  router.get('/dashboard/monthly', requireAuth, requirePermission('report.read'), getDashboardMonthly);
}
