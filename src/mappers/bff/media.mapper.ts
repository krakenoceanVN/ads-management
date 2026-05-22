/**
 * BFF Media Mapper
 * Maps between Frontend Media and Backend AdSite
 */

export interface BFFMedia {
    id: number;
    name: string;
    contact: string | null;
    phone: string | null;
    email: string | null;
    notes: string | null;
    status: 'active' | 'inactive';
    upstreamId?: number;
    adTypeCode?: string;         // From upstream.adType.code
    billingMethod?: 'CPM' | 'RATIO' | 'CPA';
    currentUnitPrice?: number;
    currentRatio?: number;
}

export interface CreateMediaRequest {
    name: string;
    upstreamId: number; // REQUIRED - no default
    billingMethod: 'CPM' | 'RATIO' | 'CPA'; // REQUIRED - no default
    status?: 'active' | 'inactive';
    currentUnitPrice?: number; // For CPM billing
    currentRatio?: number; // For RATIO billing
}

export interface UpdateMediaRequest {
    name?: string;
    upstreamId?: number;
    billingMethod?: 'CPM' | 'RATIO' | 'CPA';
    status?: 'active' | 'inactive';
    currentUnitPrice?: number; // For CPM billing
    currentRatio?: number; // For RATIO billing
}

export interface AdSiteRaw {
    id: number;
    name: string;
    status: string;
    upstreamId: number;
    billingMethod: string;
    currentUnitPrice?: any;
    currentRatio?: any;
    isActive: boolean;
    isArchived: boolean;
    upstream?: {
        id: number;
        name: string;
        status: string;
        adType?: {
            id: number;
            code: string;
            name: string;
        };
    };
}

/**
 * Maps backend AdSite to frontend Media
 */
export function mapAdSiteToMedia(adSite: AdSiteRaw): BFFMedia {
    return {
        id: adSite.id,
        name: adSite.name,
        contact: null, // AdSite has no contact field
        phone: null,
        email: null,
        notes: null,
        status: adSite.status as 'active' | 'inactive',
        upstreamId: adSite.upstreamId,
        adTypeCode: adSite.upstream?.adType?.code,
        billingMethod: adSite.billingMethod as 'CPM' | 'RATIO' | 'CPA',
        currentUnitPrice: adSite.currentUnitPrice != null ? Number(adSite.currentUnitPrice) : undefined,
        currentRatio: adSite.currentRatio != null ? Number(adSite.currentRatio) : undefined,
    };
}

/**
 * Maps array of AdSite to Media[]
 */
export function mapAdSitesToMedia(adSites: AdSiteRaw[]): BFFMedia[] {
    return adSites.map(mapAdSiteToMedia);
}

/**
 * Maps CreateMediaRequest to Prisma adSite create input
 * Throws if required fields are missing
 */
export function mapCreateRequestToAdSiteCreate(data: CreateMediaRequest): {
    name: string;
    upstreamId: number;
    billingMethod: 'CPM' | 'RATIO' | 'CPA';
    currentUnitPrice?: number;
    currentRatio?: number;
    status: string;
    isActive: boolean;
    isArchived: boolean;
} {
    if (!data.name || data.name.trim() === '') {
        throw new Error('name is required');
    }
    if (!data.upstreamId) {
        throw new Error('upstreamId is required (no default)');
    }
    if (!data.billingMethod) {
        throw new Error('billingMethod is required (no default)');
    }
    if (data.billingMethod !== 'CPM' && data.billingMethod !== 'RATIO' && data.billingMethod !== 'CPA') {
        throw new Error('billingMethod must be CPM, RATIO, or CPA');
    }

    return {
        name: data.name.trim(),
        upstreamId: data.upstreamId,
        billingMethod: data.billingMethod,
        currentUnitPrice: data.billingMethod === 'CPM' ? 0 : undefined,
        currentRatio: data.billingMethod === 'RATIO' ? 1 : undefined,
        status: data.status ?? 'active',
        isActive: true,
        isArchived: false,
    };
}

/**
 * Maps UpdateMediaRequest to Prisma adSite update input
 */
export function mapUpdateRequestToAdSiteUpdate(data: UpdateMediaRequest): {
    name?: string;
    upstreamId?: number;
    billingMethod?: string;
    currentUnitPrice?: number;
    currentRatio?: number;
    status?: string;
} {
    const update: {
        name?: string;
        upstreamId?: number;
        billingMethod?: string;
        currentUnitPrice?: number;
        currentRatio?: number;
        status?: string;
    } = {};

    if (data.name !== undefined && data.name.trim() !== '') {
        update.name = data.name.trim();
    }
    if (data.upstreamId !== undefined) {
        update.upstreamId = data.upstreamId;
    }
    if (data.billingMethod !== undefined) {
        if (data.billingMethod !== 'CPM' && data.billingMethod !== 'RATIO' && data.billingMethod !== 'CPA') {
            throw new Error('billingMethod must be CPM, RATIO, or CPA');
        }
        update.billingMethod = data.billingMethod;
        update.currentUnitPrice = data.billingMethod === 'CPM' ? 0 : undefined;
        update.currentRatio = data.billingMethod === 'RATIO' ? 1 : undefined;
        if (data.billingMethod === 'CPA') {
            update.currentUnitPrice = undefined;
            update.currentRatio = undefined;
        }
    }
    if (data.status !== undefined) {
        update.status = data.status;
    }

    return update;
}