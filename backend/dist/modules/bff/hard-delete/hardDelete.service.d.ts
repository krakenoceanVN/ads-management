import type { HardDeleteResult } from './hardDelete.types';
export interface HardDeleteContext {
    userId: number;
    username?: string | null;
}
export declare function hardDeleteAdvertiser(id: number, ctx: HardDeleteContext): Promise<HardDeleteResult>;
export declare function hardDeleteAdType(id: number, ctx: HardDeleteContext): Promise<HardDeleteResult>;
export declare function hardDeleteAdSite(id: number, ctx: HardDeleteContext, side: 'adId' | 'media'): Promise<HardDeleteResult>;
export declare function hardDeleteAdOrder(id: number, ctx: HardDeleteContext): Promise<HardDeleteResult>;
export declare function hardDeleteMediaId(id: number, ctx: HardDeleteContext): Promise<HardDeleteResult>;
//# sourceMappingURL=hardDelete.service.d.ts.map