"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.config = {
    port: parseInt(process.env.PORT ?? '3001', 10),
    nodeEnv: process.env.NODE_ENV ?? 'development',
    database: {
        url: process.env.DATABASE_URL ?? '',
        directUrl: process.env.DIRECT_URL ?? '',
    },
    jwt: {
        secret: process.env.JWT_SECRET ?? 'dev-secret-do-not-use-in-production',
        expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
    },
    rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '900000', 10),
        maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS ?? '100', 10),
    },
};
if (!exports.config.jwt.secret || exports.config.jwt.secret === 'dev-secret-do-not-use-in-production') {
    console.warn('[config] WARNING: Using default JWT secret. Set JWT_SECRET in production.');
}
//# sourceMappingURL=index.js.map