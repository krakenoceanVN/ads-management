"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveAdOrderId = resolveAdOrderId;
exports.createAdId = createAdId;
exports.updateAdId = updateAdId;
exports.deleteAdId = deleteAdId;
const client_1 = require("../../../shared/prisma/client");
const AppError_1 = require("../../../shared/errors/AppError");
const mappers_1 = require("../mappers");
const bff_types_1 = require("../bff.types");
async function getAdvertiserLinkedAdTypes(advertiserId) {
    const advertiser = await client_1.prisma.upstream.findUnique({
        where: { id: advertiserId },
        include: { adType: true, adTypeLinks: { include: { adType: true }, orderBy: { adTypeId: 'asc' } } },
    });
    if (!advertiser)
        throw new AppError_1.BadRequestError('Invalid advertiserId: ' + advertiserId);
    const linkedAdTypes = advertiser.adTypeLinks.map(link => link.adType);
    return linkedAdTypes.length ? linkedAdTypes : advertiser.adType ? [advertiser.adType] : [];
}
async function resolveAdOrderId(advertiserId, adTypeCode, existingAdOrderId) {
    const linkedAdTypes = await getAdvertiserLinkedAdTypes(advertiserId);
    const linkedCodes = linkedAdTypes.map(adType => adType.code);
    const requestedAdTypeCode = adTypeCode ?? linkedCodes[0];
    if (!requestedAdTypeCode)
        throw new AppError_1.BadRequestError('Either adOrderId or adTypeCode must be provided');
    if (!linkedCodes.includes(requestedAdTypeCode)) {
        throw new AppError_1.BadRequestError(`adTypeCode ${requestedAdTypeCode} is not linked to advertiserId ${advertiserId}`);
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
    const adType = linkedAdTypes.find(item => item.code === requestedAdTypeCode);
    if (!adType)
        throw new AppError_1.BadRequestError('Invalid adTypeCode: ' + requestedAdTypeCode);
    // Auto-create path. Retry semantics differ from the form path
    // (modules/bff/ad-orders/seq.ts):
    //   * On P2002, ANOTHER concurrent caller just inserted seq=1 for the same
    //     pair. We must NOT increment to seq=2 — we re-findFirst and reuse.
    //   * We only ever create a row when the pair has no AdOrder yet; this
    //     preserves the existing "one AdOrder per (advertiser, adType) pair
    //     via auto-create" behavior. The form path can create additional
    //     rows for the same pair.
    const SEQ_UNIQUE_COLUMNS = ['upstreamId', 'adTypeId', 'seq'];
    const MAX_ATTEMPTS = 5;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const existing = await client_1.prisma.adOrder.findFirst({
            where: { upstreamId: advertiserId, adTypeId: adType.id },
        });
        if (existing)
            return existing.id;
        try {
            const created = await client_1.prisma.adOrder.create({
                data: {
                    upstreamId: advertiserId,
                    adTypeId: adType.id,
                    seq: 1,
                    name: `${adType.code}-001`,
                    status: 'active',
                },
            });
            return created.id;
        }
        catch (e) {
            const err = e;
            if (err?.code === 'P2002') {
                const target = err.meta?.target;
                const targetArr = Array.isArray(target) ? target : typeof target === 'string' ? [target] : [];
                const onSeq = SEQ_UNIQUE_COLUMNS.every(col => targetArr.includes(col));
                if (onSeq && attempt < MAX_ATTEMPTS - 1) {
                    // Pair was just created by a concurrent request — re-loop and reuse.
                    continue;
                }
            }
            throw e;
        }
    }
    throw new Error('resolveAdOrderId: exhausted retries');
}
async function createAdId(input) {
    const { advertiserId, adOrderId, adTypeCode, slot, type, ...rest } = input;
    const billingMethod = (0, bff_types_1.normalizeBillingMethodForStorage)(type);
    if (!billingMethod)
        throw new AppError_1.BadRequestError('Invalid billing method: ' + type);
    const resolvedAdOrderId = await resolveAdOrderId(advertiserId, adTypeCode, adOrderId);
    const row = await client_1.prisma.adSite.create({
        data: {
            upstreamId: advertiserId,
            adOrderId: resolvedAdOrderId,
            name: slot.trim(),
            notes: rest.notes ?? null,
            billingMethod,
            currentUnitPrice: (billingMethod === 'CPM' || billingMethod === 'CPA') ? (rest.unitPrice ?? null) : null,
            currentRatio: billingMethod === 'RATIO' ? (rest.ratio ?? null) : null,
            status: rest.status ?? 'active',
        },
        include: {
            upstream: { include: { adType: true } },
            adOrder: { include: { adType: true } },
        },
    });
    return (0, mappers_1.mapAdId)(row);
}
async function updateAdId(id, input) {
    const { type, unitPrice, ratio, ...rest } = input;
    const billingMethod = (0, bff_types_1.normalizeBillingMethodForStorage)(type);
    if (type !== undefined && !billingMethod)
        throw new AppError_1.BadRequestError('Invalid billing method: ' + type);
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
            ...(rest.notes !== undefined && { notes: rest.notes }),
            ...(billingMethod !== undefined && { billingMethod }),
            ...((billingMethod === 'CPM' || billingMethod === 'CPA') && unitPrice !== undefined && { currentUnitPrice: unitPrice }),
            ...((billingMethod === 'CPM' || billingMethod === 'CPA') && unitPrice === undefined && { currentUnitPrice: null }),
            ...(billingMethod === 'RATIO' && ratio !== undefined && { currentRatio: ratio }),
            ...(billingMethod === 'RATIO' && ratio === undefined && { currentRatio: null }),
            ...(rest.status !== undefined && { status: rest.status }),
        },
        include: {
            upstream: { include: { adType: true } },
            adOrder: { include: { adType: true } },
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
            adOrder: { include: { adType: true } },
        },
    });
    return (0, mappers_1.mapAdId)(row);
}
//# sourceMappingURL=adId.write.service.js.map