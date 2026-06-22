"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listAdOrders = listAdOrders;
exports.getAdOrder = getAdOrder;
const client_1 = require("../../../shared/prisma/client");
const mappers_1 = require("../mappers");
const ACTIVE_SITE_FILTER = { status: 'active', isArchived: false };
async function fetchBillingMethodsByOrder(adOrderIds) {
    const result = new Map();
    if (adOrderIds.length === 0)
        return result;
    for (const id of adOrderIds)
        result.set(id, []);
    const groups = await client_1.prisma.adSite.groupBy({
        by: ['adOrderId', 'billingMethod'],
        where: {
            adOrderId: { in: adOrderIds },
            ...ACTIVE_SITE_FILTER,
        },
    });
    for (const g of groups) {
        if (g.adOrderId == null)
            continue;
        const list = result.get(g.adOrderId);
        if (!list || list.includes(g.billingMethod))
            continue;
        list.push(g.billingMethod);
    }
    for (const list of result.values())
        list.sort();
    return result;
}
async function listAdOrders(params) {
    const where = {};
    if (params?.advertiserId != null) {
        where.upstreamId = params.advertiserId;
    }
    if (params?.adTypeCode) {
        where.adType = { code: params.adTypeCode };
    }
    const rows = await client_1.prisma.adOrder.findMany({
        where,
        include: {
            upstream: true,
            adType: true,
            _count: {
                select: {
                    adSites: { where: ACTIVE_SITE_FILTER },
                },
            },
        },
        orderBy: { id: 'asc' },
    });
    const billingMap = await fetchBillingMethodsByOrder(rows.map(r => r.id));
    return rows.map(r => (0, mappers_1.mapAdOrder)(r, billingMap.get(r.id) ?? []));
}
async function getAdOrder(id) {
    const row = await client_1.prisma.adOrder.findUnique({
        where: { id },
        include: {
            upstream: true,
            adType: true,
            _count: {
                select: {
                    adSites: { where: ACTIVE_SITE_FILTER },
                },
            },
        },
    });
    if (!row)
        return null;
    const billingMap = await fetchBillingMethodsByOrder([row.id]);
    return (0, mappers_1.mapAdOrder)(row, billingMap.get(row.id) ?? []);
}
//# sourceMappingURL=adOrder.service.js.map