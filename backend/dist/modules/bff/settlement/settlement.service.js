"use strict";
/**
 * Phase 4B1/4B2: Settlement Service
 *
 * Advertiser settlement:
 * - confirmed DailyInput only
 * - exclude quarantined
 * - amount = SUM(DailyInput.revenue)
 * - group by advertiser / upstream
 * - DailyInput.revenue is source of truth (no recalculation)
 * - No payout rate logic
 *
 * Media settlement (Phase 4B2):
 * - confirmed DailyInput only
 * - exclude quarantined
 * - one row per media (upstream); revenue counted ONCE per DailyInput
 * - cost = SUM(resolved downstream costs) for all active downstreams of that media
 * - grossProfit = revenue - cost
 * - tax = grossProfit > 0 ? grossProfit * 0.06 : 0
 * - profit = grossProfit - tax
 * - profitRate = profit / revenue
 * - Revenue always from DailyInput.revenue (no recalculation)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAdvertiserSettlement = getAdvertiserSettlement;
exports.getMediaSettlement = getMediaSettlement;
const client_1 = require("../../../shared/prisma/client");
const payout_service_1 = require("../../../shared/services/payout.service");
function actualAdType(site) {
    return site.adOrder?.adType ?? site.upstream.adType ?? null;
}
function actualAdTypeWhere(adTypeCode) {
    return {
        OR: [
            { adOrder: { adType: { code: adTypeCode } } },
            { adOrderId: null, upstream: { adType: { code: adTypeCode } } },
        ],
    };
}
async function getAdvertiserSettlement(params) {
    const { advertiserId, adTypeCode } = params;
    // Build period date filter (UTC, consistent with how recordDate is stored)
    let dateFilter = {};
    if (params.period) {
        const [year, month] = params.period.split('-').map(Number);
        const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
        const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
        dateFilter = { recordDate: { gte: start, lte: end } };
    }
    const upstreamWhere = {
        ...(advertiserId != null && { id: advertiserId }),
    };
    const dailyInputs = await client_1.prisma.dailyInput.findMany({
        where: {
            ...dateFilter,
            status: 'confirmed',
            adSite: {
                ...(adTypeCode && actualAdTypeWhere(adTypeCode)),
                upstream: { ...upstreamWhere },
            },
        },
        include: {
            adSite: {
                include: {
                    upstream: { include: { adType: true } },
                    adOrder: { include: { adType: true } },
                },
            },
        },
        orderBy: { recordDate: 'asc' },
    });
    const byAdvertiser = new Map();
    for (const di of dailyInputs) {
        const upstream = di.adSite.upstream;
        const adType = actualAdType(di.adSite);
        const code = adType?.code ?? null;
        const name = adType?.name ?? null;
        const key = `${upstream.id}|${code ?? ''}`;
        if (!byAdvertiser.has(key)) {
            byAdvertiser.set(key, {
                advertiserId: upstream.id,
                advertiser: upstream.name,
                adTypeCode: code,
                adTypeName: name,
                totalAmount: 0,
                recordCount: 0,
            });
        }
        const row = byAdvertiser.get(key);
        const rev = di.revenue ? parseFloat(di.revenue.toString()) || 0 : 0;
        row.totalAmount = Math.round((row.totalAmount + rev) * 100) / 100;
        row.recordCount += 1;
    }
    return Array.from(byAdvertiser.values()).sort((a, b) => a.advertiserId - b.advertiserId);
}
async function getMediaSettlement(params) {
    const { mediaId, adTypeCode } = params;
    // Build period date filter (UTC, consistent with how recordDate is stored)
    let dateFilter = {};
    if (params.period) {
        const [year, month] = params.period.split('-').map(Number);
        const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
        const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
        dateFilter = { recordDate: { gte: start, lte: end } };
    }
    const upstreamWhere = {
        ...(mediaId != null && { id: mediaId }),
    };
    // Only adSites that have at least one downstream junction
    const dailyInputs = await client_1.prisma.dailyInput.findMany({
        where: {
            ...dateFilter,
            status: 'confirmed',
            adSite: {
                ...(adTypeCode && actualAdTypeWhere(adTypeCode)),
                upstream: { ...upstreamWhere },
                downstreams: { some: {} },
            },
        },
        include: {
            adSite: {
                include: {
                    upstream: { include: { adType: true } },
                    adOrder: { include: { adType: true } },
                    downstreams: {
                        include: {
                            downstream: true,
                        },
                    },
                },
            },
        },
        orderBy: { recordDate: 'asc' },
    });
    const groups = new Map();
    for (const di of dailyInputs) {
        const upstream = di.adSite.upstream;
        const adType = actualAdType(di.adSite);
        const adTypeCode = adType?.code ?? null;
        const adTypeName = adType?.name ?? null;
        const key = `${upstream.id}|${adTypeCode ?? ''}`;
        if (!groups.has(key)) {
            groups.set(key, {
                mediaId: upstream.id,
                media: upstream.name,
                adTypeCode,
                adTypeName,
                downstreamNames: new Set(),
                revenueSum: 0,
                recordCount: 0,
                inputs: [],
            });
        }
        const g = groups.get(key);
        g.revenueSum += parseFloat(di.revenue.toString()) || 0;
        g.recordCount += 1;
        g.inputs.push(di);
        // Collect distinct downstream names for display
        for (const j of di.adSite.downstreams) {
            if (j.downstream?.downstreamType)
                g.downstreamNames.add(j.downstream.downstreamType);
        }
    }
    const rows = [];
    for (const g of groups.values()) {
        const { totalCost, errors } = await (0, payout_service_1.aggregateDownstreamCost)(g.inputs);
        if (errors.length > 0) {
            console.warn('Downstream cost errors for media settlement:', errors);
        }
        const profitRes = (0, payout_service_1.calculateProfit)(g.revenueSum, totalCost);
        const downstreamName = g.downstreamNames.size > 0
            ? Array.from(g.downstreamNames).sort().join(', ')
            : null;
        rows.push({
            mediaId: g.mediaId,
            media: g.media,
            adTypeCode: g.adTypeCode,
            adTypeName: g.adTypeName,
            downstreamName,
            revenue: profitRes.revenue,
            cost: profitRes.cost,
            grossProfit: profitRes.grossProfit,
            tax: profitRes.tax,
            profit: profitRes.profit,
            profitRate: profitRes.profitRate,
            recordCount: g.recordCount,
        });
    }
    return rows.sort((a, b) => {
        if (a.mediaId !== b.mediaId)
            return a.mediaId - b.mediaId;
        return (a.downstreamName ?? '').localeCompare(b.downstreamName ?? '');
    });
}
//# sourceMappingURL=settlement.service.js.map