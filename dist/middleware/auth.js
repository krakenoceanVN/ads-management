"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
exports.requirePermission = requirePermission;
exports.requireWriteAccess = requireWriteAccess;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_js_1 = require("../utils/env.js");
function isViewer(user) {
    return user?.role === 'VIEWER';
}
function requireAuth(req, res, next) {
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
        req.user = payload;
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
        if (!req.user[perm]) {
            res.status(403).json({ success: false, error: 'Permission denied' });
            return;
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
