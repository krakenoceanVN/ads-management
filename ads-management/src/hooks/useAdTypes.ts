import { useQuery } from '@tanstack/react-query'
import api from '../api/axios'

export interface AdTypeWithSlug {
    id: number
    code: string
    name: string
    slug: string
    createdAt: string
    updatedAt: string
}

export function useAdTypes() {
    return useQuery<AdTypeWithSlug[]>({
        queryKey: ['adTypes'],
        queryFn: async () => {
            const response = await api.get('/api/admin/ad-types')
            return response.data.data
        },
        staleTime: 30000, // Cache for 30 seconds - avoid rapid refetches
    })
}

/**
 * Find AdType by slug (URL parameter) OR by code (for hardcoded routes like "SM", "360")
 * Handles both slug values from dynamic routes AND code values from hardcoded routes
 */
export function findAdTypeBySlug(adTypes: AdTypeWithSlug[], slugOrCode: string): AdTypeWithSlug | undefined {
    if (!slugOrCode || adTypes.length === 0) return undefined
    // First try slug match (for dynamic routes)
    const bySlug = adTypes.find((at) => at.slug.toLowerCase() === slugOrCode.toLowerCase())
    if (bySlug) return bySlug
    // Fallback to code match (for hardcoded routes like "SM", "360", "BAIDU_JS", "OTHER")
    return adTypes.find((at) => at.code.toLowerCase() === slugOrCode.toLowerCase())
}

/**
 * Find AdType by code (for API calls)
 */
export function findAdTypeByCode(adTypes: AdTypeWithSlug[], code: string): AdTypeWithSlug | undefined {
    return adTypes.find((at) => at.code === code)
}