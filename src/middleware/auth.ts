import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import prisma from '../prisma.js'
import { UserPublic, UserRole, UserStatus } from '../types/index.js'
import { getRequiredEnv } from '../utils/env.js'

export interface AuthRequest extends Request {
  user?: UserPublic
}

function isViewer(user?: UserPublic): boolean {
  return user?.role === 'VIEWER'
}

type JwtPayloadShape = {
  id?: number
}

type UserWithRoleShape = {
  role: string
  permAdmin: boolean
}

type UserApiShape = {
  id: number
  username: string
  role: string
  permDataInput: boolean
  permDataConfirm: boolean
  permAdmin: boolean
  status: string
  lastLoginAt?: Date | null
  createdAt: Date
}

function resolveUserRole(user: UserWithRoleShape): UserRole {
  if (user.role === 'VIEWER') return 'VIEWER'
  if (user.permAdmin || user.role === 'ADMIN') return 'ADMIN'
  return 'EDITOR'
}

function toUserPublic(user: UserApiShape): UserPublic {
  const resolvedRole = resolveUserRole(user)

  return {
    id: user.id,
    username: user.username,
    role: resolvedRole,
    perm_data_input: resolvedRole === 'VIEWER' ? false : resolvedRole === 'ADMIN' ? true : Boolean(user.permDataInput),
    perm_data_confirm: resolvedRole === 'VIEWER' ? false : resolvedRole === 'ADMIN' ? true : Boolean(user.permDataConfirm),
    perm_admin: resolvedRole === 'ADMIN',
    status: user.status as UserStatus,
    last_login_at: user.lastLoginAt ?? undefined,
    created_at: user.createdAt,
  }
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
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
    const payload = jwt.verify(token, jwtSecret) as JwtPayloadShape
    if (!payload?.id) {
      res.status(401).json({ success: false, error: 'Invalid or expired token' })
      return
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: {
        id: true,
        username: true,
        role: true,
        permDataInput: true,
        permDataConfirm: true,
        permAdmin: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
      },
    })

    if (!user || user.status !== 'active') {
      res.status(401).json({ success: false, error: 'Invalid or expired token' })
      return
    }

    req.user = toUserPublic(user)
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
