"use strict";
// Shared mappers: DB model → BFF frontend-facing types
// All mappers verified against frontend bffTypes.ts interfaces
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapAdvertiser = mapAdvertiser;
exports.mapMedia = mapMedia;
exports.mapAdId = mapAdId;
exports.mapMediaId = mapMediaId;
exports.mapDownstream = mapDownstream;
exports.mapMediaAdOrder = mapMediaAdOrder;
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
    const linkedAdTypes = (upstream.adTypeLinks ?? []).map(link => link.adType).filter(Boolean);
    const adTypes = linkedAdTypes.length ? linkedAdTypes : upstream.defaultAdType ? [upstream.defaultAdType] : [];
    const adTypeCodes = Array.from(new Set(adTypes.map(adType => adType.name)));
    return {
        id: upstream.id,
        name: upstream.name,
        contact: upstream.contact,
        phone: upstream.phone,
        email: upstream.email,
        notes: upstream.notes,
        status: upstream.status,
        adTypeCode: upstream.defaultAdType?.name ?? adTypeCodes[0],
        adTypeCodes,
        adTypes: adTypes.map(adType => ({ id: adType.id, name: adType.name })),
    };
}
function mapMedia(site) {
    const adType = site.upstream?.defaultAdType ?? null;
    return {
        id: site.id,
        name: site.name,
        contact: site.upstream?.contact ?? null,
        phone: site.upstream?.phone ?? null,
        email: site.upstream?.email ?? null,
        notes: null,
        status: site.status,
        upstreamId: site.upstreamId,
        adTypeCode: adType?.name,
        adTypeName: adType?.name ?? null,
        billingMethod: site.billingMethod,
        currentUnitPrice: decimalToNum(site.currentUnitPrice),
        currentRatio: decimalToNum(site.currentRatio),
    };
}
function mapAdId(site) {
    const adType = site.upstream?.defaultAdType ?? null;
    const rate = site.billingMethod === 'CPM' || site.billingMethod === 'CPA'
        ? decimalToNull(site.currentUnitPrice)
        : decimalToNull(site.currentRatio);
    return {
        id: site.id,
        slot: site.name,
        type: site.billingMethod,
        rate,
        notes: site.notes ?? null,
        status: site.status,
        advertiserId: site.upstreamId,
        advertiserName: site.upstream?.name ?? '',
        adTypeCode: adType?.name ?? '',
        adTypeName: adType?.name ?? null,
        upstreamId: site.upstreamId,
        billingMethod: site.billingMethod,
        isActive: site.isActive,
        isArchived: site.isArchived,
    };
}
function mapMediaId(j) {
    const adType = j.adSite.upstream?.defaultAdType ?? null;
    return {
        id: j.adSite.id,
        junctionId: j.id,
        slot: j.adSite.name,
        type: j.adSite.billingMethod,
        rate: decimalToNull(j.customPrice),
        shareRatio: j.pctHal ? Number(j.pctHal) : null,
        status: 'active',
        mediaId: j.adSite.id,
        mediaName: j.adSite.name,
        adTypeCode: adType?.name ?? '',
        adTypeName: adType?.name ?? null,
        upstreamId: j.adSite.upstreamId,
        upstreamName: j.adSite.upstream?.name ?? null,
        downstreamId: j.downstreamId,
        downstreamName: j.downstream?.downstreamType ?? null,
        adSiteId: j.adSiteId,
        adSiteName: j.adSite?.name ?? null,
        notes: j.notes ?? null,
        billingMethod: j.adSite.billingMethod,
        isActive: j.adSite.isActive,
        isArchived: j.adSite.isArchived,
        mediaAdTypeCode: j.mediaAdType?.name ?? null,
        mediaIdName: j.mediaIdName ?? null,
        pctHal: j.pctHal ? Number(j.pctHal) : null,
    };
}
function mapDownstream(d) {
    const linked = (d.adTypeLinks ?? []).map(l => l.adType).filter(Boolean);
    const adTypes = linked;
    const adTypeCodes = Array.from(new Set(adTypes.map(at => at.name)));
    const primary = adTypes[0];
    return {
        id: d.id,
        downstreamType: d.downstreamType,
        name: d.name ?? null,
        contact: d.contact ?? null,
        phone: d.phone ?? null,
        email: d.email ?? null,
        notes: d.notes ?? null,
        adTypeIds: adTypes.map(at => at.id),
        adTypeCodes,
        adTypes: adTypes.map(at => ({ id: at.id, name: at.name })),
        adTypeCode: primary?.name ?? '',
        adTypeName: primary?.name ?? null,
        payoutRate: null,
        status: d.status,
    };
}
function mapMediaAdOrder(row, linkCount = 0) {
    return {
        id: row.id,
        downstreamId: row.downstreamId,
        adTypeId: row.adTypeId,
        adTypeCode: row.adType?.name ?? '',
        adTypeName: row.adType?.name ?? null,
        seq: row.seq,
        name: row.name,
        notes: row.notes,
        status: row.status,
        linkCount,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
    };
}
//# sourceMappingURL=mappers.js.map