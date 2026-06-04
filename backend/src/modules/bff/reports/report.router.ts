import type { Router } from 'express';
import { getAdvertisersReport, getMediaReportHandler } from './report.controller';
import { getTotalProfitReport, getOrderProfitReport } from './profitReport.controller';
import { requireAuth } from '../../../middleware/requireAuth';
import { requirePermission } from '../../../middleware/requirePermission';

export function reportRouter(router: Router) {
  router.get('/reports/advertisers', requireAuth, requirePermission('report.read'), getAdvertisersReport);
  router.get('/reports/media', requireAuth, requirePermission('report.read'), getMediaReportHandler);
  router.get('/reports/total-profit', requireAuth, requirePermission('report.read'), getTotalProfitReport);
  router.get('/reports/order-profit', requireAuth, requirePermission('report.read'), getOrderProfitReport);
}