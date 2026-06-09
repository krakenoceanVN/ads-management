"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listAdvertiserEntries = listAdvertiserEntries;
exports.listMediaEntries = listMediaEntries;
const client_1 = require("../../../shared/prisma/client");
// Map Prisma.Decimal to Number, returning undefined for null
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
// Load all AdIds for advertiser-side data entry, with optional filters
async function listAdvertiserEntries(params) {
    const { date, advertiserId, adTypeCode, status } = params;
    // Normalize date to YYYY-MM-DD
    const d = new Date(date);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const recordDate = new Date(dateStr);
    // Build AdSite filter
    const siteWhere = {
        isArchived: false,
        ...(advertiserId != null && { upstreamId: advertiserId }),
        ...(adTypeCode && actualAdTypeWhere(adTypeCode)),
    };
    // Load all candidate AdSites for the filter
    const adSites = await client_1.prisma.adSite.findMany({
        where: siteWhere,
        include: {
            upstream: { include: { adType: true } },
            adOrder: { include: { adType: true } },
        },
        orderBy: { id: 'asc' },
    });
    // Load all DailyInput records for this date
    const dailyInputs = await client_1.prisma.dailyInput.findMany({
        where: {
            recordDate,
            ...(status && status !== 'all' && status !== 'unconfirmed' && { status }),
        },
    });
    const diBySiteId = new Map(dailyInputs.map(di => [di.adSiteId, di]));
    // Build result rows
    const rows = adSites.map(site => {
        const di = diBySiteId.get(site.id);
        if (!di) {
            // No DailyInput record for this adSite on this date
            return makeAdvertiserRow(site, recordDate, null);
        }
        // Skip quarantined unless explicitly filtered
        if (di.status === 'quarantined' && status !== 'quarantined') {
            return null;
        }
        return makeAdvertiserRow(site, recordDate, di);
    }).filter((r) => r !== null);
    return rows;
}
function makeAdvertiserRow(site, recordDate, di) {
    const upstream = site.upstream;
    const adOrder = site.adOrder;
    const adType = actualAdType(site);
    // Rate: CPM and CPA use unitPriceSnapshot;
    // RATIO and CPS use ratioSnapshot
    const rate = (site.billingMethod === 'CPM' || site.billingMethod === 'CPA')
        ? toStr(di?.unitPriceSnapshot ?? site.currentUnitPrice)
        : toStr(di?.ratioSnapshot ?? site.currentRatio);
    // Traffic: CPM qty, RATIO amount1, CPA amount2
    let traffic = '';
    let settlement = '';
    if (di) {
        if (site.billingMethod === 'CPM' || site.billingMethod === 'CPA') {
            traffic = String(di.qty);
        }
        else {
            traffic = toStr(di.amount1);
            settlement = toStr(di.amount2);
        }
    }
    const receivable = di ? toNum(di.revenue) ?? 0 : 0;
    return {
        id: di?.id ?? 0,
        date: formatDate(recordDate),
        advertiser: upstream.name,
        advertiserId: upstream.id,
        adOrder: adOrder?.name ?? '',
        adOrderId: site.adOrderId ?? null,
        adOrderCode: adType?.code ?? null,
        adOrderName: adType?.name ?? null,
        type: site.billingMethod,
        adId: site.name, // slot = AdSite.name (real schema has no slot field)
        adIdNum: site.id,
        rate,
        traffic,
        settlement,
        receivable: receivable || '',
        status: di?.status ?? 'pending',
    };
}
// Load all MediaIds for media-side data entry, with optional filters
async function listMediaEntries(params) {
    const { date, mediaId, adTypeCode, status } = params;
    const dateStr = `${params.date}`.slice(0, 10);
    const recordDate = new Date(dateStr + 'T00:00:00.000Z');
    // Build AdSite filter for media-side
    const siteWhere = {
        isArchived: false,
        ...(mediaId != null && { id: mediaId }),
        ...(adTypeCode && actualAdTypeWhere(adTypeCode)),
        // Only include sites that have JUNCTIONS (MediaIds) — we need MediaId rows
        downstreams: { some: {} },
    };
    const adSites = await client_1.prisma.adSite.findMany({
        where: siteWhere,
        include: {
            upstream: { include: { adType: true } },
            adOrder: { include: { adType: true } },
            downstreams: {
                include: { downstream: true },
                orderBy: { id: 'asc' },
            },
        },
        orderBy: { id: 'asc' },
    });
    // Load DailyInput for this date across all these adSites
    const siteIds = adSites.map(s => s.id);
    const dailyInputs = await client_1.prisma.dailyInput.findMany({
        where: {
            recordDate,
            adSiteId: { in: siteIds },
            ...(status && status !== 'all' && status !== 'unconfirmed' && { status }),
        },
    });
    const diBySiteId = new Map(dailyInputs.map(di => [di.adSiteId, di]));
    // Load DownstreamPeriod for payout rates
    const downstreamIds = adSites.flatMap(s => s.downstreams.map(d => d.downstreamId));
    const periods = await client_1.prisma.downstreamPeriod.findMany({
        where: {
            downstreamId: { in: downstreamIds },
            startDate: { lte: recordDate },
            OR: [{ endDate: null }, { endDate: { gte: recordDate } }],
        },
        orderBy: { startDate: 'desc' },
    });
    const rateByDownstreamId = new Map(periods.map(p => [p.downstreamId, toNum(p.unitPrice) ?? 0]));
    const rows = [];
    for (const site of adSites) {
        for (const junction of site.downstreams) {
            const di = diBySiteId.get(site.id) ?? null;
            if (!di && status && status !== 'all')
                continue; // skip non-existing if status filter active
            if (di?.status === 'quarantined' && status !== 'quarantined')
                continue;
            const payoutRate = rateByDownstreamId.get(junction.downstreamId) ?? toNum(junction.downstream.payoutRate) ?? 0.8;
            const row = makeMediaRow(site, junction, payoutRate, recordDate, di);
            rows.push(row);
        }
    }
    return rows;
}
function makeMediaRow(site, junction, payoutRate, recordDate, di) {
    const upstream = site.upstream;
    const adTypeCode = actualAdType(site)?.code ?? null;
    const adTypeName = actualAdType(site)?.name ?? null;
    // Rate: CPM/CPA use unitPriceSnapshot or currentUnitPrice, RATIO uses currentRatio
    const rate = site.billingMethod === 'CPM' || site.billingMethod === 'CPA'
        ? toStr(di?.unitPriceSnapshot ?? site.currentUnitPrice)
        : toStr(di?.ratioSnapshot ?? site.currentRatio);
    let traffic = '';
    let settlement = '';
    if (di) {
        if (site.billingMethod === 'CPM' || site.billingMethod === 'CPA') {
            traffic = String(di.qty);
        }
        else {
            traffic = toStr(di.amount1);
            settlement = toStr(di.amount2);
        }
    }
    // receivable is the full revenue from DailyInput
    const receivable = di ? toNum(di.revenue) ?? 0 : 0;
    // shareRatio = payoutRate from Downstream/period
    const shareRatioNum = payoutRate;
    const shareRatio = shareRatioNum === 1 ? '1' : String(shareRatioNum);
    // actualReceived = revenue * shareRatio
    const actualReceived = receivable && shareRatioNum
        ? Number((receivable * shareRatioNum).toFixed(3))
        : null;
    return {
        id: di?.id ?? 0,
        date: formatDate(recordDate),
        media: upstream.name,
        mediaId: upstream.id,
        mediaAdOrder: adTypeCode ?? '',
        mediaAdOrderId: null,
        mediaAdOrderCode: adTypeCode,
        mediaAdOrderName: adTypeName,
        type: site.billingMethod,
        mediaIdStr: site.name, // slot = AdSite.name (no slot column in schema)
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
        status: di?.status ?? 'pending',
    };
}
function formatDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
//# sourceMappingURL=dataEntry.service.js.map