"use strict";
/**
 * AdType BFF Write Service
 * Handles create, update, and delete for AdType.
 * Delete is soft-blocked if referenced by business records.
 *
 * Per docx mục 1.2: AdType giữ vai trò "đơn quảng cáo của nhà QC".
 * Không còn field `code` — `id` (6-char alphanumeric) là identifier duy nhất.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAdType = createAdType;
exports.updateAdType = updateAdType;
exports.deleteAdType = deleteAdType;
const client_1 = require("../../../shared/prisma/client");
const AppError_1 = require("../../../shared/errors/AppError");
const ids_1 = require("../../../shared/ids");
// Check if adType is referenced by any business table (by id)
async function isIdReferenced(id) {
    const [upstream, upstreamAdType, adSite, downstreamAdType, mediaAdOrder] = await Promise.all([
        client_1.prisma.upstream.count({ where: { defaultAdType: { id } } }),
        client_1.prisma.upstreamAdType.count({ where: { adTypeId: id } }),
        client_1.prisma.adSite.count({ where: { upstream: { defaultAdType: { id } } } }),
        client_1.prisma.downstreamAdType.count({ where: { adTypeId: id } }),
        client_1.prisma.mediaAdOrder.count({ where: { adTypeId: id } }),
    ]);
    return upstream > 0 || upstreamAdType > 0 || adSite > 0 || downstreamAdType > 0 || mediaAdOrder > 0;
}
function toDto(row) {
    return {
        id: row.id,
        name: row.name,
        upstreamId: row.upstreamId,
        notes: row.notes,
        status: row.status,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
    };
}
async function createAdType(input) {
    const name = input.name?.trim();
    if (!name)
        throw new AppError_1.BadRequestError('name is required');
    if (input.upstreamId) {
        const upstream = await client_1.prisma.upstream.findUnique({ where: { id: input.upstreamId } });
        if (!upstream)
            throw new AppError_1.BadRequestError('Invalid upstreamId');
    }
    const row = await client_1.prisma.adType.create({
        data: {
            id: (0, ids_1.generateShortId)(),
            name,
            upstreamId: input.upstreamId ?? null,
            notes: input.notes ?? null,
            status: input.status ?? 'active',
        },
    });
    return toDto(row);
}
async function updateAdType(id, input) {
    if (!id)
        throw new AppError_1.BadRequestError('Invalid id');
    const existing = await client_1.prisma.adType.findUnique({ where: { id } });
    if (!existing)
        throw new AppError_1.BadRequestError('AdType not found');
    const name = input.name?.trim();
    if (input.name !== undefined && !name)
        throw new AppError_1.BadRequestError('name cannot be empty');
    if (input.upstreamId) {
        const upstream = await client_1.prisma.upstream.findUnique({ where: { id: input.upstreamId } });
        if (!upstream)
            throw new AppError_1.BadRequestError('Invalid upstreamId');
    }
    const updated = await client_1.prisma.adType.update({
        where: { id },
        data: {
            ...(name && { name }),
            ...(input.upstreamId !== undefined && { upstreamId: input.upstreamId }),
            ...(input.notes !== undefined && { notes: input.notes }),
            ...(input.status !== undefined && { status: input.status }),
        },
    });
    return toDto(updated);
}
async function deleteAdType(id) {
    if (!id)
        throw new AppError_1.BadRequestError('Invalid id');
    const existing = await client_1.prisma.adType.findUnique({ where: { id } });
    if (!existing)
        throw new AppError_1.BadRequestError('AdType not found');
    const referenced = await isIdReferenced(id);
    if (referenced) {
        throw new AppError_1.BadRequestError(`Cannot delete AdType '${existing.name}': it is referenced by existing business records`);
    }
    await client_1.prisma.adType.delete({ where: { id } });
    return { deleted: true };
}
//# sourceMappingURL=adType.write.service.js.map