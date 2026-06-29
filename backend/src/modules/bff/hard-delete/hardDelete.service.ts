import type { Prisma } from '@prisma/client';
import { prisma } from '../../../shared/prisma/client';
import type { EntityType, DependencyCounts, HardDeleteResult } from './hardDelete.types';

export interface HardDeleteContext {
  userId: string | number;
  username?: string | null;
}

type FinancialCounts = Pick<
  DependencyCounts,
  'dailyInputCount' | 'confirmedCount' | 'unconfirmedCount' | 'quarantinedCount'
>;

const NOT_FOUND_MESSAGE = 'Không tìm thấy bản ghi cần xóa.';
const FINANCIAL_BLOCK_MESSAGE = 'Không thể xóa cứng vì bản ghi đã có dữ liệu tài chính liên quan.';
const DEPENDENCY_BLOCK_MESSAGE = 'Không thể xóa cứng vì bản ghi đang có dữ liệu liên kết.';

function emptyFinancialCounts(): FinancialCounts {
  return {
    dailyInputCount: 0,
    confirmedCount: 0,
    unconfirmedCount: 0,
    quarantinedCount: 0,
  };
}

async function countFinancialData(where: Prisma.DailyInputWhereInput): Promise<FinancialCounts> {
  const rows = await prisma.dailyInput.groupBy({
    by: ['status'],
    where,
    _count: { _all: true },
  });

  const counts = emptyFinancialCounts();
  for (const row of rows) {
    const count = row._count._all;
    counts.dailyInputCount += count;
    if (row.status === 'confirmed') counts.confirmedCount = count;
    if (row.status === 'unconfirmed') counts.unconfirmedCount = count;
    if (row.status === 'quarantined') counts.quarantinedCount = count;
  }
  return counts;
}

function dependencyData(dependencies: Record<string, number>) {
  return Object.fromEntries(Object.entries(dependencies).filter(([, count]) => count > 0));
}

