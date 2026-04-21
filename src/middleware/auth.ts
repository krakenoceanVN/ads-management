import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { UserPublic } from '../types/index.js'
import { getRequiredEnv } from '../utils/env.js'

export interface AuthRequest extends Request {
  user?: UserPublic
}

function isViewer(user?: UserPublic): boolean {
  return user?.role === 'VIEWER'
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) {
    res.status(401).json({ success: false, error: 'No token provided' })
    return
  }

  let jwtSecret: string
  try {
    jwtSecret = getRequiredEnv('JWT_SECRET')
  } catch (error) {
    console.error('JWT_SECRET is not configured:', error)
    res.status(500).json({ success: false, error: 'Server configuration error' })
    return
  }

  try {
    const payload = jwt.verify(token, jwtSecret) as UserPublic
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

export function requireWriteAccess(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'Unauthorized' })
    return
  }

  if (isViewer(req.user)) {
    res.status(403).json({ success: false, error: 'Viewer accounts are read-only' })
    return
  }

  next()
}
