import type { Advertiser, Media, AdId, MediaId, DownstreamDto, MediaAdOrderDto } from './bff.types';
import type { Upstream, AdSite, AdSiteDownstream, Downstream, DownstreamAdType, AdType, UpstreamAdType, MediaAdOrder } from '../../shared/prisma/client';
export declare function mapAdvertiser(upstream: Upstream & {
    defaultAdType: AdType | null;
    adTypeLinks?: Array<UpstreamAdType & {
        adType: AdType;
    }>;
}): Advertiser;
export declare function mapMedia(site: AdSite & {
    upstream: Upstream & {
        defaultAdType: AdType | null;
    };
}): Media;
export declare function mapAdId(site: AdSite & {
    upstream: Upstream & {
        defaultAdType: AdType | null;
    };
}): AdId;
export declare function mapMediaId(j: AdSiteDownstream & {
    adSite: AdSite & {
        upstream: Upstream & {
            defaultAdType: AdType | null;
        };
    };
    downstream: Downstream;
    mediaAdType?: AdType | null;
}): MediaId;
export declare function mapDownstream(d: Downstream & {
    adTypeLinks: Array<DownstreamAdType & {
        adType: AdType;
    }>;
}): DownstreamDto;
export declare function mapMediaAdOrder(row: MediaAdOrder & {
    adType?: AdType | null;
    downstream?: {
        name: string | null;
        downstreamType: string;
    } | null;
}, linkCount?: number): MediaAdOrderDto;
//# sourceMappingURL=mappers.d.ts.map