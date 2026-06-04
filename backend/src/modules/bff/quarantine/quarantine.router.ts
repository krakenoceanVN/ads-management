import type { Router } from 'express';
import { asyncHandler } from '../../../shared/errors/asyncHandler';
import {
  postQuarantine,
  postRestore,
  getQuarantineBatches,
  getQuarantineBatchRecords,
} from './quarantine.controller';
import { requireAuth } from '../../../middleware/requireAuth';
import { requirePermission } from '../../../middleware/requirePermission';

export function quarantineRouter(router: Router) {
  router.post('/daily-input/quarantine', requireAuth, requirePermission('quarantine.execute'), asyncHandler(postQuarantine));
  router.post('/daily-input/quarantine/:batchId/restore', requireAuth, requirePermission('quarantine.restore'), asyncHandler(postRestore));
  router.get('/daily-input/quarantine', requireAuth, requirePermission('quarantine.execute'), asyncHandler(getQuarantineBatches));
  router.get('/daily-input/quarantine/:batchId/records', requireAuth, requirePermission('quarantine.execute'), asyncHandler(getQuarantineBatchRecords));
}