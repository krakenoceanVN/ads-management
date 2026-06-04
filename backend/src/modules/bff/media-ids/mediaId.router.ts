import type { Router } from 'express';
import { asyncHandler } from '../../../shared/errors/asyncHandler';
import { getAll, getById, create, update, remove } from './mediaId.controller';

export function mediaIdRouter(router: Router) {
  router.get('/media-ids', asyncHandler(getAll));
  router.get('/media-ids/:id', asyncHandler(getById));
  router.post('/media-ids', asyncHandler(create));
  router.put('/media-ids/:id', asyncHandler(update));
  router.delete('/media-ids/:id', asyncHandler(remove));
}