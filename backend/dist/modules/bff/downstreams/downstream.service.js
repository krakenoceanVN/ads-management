"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listDownstreams = listDownstreams;
const client_1 = require("../../../shared/prisma/client");
const mappers_1 = require("../mappers");
async function listDownstreams(filters) {
    const where = {};
    if (filters?.adTypeCode) {
        where.adType = { code: filters.adTypeCode };
    }
    if (filters?.status) {
        where.status = filters.status;
    }
    if (filters?.keyword) {
        where.downstreamType = { contains: filters.keyword, mode: 'insensitive' };
    }
    const rows = await client_1.prisma.downstream.findMany({
        where,
        include: { adType: true },
        orderBy: { id: 'asc' },
    });
    return rows.map(r => (0, mappers_1.mapDownstream)(r));
}
//# sourceMappingURL=downstream.service.js.map