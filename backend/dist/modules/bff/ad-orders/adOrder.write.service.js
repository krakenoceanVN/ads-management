"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAdOrder = createAdOrder;
exports.updateAdOrder = updateAdOrder;
exports.deleteAdOrder = deleteAdOrder;
const client_1 = require("../../../shared/prisma/client");
const mappers_1 = require("../mappers");
const seq_1 = require("./seq");
const ids_1 = require("../../../shared/ids");
async function createAdOrder(input) {
    const { advertiserId, adTypeCode, ...rest } = input;
    if (!(0, ids_1.isValidId)(advertiserId))
        throw new Error('Invalid advertiserId');
    const adType = await client_1.prisma.adType.findUnique({ where: { code: adTypeCode } });
    if (!adType)
        throw new Error('Invalid adTypeCode');
    const row = await (0, seq_1.generateAndCreateAdOrder)(client_1.prisma, {
        upstreamId: advertiserId,
        adTypeId: adType.id,
        adTypeCode: adType.code,
        name: rest.name ?? null,
        notes: rest.notes ?? null,
        status: rest.status ?? 'active',
    });
    // Reload with the joins the mapper needs (upstream, adType).
    const reloaded = await client_1.prisma.adOrder.findUnique({
        where: { id: row.id },
        include: { upstream: true, adType: true },
    });
    if (!reloaded)
        throw new Error('AdOrder disappeared after create');
    return (0, mappers_1.mapAdOrder)(reloaded);
}
async function updateAdOrder(id, input) {
    if (!(0, ids_1.isValidId)(id))
        throw new Error('Invalid id');
    const { advertiserId, adTypeCode, ...rest } = input;
    const updateData = {};
    if (rest.name !== undefined)
        updateData['name'] = rest.name;
    if (rest.notes !== undefined)
        updateData['notes'] = rest.notes;
    if (rest.status !== undefined)
        updateData['status'] = rest.status;
    if (advertiserId !== undefined) {
        if (!(0, ids_1.isValidId)(advertiserId))
            throw new Error('Invalid advertiserId');
        updateData['upstreamId'] = advertiserId;
    }
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
    if (!(0, ids_1.isValidId)(id))
        throw new Error('Invalid id');
    // Soft delete: set status to inactive. seq is NOT freed — gaps are allowed
    // and intentional (we never want a future row to claim a stale seq).
    const row = await client_1.prisma.adOrder.update({
        where: { id },
        data: { status: 'inactive' },
        include: { upstream: true, adType: true },
    });
    return (0, mappers_1.mapAdOrder)(row);
}
//# sourceMappingURL=adOrder.write.service.js.map