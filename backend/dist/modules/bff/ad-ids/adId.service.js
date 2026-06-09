"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listAdIds = listAdIds;
exports.getAdId = getAdId;
const client_1 = require("../../../shared/prisma/client");
const mappers_1 = require("../mappers");
async function listAdIds(filters) {
    const where = {};
    if (filters?.advertiserId != null) {
        where.upstreamId = filters.advertiserId;
    }
    if (filters?.adOrderId != null) {
        where.adOrderId = filters.adOrderId;
    }
    if (filters?.adTypeCode) {
        where.OR = [
            { adOrder: { adType: { code: filters.adTypeCode } } },
            { adOrderId: null, upstream: { adType: { code: filters.adTypeCode } } },
        ];
    }
    if (filters?.type) {
        where.billingMethod = filters.type;
    }
    if (filters?.archived !== undefined) {
        where.isArchived = filters.archived;
    }
    const rows = await client_1.prisma.adSite.findMany({
        where,
        include: {
            upstream: { include: { adType: true } },
            adOrder: { include: { adType: true } },
        },
        orderBy: { id: 'asc' },
    });
    return rows.map(r => (0, mappers_1.mapAdId)(r));
}
async function getAdId(id) {
    const row = await client_1.prisma.adSite.findUnique({
        where: { id },
        include: {
            upstream: { include: { adType: true } },
            adOrder: { include: { adType: true } },
        },
    });
    if (!row)
        return null;
    return (0, mappers_1.mapAdId)(row);
}
//# sourceMappingURL=adId.service.js.map