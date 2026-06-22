"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hardDeleteAdvertiser = hardDeleteAdvertiser;
exports.hardDeleteAdType = hardDeleteAdType;
exports.hardDeleteAdSite = hardDeleteAdSite;
exports.hardDeleteAdOrder = hardDeleteAdOrder;
exports.hardDeleteMediaId = hardDeleteMediaId;
const client_1 = require("../../../shared/prisma/client");
const NOT_FOUND_MESSAGE = 'Không tìm thấy bản ghi cần xóa.';
const FINANCIAL_BLOCK_MESSAGE = 'Không thể xóa cứng vì bản ghi đã có dữ liệu tài chính liên quan.';
const DEPENDENCY_BLOCK_MESSAGE = 'Không thể xóa cứng vì bản ghi đang có dữ liệu liên kết.';
function emptyFinancialCounts() {
    return {
        dailyInputCount: 0,
        confirmedCount: 0,
        unconfirmedCount: 0,
        quarantinedCount: 0,
    };
}
async function countFinancialData(where) {
    const rows = await client_1.prisma.dailyInput.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
    });
    const counts = emptyFinancialCounts();
    for (const row of rows) {
        const count = row._count._all;
        counts.dailyInputCount += count;
        if (row.status === 'confirmed')
            counts.confirmedCount = count;
        if (row.status === 'unconfirmed')
            counts.unconfirmedCount = count;
        if (row.status === 'quarantined')
            counts.quarantinedCount = count;
    }
    return counts;
}
function dependencyData(dependencies) {
    return Object.fromEntries(Object.entries(dependencies).filter(([, count]) => count > 0));
}
async function writeOperationLog(client, ctx, action, targetType, targetId, detail) {
    await client.operationLog.create({
        data: {
            userId: ctx.userId,
            username: ctx.username ?? null,
            action,
            module: 'masterData',
            targetType,
            targetId: String(targetId),
            detail: JSON.stringify(detail),
        },
    });
}
async function notFound(entityType, entityId, ctx) {
    await writeOperationLog(client_1.prisma, ctx, 'HARD_DELETE_BLOCKED', entityType, entityId, {
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
async function financialBlock(entityType, entityId, ctx, financial, options) {
    const result = {
        success: false,
        code: 'ENTITY_HAS_FINANCIAL_DATA',
        message: options?.message ?? FINANCIAL_BLOCK_MESSAGE,
        data: {
            entityType,
            entityId,
            dailyInputCount: financial.dailyInputCount,
            confirmedCount: financial.confirmedCount,
            unconfirmedCount: financial.unconfirmedCount,
            quarantinedCount: financial.quarantinedCount,
            suggestedAction: 'quarantine',
            ...(options?.quarantineTarget ? { quarantineTarget: options.quarantineTarget } : {}),
        },
    };
    await writeOperationLog(client_1.prisma, ctx, 'HARD_DELETE_BLOCKED', entityType, entityId, {
        reason: 'ENTITY_HAS_FINANCIAL_DATA',
        responseData: result.data,
        ...(options?.detail ?? {}),
    });
    return result;
}
async function dependencyBlock(entityType, entityId, ctx, dependencies, detail) {
    const nonZeroDependencies = dependencyData(dependencies);
    const result = {
        success: false,
        code: 'ENTITY_HAS_DEPENDENCIES',
        message: DEPENDENCY_BLOCK_MESSAGE,
        data: {
            entityType,
            entityId,
            dependencies: nonZeroDependencies,
            suggestedAction: 'delete_children_first_or_archive',
        },
    };
    await writeOperationLog(client_1.prisma, ctx, 'HARD_DELETE_BLOCKED', entityType, entityId, {
        reason: 'ENTITY_HAS_DEPENDENCIES',
        responseData: result.data,
        ...(detail ?? {}),
    });
    return result;
}
function successResult(entityType, entityId) {
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
async function countAdvertiserDependencies(advertiserId) {
    const [adSiteCount, adOrderCount, adSiteDownstreamCount, rebateRateCount, adSiteEventCount, financial] = await Promise.all([
        client_1.prisma.adSite.count({ where: { upstreamId: advertiserId } }),
        client_1.prisma.adOrder.count({ where: { upstreamId: advertiserId } }),
        client_1.prisma.adSiteDownstream.count({ where: { adSite: { upstreamId: advertiserId } } }),
        client_1.prisma.adSiteRebateRate.count({ where: { adSite: { upstreamId: advertiserId } } }),
        client_1.prisma.adSiteEvent.count({ where: { adSite: { upstreamId: advertiserId } } }),
        countFinancialData({ adSite: { upstreamId: advertiserId } }),
    ]);
    return {
        adSiteCount,
        adOrderCount,
        upstreamCount: 0,
        downstreamCount: 0,
        adSiteDownstreamCount,
        rebateRateCount,
        adSiteEventCount,
        ...financial,
    };
}
function adTypeAdSiteWhere(adTypeId) {
    return {
        OR: [
            { upstream: { adTypeId } },
            { adOrder: { adTypeId } },
        ],
    };
}
async function countAdTypeDependencies(adTypeId) {
    const adSiteWhere = adTypeAdSiteWhere(adTypeId);
    const [upstreamCount, adOrderCount, adSiteCount, downstreamCount, adSiteDownstreamCount, rebateRateCount, adSiteEventCount, financial] = await Promise.all([
        client_1.prisma.upstream.count({ where: { adTypeId } }),
        client_1.prisma.adOrder.count({ where: { adTypeId } }),
        client_1.prisma.adSite.count({ where: adSiteWhere }),
        client_1.prisma.downstreamAdType.count({ where: { adTypeId } }),
        client_1.prisma.adSiteDownstream.count({ where: { adSite: adSiteWhere } }),
        client_1.prisma.adSiteRebateRate.count({ where: { adSite: adSiteWhere } }),
        client_1.prisma.adSiteEvent.count({ where: { adSite: adSiteWhere } }),
        countFinancialData({ adSite: adSiteWhere }),
    ]);
    return {
        adSiteCount,
        adOrderCount,
        upstreamCount,
        downstreamCount,
        adSiteDownstreamCount,
        rebateRateCount,
        adSiteEventCount,
        ...financial,
    };
}
async function countAdSiteDependencies(adSiteId) {
    const [adSiteDownstreamCount, rebateRateCount, adSiteEventCount, financial] = await Promise.all([
        client_1.prisma.adSiteDownstream.count({ where: { adSiteId } }),
        client_1.prisma.adSiteRebateRate.count({ where: { adSiteId } }),
        client_1.prisma.adSiteEvent.count({ where: { adSiteId } }),
        countFinancialData({ adSiteId }),
    ]);
    return {
        adSiteCount: 0,
        adOrderCount: 0,
        upstreamCount: 0,
        downstreamCount: 0,
        adSiteDownstreamCount,
        rebateRateCount,
        adSiteEventCount,
        ...financial,
    };
}
async function countAdOrderDependencies(adOrderId) {
    const adSiteWhere = { adOrderId };
    const [adSiteCount, adSiteDownstreamCount, rebateRateCount, adSiteEventCount, financial] = await Promise.all([
        client_1.prisma.adSite.count({ where: adSiteWhere }),
        client_1.prisma.adSiteDownstream.count({ where: { adSite: adSiteWhere } }),
        client_1.prisma.adSiteRebateRate.count({ where: { adSite: adSiteWhere } }),
        client_1.prisma.adSiteEvent.count({ where: { adSite: adSiteWhere } }),
        countFinancialData({ adSite: adSiteWhere }),
    ]);
    return {
        adSiteCount,
        adOrderCount: 0,
        upstreamCount: 0,
        downstreamCount: 0,
        adSiteDownstreamCount,
        rebateRateCount,
        adSiteEventCount,
        ...financial,
    };
}
function adSiteDependencyCounts(deps) {
    return {
        adSiteDownstreamCount: deps.adSiteDownstreamCount,
        rebateRateCount: deps.rebateRateCount,
        adSiteEventCount: deps.adSiteEventCount,
    };
}
async function hardDeleteAdvertiser(id, ctx) {
    const target = await client_1.prisma.upstream.findUnique({ where: { id }, include: { adType: true } });
    if (!target)
        return notFound('advertiser', id, ctx);
    const deps = await countAdvertiserDependencies(id);
    if (deps.dailyInputCount > 0) {
        return financialBlock('advertiser', id, ctx, deps, {
            quarantineTarget: { scope: 'advertiser', advertiserId: id },
            detail: { snapshot: target, dependencyCheck: deps },
        });
    }
    const dependencies = {
        adSiteCount: deps.adSiteCount,
        adOrderCount: deps.adOrderCount,
        adSiteDownstreamCount: deps.adSiteDownstreamCount,
        rebateRateCount: deps.rebateRateCount,
        adSiteEventCount: deps.adSiteEventCount,
    };
    if (Object.keys(dependencyData(dependencies)).length > 0) {
        return dependencyBlock('advertiser', id, ctx, dependencies, { snapshot: target, dependencyCheck: deps });
    }
    await client_1.prisma.$transaction(async (tx) => {
        await tx.upstream.delete({ where: { id } });
        await writeOperationLog(tx, ctx, 'HARD_DELETE', 'advertiser', id, {
            snapshot: target,
            dependencyCheck: deps,
            deleted: true,
        });
    });
    return successResult('advertiser', id);
}
async function hardDeleteAdType(id, ctx) {
    const target = await client_1.prisma.adType.findUnique({ where: { id } });
    if (!target)
        return notFound('adType', id, ctx);
    const deps = await countAdTypeDependencies(id);
    if (deps.dailyInputCount > 0) {
        return financialBlock('adType', id, ctx, deps, {
            message: `${FINANCIAL_BLOCK_MESSAGE} Hiện Cô lập dữ liệu chưa hỗ trợ trực tiếp theo Đơn quảng cáo; ` +
                'cần cô lập theo từng Nhà quảng cáo/Media liên quan.',
            detail: { snapshot: target, dependencyCheck: deps },
        });
    }
    const dependencies = {
        upstreamCount: deps.upstreamCount,
        adOrderCount: deps.adOrderCount,
        adSiteCount: deps.adSiteCount,
        downstreamCount: deps.downstreamCount,
        adSiteDownstreamCount: deps.adSiteDownstreamCount,
        rebateRateCount: deps.rebateRateCount,
        adSiteEventCount: deps.adSiteEventCount,
    };
    if (Object.keys(dependencyData(dependencies)).length > 0) {
        return dependencyBlock('adType', id, ctx, dependencies, { snapshot: target, dependencyCheck: deps });
    }
    await client_1.prisma.$transaction(async (tx) => {
        await tx.adType.delete({ where: { id } });
        await writeOperationLog(tx, ctx, 'HARD_DELETE', 'adType', id, {
            snapshot: target,
            dependencyCheck: deps,
            deleted: true,
        });
    });
    return successResult('adType', id);
}
async function hardDeleteAdSite(id, ctx, side) {
    const target = await client_1.prisma.adSite.findUnique({
        where: { id },
        include: {
            upstream: { include: { adType: true } },
            adOrder: true,
        },
    });
    if (!target)
        return notFound(side, id, ctx);
    const deps = await countAdSiteDependencies(id);
    if (deps.dailyInputCount > 0) {
        return financialBlock(side, id, ctx, deps, {
            quarantineTarget: { scope: 'media', adSiteId: id },
            detail: { snapshot: target, dependencyCheck: deps },
        });
    }
    const dependencies = adSiteDependencyCounts(deps);
    if (Object.keys(dependencyData(dependencies)).length > 0) {
        return dependencyBlock(side, id, ctx, dependencies, { snapshot: target, dependencyCheck: deps });
    }
    await client_1.prisma.$transaction(async (tx) => {
        await tx.adSite.delete({ where: { id } });
        await writeOperationLog(tx, ctx, 'HARD_DELETE', side, id, {
            snapshot: target,
            dependencyCheck: deps,
            deleted: true,
        });
    });
    return successResult(side, id);
}
async function hardDeleteAdOrder(id, ctx) {
    const target = await client_1.prisma.adOrder.findUnique({
        where: { id },
        include: {
            upstream: true,
            adType: true,
        },
    });
    if (!target)
        return notFound('mediaAdOrder', id, ctx);
    const deps = await countAdOrderDependencies(id);
    if (deps.dailyInputCount > 0) {
        return financialBlock('mediaAdOrder', id, ctx, deps, {
            message: `${FINANCIAL_BLOCK_MESSAGE} Hiện Cô lập dữ liệu chưa hỗ trợ trực tiếp theo Đơn quảng cáo media; ` +
                'cần cô lập theo từng Media liên quan.',
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
        return dependencyBlock('mediaAdOrder', id, ctx, dependencies, { snapshot: target, dependencyCheck: deps });
    }
    await client_1.prisma.$transaction(async (tx) => {
        await tx.adOrder.delete({ where: { id } });
        await writeOperationLog(tx, ctx, 'HARD_DELETE', 'mediaAdOrder', id, {
            snapshot: target,
            dependencyCheck: deps,
            deleted: true,
        });
    });
    return successResult('mediaAdOrder', id);
}
async function hardDeleteMediaId(id, ctx) {
    const target = await client_1.prisma.adSiteDownstream.findUnique({
        where: { id },
        include: {
            adSite: {
                include: {
                    upstream: { include: { adType: true } },
                },
            },
            downstream: true,
        },
    });
    if (!target)
        return notFound('mediaId', id, ctx);
    const financial = await countFinancialData({ adSiteId: target.adSiteId });
    if (financial.dailyInputCount > 0) {
        return financialBlock('mediaId', id, ctx, financial, {
            quarantineTarget: { scope: 'media', adSiteId: target.adSiteId },
            detail: { snapshot: target, dependencyCheck: financial },
        });
    }
    await client_1.prisma.$transaction(async (tx) => {
        await tx.adSiteDownstream.delete({ where: { id } });
        await writeOperationLog(tx, ctx, 'HARD_DELETE', 'mediaId', id, {
            snapshot: target,
            dependencyCheck: financial,
            deleted: true,
        });
    });
    return successResult('mediaId', id);
}
//# sourceMappingURL=hardDelete.service.js.map