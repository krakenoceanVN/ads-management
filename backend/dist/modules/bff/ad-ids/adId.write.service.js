"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAdId = createAdId;
exports.updateAdId = updateAdId;
exports.deleteAdId = deleteAdId;
const client_1 = require("../../../shared/prisma/client");
const mappers_1 = require("../mappers");
async function resolveAdOrderId(advertiserId, adTypeCode, existingAdOrderId) {
    if (existingAdOrderId)
        return existingAdOrderId;
    if (!adTypeCode)
        throw new Error('Either adOrderId or adTypeCode must be provided');
    const adType = await client_1.prisma.adType.findUnique({ where: { code: adTypeCode } });
    if (!adType)
        throw new Error('Invalid adTypeCode: ' + adTypeCode);
    // Find existing internal AdOrder for this advertiser + AdType
    const existing = await client_1.prisma.adOrder.findFirst({
        where: { upstreamId: advertiserId, adTypeId: adType.id },
    });
    if (existing)
        return existing.id;
    // Auto-create the internal AdOrder record
    const created = await client_1.prisma.adOrder.create({
        data: {
            upstreamId: advertiserId,
            adTypeId: adType.id,
            name: adType.name ?? adTypeCode,
            status: 'active',
        },
    });
    return created.id;
}
async function createAdId(input) {
    const { advertiserId, adOrderId, adTypeCode, slot, type, ...rest } = input;
    const billingMethod = type;
    const resolvedAdOrderId = await resolveAdOrderId(advertiserId, adTypeCode, adOrderId);
    const row = await client_1.prisma.adSite.create({
        data: {
            upstreamId: advertiserId,
            adOrderId: resolvedAdOrderId,
            name: slot.trim(),
            billingMethod,
            currentUnitPrice: (type === 'CPM' || type === 'CPA') ? (rest.unitPrice ?? null) : null,
            currentRatio: type === 'RATIO' ? (rest.ratio ?? null) : null,
            status: rest.status ?? 'active',
        },
        include: {
            upstream: { include: { adType: true } },
            adOrder: true,
        },
    });
    return (0, mappers_1.mapAdId)(row);
}
async function updateAdId(id, input) {
    const { type, unitPrice, ratio, ...rest } = input;
    const billingMethod = type ?? undefined;
    // If adTypeCode is provided in update, resolve it to adOrderId
    let resolvedAdOrderId = rest.adOrderId;
    if (rest.adTypeCode && !rest.adOrderId) {
        // reading current record to get advertiserId
        const current = await client_1.prisma.adSite.findUnique({ where: { id }, include: { upstream: true } });
        if (current) {
            resolvedAdOrderId = await resolveAdOrderId(current.upstreamId, rest.adTypeCode, undefined);
        }
    }
    const row = await client_1.prisma.adSite.update({
        where: { id },
        data: {
            ...(rest.advertiserId !== undefined && { upstreamId: rest.advertiserId }),
            ...(resolvedAdOrderId !== undefined && { adOrderId: resolvedAdOrderId }),
            ...(rest.slot !== undefined && { name: rest.slot.trim() }),
            ...(billingMethod !== undefined && { billingMethod }),
            ...((type === 'CPM' || type === 'CPA') && unitPrice !== undefined && { currentUnitPrice: unitPrice }),
            ...((type === 'CPM' || type === 'CPA') && unitPrice === undefined && { currentUnitPrice: null }),
            ...(type === 'RATIO' && ratio !== undefined && { currentRatio: ratio }),
            ...(type === 'RATIO' && ratio === undefined && { currentRatio: null }),
            ...(rest.status !== undefined && { status: rest.status }),
        },
        include: {
            upstream: { include: { adType: true } },
            adOrder: true,
        },
    });
    return (0, mappers_1.mapAdId)(row);
}
async function deleteAdId(id) {
    // Soft deactivate: set status to inactive
    const row = await client_1.prisma.adSite.update({
        where: { id },
        data: { status: 'inactive' },
        include: {
            upstream: { include: { adType: true } },
            adOrder: true,
        },
    });
    return (0, mappers_1.mapAdId)(row);
}
//# sourceMappingURL=adId.write.service.js.map