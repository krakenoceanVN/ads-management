import type { Router } from 'express';
import { getAllRoles, getAllPermissions, updatePermissionsHandler } from './role.controller';
import { requireAuth } from '../../middleware/requireAuth';
import { requirePermission } from '../../middleware/requirePermission';

export function roleRouter(router: Router) {
  router.get('/roles', requireAuth, requirePermission('role.update'), getAllRoles);
  router.get('/permissions', requireAuth, requirePermission('role.update'), getAllPermissions);
  router.put('/roles/:id/permissions', requireAuth, requirePermission('role.update'), updatePermissionsHandler);
}
