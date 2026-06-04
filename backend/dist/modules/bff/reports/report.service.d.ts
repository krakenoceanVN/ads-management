/**
 * Phase 4A: Reports Read Service
 *
 * - advertiser report: entry-level per-DailyInput rows (not grouped), using stored DailyInput.revenue
 * - media report: grouped by media, using stored DailyInput.revenue
 *
 * Rules:
 * - Uses stored DailyInput.revenue as source of truth (no recalculation)
 * - Excludes quarantined records
 * - Includes confirmed records by default
 * - Does not hide inactive advertisers with confirmed historical data
 * - Does not hide archived media with confirmed historical data
 * - No DailyInput writes
 */
import type { AdvertiserEntryRow, MediaEntryRow } from '../data-entry/dataEntry.types';
export interface AdvertiserReportParams {
    date?: string;
    startDate?: string;
    endDate?: string;
    advertiserId?: number;
    adTypeCode?: string;
    status?: 'confirmed' | 'unconfirmed' | 'pending' | 'all';
}
export interface MediaReportParams {
    date?: string;
    startDate?: string;
    endDate?: string;
    mediaId?: number;
    adTypeCode?: string;
    status?: 'confirmed' | 'unconfirmed' | 'pending' | 'all';
}
export declare function getAdvertiserReport(params: AdvertiserReportParams): Promise<AdvertiserEntryRow[]>;
export declare function getMediaReport(params: MediaReportParams): Promise<MediaEntryRow[]>;
//# sourceMappingURL=report.service.d.ts.map