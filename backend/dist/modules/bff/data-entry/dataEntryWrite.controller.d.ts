/**
 * Phase 3B/3C: Data Entry Write Controller
 * Handles advertiser and media batch save/confirm/unconfirm.
 * Permission guards are applied at route level via requirePermission middleware.
 */
import type { Request, Response } from 'express';
export declare function postAdvertiserBatch(req: Request, res: Response): Promise<void>;
export declare function postAdvertiserConfirmBatch(req: Request, res: Response): Promise<void>;
export declare function putAdvertiserUnconfirm(req: Request, res: Response): Promise<void>;
export declare function postMediaBatch(req: Request, res: Response): Promise<void>;
export declare function postMediaConfirmBatch(req: Request, res: Response): Promise<void>;
export declare function putMediaUnconfirm(req: Request, res: Response): Promise<void>;
//# sourceMappingURL=dataEntryWrite.controller.d.ts.map