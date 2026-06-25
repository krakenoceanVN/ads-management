"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.downstreamInclude = void 0;
exports.listDownstreams = listDownstreams;
exports.getDownstreamById = getDownstreamById;
const client_1 = require("../../../shared/prisma/client");
const mappers_1 = require("../mappers");
exports.downstreamInclude = {
    adTypeLinks: { include: { adType: true }, orderBy: { adTypeId: 'asc' } },
};
async function listDownstreams(filters) {
    const where = {};
    if (filters?.adTypeId) {
        where.adTypeLinks = { some: { adTypeId: filters.adTypeId } };
    }
    if (filters?.status) {
        where.status = filters.status;
    }
    if (filters?.keyword) {
        where.downstreamType = { contains: filters.keyword, mode: 'insensitive' };
    }
    const rows = await client_1.prisma.downstream.findMany({
        where,
        include: exports.downstreamInclude,
        orderBy: { id: 'asc' },
    });
    return rows.map(r => (0, mappers_1.mapDownstream)(r));
}
async function getDownstreamById(id) {
    const row = await client_1.prisma.downstream.findUnique({
        where: { id },
        include: exports.downstreamInclude,
    });
    return row ? (0, mappers_1.mapDownstream)(row) : null;
}
//# sourceMappingURL=downstream.service.js.map