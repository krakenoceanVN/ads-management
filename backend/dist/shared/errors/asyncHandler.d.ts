import type { Request, Response, NextFunction, RequestHandler } from 'express';
/**
 * Wraps an async route handler so unhandled promise rejections are forwarded
 * to the Express error handler instead of crashing the Node process.
 */
export declare function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler;
//# sourceMappingURL=asyncHandler.d.ts.map