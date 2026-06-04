import type { Router } from 'express';
import { asyncHandler } from '../../../shared/errors/asyncHandler';
import { getAll, getById, create, update, remove } from './adType.controller';
import { requireAuth } from '../../../middleware/requireAuth';

export function adTypeRouter(router: Router) {
  router.get('/ad-types', requireAuth, asyncHandler(getAll));
  router.get('/ad-types/:id', requireAuth, asyncHandler(getById));
  router.post('/ad-types', requireAuth, asyncHandler(create));
  router.put('/ad-types/:id', requireAuth, asyncHandler(update));
  router.delete('/ad-types/:id', requireAuth, asyncHandler(remove));
}