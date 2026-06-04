"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMediaId = createMediaId;
exports.updateMediaId = updateMediaId;
exports.deleteMediaId = deleteMediaId;
const client_1 = require("../../../shared/prisma/client");
const mappers_1 = require("../mappers");
const AppError_1 = require("../../../shared/errors/AppError");
async function createMediaId(input) {
    const { adSiteId, downstreamId, customPrice } = input;
    if (!adSiteId || Number.isNaN(adSiteId))
        throw new AppError_1.BadRequestError('adSiteId is required');
    if (!downstreamId || Number.isNaN(downstreamId))
        throw new AppError_1.BadRequestError('downstreamId is required');
    // Both foreign keys must point to existing rows — return a clean 400 instead of a raw FK crash.
    const adSite = await client_1.prisma.adSite.findUnique({
        where: { id: adSiteId },
        include: { upstream: true },
    });
    if (!adSite)
        throw new AppError_1.BadRequestError(`AdSite (ID quảng cáo) with id '${adSiteId}' does not exist`);
    const downstream = await client_1.prisma.downstream.findUnique({ where: { id: downstreamId } });
    if (!downstream)
        throw new AppError_1.BadRequestError(`Downstream with id '${downstreamId}' does not exist`);
    // The AdSite (via its upstream) and the Downstream must belong to the same AdType.
    if (adSite.upstream.adTypeId !== downstream.adTypeId) {
        throw new AppError_1.BadRequestError('Media (ID quảng cáo) and downstream must use the same ad type');
    }
    // Do not allow creating NEW links to an inactive downstream.
    // (Existing historical links are untouched — this only guards new creates.)
    if (downstream.status !== 'active') {
        throw new AppError_1.BadRequestError('Cannot link to an inactive downstream');
    }
    // Uniqueness enforced by schema (@@unique([adSiteId, downstreamId])); pre-check for a clean error.
    const existing = await client_1.prisma.adSiteDownstream.findUnique({
        where: { adSiteId_downstreamId: { adSiteId, downstreamId } },
    });
    if (existing) {
        throw new AppError_1.ConflictError('This ID media (AdSite + downstream) already exists');
    }
    const row = await client_1.prisma.adSiteDownstream.create({
        data: {
            adSiteId,
            downstreamId,
            customPrice: customPrice ?? null,
        },
        include: {
            adSite: { include: { upstream: { include: { adType: true } } } },
            downstream: true,
        },
    });
    return (0, mappers_1.mapMediaId)(row);
}
async function updateMediaId(junctionId, input) {
    const { customPrice, status } = input;
    // Note: status validation is done in the controller before calling this service.
    // status is read-only per compatibility decision; only customPrice can be updated.
    const row = await client_1.prisma.adSiteDownstream.update({
        where: { id: junctionId },
        data: {
            ...(customPrice !== undefined && { customPrice: customPrice }),
        },
        include: {
            adSite: { include: { upstream: { include: { adType: true } } } },
            downstream: true,
        },
    });
    return (0, mappers_1.mapMediaId)(row);
}
async function deleteMediaId(_junctionId) {
    throw new AppError_1.ConflictError('Cannot delete MediaId: deleting media/downstream mapping is disabled to preserve historical reporting and settlement integrity.');
}
//# sourceMappingURL=mediaId.write.service.js.map