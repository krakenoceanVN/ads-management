import type { Router } from 'express';
import { getAdvertiserSettlementHandler, getMediaSettlementHandler } from './settlement.controller';
import { requireAuth } from '../../../middleware/requireAuth';
import { requirePermission } from '../../../middleware/requirePermission';

export function settlementRouter(router: Router) {
  router.get('/settlement/advertisers', requireAuth, requirePermission('settlement.read'), getAdvertiserSettlementHandler);
  router.get('/settlement/media', requireAuth, requirePermission('settlement.read'), getMediaSettlementHandler);
}