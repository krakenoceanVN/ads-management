"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listAdvertisers = listAdvertisers;
exports.getAdvertiser = getAdvertiser;
const client_1 = require("../../../shared/prisma/client");
const mappers_1 = require("../mappers");
async function listAdvertisers() {
    const rows = await client_1.prisma.upstream.findMany({
        include: { adType: true },
        orderBy: { id: 'asc' },
    });
    return rows.map(r => (0, mappers_1.mapAdvertiser)(r));
}
async function getAdvertiser(id) {
    const row = await client_1.prisma.upstream.findUnique({
        where: { id },
        include: { adType: true },
    });
    if (!row)
        return null;
    return (0, mappers_1.mapAdvertiser)(row);
}
//# sourceMappingURL=advertiser.service.js.map