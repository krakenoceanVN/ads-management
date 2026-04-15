import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { UserPublic } from '../types/index.js'

export interface AuthRequest extends Request {
  user?: UserPublic
}

const JWT_SECRET = process.env.JWT_SECRET ?? 'change-me-in-production'

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) {
    res.status(401).json({ success: false, error: 'No token provided' })
    return
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as UserPublic
    req.user = payload
    next()
  } catch {
    res.status(401).json({ success: false, error: 'Invalid or expired token' })
  }
}

export function requirePermission(perm: 'perm_data_input' | 'perm_data_confirm' | 'perm_admin') {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' })
      return
    }
    if (!req.user[perm]) {
      res.status(403).json({ success: false, error: 'Permission denied' })
      return
    }
    next()
  }
}
