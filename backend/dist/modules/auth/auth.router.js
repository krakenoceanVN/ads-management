"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = authRouter;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const auth_controller_1 = require("./auth.controller");
const requireAuth_1 = require("../../middleware/requireAuth");
const config_1 = require("../../config");
const isProduction = config_1.config.nodeEnv === 'production';
// In production: login-specific rate limiter (brute-force protection only)
const loginLimiter = isProduction
    ? (0, express_rate_limit_1.default)({
        windowMs: 15 * 60 * 1000,
        max: 5,
        standardHeaders: true,
        legacyHeaders: false,
        message: { success: false, error: 'Too many requests, please try again later.' },
    })
    : undefined;
function authRouter(router) {
    router.post('/login', loginLimiter ?? [], auth_controller_1.login);
    router.get('/me', requireAuth_1.requireAuth, auth_controller_1.me);
}
//# sourceMappingURL=auth.router.js.map