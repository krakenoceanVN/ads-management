"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMedia = createMedia;
exports.updateMedia = updateMedia;
exports.deleteMedia = deleteMedia;
const client_1 = require("../../../shared/prisma/client");
const mappers_1 = require("../mappers");
const bff_types_1 = require("../bff.types");
async function createMedia(input) {
    const upstream = await client_1.prisma.upstream.findUnique({ where: { id: input.upstreamId } });
    if (!upstream)
        throw new Error('Invalid upstreamId: ' + input.upstreamId);
    const billingMethod = (0, bff_types_1.normalizeBillingMethodForStorage)(input.billingMethod ?? 'CPM');
    if (!billingMethod)
        throw new Error('Invalid billingMethod: ' + input.billingMethod);
    const row = await client_1.prisma.adSite.create({
        data: {
            name: input.name,
            upstreamId: input.upstreamId,
            billingMethod,
            currentUnitPrice: input.currentUnitPrice ?? null,
            currentRatio: input.currentRatio ?? null,
            status: input.status ?? 'active',
        },
        include: { upstream: { include: { adType: true } }, adOrder: { include: { adType: true } } },
    });
    return (0, mappers_1.mapMedia)(row);
}
async function updateMedia(id, input) {
    if (input.upstreamId !== undefined) {
        const upstream = await client_1.prisma.upstream.findUnique({ where: { id: input.upstreamId } });
        if (!upstream)
            throw new Error('Invalid upstreamId: ' + input.upstreamId);
    }
    const billingMethod = (0, bff_types_1.normalizeBillingMethodForStorage)(input.billingMethod);
    if (input.billingMethod !== undefined && !billingMethod)
        throw new Error('Invalid billingMethod: ' + input.billingMethod);
    const row = await client_1.prisma.adSite.update({
        where: { id },
        data: {
            ...(input.name !== undefined && { name: input.name }),
            ...(input.status !== undefined && { status: input.status }),
            ...(input.upstreamId !== undefined && { upstreamId: input.upstreamId }),
            ...(billingMethod !== undefined && { billingMethod }),
            ...(input.currentUnitPrice !== undefined && { currentUnitPrice: input.currentUnitPrice }),
            ...(input.currentRatio !== undefined && { currentRatio: input.currentRatio }),
            ...(input.isArchived !== undefined && { isArchived: input.isArchived }),
        },
        include: { upstream: { include: { adType: true } }, adOrder: { include: { adType: true } } },
    });
    return (0, mappers_1.mapMedia)(row);
}
async function deleteMedia(id) {
    // Soft archive: set isArchived=true, do not hard-delete AdSite
    const row = await client_1.prisma.adSite.update({
        where: { id },
        data: { isArchived: true },
        include: { upstream: { include: { adType: true } }, adOrder: { include: { adType: true } } },
    });
    return (0, mappers_1.mapMedia)(row);
}
//# sourceMappingURL=media.write.service.js.map