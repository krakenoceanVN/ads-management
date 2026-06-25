"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAdId = createAdId;
exports.updateAdId = updateAdId;
exports.deleteAdId = deleteAdId;
const client_1 = require("../../../shared/prisma/client");
const AppError_1 = require("../../../shared/errors/AppError");
const mappers_1 = require("../mappers");
const ids_1 = require("../../../shared/ids");
const bff_types_1 = require("../bff.types");
async function getAdvertiserLinkedAdTypes(advertiserId) {
    const advertiser = await client_1.prisma.upstream.findUnique({
        where: { id: advertiserId },
        include: {
            defaultAdType: true,
            adTypeLinks: { include: { adType: true }, orderBy: { adTypeId: 'asc' } },
        },
    });
    if (!advertiser)
        throw new AppError_1.BadRequestError('Invalid advertiserId: ' + advertiserId);
    const linkedAdTypes = advertiser.adTypeLinks.map(link => link.adType);
    return linkedAdTypes.length ? linkedAdTypes : advertiser.defaultAdType ? [advertiser.defaultAdType] : [];
}
async function createAdId(input) {
    const { advertiserId, adTypeId, slot, type, ...rest } = input;
    const billingMethod = (0, bff_types_1.normalizeBillingMethodForStorage)(type);
    if (!billingMethod)
        throw new AppError_1.BadRequestError('Invalid billing method: ' + type);
    const advId = String(advertiserId);
    if (!(0, ids_1.isValidId)(advId))
        throw new AppError_1.BadRequestError('Invalid advertiserId');
    if (adTypeId) {
        const linkedAdTypes = await getAdvertiserLinkedAdTypes(advId);
        if (!linkedAdTypes.some(at => at.id === adTypeId)) {
            throw new AppError_1.BadRequestError(`adTypeId ${adTypeId} is not linked to advertiserId ${advId}`);
        }
    }
    const row = await client_1.prisma.adSite.create({
        data: {
            id: (0, ids_1.generateShortId)(),
            upstreamId: advId,
            name: slot.trim(),
            notes: rest.notes ?? null,
            billingMethod,
            currentUnitPrice: (billingMethod === 'CPM' || billingMethod === 'CPA') ? (rest.unitPrice ?? null) : null,
            currentRatio: billingMethod === 'CPS' ? (rest.ratio ?? null) : null,
            status: rest.status ?? 'active',
        },
        include: {
            upstream: { include: { defaultAdType: true } },
        },
    });
    return (0, mappers_1.mapAdId)(row);
}
async function updateAdId(id, input) {
    if (!(0, ids_1.isValidId)(String(id)))
        throw new AppError_1.BadRequestError('Invalid id');
    const { type, unitPrice, ratio, ...rest } = input;
    const billingMethod = (0, bff_types_1.normalizeBillingMethodForStorage)(type);
    if (type !== undefined && !billingMethod)
        throw new AppError_1.BadRequestError('Invalid billing method: ' + type);
    if (rest.advertiserId && rest.adTypeId) {
        const linkedAdTypes = await getAdvertiserLinkedAdTypes(String(rest.advertiserId));
        if (!linkedAdTypes.some(at => at.id === rest.adTypeId)) {
            throw new AppError_1.BadRequestError(`adTypeId ${rest.adTypeId} is not linked to advertiserId ${rest.advertiserId}`);
        }
    }
    const row = await client_1.prisma.adSite.update({
        where: { id: String(id) },
        data: {
            ...(rest.advertiserId !== undefined && { upstreamId: String(rest.advertiserId) }),
            ...(rest.slot !== undefined && { name: rest.slot.trim() }),
            ...(rest.notes !== undefined && { notes: rest.notes }),
            ...(billingMethod !== undefined && { billingMethod }),
            ...((billingMethod === 'CPM' || billingMethod === 'CPA') && unitPrice !== undefined && { currentUnitPrice: unitPrice }),
            ...((billingMethod === 'CPM' || billingMethod === 'CPA') && unitPrice === undefined && { currentUnitPrice: null }),
            ...(billingMethod === 'CPS' && ratio !== undefined && { currentRatio: ratio }),
            ...(billingMethod === 'CPS' && ratio === undefined && { currentRatio: null }),
            ...(rest.status !== undefined && { status: rest.status }),
        },
        include: {
            upstream: { include: { defaultAdType: true } },
        },
    });
    return (0, mappers_1.mapAdId)(row);
}
async function deleteAdId(id) {
    if (!(0, ids_1.isValidId)(String(id)))
        throw new AppError_1.BadRequestError('Invalid id');
    // Soft deactivate: set status to inactive
    const row = await client_1.prisma.adSite.update({
        where: { id: String(id) },
        data: { status: 'inactive' },
        include: {
            upstream: { include: { defaultAdType: true } },
        },
    });
    return (0, mappers_1.mapAdId)(row);
}
//# sourceMappingURL=adId.write.service.js.map