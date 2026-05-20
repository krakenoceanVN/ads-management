/**
 * BFF AdId Mapper
 * AdId maps to AdSite (demand side ad slot)
 * 
 * Rules:
 * - ID-based lookup preferred
 * - CPM only (CPA/CPS = 400 error)
 * - shareRatio NOT mapped to rebateRate (different concepts)
 * - dataCoefficient NOT mapped to rebateRate (different concepts)
 */

export interface BFFAdId {
    id: number;
    slot: string;          // AdSite.name
    type: 'CPM' | 'RATIO';
    rate: number | null;   // currentUnitPrice (CPM) or currentRatio (RATIO)
    status: 'active' | 'inactive';
    advertiserId: number;
    advertiserName: string;
    adTypeCode: string;
    // AdSite metadata
    upstreamId: number;
    billingMethod: string;
    isActive: boolean;
    isArchived: boolean;
}

export interface CreateAdIdRequest {
    slot: string;          // REQUIRED - maps to AdSite.name
    type: 'CPM' | 'RATIO'; // REQUIRED - CPM only, RATIO allowed
    rate: number;          // REQUIRED - currentUnitPrice or currentRatio
    advertiserId: number;  // REQUIRED - upstreamId
    notes?: string;
}

export interface UpdateAdIdRequest {
    slot?: string;
    type?: 'CPM' | 'RATIO';
    rate?: number;
    notes?: string;
}

export interface AdSiteWithUpstream {
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
}

/**
 * Maps AdSite to BFFAdId
 */
export function mapAdSiteToAdId(adSite: AdSiteWithUpstream): BFFAdId {
    return {
        id: adSite.id,
        slot: adSite.name,
        type: adSite.billingMethod as 'CPM' | 'RATIO',
        rate: adSite.billingMethod === 'CPM'
            ? (adSite.currentUnitPrice ? Number(adSite.currentUnitPrice) : null)
            : (adSite.currentRatio ? Number(adSite.currentRatio) : null),
        status: adSite.status as 'active' | 'inactive',
        advertiserId: adSite.upstreamId,
        advertiserName: adSite.upstream.name,
        adTypeCode: adSite.upstream.adType.code,
        upstreamId: adSite.upstreamId,
        billingMethod: adSite.billingMethod,
        isActive: adSite.isActive,
        isArchived: adSite.isArchived,
    };
}

/**
 * Maps array of AdSite to AdId[]
 */
export function mapAdSitesToAdIds(adSites: AdSiteWithUpstream[]): BFFAdId[] {
    return adSites.map(mapAdSiteToAdId);
}