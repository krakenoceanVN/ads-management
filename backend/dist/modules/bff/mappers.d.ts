import type { Advertiser, Media, AdOrder, AdId, MediaId, DownstreamDto } from './bff.types';
import type { Upstream, AdSite, AdOrder as PrismaAdOrder, AdSiteDownstream, Downstream, AdType, UpstreamAdType } from '../../shared/prisma/client';
export declare function mapAdvertiser(upstream: Upstream & {
    adType: AdType;
    adTypeLinks?: Array<UpstreamAdType & {
        adType: AdType;
    }>;
}): Advertiser;
export declare function mapMedia(site: AdSite & {
    upstream: Upstream & {
        adType: AdType;
    };
    adOrder?: (PrismaAdOrder & {
        adType: AdType;
    }) | null;
}): Media;
export declare function mapAdOrder(order: PrismaAdOrder & {
    upstream: Upstream;
    adType: AdType;
}): AdOrder;
export declare function mapAdId(site: AdSite & {
    upstream: Upstream & {
        adType: AdType;
    };
    adOrder: (PrismaAdOrder & {
        adType?: AdType;
    }) | null;
}): AdId;
export declare function mapMediaId(j: AdSiteDownstream & {
    adSite: AdSite & {
        upstream: Upstream & {
            adType: AdType;
        };
        adOrder?: (PrismaAdOrder & {
            adType?: AdType;
        }) | null;
    };
    downstream: Downstream;
}): MediaId;
export declare function mapDownstream(d: Downstream & {
    adType: AdType;
}): DownstreamDto;
//# sourceMappingURL=mappers.d.ts.map