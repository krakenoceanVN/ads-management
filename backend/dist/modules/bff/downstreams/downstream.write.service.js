"use strict";
/**
 * Downstream BFF Write Service
 * Handles create and update for Downstream (下游).
 * A downstream is a payout channel (ML | LE | YIYI) attached to an AdType.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDownstream = createDownstream;
exports.updateDownstream = updateDownstream;
exports.deleteDownstream = deleteDownstream;
const client_1 = require("../../../shared/prisma/client");
const mappers_1 = require("../mappers");
const AppError_1 = require("../../../shared/errors/AppError");
// downstreamType is free-form (new types like LS/LI can be added without a code
// change); ML/LE/YIYI are just UI suggestions on the frontend.
const ALLOWED_STATUSES = ['active', 'inactive'];
function normalizeType(raw) {
    const value = raw?.trim().toUpperCase();
    if (!value)
        throw new AppError_1.BadRequestError('downstreamType is required');
    // Free-form code (so new types can be added without a code change) — but kept
    // to a clean, normalized shape to avoid typos like trailing spaces.
    if (!/^[A-Z0-9_]{1,20}$/.test(value)) {
        throw new AppError_1.BadRequestError('downstreamType must be 1–20 chars: A–Z, 0–9, _ only');
    }
    return value;
}
function validatePayoutRate(rate) {
    if (typeof rate !== 'number' || Number.isNaN(rate)) {
        throw new AppError_1.BadRequestError('payoutRate must be a number');
    }
    // Rate is a ratio, not capped at 1 — real data has rates above 100% (e.g. 1.45).
    // Only guard against negatives and absurd typos.
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
async function loadWithAdType(id) {
    const row = await client_1.prisma.downstream.findUnique({ where: { id }, include: { adType: true } });
    if (!row)
        throw new AppError_1.NotFoundError('Downstream not found');
    return (0, mappers_1.mapDownstream)(row);
}
async function createDownstream(input) {
    const adTypeId = Number(input.adTypeId);
    if (!adTypeId || Number.isNaN(adTypeId))
        throw new AppError_1.BadRequestError('adTypeId is required');
    const adType = await client_1.prisma.adType.findUnique({ where: { id: adTypeId } });
    if (!adType)
        throw new AppError_1.BadRequestError(`AdType with id '${adTypeId}' does not exist`);
    const downstreamType = normalizeType(input.downstreamType);
    const payoutRate = input.payoutRate ?? 0.8;
    validatePayoutRate(payoutRate);
    const status = validateStatus(input.status ?? 'active');
    // One downstreamType per AdType
    const existing = await client_1.prisma.downstream.findFirst({ where: { adTypeId, downstreamType } });
    if (existing) {
        throw new AppError_1.ConflictError(`Downstream '${downstreamType}' already exists for this ad type`);
    }
    const created = await client_1.prisma.downstream.create({
        data: { adTypeId, downstreamType, payoutRate, status },
        include: { adType: true },
    });
    return (0, mappers_1.mapDownstream)(created);
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
            const duplicate = await client_1.prisma.downstream.findFirst({
                where: { adTypeId: existing.adTypeId, downstreamType, id: { not: id } },
            });
            if (duplicate) {
                throw new AppError_1.ConflictError(`Downstream '${downstreamType}' already exists for this ad type`);
            }
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
    await client_1.prisma.downstream.update({ where: { id }, data });
    return loadWithAdType(id);
}
async function deleteDownstream(id) {
    if (!id || Number.isNaN(id))
        throw new AppError_1.BadRequestError('Invalid id');
    const existing = await client_1.prisma.downstream.findUnique({ where: { id } });
    if (!existing)
        throw new AppError_1.NotFoundError('Downstream not found');
    // Count every relation that carries operational/financial meaning.
    const [mediaIds, periods, dailyRates] = await Promise.all([
        client_1.prisma.adSiteDownstream.count({ where: { downstreamId: id } }),
        client_1.prisma.downstreamPeriod.count({ where: { downstreamId: id } }),
        client_1.prisma.dailyDownstreamRate.count({ where: { downstreamId: id } }),
    ]);
    // Only hard-delete when the downstream is completely unused; otherwise soft-delete
    // (set inactive) so historical reporting/settlement data stays intact.
    if (mediaIds === 0 && periods === 0 && dailyRates === 0) {
        await client_1.prisma.downstream.delete({ where: { id } });
        return { mode: 'deleted', id };
    }
    await client_1.prisma.downstream.update({ where: { id }, data: { status: 'inactive' } });
    return { mode: 'deactivated', id, references: { mediaIds, periods, dailyRates } };
}
//# sourceMappingURL=downstream.write.service.js.map