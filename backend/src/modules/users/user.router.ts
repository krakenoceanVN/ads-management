import type { Router } from 'express';
import { getAll, create, update, doResetPassword } from './user.controller';
import { requireAuth } from '../../middleware/requireAuth';
import { requirePermission } from '../../middleware/requirePermission';

export function userRouter(router: Router) {
  router.get('/users', requireAuth, requirePermission('user.update'), getAll);
  router.post('/users', requireAuth, requirePermission('user.create'), create);
  router.put('/users/:id', requireAuth, requirePermission('user.update'), update);
  router.post('/users/:id/reset-password', requireAuth, requirePermission('user.update'), doResetPassword);
}
