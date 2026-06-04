import type { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { login, me } from './auth.controller';
import { requireAuth } from '../../middleware/requireAuth';
import { config } from '../../config';

const isProduction = config.nodeEnv === 'production';

// In production: login-specific rate limiter (brute-force protection only)
const loginLimiter = isProduction
  ? rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 5,
      standardHeaders: true,
      legacyHeaders: false,
      message: { success: false, error: 'Too many requests, please try again later.' },
    })
  : undefined;

export function authRouter(router: Router) {
  router.post('/login', loginLimiter ?? [], login);
  router.get('/me', requireAuth, me);
}
