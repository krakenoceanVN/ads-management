import type { HardDeleteResult } from './hardDelete.types';
export interface HardDeleteContext {
    userId: string | number;
    username?: string | null;
}
export declare function hardDeleteAdvertiser(id: string, ctx: HardDeleteContext): Promise<HardDeleteResult>;
export declare function hardDeleteAdType(id: string, ctx: HardDeleteContext): Promise<HardDeleteResult>;
export declare function hardDeleteAdSite(id: string, ctx: HardDeleteContext, side: 'adId' | 'media'): Promise<HardDeleteResult>;
export declare function hardDeleteMediaAdOrder(id: string, ctx: HardDeleteContext): Promise<HardDeleteResult>;
export declare function hardDeleteMediaId(id: string, ctx: HardDeleteContext): Promise<HardDeleteResult>;
//# sourceMappingURL=hardDelete.service.d.ts.map