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

export type UserWithRoleShape = {
  role: string
  permAdmin: boolean
  roleRef?: { id: number; code: string; name: string } | null
}

export type UserApiShape = {
  id: number
  username: string
  role: string
  permDataInput: boolean
  permDataConfirm: boolean
  permAdmin: boolean
  status: string
  lastLoginAt?: Date | null
  createdAt: Date
  roleRef?: { id: number; code: string; name: string } | null
}

export function resolveUserRole(user: UserWithRoleShape): UserRole {
  // If user has a proper role code from RBAC, use it directly
  if (user.roleRef?.code) {
    return user.roleRef.code as UserRole
  }
  // Fallback to legacy resolution
  if (user.role === 'VIEWER') return 'VIEWER'
  if (user.permAdmin || user.role === 'ADMIN') return 'ADMIN'
  return 'EDITOR'
}

export function toUserPublic(user: UserApiShape, permissions: string[] = []): UserPublic {
  const resolvedRole = resolveUserRole(user)

  return {
    id: user.id,
    username: user.username,
    role: resolvedRole,
    roleId: user.roleRef?.id,
    roleCode: user.roleRef?.code,
    roleName: user.roleRef?.name,
    permissions,
    perm_data_input: resolvedRole === 'VIEWER' ? false : resolvedRole === 'ADMIN' ? true : Boolean(user.permDataInput),
    perm_data_confirm: resolvedRole === 'VIEWER' ? false : resolvedRole === 'ADMIN' ? true : Boolean(user.permDataConfirm),
    perm_admin: resolvedRole === 'ADMIN',
    status: user.status as UserStatus,
    last_login_at: user.lastLoginAt ?? undefined,
    created_at: user.createdAt,
  }
}

export function hasPermission(user: UserPublic | undefined, permissionKey: string): boolean {
  if (!user) return false
  if (user.role === 'SUPER_ADMIN') return true
  return user.permissions?.includes(permissionKey) ?? false
}

export function requireRole(...roles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' })
      return
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ success: false, error: 'Insufficient role' })
      return
    }
    next()
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
        roleRef: {
          include: {
            permissions: {
              include: { permission: true },
            },
          },
        },
      },
    })

    if (!user || user.status !== 'active') {
      res.status(401).json({ success: false, error: 'Invalid or expired token' })
      return
    }

    const permissions = user.roleRef?.permissions.map(rp => rp.permission.key) ?? []
    req.user = toUserPublic(user, permissions)
    next()
  } catch {
    res.status(401).json({ success: false, error: 'Invalid or expired token' })
  }
}

export function requirePermission(perm: 'perm_data_input' | 'perm_data_confirm' | 'perm_admin' | string) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' })
      return
    }
    // Legacy boolean flags
    if (perm in req.user && typeof req.user[perm as keyof UserPublic] === 'boolean') {
      if (!req.user[perm as keyof UserPublic]) {
        res.status(403).json({ success: false, error: 'Permission denied' })
        return
      }
    }
    // Permission key check (RBAC)
    else {
      if (!hasPermission(req.user, perm)) {
        res.status(403).json({ success: false, error: 'Permission denied' })
        return
      }
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
