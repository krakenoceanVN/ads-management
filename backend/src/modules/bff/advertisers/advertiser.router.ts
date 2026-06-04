import type { Router } from 'express';
import { asyncHandler } from '../../../shared/errors/asyncHandler';
import { getAll, getById, create, update, remove } from './advertiser.controller';

export function advertiserRouter(router: Router) {
  router.get('/advertisers', asyncHandler(getAll));
  router.get('/advertisers/:id', asyncHandler(getById));
  router.post('/advertisers', asyncHandler(create));
  router.put('/advertisers/:id', asyncHandler(update));
  router.delete('/advertisers/:id', asyncHandler(remove));
}