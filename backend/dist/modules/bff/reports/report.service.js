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
function actualAdType(site) {
    return site.upstream?.defaultAdType ?? null;
}
function actualAdTypeWhere(adTypeId) {
    return {
        upstream: { defaultAdType: { id: adTypeId } },
    };
}
function makeReportAdvertiserRow(di) {
    const site = di.adSite;
    const upstream = site.upstream;
    const adType = actualAdType(site);
    const rate = (site.billingMethod === 'CPM' || site.billingMethod === 'CPA')
        ? toStr(di.unitPriceSnapshot ?? site.currentUnitPrice)
        : toStr(di.ratioSnapshot ?? site.currentRatio);
    let traffic = '';
    let settlement = '';
    if (site.billingMethod === 'CPM' || site.billingMethod === 'CPA') {
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
        adTypeName: adType?.name ?? '',
        adTypeCode: adType?.name ?? null,
        type: site.billingMethod,
        adId: site.name,
        adIdNum: site.id,
        rate,
        traffic,
        settlement,
        receivable: receivable || '',
        status: di.status,
        uiKey: `${di.id}-${site.id}`,
    };
}
async function getAdvertiserReport(params) {
    const { advertiserId, adTypeCode, status } = params;
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
    const statusFilter = {};
    if (status && status !== 'all') {
        statusFilter.status = status;
    }
    else {
        statusFilter.status = 'confirmed';
    }
    const upstreamWhere = {
        ...(advertiserId != null && { id: advertiserId }),
    };
    const dailyInputs = await client_1.prisma.dailyInput.findMany({
        where: {
            ...dateFilter,
            ...statusFilter,
            status: { not: 'quarantined' },
            adSite: {
                ...(adTypeCode && actualAdTypeWhere(adTypeCode)),
                upstream: {
                    ...upstreamWhere,
                },
            },
        },
        include: {
            adSite: {
                include: {
                    upstream: { include: { defaultAdType: true } },
                },
            },
        },
        orderBy: { recordDate: 'asc' },
    });
    return dailyInputs.map(di => makeReportAdvertiserRow(di));
}
function makeReportMediaRow(di, site, upstream, junction, payoutRate) {
    const adTypeCode = actualAdType(site)?.name ?? null;
    const adTypeName = actualAdType(site)?.name ?? null;
    const rate = site.billingMethod === 'CPM' || site.billingMethod === 'CPA'
        ? toStr(di.unitPriceSnapshot ?? site.currentUnitPrice)
        : toStr(di.ratioSnapshot ?? site.currentRatio);
    let traffic = '';
    let settlement = '';
    if (site.billingMethod === 'CPM' || site.billingMethod === 'CPA') {
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
        mediaAdTypeName: adTypeName ?? '',
        mediaAdTypeCode: adTypeCode,
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
        uiKey: `${di.id}-${junction.id}`,
    };
}
async function getMediaReport(params) {
    const { mediaId, adTypeCode, status } = params;
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
    const statusFilter = {};
    if (status && status !== 'all') {
        statusFilter.status = status;
    }
    else {
        statusFilter.status = 'confirmed';
    }
    const dailyInputs = await client_1.prisma.dailyInput.findMany({
        where: {
            ...dateFilter,
            ...statusFilter,
            status: { not: 'quarantined' },
            adSite: {
                downstreams: { some: {} },
                ...(mediaId != null && { upstreamId: mediaId }),
                ...(adTypeCode && actualAdTypeWhere(adTypeCode)),
            },
        },
        include: {
            adSite: {
                include: {
                    upstream: { include: { defaultAdType: true } },
                    downstreams: {
                        include: { downstream: true },
                    },
                },
            },
        },
        orderBy: { recordDate: 'asc' },
    });
    const rows = [];
    for (const di of dailyInputs) {
        const site = di.adSite;
        if (!site.downstreams || site.downstreams.length === 0)
            continue;
        for (const junction of site.downstreams) {
            const payoutRate = 0.8; // payoutRate moved to DownstreamPeriod; fixed default for now
            rows.push(makeReportMediaRow(di, site, site.upstream, junction, payoutRate));
        }
    }
    return rows;
}
//# sourceMappingURL=report.service.js.map