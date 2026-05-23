"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveUserRole = resolveUserRole;
exports.toUserPublic = toUserPublic;
exports.hasPermission = hasPermission;
exports.requireRole = requireRole;
exports.requireAuth = requireAuth;
exports.requirePermission = requirePermission;
exports.requireWriteAccess = requireWriteAccess;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_js_1 = __importDefault(require("../prisma.js"));
const env_js_1 = require("../utils/env.js");
function isViewer(user) {
    return user?.role === 'VIEWER';
}
function resolveUserRole(user) {
    // If user has a proper role code from RBAC, use it directly
    if (user.roleRef?.code) {
        return user.roleRef.code;
    }
    // Fallback to legacy resolution
    if (user.role === 'VIEWER')
        return 'VIEWER';
    if (user.permAdmin || user.role === 'ADMIN')
        return 'ADMIN';
    return 'EDITOR';
}
function toUserPublic(user, permissions = []) {
    const resolvedRole = resolveUserRole(user);
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
        status: user.status,
        last_login_at: user.lastLoginAt ?? undefined,
        created_at: user.createdAt,
    };
}
function hasPermission(user, permissionKey) {
    if (!user)
        return false;
    if (user.role === 'SUPER_ADMIN')
        return true;
    return user.permissions?.includes(permissionKey) ?? false;
}
function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({ success: false, error: 'Unauthorized' });
            return;
        }
        if (!roles.includes(req.user.role)) {
            res.status(403).json({ success: false, error: 'Insufficient role' });
            return;
        }
        next();
    };
}
async function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
        res.status(401).json({ success: false, error: 'No token provided' });
        return;
    }
    let jwtSecret;
    try {
        jwtSecret = (0, env_js_1.getRequiredEnv)('JWT_SECRET');
    }
    catch (error) {
        console.error('JWT_SECRET is not configured:', error);
        res.status(500).json({ success: false, error: 'Server configuration error' });
        return;
    }
    try {
        const payload = jsonwebtoken_1.default.verify(token, jwtSecret);
        if (!payload?.id) {
            res.status(401).json({ success: false, error: 'Invalid or expired token' });
            return;
        }
        const user = await prisma_js_1.default.user.findUnique({
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
        });
        if (!user || user.status !== 'active') {
            res.status(401).json({ success: false, error: 'Invalid or expired token' });
            return;
        }
        const permissions = user.roleRef?.permissions.map(rp => rp.permission.key) ?? [];
        req.user = toUserPublic(user, permissions);
        next();
    }
    catch {
        res.status(401).json({ success: false, error: 'Invalid or expired token' });
    }
}
function requirePermission(perm) {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({ success: false, error: 'Unauthorized' });
            return;
        }
        // Legacy boolean flags
        if (perm in req.user && typeof req.user[perm] === 'boolean') {
            if (!req.user[perm]) {
                res.status(403).json({ success: false, error: 'Permission denied' });
                return;
            }
        }
        // Permission key check (RBAC)
        else {
            if (!hasPermission(req.user, perm)) {
                res.status(403).json({ success: false, error: 'Permission denied' });
                return;
            }
        }
        next();
    };
}
function requireWriteAccess(req, res, next) {
    if (!req.user) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
    }
    if (isViewer(req.user)) {
        res.status(403).json({ success: false, error: 'Viewer accounts are read-only' });
        return;
    }
    next();
}
