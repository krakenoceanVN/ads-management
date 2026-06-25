import { PrismaClient } from '@prisma/client';
import type { Upstream, UpstreamAdType, AdSite, AdSiteDownstream, Downstream, DownstreamAdType, AdType, AdSiteEvent, DailyDownstreamRate, DailyInput, DailyInputQuarantineBatch, DailyInputQuarantineRecord, LEDailyCost, Role, Permission, RolePermission, User, OperationLog, AdSiteRebateRate, YiyiDailyData, YiyiDailyPricing, DownstreamPeriod, MediaAdOrder } from '@prisma/client';

export type { Upstream, UpstreamAdType, AdSite, AdSiteDownstream, Downstream, DownstreamAdType, AdType, AdSiteEvent, DailyDownstreamRate, DailyInput, DailyInputQuarantineBatch, DailyInputQuarantineRecord, LEDailyCost, Role, Permission, RolePermission, User, OperationLog, AdSiteRebateRate, YiyiDailyData, YiyiDailyPricing, DownstreamPeriod, MediaAdOrder };

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}