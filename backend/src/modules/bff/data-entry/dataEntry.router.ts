import type { Router } from 'express';
import { asyncHandler } from '../../../shared/errors/asyncHandler';
import { getAdvertiserEntries, getMediaEntries } from './dataEntry.controller';
import {
  postAdvertiserBatch,
  postAdvertiserConfirmBatch,
  putAdvertiserUnconfirm,
  postMediaBatch,
  postMediaConfirmBatch,
  putMediaUnconfirm,
} from './dataEntryWrite.controller';
import { requireAuth } from '../../../middleware/requireAuth';
import { requirePermission } from '../../../middleware/requirePermission';

export function dataEntryRouter(router: Router) {
  // Read
  router.get('/data-entry/advertisers', requireAuth, asyncHandler(getAdvertiserEntries));
  router.get('/data-entry/media', requireAuth, asyncHandler(getMediaEntries));

  // Advertiser write
  router.post('/data-entry/advertisers/batch', requireAuth, requirePermission('dataEntry.create'), asyncHandler(postAdvertiserBatch));
  router.post('/data-entry/advertisers/confirm-batch', requireAuth, requirePermission('dataEntry.confirm'), asyncHandler(postAdvertiserConfirmBatch));
  router.put('/data-entry/advertisers/:id/unconfirm', requireAuth, requirePermission('dataEntry.unconfirm'), asyncHandler(putAdvertiserUnconfirm));

  // Media write
  router.post('/data-entry/media/batch', requireAuth, requirePermission('dataEntry.create'), asyncHandler(postMediaBatch));
  router.post('/data-entry/media/confirm-batch', requireAuth, requirePermission('dataEntry.confirm'), asyncHandler(postMediaConfirmBatch));
  router.put('/data-entry/media/:id/unconfirm', requireAuth, requirePermission('dataEntry.unconfirm'), asyncHandler(putMediaUnconfirm));
}