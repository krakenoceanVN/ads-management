"use strict";
// Shared mappers: DB model → BFF frontend-facing types
// All mappers verified against frontend bffTypes.ts interfaces
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapAdvertiser = mapAdvertiser;
exports.mapMedia = mapMedia;
exports.mapAdOrder = mapAdOrder;
exports.mapAdId = mapAdId;
exports.mapMediaId = mapMediaId;
exports.mapDownstream = mapDownstream;
function decimalToNum(d) {
    if (d == null)
        return undefined;
    const n = Number(d);
    return Number.isFinite(n) ? n : undefined;
}
function decimalToNull(d) {
    if (d == null)
        return null;
    const n = Number(d);
    return Number.isFinite(n) ? n : null;
}
function mapAdvertiser(upstream) {
    return {
        id: upstream.id,
        name: upstream.name,
        contact: upstream.contact,
        phone: upstream.phone,
        email: upstream.email,
        notes: upstream.notes,
        status: upstream.status,
        adTypeCode: upstream.adType?.code,
    };
}
function mapMedia(site) {
    return {
        id: site.id,
        name: site.name,
        contact: site.upstream?.contact ?? null,
        phone: site.upstream?.phone ?? null,
        email: site.upstream?.email ?? null,
        notes: null,
        status: site.status,
        upstreamId: site.upstreamId,
        adTypeCode: site.upstream?.adType?.code,
        billingMethod: site.billingMethod,
        currentUnitPrice: decimalToNum(site.currentUnitPrice),
        currentRatio: decimalToNum(site.currentRatio),
    };
}
function mapAdOrder(order) {
    return {
        id: order.id,
        advId: order.upstreamId,
        name: order.name,
        adTypeCode: order.adType?.code ?? '',
        notes: order.notes,
        status: order.status,
    };
}
function mapAdId(site) {
    // slot field — schema has no separate slot column; use adSite.name as slot identifier
    // rate — currentUnitPrice for CPM/CPA, currentRatio for RATIO
    const rate = site.billingMethod === 'CPM' || site.billingMethod === 'CPA'
        ? decimalToNull(site.currentUnitPrice)
        : decimalToNull(site.currentRatio);
    return {
        id: site.id,
        slot: site.name,
        type: site.billingMethod,
        rate,
        status: site.status,
        advertiserId: site.upstreamId,
        advertiserName: site.upstream?.name ?? '',
        adTypeCode: site.upstream?.adType?.code ?? '',
        adOrderId: site.adOrderId ?? null,
        upstreamId: site.upstreamId,
        billingMethod: site.billingMethod,
        isActive: site.isActive,
        isArchived: site.isArchived,
    };
}
function mapMediaId(j) {
    return {
        id: j.adSite.id,
        junctionId: j.id,
        slot: j.adSite.name,
        type: j.adSite.billingMethod,
        rate: decimalToNull(j.customPrice) ?? decimalToNull(j.downstream.payoutRate),
        shareRatio: decimalToNull(j.downstream.payoutRate),
        status: 'active', // AdSiteDownstream has no status column → default active
        mediaId: j.adSite.id,
        mediaName: j.adSite.name,
        adTypeCode: j.adSite.upstream?.adType?.code ?? '',
        upstreamId: j.adSite.upstreamId,
        billingMethod: j.adSite.billingMethod,
        isActive: j.adSite.isActive,
        isArchived: j.adSite.isArchived,
        adSiteId: j.adSiteId,
        downstreamId: j.downstreamId,
    };
}
function mapDownstream(d) {
    return {
        id: d.id,
        downstreamType: d.downstreamType,
        adTypeId: d.adTypeId,
        adTypeCode: d.adType?.code ?? '',
        payoutRate: Number(d.payoutRate),
        status: d.status,
    };
}
//# sourceMappingURL=mappers.js.map