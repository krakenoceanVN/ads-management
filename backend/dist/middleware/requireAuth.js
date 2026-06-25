"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../config");
const auth_service_1 = require("../modules/auth/auth.service");
function requireAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
        res.status(401).json({ success: false, error: 'Missing or invalid authorization header', code: 'UNAUTHORIZED' });
        return;
    }
    const token = authHeader.slice(7);
    let payload;
    try {
        payload = jsonwebtoken_1.default.verify(token, config_1.config.jwt.secret);
    }
    catch {
        res.status(401).json({ success: false, error: 'Invalid or expired token', code: 'UNAUTHORIZED' });
        return;
    }
    if (!payload.sub || typeof payload.sub !== 'string') {
        res.status(401).json({ success: false, error: 'Invalid token payload', code: 'UNAUTHORIZED' });
        return;
    }
    // Load full user from DB to get current permissions and legacy flags
    (0, auth_service_1.getUserById)(payload.sub).then(user => {
        if (!user) {
            res.status(401).json({ success: false, error: 'User not found or inactive', code: 'UNAUTHORIZED' });
            return;
        }
        req.authUser = user;
        next();
    }).catch((_err) => {
        res.status(500).json({ success: false, error: 'Auth error', code: 'INTERNAL' });
    });
}
//# sourceMappingURL=requireAuth.js.map