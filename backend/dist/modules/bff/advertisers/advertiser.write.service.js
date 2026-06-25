"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAdvertiser = createAdvertiser;
exports.updateAdvertiser = updateAdvertiser;
exports.deleteAdvertiser = deleteAdvertiser;
const client_1 = require("../../../shared/prisma/client");
const AppError_1 = require("../../../shared/errors/AppError");
const mappers_1 = require("../mappers");
const ids_1 = require("../../../shared/ids");
const advertiserInclude = {
    defaultAdType: true,
    adTypeLinks: { include: { adType: true }, orderBy: { adTypeId: 'asc' } },
};
function normalizeAdTypeIds(input) {
    const rawIds = input.adTypeIds !== undefined ? input.adTypeIds : input.adTypeId ? [input.adTypeId] : [];
    return Array.from(new Set(rawIds.map(id => id.trim()).filter(Boolean)));
}
async function resolveAdTypesByIds(ids, tx) {
    if (!ids.length)
        return [];
    const adTypes = await tx.adType.findMany({ where: { id: { in: ids } }, orderBy: { id: 'asc' } });
    const foundIds = new Set(adTypes.map(adType => adType.id));
    const missing = ids.filter(id => !foundIds.has(id));
    if (missing.length)
        throw new AppError_1.BadRequestError(`Invalid adTypeId: ${missing.join(', ')}`);
    return ids.map(id => adTypes.find(adType => adType.id === id));
}
async function syncUpstreamAdTypes(upstreamId, adTypeIds, tx) {
    await tx.upstreamAdType.deleteMany({ where: { upstreamId, adTypeId: { notIn: adTypeIds } } });
    await Promise.all(adTypeIds.map(adTypeId => tx.upstreamAdType.upsert({
        where: { upstreamId_adTypeId: { upstreamId, adTypeId } },
        update: {},
        create: { id: `uat_${upstreamId}_${adTypeId}`, upstreamId, adTypeId },
    })));
}
async function createAdvertiser(input) {
    const adTypeIds = normalizeAdTypeIds(input);
    const row = await client_1.prisma.$transaction(async (tx) => {
        const adTypes = await resolveAdTypesByIds(adTypeIds, tx);
        const primaryAdType = adTypes[0];
        const created = await tx.upstream.create({
            data: {
                id: (0, ids_1.generateShortId)(),
                name: input.name,
                contact: input.contact ?? null,
                phone: input.phone ?? null,
                email: input.email ?? null,
                notes: input.notes ?? null,
                status: input.status ?? 'active',
                adTypeId: primaryAdType?.id ?? null,
            },
        });
        await syncUpstreamAdTypes(created.id, adTypes.map(adType => adType.id), tx);
        return tx.upstream.findUniqueOrThrow({ where: { id: created.id }, include: advertiserInclude });
    });
    return (0, mappers_1.mapAdvertiser)(row);
}
async function updateAdvertiser(id, input) {
    const shouldSyncAdTypes = input.adTypeIds !== undefined || input.adTypeId !== undefined;
    const adTypeIds = shouldSyncAdTypes ? normalizeAdTypeIds(input) : [];
    const row = await client_1.prisma.$transaction(async (tx) => {
        const adTypes = shouldSyncAdTypes ? await resolveAdTypesByIds(adTypeIds, tx) : [];
        await tx.upstream.update({
            where: { id },
            data: {
                ...(input.name !== undefined && { name: input.name }),
                ...(input.contact !== undefined && { contact: input.contact }),
                ...(input.phone !== undefined && { phone: input.phone }),
                ...(input.email !== undefined && { email: input.email }),
                ...(input.notes !== undefined && { notes: input.notes }),
                ...(input.status !== undefined && { status: input.status }),
                ...(shouldSyncAdTypes && { adTypeId: adTypes[0]?.id ?? null }),
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