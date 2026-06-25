"use strict";
/**
 * Phase 3B/3C: Advertiser Data Entry Write Service
 * Handles save batch, confirm batch, unconfirm single.
 *
 * CPM rebate:
 *   baseRevenue = qty * unitPrice / 1000
 *   if rebateRate exists: revenue = baseRevenue - (qty * rebateRate)
 *   else: revenue = baseRevenue
 *
 * Rebate source priority:
 *   1. Active AdSiteRebateRate (startDate <= recordDate <= endDate or endDate=null)
 *      latest startDate wins
 *   2. AdSite.rebateRate (Float)
 *   3. No rebate
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveAdvertiserBatch = saveAdvertiserBatch;
exports.confirmAdvertiserBatch = confirmAdvertiserBatch;
exports.unconfirmAdvertiser = unconfirmAdvertiser;
const client_1 = require("@prisma/client");
const client_2 = require("../../../shared/prisma/client");
const revenue_service_1 = require("../../../shared/services/revenue.service");
const rebate_service_1 = require("../../../shared/services/rebate.service");
function validateAdvertiserBatchItem(item, billingMethod) {
    if (billingMethod === 'CPM' || billingMethod === 'CPA') {
        if (!Object.prototype.hasOwnProperty.call(item, 'qty') || item.qty === undefined || item.qty === null) {
            throw new Error(`${billingMethod}: qty is required`);
        }
        const qty = Number(item.qty);
        if (isNaN(qty))
            throw new Error(`${billingMethod}: qty must be numeric`);
        if (qty < 0)
            throw new Error(`${billingMethod}: qty must be >= 0`);
    }
    else if (billingMethod === 'CPS') {
        const hasA1 = Object.prototype.hasOwnProperty.call(item, 'amount1') && item.amount1 !== undefined && item.amount1 !== null && String(item.amount1).trim() !== '';
        const hasA2 = Object.prototype.hasOwnProperty.call(item, 'amount2') && item.amount2 !== undefined && item.amount2 !== null && String(item.amount2).trim() !== '';
        const hasRatio = Object.prototype.hasOwnProperty.call(item, 'ratio') && item.ratio !== undefined && item.ratio !== null && String(item.ratio).trim() !== '';
        if (!hasA1)
            throw new Error(`${billingMethod}: amount1 is required`);
        if (!hasA2)
            throw new Error(`${billingMethod}: amount2 is required`);
        if (!hasRatio)
            throw new Error(`${billingMethod}: ratio is required`);
        const a1 = Number(item.amount1);
        const a2 = Number(item.amount2);
        const r = Number(item.ratio);
        if (isNaN(a1) || isNaN(a2))
            throw new Error(`${billingMethod}: amount1 and amount2 must be numeric`);
        if (isNaN(r))
            throw new Error(`${billingMethod}: ratio must be numeric`);
        if (r <= 0)
            throw new Error(`${billingMethod}: ratio must be > 0`);
    }
}
async function saveAdvertiserBatch(items, userId) {
    const result = { success: true, saved: 0, updated: 0, skipped: 0, errors: [] };
    const siteIds = [...new Set(items.map(i => String(i.adSiteId)))];
    const sites = await client_2.prisma.adSite.findMany({
        where: { id: { in: siteIds } },
        include: { upstream: { include: { defaultAdType: true } } },
    });
    const siteById = new Map(sites.map(s => [s.id, s]));
    for (const item of items) {
        try {
            const site = siteById.get(item.adSiteId);
            if (!site) {
                result.skipped++;
                result.errors.push(`AdSite ${item.adSiteId} not found`);
                continue;
            }
            const recordDate = new Date(item.recordDate + 'T00:00:00.000Z');
            const billingMethod = site.billingMethod;
            validateAdvertiserBatchItem(item, billingMethod);
            // Fall back to AdSite configured rate when input is empty
            const currentUP = site.currentUnitPrice != null ? Number(site.currentUnitPrice) : 0;
            const currentRatio = site.currentRatio != null ? Number(site.currentRatio) : 0;
            const resolvedUnitPrice = item.unitPrice != null && String(item.unitPrice).trim() !== ''
                ? item.unitPrice
                : currentUP;
            const resolvedRatio = item.ratio != null && String(item.ratio).trim() !== ''
                ? item.ratio
                : currentRatio;
            // Resolve rebate rate for CPM
            let rebateRate = null;
            if (billingMethod === 'CPM') {
                const rebate = await (0, rebate_service_1.resolveRebateRate)(item.adSiteId, recordDate);
                rebateRate = rebate.rate;
            }
            const revenuePayload = (0, revenue_service_1.buildRevenuePayload)({
                billingMethod,
                qty: item.qty,
                unitPrice: resolvedUnitPrice,
                amount1: item.amount1,
                amount2: item.amount2,
                ratio: resolvedRatio,
                rebateRate,
            });
            const existing = await client_2.prisma.dailyInput.findUnique({
                where: { recordDate_adSiteId: { recordDate, adSiteId: item.adSiteId } },
            });
            if (existing) {
                if (existing.status === 'confirmed') {
                    result.skipped++;
                    result.errors.push(`AdSite ${item.adSiteId} on ${item.recordDate}: confirmed record cannot be edited`);
                    continue;
                }
                if (existing.status === 'quarantined') {
                    result.skipped++;
                    result.errors.push(`AdSite ${item.adSiteId} on ${item.recordDate}: quarantined record cannot be edited`);
                    continue;
                }
                await client_2.prisma.dailyInput.update({
                    where: { id: existing.id },
                    data: {
                        qty: item.qty ?? 0,
                        unitPriceSnapshot: item.unitPrice != null && String(item.unitPrice).trim() !== '' ? new client_1.Prisma.Decimal(String(item.unitPrice)) : new client_1.Prisma.Decimal(String(site.currentUnitPrice ?? 0)),
                        amount1: item.amount1 != null ? new client_1.Prisma.Decimal(String(item.amount1)) : undefined,
                        amount2: item.amount2 != null ? new client_1.Prisma.Decimal(String(item.amount2)) : undefined,
                        ratioSnapshot: item.ratio != null && String(item.ratio).trim() !== '' ? new client_1.Prisma.Decimal(String(item.ratio)) : new client_1.Prisma.Decimal(String(site.currentRatio ?? 0)),
                        rebateRateSnapshot: rebateRate != null ? new client_1.Prisma.Decimal(rebateRate) : new client_1.Prisma.Decimal(0),
                        revenue: new client_1.Prisma.Decimal(revenuePayload.toFixed(6)),
                        note: item.note ?? null,
                    },
                });
                result.updated++;
            }
            else {
                await client_2.prisma.dailyInput.create({
                    data: {
                        id: `di_${item.adSiteId}_${item.recordDate.replace(/-/g, '')}`,
                        recordDate,
                        adSiteId: item.adSiteId,
                        qty: item.qty ?? 0,
                        unitPriceSnapshot: item.unitPrice != null && String(item.unitPrice).trim() !== '' ? new client_1.Prisma.Decimal(String(item.unitPrice)) : new client_1.Prisma.Decimal(String(site.currentUnitPrice ?? 0)),
                        amount1: item.amount1 != null ? new client_1.Prisma.Decimal(String(item.amount1)) : undefined,
                        amount2: item.amount2 != null ? new client_1.Prisma.Decimal(String(item.amount2)) : undefined,
                        ratioSnapshot: item.ratio != null && String(item.ratio).trim() !== '' ? new client_1.Prisma.Decimal(String(item.ratio)) : new client_1.Prisma.Decimal(String(site.currentRatio ?? 0)),
                        rebateRateSnapshot: rebateRate != null ? new client_1.Prisma.Decimal(rebateRate) : new client_1.Prisma.Decimal(0),
                        revenue: new client_1.Prisma.Decimal(revenuePayload.toFixed(6)),
                        note: item.note ?? null,
                        createdBy: userId,
                        status: 'unconfirmed',
                    },
                });
                result.saved++;
            }
        }
        catch (err) {
            result.errors.push(`AdSite ${item.adSiteId}: ${err.message}`);
        }
    }
    return result;
}
async function confirmAdvertiserBatch(recordDate, adSiteIds, userId) {
    const date = new Date(recordDate + 'T00:00:00.000Z');
    const result = { success: true, confirmed: 0, errors: [] };
    return client_2.prisma.$transaction(async (tx) => {
        const records = await tx.dailyInput.findMany({
            where: {
                recordDate: date,
                adSiteId: { in: adSiteIds },
                status: 'unconfirmed',
            },
        });
        if (records.length === 0) {
            return result;
        }
        const ids = records.map(r => r.id);
        await tx.dailyInput.updateMany({
            where: { id: { in: ids } },
            data: { status: 'confirmed' },
        });
        await tx.operationLog.create({
            data: {
                id: `opl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                userId: userId || null,
                username: null,
                action: 'CONFIRM_ADVERTISER',
                module: 'dataEntry',
                targetType: 'DailyInput',
                targetId: ids.join(','),
                detail: `Confirmed ${ids.length} advertiser records on ${recordDate} for adSiteIds=${adSiteIds.join(',')}`,
            },
        });
        result.confirmed = ids.length;
        return result;
    });
}
async function unconfirmAdvertiser(id, userId) {
    return client_2.prisma.$transaction(async (tx) => {
        const record = await tx.dailyInput.findUnique({ where: { id } });
        if (!record) {
            throw new Error('Record not found');
        }
        if (record.status !== 'confirmed') {
            throw new Error(`Cannot unconfirm: record status is '${record.status}', must be 'confirmed'`);
        }
        const updated = await tx.dailyInput.update({
            where: { id },
            data: { status: 'unconfirmed' },
        });
        await tx.operationLog.create({
            data: {
                id: `opl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                userId: userId || null,
                username: null,
                action: 'UNCONFIRM_ADVERTISER',
                module: 'dataEntry',
                targetType: 'DailyInput',
                targetId: String(id),
                detail: `Unconfirmed advertiser record id=${id}`,
            },
        });
        return {
            success: true,
            id: updated.id,
            previousStatus: 'confirmed',
            newStatus: updated.status,
        };
    });
}
//# sourceMappingURL=advertiserBatch.service.js.map