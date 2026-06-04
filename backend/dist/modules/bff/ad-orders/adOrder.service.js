"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listAdOrders = listAdOrders;
exports.getAdOrder = getAdOrder;
const client_1 = require("../../../shared/prisma/client");
const mappers_1 = require("../mappers");
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
        },
        orderBy: { id: 'asc' },
    });
    return rows.map(r => (0, mappers_1.mapAdOrder)(r));
}
async function getAdOrder(id) {
    const row = await client_1.prisma.adOrder.findUnique({
        where: { id },
        include: {
            upstream: true,
            adType: true,
        },
    });
    if (!row)
        return null;
    return (0, mappers_1.mapAdOrder)(row);
}
//# sourceMappingURL=adOrder.service.js.map