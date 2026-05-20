/**
 * BFF Advertiser Mapper
 * Maps between Frontend Advertiser and Backend Upstream
 */

export interface BFFAdvertiser {
    id: number;
    name: string;
    contact: string | null;
    phone: string | null;
    email: string | null;
    notes: string | null;
    status: 'active' | 'inactive';
    adTypeCode?: string;
}

export interface CreateAdvertiserRequest {
    name: string;
    adTypeCode: string; // REQUIRED - no default
    status?: 'active' | 'inactive';
}

export interface UpdateAdvertiserRequest {
    name?: string;
    adTypeCode?: string;
    status?: 'active' | 'inactive';
}

export interface UpstreamRaw {
    id: number;
    name: string;
    status: string;
    adTypeId: number;
    adType?: {
        code: string;
        name: string;
    };
}

/**
 * Maps backend Upstream to frontend Advertiser
 */
export function mapUpstreamToAdvertiser(upstream: UpstreamRaw): BFFAdvertiser {
    return {
        id: upstream.id,
        name: upstream.name,
        contact: null, // Upstream has no contact field
        phone: null,
        email: null,
        notes: null,
        status: upstream.status as 'active' | 'inactive',
        adTypeCode: upstream.adType?.code,
    };
}

/**
 * Maps array of Upstream to Advertiser[]
 */
export function mapUpstreamsToAdvertisers(upstreams: UpstreamRaw[]): BFFAdvertiser[] {
    return upstreams.map(mapUpstreamToAdvertiser);
}

/**
 * Maps CreateAdvertiserRequest to Prisma upstream create input
 * Throws if required fields are missing
 */
export function mapCreateRequestToUpstreamCreate(data: CreateAdvertiserRequest): {
    name: string;
    adTypeId: number;
    status: string;
} {
    if (!data.name || data.name.trim() === '') {
        throw new Error('name is required');
    }
    if (!data.adTypeCode || data.adTypeCode.trim() === '') {
        throw new Error('adTypeCode is required (no default)');
    }

    return {
        name: data.name.trim(),
        adTypeId: 0, // Will be resolved by controller from adTypeCode
        status: data.status ?? 'active',
    };
}

/**
 * Maps UpdateAdvertiserRequest to Prisma upstream update input
 */
export function mapUpdateRequestToUpstreamUpdate(data: UpdateAdvertiserRequest): {
    name?: string;
    adTypeId?: number;
    status?: string;
} {
    const update: { name?: string; adTypeId?: number; status?: string } = {};

    if (data.name !== undefined && data.name.trim() !== '') {
        update.name = data.name.trim();
    }
    if (data.status !== undefined) {
        update.status = data.status;
    }
    // adTypeId will be resolved by controller if adTypeCode provided

    return update;
}