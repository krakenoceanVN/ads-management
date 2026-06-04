import type { Router } from 'express';
import { getYiyiDailyHandler, getYiyiMonthlyHandler, postYiyiBatch } from './yiyi.controller';
import { requireAuth } from '../../middleware/requireAuth';

export function yiyiRouter(router: Router) {
  // GET /api/yiyi-data?date=YYYY-MM-DD
  router.get('/yiyi-data', requireAuth, getYiyiDailyHandler);
  // GET /api/yiyi-data/monthly?year=YYYY&month=M
  router.get('/yiyi-data/monthly', requireAuth, getYiyiMonthlyHandler);
  // POST /api/yiyi-data/batch
  router.post('/yiyi-data/batch', requireAuth, postYiyiBatch);
}