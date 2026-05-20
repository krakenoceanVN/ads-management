/**
 * BFF MediaId Mapper
 * MediaId maps to AdSite + Downstream (supply side ad slot)
 * 
 * Rules:
 * - ID-based lookup preferred
 * - CPM only (CPA/CPS = 400 error)
 * - shareRatio from Downstream.payoutRate (NOT rebateRate)
 * - dataCoefficient NOT mapped to rebateRate (different concepts)
 * - MediaId lookup includes downstream payoutRate as shareRatio
 */

export interface BFFMediaId {
    id: number;
    slot: string;              // AdSite.name
    type: 'CPM' | 'RATIO';
    rate: number | null;       // currentUnitPrice (CPM) or currentRatio (RATIO)
    shareRatio: number | null; // From Downstream.payoutRate via AdSiteDownstream
    status: 'active' | 'inactive';
    mediaId: number;           // advertiser (upstream) id
    mediaName: string;         // upstream name
    adTypeCode: string;
    // AdSite metadata
    upstreamId: number;
    billingMethod: string;
    isActive: boolean;
    isArchived: boolean;
}

export interface CreateMediaIdRequest {
    slot: string;              // REQUIRED - maps to AdSite.name
    type: 'CPM' | 'RATIO';     // REQUIRED - CPM only, RATIO allowed
    rate: number;              // REQUIRED - currentUnitPrice or currentRatio
    shareRatio: number;        // REQUIRED - downstream payoutRate
    mediaId: number;           // REQUIRED - upstreamId
    downstreamId?: number;      // Optional - if provided, links to specific downstream
    notes?: string;
}

export interface UpdateMediaIdRequest {
    slot?: string;
    type?: 'CPM' | 'RATIO';
    rate?: number;
    shareRatio?: number;
    notes?: string;
}

// Prisma generated type for AdSite with downstream include
export interface AdSiteDownstreamWithDownstream {
    id: number;
    adSiteId: number;
    downstreamId: number;
    customPrice: any;
    downstream: {
        id: number;
        adTypeId: number;
        downstreamType: string;
        payoutRate: any;
        status: string;
        name?: string; // Some Prisma versions include this
    };
}

export interface AdSiteWithUpstreamAndDownstream {
    id: number;
    name: string;
    status: string;
    upstreamId: number;
    billingMethod: string;
    currentUnitPrice: any;
    currentRatio: any;
    isActive: boolean;
    isArchived: boolean;
    upstream: {
        id: number;
        name: string;
        status: string;
        adType: {
            id: number;
            code: string;
            name: string;
        };
    };
    downstreams: AdSiteDownstreamWithDownstream[];
}

/**
 * Maps AdSite with downstream to BFFMediaId
 * shareRatio comes from Downstream.payoutRate via AdSiteDownstream
 */
export function mapAdSiteWithDownstreamToMediaId(adSite: AdSiteWithUpstreamAndDownstream): BFFMediaId {
    // Get first downstream's payoutRate as shareRatio
    const primaryDownstream = adSite.downstreams?.[0];
    const shareRatio = primaryDownstream?.downstream?.payoutRate
        ? Number(primaryDownstream.downstream.payoutRate)
        : null;

    return {
        id: adSite.id,
        slot: adSite.name,
        type: adSite.billingMethod as 'CPM' | 'RATIO',
        rate: adSite.billingMethod === 'CPM'
            ? (adSite.currentUnitPrice ? Number(adSite.currentUnitPrice) : null)
            : (adSite.currentRatio ? Number(adSite.currentRatio) : null),
        shareRatio,
        status: adSite.status as 'active' | 'inactive',
        mediaId: adSite.upstreamId,
        mediaName: adSite.upstream.name,
        adTypeCode: adSite.upstream.adType.code,
        upstreamId: adSite.upstreamId,
        billingMethod: adSite.billingMethod,
        isActive: adSite.isActive,
        isArchived: adSite.isArchived,
    };
}

/**
 * Maps array of AdSite to MediaId[]
 */
export function mapAdSitesToMediaIds(adSites: AdSiteWithUpstreamAndDownstream[]): BFFMediaId[] {
    return adSites.map(mapAdSiteWithDownstreamToMediaId);
}