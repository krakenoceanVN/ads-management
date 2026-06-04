import type { Request, Response, NextFunction } from 'express';
import { AppError } from './AppError';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code,
    });
    return;
  }

  console.error('[errorHandler] Unexpected error:', err);

  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred'
      : err.message,
    code: 'INTERNAL_ERROR',
  });
}