async function writeOperationLog(
  client: Prisma.TransactionClient | typeof prisma,
  ctx: HardDeleteContext,
  action: 'HARD_DELETE' | 'HARD_DELETE_BLOCKED',
  targetType: EntityType,
  targetId: string | number,
  detail: unknown
) {
  await client.operationLog.create({
    data: {
      id: `opl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      userId: ctx.userId != null ? String(ctx.userId) : null,
      username: ctx.username ?? null,
      action,
      module: 'masterData',
      targetType,
      targetId: String(targetId),
      detail: JSON.stringify(detail),
    },
  });
}

async function notFound(entityType: EntityType, entityId: string | number, ctx: HardDeleteContext): Promise<HardDeleteResult> {
  await writeOperationLog(prisma, ctx, 'HARD_DELETE_BLOCKED', entityType, entityId, {
    reason: 'NOT_FOUND',
    entityType,
    entityId,
  });

  return {
    success: false,
    code: 'NOT_FOUND',
    message: NOT_FOUND_MESSAGE,
  };
}

async function financialBlock(
  entityType: EntityType,
  entityId: string | number,
  ctx: HardDeleteContext,
  financial: FinancialCounts,
  options?: {
    message?: string;
    quarantineTarget?: { scope: 'advertiser' | 'media'; advertiserId?: string; adSiteId?: string };
    detail?: Record<string, unknown>;
  }
): Promise<HardDeleteResult> {
  const result = {
    success: false as const,
    code: 'ENTITY_HAS_FINANCIAL_DATA' as const,
    message: options?.message ?? FINANCIAL_BLOCK_MESSAGE,
    data: {
      entityType,
      entityId,
      dailyInputCount: financial.dailyInputCount,
      confirmedCount: financial.confirmedCount,
      unconfirmedCount: financial.unconfirmedCount,
      quarantinedCount: financial.quarantinedCount,
      suggestedAction: 'quarantine' as const,
      ...(options?.quarantineTarget ? { quarantineTarget: options.quarantineTarget } : {}),
    },
  };

  await writeOperationLog(prisma, ctx, 'HARD_DELETE_BLOCKED', entityType, entityId, {
    reason: 'ENTITY_HAS_FINANCIAL_DATA',
    responseData: result.data,
    ...(options?.detail ?? {}),
  });

  return result;
}

async function dependencyBlock(
  entityType: EntityType,
  entityId: string | number,
  ctx: HardDeleteContext,
  dependencies: Record<string, number>,
  detail?: Record<string, unknown>
): Promise<HardDeleteResult> {
  const nonZeroDependencies = dependencyData(dependencies);
  const result = {
    success: false as const,
    code: 'ENTITY_HAS_DEPENDENCIES' as const,
    message: DEPENDENCY_BLOCK_MESSAGE,
    data: {
      entityType,
      entityId,
      dependencies: nonZeroDependencies,
      suggestedAction: 'delete_children_first_or_archive' as const,
    },
  };

  await writeOperationLog(prisma, ctx, 'HARD_DELETE_BLOCKED', entityType, entityId, {
    reason: 'ENTITY_HAS_DEPENDENCIES',
    responseData: result.data,
    ...(detail ?? {}),
  });

  return result;
}

function successResult(entityType: EntityType, entityId: string | number): HardDeleteResult {
  return {
    success: true,
    data: {
      deleted: true,
      entityType,
      entityId,
    },
    message: 'Đã xóa cứng thành công.',
  };
}

export async function countAdvertiserDependencies(advertiserId: string): Promise<DependencyCounts> {
  const [adSiteCount, adSiteDownstreamCount, rebateRateCount, adSiteEventCount, financial] =
    await Promise.all([
      prisma.adSite.count({ where: { upstreamId: advertiserId } }),
      prisma.adSiteDownstream.count({ where: { adSite: { upstreamId: advertiserId } } }),
      prisma.adSiteRebateRate.count({ where: { adSite: { upstreamId: advertiserId } } }),
      prisma.adSiteEvent.count({ where: { adSite: { upstreamId: advertiserId } } }),
      countFinancialData({ adSite: { upstreamId: advertiserId } }),
    ]);

  return {
    adSiteCount,
    upstreamCount: 0,
    downstreamCount: 0,
    adSiteDownstreamCount,
    rebateRateCount,
    adSiteEventCount,
    mediaAdOrderCount: 0,
    ...financial,
  };
}

function adTypeAdSiteWhere(adTypeId: string): Prisma.AdSiteWhereInput {
  return {
    adTypeId,
  };
}

export async function countAdTypeDependencies(adTypeId: string): Promise<DependencyCounts> {
  const adSiteWhere = adTypeAdSiteWhere(adTypeId);
  const [upstreamCount, adSiteCount, downstreamCount, adSiteDownstreamCount, rebateRateCount, adSiteEventCount, mediaAdOrderCount, financial] =
    await Promise.all([
      prisma.upstream.count({ where: { adTypeId } }),
      prisma.adSite.count({ where: adSiteWhere }),
      prisma.downstreamAdType.count({ where: { adTypeId } }),
      prisma.adSiteDownstream.count({ where: { adSite: adSiteWhere } }),
      prisma.adSiteRebateRate.count({ where: { adSite: adSiteWhere } }),
      prisma.adSiteEvent.count({ where: { adSite: adSiteWhere } }),
      prisma.mediaAdOrder.count({ where: { adTypeId } }),
      countFinancialData({ adSite: adSiteWhere }),
    ]);

  return {
    adSiteCount,
    upstreamCount,
    downstreamCount,
    adSiteDownstreamCount,
    rebateRateCount,
    adSiteEventCount,
    mediaAdOrderCount,
    ...financial,
  };
}

export async function countAdSiteDependencies(adSiteId: string): Promise<DependencyCounts> {
  const [adSiteDownstreamCount, rebateRateCount, adSiteEventCount, financial] = await Promise.all([
    prisma.adSiteDownstream.count({ where: { adSiteId } }),
    prisma.adSiteRebateRate.count({ where: { adSiteId } }),
    prisma.adSiteEvent.count({ where: { adSiteId } }),
    countFinancialData({ adSiteId }),
  ]);

  return {
    adSiteCount: 0,
    upstreamCount: 0,
    downstreamCount: 0,
    adSiteDownstreamCount,
    rebateRateCount,
    adSiteEventCount,
    mediaAdOrderCount: 0,
    ...financial,
  };
}

export async function hardDeleteAdvertiser(id: string, ctx: HardDeleteContext): Promise<HardDeleteResult> {
  const target = await prisma.upstream.findUnique({ where: { id }, include: { defaultAdType: true } });
  if (!target) return notFound('advertiser', id, ctx);

  const deps = await countAdvertiserDependencies(id);
  if (deps.dailyInputCount > 0) {
    return financialBlock('advertiser', id, ctx, deps, {
      quarantineTarget: { scope: 'advertiser', advertiserId: id },
      detail: { snapshot: target, dependencyCheck: deps },
    });
  }

  const dependencies = {
    adSiteCount: deps.adSiteCount,
    adSiteDownstreamCount: deps.adSiteDownstreamCount,
    rebateRateCount: deps.rebateRateCount,
    adSiteEventCount: deps.adSiteEventCount,
  };
  if (Object.keys(dependencyData(dependencies)).length > 0) {
    return dependencyBlock('advertiser', id, ctx, dependencies, { snapshot: target, dependencyCheck: deps });
  }

  await prisma.$transaction(async (tx) => {
    await tx.upstream.delete({ where: { id } });
    await writeOperationLog(tx, ctx, 'HARD_DELETE', 'advertiser', id, {
      snapshot: target,
      dependencyCheck: deps,
      deleted: true,
    });
  });

  return successResult('advertiser', id);
}

export async function hardDeleteAdType(id: string, ctx: HardDeleteContext): Promise<HardDeleteResult> {
  const target = await prisma.adType.findUnique({ where: { id } });
  if (!target) return notFound('adType', id, ctx);

  const deps = await countAdTypeDependencies(id);
  if (deps.dailyInputCount > 0) {
    return financialBlock('adType', id, ctx, deps, {
      message:
        `${FINANCIAL_BLOCK_MESSAGE} Hiện Cô lập dữ liệu chưa hỗ trợ trực tiếp theo Đơn quảng cáo; ` +
        'cần cô lập theo từng Nhà quảng cáo/Media liên quan.',
      detail: { snapshot: target, dependencyCheck: deps },
    });
  }

  const dependencies = {
    upstreamCount: deps.upstreamCount,
    adSiteCount: deps.adSiteCount,
    downstreamCount: deps.downstreamCount,
    adSiteDownstreamCount: deps.adSiteDownstreamCount,
    rebateRateCount: deps.rebateRateCount,
    adSiteEventCount: deps.adSiteEventCount,
    mediaAdOrderCount: deps.mediaAdOrderCount,
  };
  if (Object.keys(dependencyData(dependencies)).length > 0) {
    return dependencyBlock('adType', id, ctx, dependencies, { snapshot: target, dependencyCheck: deps });
  }

  await prisma.$transaction(async (tx) => {
    // Detach all references before deleting: nullable FKs → null, NOT-NULL junctions → delete rows.
    await tx.adSite.updateMany({ where: { adTypeId: id }, data: { adTypeId: null } });
    await tx.upstream.updateMany({ where: { adTypeId: id }, data: { adTypeId: null } });
    await tx.mediaAdOrder.updateMany({ where: { adTypeId: id }, data: { adTypeId: null } });
    await tx.adSiteDownstream.updateMany({ where: { mediaAdTypeId: id }, data: { mediaAdTypeId: null } });
    await tx.upstreamAdType.deleteMany({ where: { adTypeId: id } });
    await tx.downstreamAdType.deleteMany({ where: { adTypeId: id } });
    await tx.adType.delete({ where: { id } });
    await writeOperationLog(tx, ctx, 'HARD_DELETE', 'adType', id, {
      snapshot: target,
      dependencyCheck: deps,
      deleted: true,
    });
  });

  return successResult('adType', id);
}

export async function hardDeleteAdSite(
  id: string,
  ctx: HardDeleteContext,
  side: 'adId' | 'media'
): Promise<HardDeleteResult> {
  const target = await prisma.adSite.findUnique({
    where: { id },
    include: {
      upstream: { include: { defaultAdType: true } },
    },
  });
  if (!target) return notFound(side, id, ctx);

  const deps = await countAdSiteDependencies(id);
  if (deps.dailyInputCount > 0) {
    return financialBlock(side, id, ctx, deps, {
      quarantineTarget: { scope: 'media', adSiteId: id },
      detail: { snapshot: target, dependencyCheck: deps },
    });
  }

  const dependencies = {
    adSiteDownstreamCount: deps.adSiteDownstreamCount,
    rebateRateCount: deps.rebateRateCount,
    adSiteEventCount: deps.adSiteEventCount,
    mediaAdOrderCount: deps.mediaAdOrderCount,
  };
  if (Object.keys(dependencyData(dependencies)).length > 0) {
    return dependencyBlock(side, id, ctx, dependencies, { snapshot: target, dependencyCheck: deps });
  }

  await prisma.$transaction(async (tx) => {
    await tx.adSite.delete({ where: { id } });
    await writeOperationLog(tx, ctx, 'HARD_DELETE', side, id, {
      snapshot: target,
      dependencyCheck: deps,
      deleted: true,
    });
  });

  return successResult(side, id);
}

export async function hardDeleteMediaAdOrder(id: string, ctx: HardDeleteContext): Promise<HardDeleteResult> {
  const target = await prisma.mediaAdOrder.findUnique({
    where: { id },
    include: {
      downstream: true,
      adType: true,
    },
  });
  if (!target) return notFound('mediaAdOrder', id, ctx);

  await prisma.$transaction(async (tx) => {
    await tx.mediaAdOrder.delete({ where: { id } });
    await writeOperationLog(tx, ctx, 'HARD_DELETE', 'mediaAdOrder', id, {
      snapshot: target,
      deleted: true,
    });
  });

  return successResult('mediaAdOrder', id);
}

export async function hardDeleteMediaId(id: string, ctx: HardDeleteContext): Promise<HardDeleteResult> {
  const target = await prisma.adSiteDownstream.findUnique({
    where: { id },
    include: {
      adSite: true,
      downstream: true,
    },
  });
  if (!target) return notFound('mediaId', id, ctx);

  await prisma.$transaction(async (tx) => {
    await tx.adSiteDownstream.delete({ where: { id } });
    await writeOperationLog(tx, ctx, 'HARD_DELETE', 'mediaId', id, {
      snapshot: target,
      deleted: true,
    });
  });

  return successResult('mediaId', id);
}