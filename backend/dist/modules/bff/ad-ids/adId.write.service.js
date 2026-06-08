"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAdId = createAdId;
exports.updateAdId = updateAdId;
exports.deleteAdId = deleteAdId;
const client_1 = require("../../../shared/prisma/client");
const AppError_1 = require("../../../shared/errors/AppError");
const mappers_1 = require("../mappers");
async function getAdvertiserAdType(advertiserId) {
    const advertiser = await client_1.prisma.upstream.findUnique({
        where: { id: advertiserId },
        include: { adType: true },
    });
    if (!advertiser)
        throw new AppError_1.BadRequestError('Invalid advertiserId: ' + advertiserId);
    return advertiser.adType;
}
async function resolveAdOrderId(advertiserId, adTypeCode, existingAdOrderId) {
    const advertiserAdType = await getAdvertiserAdType(advertiserId);
    const canonicalAdTypeCode = advertiserAdType?.code;
    const requestedAdTypeCode = adTypeCode ?? canonicalAdTypeCode;
    if (!requestedAdTypeCode)
        throw new AppError_1.BadRequestError('Either adOrderId or adTypeCode must be provided');
    if (canonicalAdTypeCode && requestedAdTypeCode !== canonicalAdTypeCode) {
        throw new AppError_1.BadRequestError(`adTypeCode ${requestedAdTypeCode} does not match advertiser adTypeCode ${canonicalAdTypeCode}`);
    }
    if (existingAdOrderId) {
        const adOrder = await client_1.prisma.adOrder.findUnique({
            where: { id: existingAdOrderId },
            include: { adType: true },
        });
        if (!adOrder)
            throw new AppError_1.BadRequestError('Invalid adOrderId: ' + existingAdOrderId);
        if (adOrder.upstreamId !== advertiserId) {
            throw new AppError_1.BadRequestError('adOrderId does not belong to advertiserId ' + advertiserId);
        }
        if (adOrder.adType?.code !== requestedAdTypeCode) {
            throw new AppError_1.BadRequestError(`adOrderId adTypeCode ${adOrder.adType?.code ?? ''} does not match advertiser adTypeCode ${requestedAdTypeCode}`);
        }
        return existingAdOrderId;
    }
    const adType = await client_1.prisma.adType.findUnique({ where: { code: requestedAdTypeCode } });
    if (!adType)
        throw new AppError_1.BadRequestError('Invalid adTypeCode: ' + requestedAdTypeCode);
    const existing = await client_1.prisma.adOrder.findFirst({
        where: { upstreamId: advertiserId, adTypeId: adType.id },
    });
    if (existing)
        return existing.id;
    const created = await client_1.prisma.adOrder.create({
        data: {
            upstreamId: advertiserId,
            adTypeId: adType.id,
            name: adType.name ?? requestedAdTypeCode,
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
    let resolvedAdOrderId = rest.adOrderId;
    if (rest.adTypeCode || rest.adOrderId || rest.advertiserId) {
        const current = await client_1.prisma.adSite.findUnique({ where: { id } });
        if (!current)
            throw new AppError_1.BadRequestError('Invalid ad id: ' + id);
        const advertiserId = rest.advertiserId ?? current.upstreamId;
        resolvedAdOrderId = await resolveAdOrderId(advertiserId, rest.adTypeCode, rest.adOrderId ?? undefined);
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