"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAdvertiser = createAdvertiser;
exports.updateAdvertiser = updateAdvertiser;
exports.deleteAdvertiser = deleteAdvertiser;
const client_1 = require("../../../shared/prisma/client");
const AppError_1 = require("../../../shared/errors/AppError");
const mappers_1 = require("../mappers");
const advertiserInclude = {
    adType: true,
    adTypeLinks: { include: { adType: true }, orderBy: { adTypeId: 'asc' } },
};
function normalizeAdTypeCodes(input) {
    const rawCodes = input.adTypeCodes !== undefined ? input.adTypeCodes : input.adTypeCode ? [input.adTypeCode] : [];
    return Array.from(new Set(rawCodes.map(code => code.trim()).filter(Boolean)));
}
async function resolveAdTypesByCodes(codes, tx) {
    if (!codes.length)
        throw new AppError_1.BadRequestError('at least one adTypeCode is required');
    const adTypes = await tx.adType.findMany({ where: { code: { in: codes } }, orderBy: { id: 'asc' } });
    const foundCodes = new Set(adTypes.map(adType => adType.code));
    const missing = codes.filter(code => !foundCodes.has(code));
    if (missing.length)
        throw new AppError_1.BadRequestError(`Invalid adTypeCode: ${missing.join(', ')}`);
    return codes.map(code => adTypes.find(adType => adType.code === code));
}
async function syncUpstreamAdTypes(upstreamId, adTypeIds, tx) {
    await tx.upstreamAdType.deleteMany({ where: { upstreamId, adTypeId: { notIn: adTypeIds } } });
    await Promise.all(adTypeIds.map(adTypeId => tx.upstreamAdType.upsert({
        where: { upstreamId_adTypeId: { upstreamId, adTypeId } },
        update: {},
        create: { upstreamId, adTypeId },
    })));
}
async function createAdvertiser(input) {
    const adTypeCodes = normalizeAdTypeCodes(input);
    const row = await client_1.prisma.$transaction(async (tx) => {
        const adTypes = await resolveAdTypesByCodes(adTypeCodes, tx);
        const primaryAdType = adTypes[0];
        const created = await tx.upstream.create({
            data: {
                name: input.name,
                contact: input.contact ?? null,
                phone: input.phone ?? null,
                email: input.email ?? null,
                notes: input.notes ?? null,
                status: input.status ?? 'active',
                adTypeId: primaryAdType.id,
            },
        });
        await syncUpstreamAdTypes(created.id, adTypes.map(adType => adType.id), tx);
        return tx.upstream.findUniqueOrThrow({ where: { id: created.id }, include: advertiserInclude });
    });
    return (0, mappers_1.mapAdvertiser)(row);
}
async function updateAdvertiser(id, input) {
    const shouldSyncAdTypes = input.adTypeCodes !== undefined || input.adTypeCode !== undefined;
    const adTypeCodes = shouldSyncAdTypes ? normalizeAdTypeCodes(input) : [];
    const row = await client_1.prisma.$transaction(async (tx) => {
        const adTypes = shouldSyncAdTypes ? await resolveAdTypesByCodes(adTypeCodes, tx) : [];
        await tx.upstream.update({
            where: { id },
            data: {
                ...(input.name !== undefined && { name: input.name }),
                ...(input.contact !== undefined && { contact: input.contact }),
                ...(input.phone !== undefined && { phone: input.phone }),
                ...(input.email !== undefined && { email: input.email }),
                ...(input.notes !== undefined && { notes: input.notes }),
                ...(input.status !== undefined && { status: input.status }),
                ...(shouldSyncAdTypes && { adTypeId: adTypes[0].id }),
            },
        });
        if (shouldSyncAdTypes) {
            await syncUpstreamAdTypes(id, adTypes.map(adType => adType.id), tx);
        }
        return tx.upstream.findUniqueOrThrow({ where: { id }, include: advertiserInclude });
    });
    return (0, mappers_1.mapAdvertiser)(row);
}
async function deleteAdvertiser(id) {
    const row = await client_1.prisma.upstream.update({
        where: { id },
        data: { status: 'inactive' },
        include: advertiserInclude,
    });
    return (0, mappers_1.mapAdvertiser)(row);
}
//# sourceMappingURL=advertiser.write.service.js.map