import type { Router } from 'express';
import { asyncHandler } from '../../../shared/errors/asyncHandler';
import { getAll, getById, create, update, remove } from './adId.controller';

export function adIdRouter(router: Router) {
  router.get('/ad-ids', asyncHandler(getAll));
  router.get('/ad-ids/:id', asyncHandler(getById));
  router.post('/ad-ids', asyncHandler(create));
  router.put('/ad-ids/:id', asyncHandler(update));
  router.delete('/ad-ids/:id', asyncHandler(remove));
}