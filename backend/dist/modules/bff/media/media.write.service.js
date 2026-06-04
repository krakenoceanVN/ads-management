"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMedia = createMedia;
exports.updateMedia = updateMedia;
exports.deleteMedia = deleteMedia;
const client_1 = require("../../../shared/prisma/client");
const mappers_1 = require("../mappers");
async function createMedia(input) {
    const upstream = await client_1.prisma.upstream.findUnique({ where: { id: input.upstreamId } });
    if (!upstream)
        throw new Error('Invalid upstreamId: ' + input.upstreamId);
    const row = await client_1.prisma.adSite.create({
        data: {
            name: input.name,
            upstreamId: input.upstreamId,
            billingMethod: input.billingMethod ?? 'CPM',
            currentUnitPrice: input.currentUnitPrice ?? null,
            currentRatio: input.currentRatio ?? null,
            status: input.status ?? 'active',
        },
        include: { upstream: { include: { adType: true } } },
    });
    return (0, mappers_1.mapMedia)(row);
}
async function updateMedia(id, input) {
    if (input.upstreamId !== undefined) {
        const upstream = await client_1.prisma.upstream.findUnique({ where: { id: input.upstreamId } });
        if (!upstream)
            throw new Error('Invalid upstreamId: ' + input.upstreamId);
    }
    const row = await client_1.prisma.adSite.update({
        where: { id },
        data: {
            ...(input.name !== undefined && { name: input.name }),
            ...(input.status !== undefined && { status: input.status }),
            ...(input.upstreamId !== undefined && { upstreamId: input.upstreamId }),
            ...(input.billingMethod !== undefined && { billingMethod: input.billingMethod }),
            ...(input.currentUnitPrice !== undefined && { currentUnitPrice: input.currentUnitPrice }),
            ...(input.currentRatio !== undefined && { currentRatio: input.currentRatio }),
            ...(input.isArchived !== undefined && { isArchived: input.isArchived }),
        },
        include: { upstream: { include: { adType: true } } },
    });
    return (0, mappers_1.mapMedia)(row);
}
async function deleteMedia(id) {
    // Soft archive: set isArchived=true, do not hard-delete AdSite
    const row = await client_1.prisma.adSite.update({
        where: { id },
        data: { isArchived: true },
        include: { upstream: { include: { adType: true } } },
    });
    return (0, mappers_1.mapMedia)(row);
}
//# sourceMappingURL=media.write.service.js.map