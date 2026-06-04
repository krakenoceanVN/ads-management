/**
 * Phase 3C: Hard Delete Controller
 *
 * Handles hard delete HTTP endpoints.
 * Permission guard via requirePermission middleware (route-level).
 */
import type { Request, Response } from 'express';
export declare function deleteAdvertiser(req: Request, res: Response): Promise<void>;
export declare function deleteAdType(req: Request, res: Response): Promise<void>;
export declare function deleteAdId(req: Request, res: Response): Promise<void>;
export declare function deleteMedia(req: Request, res: Response): Promise<void>;
export declare function deleteMediaAdOrder(req: Request, res: Response): Promise<void>;
export declare function deleteMediaId(req: Request, res: Response): Promise<void>;
//# sourceMappingURL=hardDelete.controller.d.ts.map