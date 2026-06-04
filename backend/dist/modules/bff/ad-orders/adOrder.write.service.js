"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAdOrder = createAdOrder;
exports.updateAdOrder = updateAdOrder;
exports.deleteAdOrder = deleteAdOrder;
const client_1 = require("../../../shared/prisma/client");
const mappers_1 = require("../mappers");
async function createAdOrder(input) {
    const { advertiserId, adTypeCode, ...rest } = input;
    // Resolve adTypeId from adTypeCode
    const adType = await client_1.prisma.adType.findUnique({ where: { code: adTypeCode } });
    if (!adType)
        throw new Error('Invalid adTypeCode');
    const row = await client_1.prisma.adOrder.create({
        data: {
            upstreamId: advertiserId,
            adTypeId: adType.id,
            name: rest.name,
            notes: rest.notes ?? null,
            status: rest.status ?? 'active',
        },
        include: { upstream: true, adType: true },
    });
    return (0, mappers_1.mapAdOrder)(row);
}
async function updateAdOrder(id, input) {
    const { advertiserId, adTypeCode, ...rest } = input;
    const updateData = {};
    if (rest.name !== undefined)
        updateData['name'] = rest.name;
    if (rest.notes !== undefined)
        updateData['notes'] = rest.notes;
    if (rest.status !== undefined)
        updateData['status'] = rest.status;
    if (advertiserId !== undefined)
        updateData['upstreamId'] = advertiserId;
    if (adTypeCode !== undefined) {
        const adType = await client_1.prisma.adType.findUnique({ where: { code: adTypeCode } });
        if (!adType)
            throw new Error('Invalid adTypeCode');
        updateData['adTypeId'] = adType.id;
    }
    const row = await client_1.prisma.adOrder.update({
        where: { id },
        data: updateData,
        include: { upstream: true, adType: true },
    });
    return (0, mappers_1.mapAdOrder)(row);
}
async function deleteAdOrder(id) {
    // Soft delete: set status to inactive
    const row = await client_1.prisma.adOrder.update({
        where: { id },
        data: { status: 'inactive' },
        include: { upstream: true, adType: true },
    });
    return (0, mappers_1.mapAdOrder)(row);
}
//# sourceMappingURL=adOrder.write.service.js.map