import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { getUserById } from '../modules/auth/auth.service';
import type { AuthUser } from '../modules/auth/auth.types';

export interface AuthenticatedRequest extends Request {
  authUser?: AuthUser;
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Missing or invalid authorization header', code: 'UNAUTHORIZED' });
    return;
  }

  const token = authHeader.slice(7);
  let payload: jwt.JwtPayload;
  try {
    payload = jwt.verify(token, config.jwt.secret) as jwt.JwtPayload;
  } catch {
    res.status(401).json({ success: false, error: 'Invalid or expired token', code: 'UNAUTHORIZED' });
    return;
  }

  if (!payload.sub || typeof payload.sub !== 'number') {
    res.status(401).json({ success: false, error: 'Invalid token payload', code: 'UNAUTHORIZED' });
    return;
  }

  // Load full user from DB to get current permissions and legacy flags
  getUserById(payload.sub).then(user => {
    if (!user) {
      res.status(401).json({ success: false, error: 'User not found or inactive', code: 'UNAUTHORIZED' });
      return;
    }
    req.authUser = user;
    next();
  }).catch((_err: unknown): void => {
    res.status(500).json({ success: false, error: 'Auth error', code: 'INTERNAL' });
  });
}
