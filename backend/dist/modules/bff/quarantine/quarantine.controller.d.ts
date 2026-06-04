/**
 * Phase 5A: Quarantine Controller
 *
 * Handles quarantine and restore endpoints.
 * Permission guards via requirePermission middleware (route-level).
 */
import type { Request, Response } from 'express';
export declare function postQuarantine(req: Request, res: Response): Promise<void>;
export declare function postRestore(req: Request, res: Response): Promise<void>;
export declare function getQuarantineBatches(req: Request, res: Response): Promise<void>;
export declare function getQuarantineBatchRecords(req: Request, res: Response): Promise<void>;
//# sourceMappingURL=quarantine.controller.d.ts.map