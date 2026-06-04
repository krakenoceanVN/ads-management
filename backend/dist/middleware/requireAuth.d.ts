import type { Request, Response, NextFunction } from 'express';
import type { AuthUser } from '../modules/auth/auth.types';
export interface AuthenticatedRequest extends Request {
    authUser?: AuthUser;
}
export declare function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void;
//# sourceMappingURL=requireAuth.d.ts.map