import type { Router } from 'express';
import { asyncHandler } from '../../../shared/errors/asyncHandler';
import { getAll, getById, create, update, remove } from './mediaAdOrder.controller';

export function mediaAdOrderRouter(router: Router) {
  router.get('/media-ad-orders', asyncHandler(getAll));
  router.get('/media-ad-orders/:id', asyncHandler(getById));
  router.post('/media-ad-orders', asyncHandler(create));
  router.put('/media-ad-orders/:id', asyncHandler(update));
  router.delete('/media-ad-orders/:id', asyncHandler(remove));
}