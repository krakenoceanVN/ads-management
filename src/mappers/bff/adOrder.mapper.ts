/**
 * BFF AdOrder Mapper
 * AdOrder is VIRTUAL/READ-ONLY - derived from AdType (category/formula metadata)
 * 
 * Per Phase 2 rules:
 * - AdOrder must be virtual/read-only derived from AdType
 * - Do NOT derive from AdSite
 * - Do NOT group by upstreamId
 */

export interface BFFAdOrder {
    id: number;           // adType.id
    advId: number | null; // passthrough from query.advId
    name: string;          // adType.name
    adTypeCode: string;   // adType.code
    notes: null;          // always null (no notes in AdType)
}

/**
 * Maps AdType to BFFAdOrder
 */
export function mapAdTypeToAdOrder(adType: { id: number; code: string; name: string }, advId: number | null = null): BFFAdOrder {
    return {
        id: adType.id,
        advId,
        name: adType.name,
        adTypeCode: adType.code,
        notes: null,
    };
}

/**
 * Maps array of AdType to AdOrder[]
 */
export function mapAdTypesToAdOrders(adTypes: { id: number; code: string; name: string }[], advId: number | null = null): BFFAdOrder[] {
    return adTypes.map(at => mapAdTypeToAdOrder(at, advId));
}