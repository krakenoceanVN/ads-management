"use strict";
/**
 * Phase 4A: Reports Read Service
 *
 * - advertiser report: entry-level per-DailyInput rows (not grouped), using stored DailyInput.revenue
 * - media report: grouped by media, using stored DailyInput.revenue
 *
 * Rules:
 * - Uses stored DailyInput.revenue as source of truth (no recalculation)
 * - Excludes quarantined records
 * - Includes confirmed records by default
 * - Does not hide inactive advertisers with confirmed historical data
 * - Does not hide archived media with confirmed historical data
 * - No DailyInput writes
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAdvertiserReport = getAdvertiserReport;
exports.getMediaReport = getMediaReport;
const client_1 = require("../../../shared/prisma/client");
// ─── Advertiser Report (entry-level rows) ────────────────────────────────────
function toNum(d) {
    if (d == null)
        return undefined;
    return d.toNumber();
}
function toStr(d) {
    if (d == null)
        return '';
    return d.toString();
}
function formatDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function makeReportAdvertiserRow(di) {
    const site = di.adSite;
    const upstream = site.upstream;
    const adOrder = site.adOrder;
    const adType = adOrder?.adType;
    // Rate: CPM/CPA use unitPriceSnapshot; RATIO/CPS use ratioSnapshot
    const rate = (site.billingMethod === 'CPM' || site.billingMethod === 'CPA')
        ? toStr(di.unitPriceSnapshot ?? site.currentUnitPrice)
        : toStr(di.ratioSnapshot ?? site.currentRatio);
    // Traffic and settlement
    let traffic = '';
    let settlement = '';
    if (site.billingMethod === 'CPM') {
        traffic = String(di.qty);
    }
    else {
        traffic = toStr(di.amount1);
        settlement = toStr(di.amount2);
    }
    const receivable = toNum(di.revenue) ?? 0;
    return {
        id: di.id,
        date: formatDate(di.recordDate),
        advertiser: upstream.name,
        advertiserId: upstream.id,
        adOrder: adOrder?.name ?? '',
        adOrderId: site.adOrderId ?? null,
        adOrderCode: adType?.code ?? null,
        type: site.billingMethod,
        adId: site.name,
        adIdNum: site.id,
        rate,
        traffic,
        settlement,
        receivable: receivable || '',
        status: di.status,
    };
}
async function getAdvertiserReport(params) {
    const { advertiserId, adTypeCode, status } = params;
    // Build date filter
    let dateFilter = {};
    if (params.date) {
        const d = new Date(params.date + 'T00:00:00.000Z');
        dateFilter = { recordDate: d };
    }
    else if (params.startDate && params.endDate) {
        const start = new Date(params.startDate + 'T00:00:00.000Z');
        const end = new Date(params.endDate + 'T00:00:00.000Z');
        dateFilter = { recordDate: { gte: start, lte: end } };
    }
    // Build status filter — exclude quarantined always
    const statusFilter = {};
    if (status && status !== 'all') {
        statusFilter.status = status;
    }
    else {
        // Default: confirmed only (exclude quarantined and pending)
        statusFilter.status = 'confirmed';
    }
    // Build upstream filter for advertiser report
    const upstreamWhere = {
        ...(advertiserId != null && { id: advertiserId }),
        ...(adTypeCode && { adType: { code: adTypeCode } }),
    };
    // Get all DailyInputs matching filters — return entry-level rows (not grouped)
    const dailyInputs = await client_1.prisma.dailyInput.findMany({
        where: {
            ...dateFilter,
            ...statusFilter,
            status: { not: 'quarantined' },
            // Only ad sites that belong to advertiser-type upstreams
            adSite: {
                upstream: {
                    ...upstreamWhere,
                },
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
    return dailyInputs.map(di => makeReportAdvertiserRow(di));
}
// ─── Media Report (entry-level rows) ────────────────────────────────────────
function makeReportMediaRow(di, site, upstream, junction, payoutRate) {
    const adTypeCode = upstream.adType?.code ?? null;
    // Rate: CPM uses unitPriceSnapshot or currentUnitPrice, RATIO uses currentRatio
    const rate = site.billingMethod === 'CPM'
        ? toStr(di.unitPriceSnapshot ?? site.currentUnitPrice)
        : toStr(di.ratioSnapshot ?? site.currentRatio);
    let traffic = '';
    let settlement = '';
    if (site.billingMethod === 'CPM') {
        traffic = String(di.qty);
    }
    else {
        traffic = toStr(di.amount1);
        settlement = toStr(di.amount2);
    }
    const receivable = toNum(di.revenue) ?? 0;
    const shareRatioNum = payoutRate;
    const shareRatio = shareRatioNum === 1 ? '1' : String(shareRatioNum);
    const actualReceived = receivable && shareRatioNum
        ? Number((receivable * shareRatioNum).toFixed(3))
        : null;
    return {
        id: di.id,
        date: formatDate(di.recordDate),
        media: upstream.name,
        mediaId: upstream.id,
        mediaAdOrder: adTypeCode ?? '',
        mediaAdOrderId: null,
        mediaAdOrderCode: adTypeCode,
        type: site.billingMethod,
        mediaIdStr: site.name,
        upstreamAdId: site.name,
        upstreamAdIdNum: site.id,
        rate,
        traffic,
        settlement,
        dataCoefficient: '',
        receivable: receivable || '',
        shareRatio,
        shareRatioNum,
        actualReceived,
        status: di.status,
    };
}
async function getMediaReport(params) {
    const { mediaId, adTypeCode, status } = params;
    // Build date filter
    let dateFilter = {};
    if (params.date) {
        const d = new Date(params.date + 'T00:00:00.000Z');
        dateFilter = { recordDate: d };
    }
    else if (params.startDate && params.endDate) {
        const start = new Date(params.startDate + 'T00:00:00.000Z');
        const end = new Date(params.endDate + 'T00:00:00.000Z');
        dateFilter = { recordDate: { gte: start, lte: end } };
    }
    // Build status filter — exclude quarantined always, default confirmed
    const statusFilter = {};
    if (status && status !== 'all') {
        statusFilter.status = status;
    }
    else {
        statusFilter.status = 'confirmed';
    }
    // Get all confirmed DailyInputs (excluding quarantined) for media-side
    const dailyInputs = await client_1.prisma.dailyInput.findMany({
        where: {
            ...dateFilter,
            ...statusFilter,
            status: { not: 'quarantined' },
            adSite: {
                downstreams: { some: {} },
                ...(mediaId != null && { upstreamId: mediaId }),
                ...(adTypeCode && { upstream: { adType: { code: adTypeCode } } }),
            },
        },
        include: {
            adSite: {
                include: {
                    upstream: { include: { adType: true } },
                    downstreams: {
                        include: { downstream: true },
                    },
                },
            },
        },
        orderBy: { recordDate: 'asc' },
    });
    // Return entry-level rows — one row per DailyInput per downstream junction
    const rows = [];
    for (const di of dailyInputs) {
        const site = di.adSite;
        if (!site.downstreams || site.downstreams.length === 0)
            continue;
        for (const junction of site.downstreams) {
            const payoutRate = junction.downstream?.payoutRate ? Number(junction.downstream.payoutRate) : 0.8;
            rows.push(makeReportMediaRow(di, site, site.upstream, junction, payoutRate));
        }
    }
    return rows;
}
//# sourceMappingURL=report.service.js.map