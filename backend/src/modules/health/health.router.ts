import type { Router } from 'express';
import { healthCheck } from './health.controller';

export function healthRouter(router: Router): void {
  router.get('/health', healthCheck);
}