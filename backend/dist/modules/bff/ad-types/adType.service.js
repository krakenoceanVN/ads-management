"use strict";
/**
 * AdType BFF Service
 * Read-only service for listing AdTypes.
 * Write operations (create/update/delete) are in adType.write.service.ts.
 *
 * Per docx mục 1.2: AdType giữ vai trò "đơn quảng cáo của nhà QC".
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.listAdTypes = listAdTypes;
exports.getAdType = getAdType;
const client_1 = require("../../../shared/prisma/client");
function toDto(adType) {
    return {
        id: adType.id,
        name: adType.name,
        upstreamId: adType.upstreamId,
        upstreamName: adType.upstream?.name ?? null,
        notes: adType.notes,
        status: adType.status,
        adSiteCount: adType._count?.adSites ?? 0,
        createdAt: adType.createdAt.toISOString(),
        updatedAt: adType.updatedAt.toISOString(),
    };
}
async function listAdTypes() {
    const rows = await client_1.prisma.adType.findMany({
        orderBy: { id: 'asc' },
    });
    const ids = rows.map(r => r.id);
    const counts = await client_1.prisma.upstreamAdType.groupBy({
        by: ['adTypeId'],
        where: { adTypeId: { in: ids } },
        _count: { _all: true },
    });
    const countMap = new Map(counts.map(c => [c.adTypeId, c._count._all]));
    const ownerIds = rows.map(r => r.upstreamId).filter((x) => Boolean(x));
    const owners = await client_1.prisma.upstream.findMany({
        where: { id: { in: ownerIds } },
        select: { id: true, name: true },
    });
    const ownerMap = new Map(owners.map(o => [o.id, o.name]));
    return rows.map(r => ({
        ...toDto(r),
        upstreamName: r.upstreamId ? (ownerMap.get(r.upstreamId) ?? null) : null,
        adSiteCount: countMap.get(r.id) ?? 0,
    }));
}
async function getAdType(id) {
    const row = await client_1.prisma.adType.findUnique({ where: { id } });
    if (!row)
        return null;
    const linkCount = await client_1.prisma.upstreamAdType.count({ where: { adTypeId: id } });
    const owner = row.upstreamId
        ? await client_1.prisma.upstream.findUnique({ where: { id: row.upstreamId }, select: { name: true } })
        : null;
    return {
        ...toDto(row),
        upstreamName: owner?.name ?? null,
        adSiteCount: linkCount,
    };
}
//# sourceMappingURL=adType.service.js.map