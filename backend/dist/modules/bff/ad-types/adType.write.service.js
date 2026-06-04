"use strict";
/**
 * AdType BFF Write Service
 * Handles create, update, and delete for AdType.
 * Delete is soft-blocked if referenced by business records.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAdType = createAdType;
exports.updateAdType = updateAdType;
exports.deleteAdType = deleteAdType;
const client_1 = require("../../../shared/prisma/client");
const AppError_1 = require("../../../shared/errors/AppError");
// Check if adType code is referenced by any business table
async function isCodeReferenced(code) {
    const [upstream, adOrder, adSite, downstream] = await Promise.all([
        client_1.prisma.upstream.count({ where: { adType: { code } } }),
        client_1.prisma.adOrder.count({ where: { adType: { code } } }),
        client_1.prisma.adSite.count({ where: { upstream: { adType: { code } } } }),
        client_1.prisma.downstream.count({ where: { adType: { code } } }),
    ]);
    return upstream > 0 || adOrder > 0 || adSite > 0 || downstream > 0;
}
async function createAdType(input) {
    const code = input.code?.trim().toUpperCase();
    const name = input.name?.trim();
    if (!code)
        throw new AppError_1.BadRequestError('code is required');
    if (!name)
        throw new AppError_1.BadRequestError('name is required');
    if (!/^[A-Z0-9_]+$/.test(code)) {
        throw new AppError_1.BadRequestError('code must contain only uppercase letters, numbers, and underscores (pattern: ^[A-Z0-9_]+)');
    }
    const existing = await client_1.prisma.adType.findUnique({ where: { code } });
    if (existing)
        throw new AppError_1.ConflictError(`AdType with code '${code}' already exists`);
    // AdType.id has no auto-increment — must provide explicit id.
    // Find next available id to avoid conflicts.
    const maxRow = await client_1.prisma.adType.findFirst({ orderBy: { id: 'desc' }, select: { id: true } });
    const nextId = (maxRow?.id ?? 0) + 1;
    let row;
    try {
        row = await client_1.prisma.adType.create({
            data: { id: nextId, code, name },
            select: { id: true, code: true, name: true },
        });
    }
    catch (err) {
        // Handle race condition where id is taken between our check and insert
        if (err.code === '2002' || err.message?.includes('duplicate key')) {
            throw new AppError_1.ConflictError(`AdType with code '${code}' already exists`);
        }
        throw err;
    }
    return { id: row.id, code: row.code, name: row.name };
}
async function updateAdType(id, input) {
    if (!id || isNaN(id))
        throw new AppError_1.BadRequestError('Invalid id');
    const existing = await client_1.prisma.adType.findUnique({ where: { id } });
    if (!existing)
        throw new AppError_1.BadRequestError('AdType not found');
    let code = input.code?.trim().toUpperCase();
    const name = input.name?.trim();
    if (input.code !== undefined && !code)
        throw new AppError_1.BadRequestError('code cannot be empty');
    if (input.name !== undefined && !name)
        throw new AppError_1.BadRequestError('name cannot be empty');
    if (code && !/^[A-Z0-9_]+$/.test(code)) {
        throw new AppError_1.BadRequestError('code must contain only uppercase letters, numbers, and underscores (pattern: ^[A-Z0-9_]+)');
    }
    // If code is changing, check it's not referenced
    if (code && code !== existing.code) {
        const referenced = await isCodeReferenced(existing.code);
        if (referenced) {
            throw new AppError_1.ConflictError(`Cannot change code: AdType '${existing.code}' is referenced by existing business records`);
        }
        const duplicate = await client_1.prisma.adType.findUnique({ where: { code } });
        if (duplicate)
            throw new AppError_1.ConflictError(`AdType with code '${code}' already exists`);
    }
    const updated = await client_1.prisma.adType.update({
        where: { id },
        data: {
            ...(code && { code }),
            ...(name && { name }),
        },
        select: { id: true, code: true, name: true },
    });
    return { id: updated.id, code: updated.code, name: updated.name };
}
async function deleteAdType(id) {
    if (!id || isNaN(id))
        throw new AppError_1.BadRequestError('Invalid id');
    const existing = await client_1.prisma.adType.findUnique({ where: { id } });
    if (!existing)
        throw new AppError_1.BadRequestError('AdType not found');
    // Check if referenced before blocking delete
    const referenced = await isCodeReferenced(existing.code);
    if (referenced) {
        throw new AppError_1.ConflictError(`Cannot delete AdType '${existing.code}': it is referenced by existing business records`);
    }
    await client_1.prisma.adType.delete({ where: { id } });
    return { deleted: true };
}
//# sourceMappingURL=adType.write.service.js.map