import dotenv from 'dotenv';

dotenv.config();

export const config = {
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
} as const;

if (!config.jwt.secret || config.jwt.secret === 'dev-secret-do-not-use-in-production') {
  console.warn('[config] WARNING: Using default JWT secret. Set JWT_SECRET in production.');
}