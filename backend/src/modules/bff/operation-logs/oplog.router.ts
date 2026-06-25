import type { Router } from 'express';
import { getOperationLogs } from './oplog.controller';
import { requireAuth } from '../../../middleware/requireAuth';
import { requirePermission } from '../../../middleware/requirePermission';

export function oplogRouter(router: Router) {
  router.get('/oplog', requireAuth, requirePermission('oplog.read'), getOperationLogs);
}