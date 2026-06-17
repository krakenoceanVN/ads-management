import type { Router } from 'express';
import { asyncHandler } from '../../../shared/errors/asyncHandler';
import { getAll, getById, create, update, remove } from './downstream.controller';
import { requireAuth } from '../../../middleware/requireAuth';

export function downstreamRouter(router: Router) {
  router.get('/downstreams', requireAuth, asyncHandler(getAll));
  router.get('/downstreams/:id', requireAuth, asyncHandler(getById));
  router.post('/downstreams', requireAuth, asyncHandler(create));
  router.put('/downstreams/:id', requireAuth, asyncHandler(update));
  router.delete('/downstreams/:id', requireAuth, asyncHandler(remove));
}
