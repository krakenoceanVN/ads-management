/**
 * Phase 3C: Hard Delete Router
 *
 * Registers hard delete endpoints under /api/bff/hard-delete/.
 * Permission: masterData.hardDelete (falls back to permAdmin for existing roles).
 */

import type { Router } from 'express';
import { asyncHandler } from '../../../shared/errors/asyncHandler';
import {
  deleteAdvertiser,
  deleteAdType,
  deleteAdId,
  deleteMedia,
  deleteMediaAdOrder,
  deleteMediaId,
} from './hardDelete.controller';
import { requireAuth } from '../../../middleware/requireAuth';
import { requirePermission } from '../../../middleware/requirePermission';

export function hardDeleteRouter(router: Router) {
  router.delete(
    '/hard-delete/advertisers/:id',
    requireAuth,
    requirePermission('masterData.hardDelete'),
    asyncHandler(deleteAdvertiser)
  );
  router.delete(
    '/hard-delete/ad-types/:id',
    requireAuth,
    requirePermission('masterData.hardDelete'),
    asyncHandler(deleteAdType)
  );
  router.delete(
    '/hard-delete/ad-ids/:id',
    requireAuth,
    requirePermission('masterData.hardDelete'),
    asyncHandler(deleteAdId)
  );
  router.delete(
    '/hard-delete/media/:id',
    requireAuth,
    requirePermission('masterData.hardDelete'),
    asyncHandler(deleteMedia)
  );
  router.delete(
    '/hard-delete/media-ad-orders/:id',
    requireAuth,
    requirePermission('masterData.hardDelete'),
    asyncHandler(deleteMediaAdOrder)
  );
  router.delete(
    '/hard-delete/media-ids/:id',
    requireAuth,
    requirePermission('masterData.hardDelete'),
    asyncHandler(deleteMediaId)
  );
}
