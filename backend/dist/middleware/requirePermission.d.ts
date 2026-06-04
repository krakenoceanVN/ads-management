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
export declare function requirePermission(permissionKey: string): (req: AuthenticatedRequest, res: Response, next: NextFunction) => void;
//# sourceMappingURL=requirePermission.d.ts.map