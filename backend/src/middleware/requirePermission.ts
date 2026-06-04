import type { AuthenticatedRequest } from './requireAuth';
import type { Response, NextFunction } from 'express';

/**
 * SUPER_ADMIN bypass: if user.role === 'SUPER_ADMIN', they pass all permission checks.
 *
 * Permission key format: "module.action" (e.g. "dataEntry.create")
 *
 * Legacy compatibility mapping — used when roleId is null OR permission not found in RBAC:
 *   dataEntry.create     -> permDataInput
 *   dataEntry.confirm   -> permDataConfirm
 *   dataEntry.unconfirm -> permAdmin
 *   advertiser.create  -> permAdmin
 *   advertiser.update  -> permAdmin
 *   advertiser.delete  -> permAdmin
 *   media.create       -> permAdmin
 *   media.update      -> permAdmin
 *   media.delete      -> permAdmin
 *   adOrder.create    -> permAdmin
 *   adOrder.update    -> permAdmin
 *   adOrder.delete    -> permAdmin
 *   adId.create       -> permAdmin
 *   adId.update       -> permAdmin
 *   adId.delete       -> permAdmin
 *   mediaId.create    -> permAdmin
 *   mediaId.update    -> permAdmin
 *   mediaId.delete    -> permAdmin
 *   user.create       -> permAdmin
 *   user.update      -> permAdmin
 *   role.update      -> permAdmin
 *   quarantine.execute -> permAdmin
 *   quarantine.restore -> permAdmin
 *   report.read      -> permAdmin
 *   settlement.read   -> permAdmin
 *   oplog.read       -> permAdmin
 *
 * Backward-compatible legacy key aliases:
 *   DATA_INPUT   -> permDataInput
 *   DATA_CONFIRM -> permDataConfirm
 *   ADMIN       -> permAdmin
 */
export function requirePermission(permissionKey: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const authUser = req.authUser;
    if (!authUser) {
      res.status(401).json({ success: false, error: 'Not authenticated', code: 'UNAUTHORIZED' });
      return;
    }

    // SUPER_ADMIN bypass
    if (authUser.role === 'SUPER_ADMIN') {
      next();
      return;
    }

    // Step 1: RBAC check — if roleId is set, first check resolved permissions
    if (authUser.roleId !== null && authUser.permissions.length > 0) {
      if (authUser.permissions.includes(permissionKey)) {
        next();
        return;
      }
    }

    // Step 2: Legacy fallback mapping
    const legacyMap: Record<string, 'permDataInput' | 'permDataConfirm' | 'permAdmin'> = {
      // Data entry permissions
      'dataEntry.create': 'permDataInput',
      'dataEntry.confirm': 'permDataConfirm',
      'dataEntry.unconfirm': 'permAdmin',
      // Entity management permissions
      'advertiser.create': 'permAdmin',
      'advertiser.update': 'permAdmin',
      'advertiser.delete': 'permAdmin',
      'media.create': 'permAdmin',
      'media.update': 'permAdmin',
      'media.delete': 'permAdmin',
      'adOrder.create': 'permAdmin',
      'adOrder.update': 'permAdmin',
      'adOrder.delete': 'permAdmin',
      'adId.create': 'permAdmin',
      'adId.update': 'permAdmin',
      'adId.delete': 'permAdmin',
      'mediaId.create': 'permAdmin',
      'mediaId.update': 'permAdmin',
      'mediaId.delete': 'permAdmin',
      'user.create': 'permAdmin',
      'user.update': 'permAdmin',
      'role.update': 'permAdmin',
      // Quarantine
      'quarantine.execute': 'permAdmin',
      'quarantine.restore': 'permAdmin',
      // Master Data
      'masterData.hardDelete': 'permAdmin',
      // Reports and settlement
      'report.read': 'permAdmin',
      'settlement.read': 'permAdmin',
      'oplog.read': 'permAdmin',
      // Backward-compatible legacy aliases
      'DATA_INPUT': 'permDataInput',
      'DATA_CONFIRM': 'permDataConfirm',
      'ADMIN': 'permAdmin',
    };

    const legacyFlag = legacyMap[permissionKey];
    if (legacyFlag && authUser[legacyFlag] === true) {
      next();
      return;
    }

    res.status(403).json({
      success: false,
      error: 'Insufficient permissions',
      code: 'FORBIDDEN',
    });
  };
}
