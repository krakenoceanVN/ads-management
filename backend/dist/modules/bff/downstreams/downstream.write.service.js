"use strict";
/**
 * Downstream BFF Write Service
 * Handles create and update for Downstream (下游).
 * A downstream is a payout channel (ML | LE | YIYI) that owns a set of AdTypes
 * via the DownstreamAdType junction (mirrors UpstreamAdType). Phase-2 dropped
 * the legacy scalar Downstream.adTypeId — the junction is the single source of
 * truth.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDownstream = createDownstream;
exports.updateDownstream = updateDownstream;
exports.deleteDownstream = deleteDownstream;
const client_1 = require("../../../shared/prisma/client");
const mappers_1 = require("../mappers");
const AppError_1 = require("../../../shared/errors/AppError");
const downstream_service_1 = require("./downstream.service");
const ALLOWED_STATUSES = ['active', 'inactive'];
function normalizeType(raw) {
    const value = raw?.trim().toUpperCase();
    if (!value)
        throw new AppError_1.BadRequestError('downstreamType is required');
    if (!/^[A-Z0-9_]{1,20}$/.test(value)) {
        throw new AppError_1.BadRequestError('downstreamType must be 1–20 chars: A–Z, 0–9, _ only');
    }
    return value;
}
function validatePayoutRate(rate) {
    if (typeof rate !== 'number' || Number.isNaN(rate)) {
        throw new AppError_1.BadRequestError('payoutRate must be a number');
    }
    if (rate < 0 || rate > 100) {
        throw new AppError_1.BadRequestError('payoutRate must be 0 or greater');
    }
}
function validateStatus(status) {
    if (!ALLOWED_STATUSES.includes(status)) {
        throw new AppError_1.BadRequestError(`status must be one of: ${ALLOWED_STATUSES.join(', ')}`);
    }
    return status;
}
function normalizeAdTypeCodes(input) {
    if (input.adTypeCodes === undefined)
        return [];
    return Array.from(new Set(input.adTypeCodes.map(c => c.trim()).filter(Boolean)));
}
async function resolveAdTypesByCodes(codes, tx) {
    if (!codes.length)
        throw new AppError_1.BadRequestError('at least one adTypeCode is required');
    const adTypes = await tx.adType.findMany({ where: { code: { in: codes } }, orderBy: { id: 'asc' } });
    const found = new Set(adTypes.map(t => t.code));
    const missing = codes.filter(c => !found.has(c));
    if (missing.length)
        throw new AppError_1.BadRequestError(`Invalid adTypeCode: ${missing.join(', ')}`);
    return codes.map(code => adTypes.find(t => t.code === code));
}
async function syncDownstreamAdTypes(downstreamId, adTypeIds, tx) {
    await tx.downstreamAdType.deleteMany({ where: { downstreamId, adTypeId: { notIn: adTypeIds } } });
    await Promise.all(adTypeIds.map(adTypeId => tx.downstreamAdType.upsert({
        where: { downstreamId_adTypeId: { downstreamId, adTypeId } },
        update: {},
        create: { downstreamId, adTypeId },
    })));
}
async function createDownstream(input) {
    const downstreamType = normalizeType(input.downstreamType);
    const payoutRate = input.payoutRate ?? 0.8;
    validatePayoutRate(payoutRate);
    const status = validateStatus(input.status ?? 'active');
    const adTypeCodes = normalizeAdTypeCodes(input);
    const row = await client_1.prisma.$transaction(async (tx) => {
        await resolveAdTypesByCodes(adTypeCodes, tx);
        // DB-level partial unique on (downstreamType) where status='active' will also
        // throw P2002 — catch that here for a clean 409.
        let created;
        try {
            created = await tx.downstream.create({
                data: { downstreamType, payoutRate, status },
            });
        }
        catch (err) {
            if (err?.code === 'P2002') {
                throw new AppError_1.ConflictError(`Downstream '${downstreamType}' already exists`);
            }
            throw err;
        }
        const adTypes = await resolveAdTypesByCodes(adTypeCodes, tx);
        await syncDownstreamAdTypes(created.id, adTypes.map(t => t.id), tx);
        return tx.downstream.findUniqueOrThrow({ where: { id: created.id }, include: downstream_service_1.downstreamInclude });
    });
    return (0, mappers_1.mapDownstream)(row);
}
async function updateDownstream(id, input) {
    if (!id || Number.isNaN(id))
        throw new AppError_1.BadRequestError('Invalid id');
    const existing = await client_1.prisma.downstream.findUnique({ where: { id } });
    if (!existing)
        throw new AppError_1.NotFoundError('Downstream not found');
    const data = {};
    if (input.downstreamType !== undefined) {
        const downstreamType = normalizeType(input.downstreamType);
        if (downstreamType !== existing.downstreamType) {
            const dup = await client_1.prisma.downstream.findFirst({
                where: { downstreamType, id: { not: id }, status: 'active' },
            });
            if (dup)
                throw new AppError_1.ConflictError(`Downstream '${downstreamType}' already exists`);
        }
        data.downstreamType = downstreamType;
    }
    if (input.payoutRate !== undefined) {
        validatePayoutRate(input.payoutRate);
        data.payoutRate = input.payoutRate;
    }
    if (input.status !== undefined) {
        data.status = validateStatus(input.status);
    }
    const shouldSyncAdTypes = input.adTypeCodes !== undefined;
    const row = await client_1.prisma.$transaction(async (tx) => {
        if (shouldSyncAdTypes) {
            const codes = normalizeAdTypeCodes(input);
            const adTypes = await resolveAdTypesByCodes(codes, tx);
            await syncDownstreamAdTypes(id, adTypes.map(t => t.id), tx);
        }
        if (Object.keys(data).length) {
            try {
                await tx.downstream.update({ where: { id }, data });
            }
            catch (err) {
                if (err?.code === 'P2002') {
                    throw new AppError_1.ConflictError(`Downstream '${data.downstreamType ?? existing.downstreamType}' already exists`);
                }
                throw err;
            }
        }
        return tx.downstream.findUniqueOrThrow({ where: { id }, include: downstream_service_1.downstreamInclude });
    });
    return (0, mappers_1.mapDownstream)(row);
}
async function deleteDownstream(id) {
    if (!id || Number.isNaN(id))
        throw new AppError_1.BadRequestError('Invalid id');
    const existing = await client_1.prisma.downstream.findUnique({ where: { id } });
    if (!existing)
        throw new AppError_1.NotFoundError('Downstream not found');
    const [mediaIds, periods, dailyRates] = await Promise.all([
        client_1.prisma.adSiteDownstream.count({ where: { downstreamId: id } }),
        client_1.prisma.downstreamPeriod.count({ where: { downstreamId: id } }),
        client_1.prisma.dailyDownstreamRate.count({ where: { downstreamId: id } }),
    ]);
    if (mediaIds === 0 && periods === 0 && dailyRates === 0) {
        await client_1.prisma.downstream.delete({ where: { id } });
        return { mode: 'deleted', id };
    }
    await client_1.prisma.downstream.update({ where: { id }, data: { status: 'inactive' } });
    return { mode: 'deactivated', id, references: { mediaIds, periods, dailyRates } };
}
//# sourceMappingURL=downstream.write.service.js.map