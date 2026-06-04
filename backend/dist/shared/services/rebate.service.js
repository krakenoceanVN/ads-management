"use strict";
/**
 * Rebate rate resolution service.
 *
 * Priority for CPM rebate:
 * 1. Active AdSiteRebateRate for the recordDate
 *    (startDate <= recordDate AND (endDate IS NULL OR endDate >= recordDate))
 *    Latest startDate wins when multiple match
 * 2. Fallback: AdSite.rebateRate (Float)
 * 3. None: returns null (no rebate)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveRebateRate = resolveRebateRate;
const client_1 = require("../../shared/prisma/client");
/**
 * Resolve the effective rebate rate for an AdSite on a given recordDate.
 */
async function resolveRebateRate(adSiteId, recordDate) {
    // 1. Check active AdSiteRebateRate
    const activeRates = await client_1.prisma.adSiteRebateRate.findMany({
        where: {
            adSiteId,
            startDate: { lte: recordDate },
            OR: [
                { endDate: null },
                { endDate: { gte: recordDate } },
            ],
        },
        orderBy: { startDate: 'desc' },
    });
    if (activeRates.length > 0) {
        // Latest startDate wins
        const resolved = toNum(activeRates[0].rate);
        if (resolved > 0) {
            return { rate: resolved, source: 'AdSiteRebateRate' };
        }
    }
    // 2. Fallback: AdSite.rebateRate
    const site = await client_1.prisma.adSite.findUnique({
        where: { id: adSiteId },
        select: { rebateRate: true },
    });
    if (site && site.rebateRate != null && site.rebateRate > 0) {
        return { rate: site.rebateRate, source: 'AdSite.rebateRate' };
    }
    return { rate: null, source: null };
}
function toNum(v) {
    if (v == null)
        return 0;
    if (typeof v === 'number')
        return v;
    return parseFloat(v.toString()) || 0;
}
//# sourceMappingURL=rebate.service.js.map