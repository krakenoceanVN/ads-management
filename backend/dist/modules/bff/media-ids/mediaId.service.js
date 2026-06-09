"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listMediaIds = listMediaIds;
exports.getMediaId = getMediaId;
const client_1 = require("../../../shared/prisma/client");
const mappers_1 = require("../mappers");
async function listMediaIds(filters) {
    const where = {};
    if (filters?.mediaId != null) {
        where.adSiteId = filters.mediaId;
    }
    if (filters?.adTypeCode || filters?.type !== undefined || filters?.archived !== undefined) {
        where.adSite = {
            OR: filters.adTypeCode ? [
                { adOrder: { adType: { code: filters.adTypeCode } } },
                { adOrderId: null, upstream: { adType: { code: filters.adTypeCode } } },
            ] : undefined,
            billingMethod: filters.type,
            isArchived: filters.archived,
        };
    }
    const rows = await client_1.prisma.adSiteDownstream.findMany({
        where,
        include: {
            adSite: {
                include: {
                    upstream: { include: { adType: true } },
                    adOrder: { include: { adType: true } },
                },
            },
            downstream: true,
        },
        orderBy: { id: 'asc' },
    });
    return rows.map(r => (0, mappers_1.mapMediaId)(r));
}
async function getMediaId(id) {
    const row = await client_1.prisma.adSiteDownstream.findUnique({
        where: { id },
        include: {
            adSite: {
                include: {
                    upstream: { include: { adType: true } },
                    adOrder: { include: { adType: true } },
                },
            },
            downstream: true,
        },
    });
    if (!row)
        return null;
    return (0, mappers_1.mapMediaId)(row);
}
//# sourceMappingURL=mediaId.service.js.map