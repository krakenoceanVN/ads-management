import type { Router } from 'express';
import { asyncHandler } from '../../../shared/errors/asyncHandler';
import { getAll, getById, create, update, remove } from './adOrder.controller';

export function adOrderRouter(router: Router) {
  router.get('/ad-orders', asyncHandler(getAll));
  router.get('/ad-orders/:id', asyncHandler(getById));
  router.post('/ad-orders', asyncHandler(create));
  router.put('/ad-orders/:id', asyncHandler(update));
  router.delete('/ad-orders/:id', asyncHandler(remove));
}