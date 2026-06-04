import type { Router } from 'express';
import { asyncHandler } from '../../../shared/errors/asyncHandler';
import { getAll, getById, create, update, remove } from './media.controller';

export function mediaRouter(router: Router) {
  router.get('/media', asyncHandler(getAll));
  router.get('/media/:id', asyncHandler(getById));
  router.post('/media', asyncHandler(create));
  router.put('/media/:id', asyncHandler(update));
  router.delete('/media/:id', asyncHandler(remove));
}