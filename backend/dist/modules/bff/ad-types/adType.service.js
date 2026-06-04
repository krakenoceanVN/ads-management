"use strict";
/**
 * AdType BFF Service
 * Read-only service for listing AdTypes.
 * Write operations (create/update/delete) are in adType.write.service.ts.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.listAdTypes = listAdTypes;
exports.getAdType = getAdType;
const client_1 = require("../../../shared/prisma/client");
function toDto(adType) {
    return {
        id: adType.id,
        code: adType.code,
        name: adType.name,
        createdAt: adType.createdAt.toISOString(),
        updatedAt: adType.updatedAt.toISOString(),
    };
}
async function listAdTypes() {
    const rows = await client_1.prisma.adType.findMany({
        orderBy: { id: 'asc' },
    });
    return rows.map(toDto);
}
async function getAdType(id) {
    const row = await client_1.prisma.adType.findUnique({ where: { id } });
    return row ? toDto(row) : null;
}
//# sourceMappingURL=adType.service.js.map