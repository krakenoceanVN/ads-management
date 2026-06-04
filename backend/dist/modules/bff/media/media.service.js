"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listMedia = listMedia;
exports.getMedia = getMedia;
const client_1 = require("../../../shared/prisma/client");
const mappers_1 = require("../mappers");
async function listMedia() {
    const rows = await client_1.prisma.adSite.findMany({
        include: {
            upstream: { include: { adType: true } },
        },
        orderBy: { id: 'asc' },
    });
    return rows.map(r => (0, mappers_1.mapMedia)(r));
}
async function getMedia(id) {
    const row = await client_1.prisma.adSite.findUnique({
        where: { id },
        include: {
            upstream: { include: { adType: true } },
        },
    });
    if (!row)
        return null;
    return (0, mappers_1.mapMedia)(row);
}
//# sourceMappingURL=media.service.js.map