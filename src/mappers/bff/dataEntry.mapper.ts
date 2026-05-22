/**
 * BFF DataEntryRow Mappers
 * Shared utilities for Advertiser and Media DataEntryRow mapping
 */

import { Prisma } from "@prisma/client";
import { formatBusinessDate } from "../../utils/date.js";

/**
 * Validates dataCoefficient is neutral (1, "1", 100, "100%", null, undefined, empty)
 * Any other value → return error message
 */
export function validateDataCoefficient(value: unknown): string | null {
    if (value === undefined || value === null || value === "") {
        return null; // neutral - ok
    }
    if (typeof value === "number") {
        if (value === 1) return null;
        return "dataCoefficient is not supported by legacy backend calculations.";
    }
    if (typeof value === "string") {
        const normalized = value.replace(/%/g, "").trim();
        if (normalized === "1") return null;
        if (normalized === "100") return null;
        return "dataCoefficient is not supported by legacy backend calculations.";
    }
    return "dataCoefficient is not supported by legacy backend calculations.";
}

/**
 * Maps frontend type to billingMethod
 * CPA: rate × settlement (direct multiplier)
 * RATIO: (amount1 + amount2) × ratio — user-facing label is CPS in UI
 */
export function mapTypeToBillingMethod(type: string): "CPM" | "RATIO" | "CPA" | "UNSUPPORTED" {
    if (type === "CPM") return "CPM";
    if (type === "RATIO") return "RATIO";
    if (type === "CPA") return "CPA";
    return "UNSUPPORTED";
}

/**
 * Maps dailyInput record to advertiser data entry row shape
 */
export interface BFFAdvertiserEntryRow {
    id: number;
    date: string;
    advertiser: string;
    advertiserId: number;
    adOrder: string;
    adOrderId: number | null;
    adOrderCode: string | null;
    type: "CPM" | "RATIO";
    adId: string;
    adIdNum: number;
    rate: string;
    traffic: string;
    settlement: string;
    receivable: number | "";
    status: "pending" | "confirmed";
}

export interface BFFMediaEntryRow {
    id: number;
    date: string;
    media: string;
    mediaId: number;
    mediaAdOrder: string;
    mediaAdOrderId: number | null;
    mediaAdOrderCode: string | null;
    type: "CPM" | "RATIO";
    mediaIdStr: string;
    upstreamAdId: string;
    upstreamAdIdNum: number;
    rate: string;
    traffic: string;
    settlement: string;
    dataCoefficient: string;
    receivable: number | "";
    shareRatio: string;
    shareRatioNum: number | null;
    actualReceived: number | null;
    status: "pending" | "confirmed";
}

/**
 * Maps Prisma DailyInput → BFFAdvertiserEntryRow
 */
export function mapDailyInputToAdvertiserEntry(
    record: {
        id: number;
        recordDate: Date;
        qty: number | null;
        unitPriceSnapshot: Prisma.Decimal | null;
        amount1: Prisma.Decimal;
        amount2: Prisma.Decimal;
        ratioSnapshot: Prisma.Decimal | null;
        revenue: Prisma.Decimal;
        status: string;
        adSite: {
            id: number;
            name: string;
            billingMethod: string;
            adOrderId: number | null;
            upstream: {
                id: number;
                name: string;
                adType: { id: number; code: string; name: string };
            };
            adOrder?: {
                id: number;
                name: string;
                orderNumber?: string;
                adType?: { id: number; code: string; name: string };
            } | null;
        };
    },
    adTypeCode: string
): BFFAdvertiserEntryRow {
    const billingMethod = record.adSite.billingMethod as "CPM" | "RATIO";

    let rate = "";
    let traffic = "";
    let settlement = "";
    let receivable: number | "" = "";

    if (billingMethod === "CPM") {
        rate = record.unitPriceSnapshot ? String(Number(record.unitPriceSnapshot)) : "";
        traffic = record.qty ? String(record.qty) : "";
        settlement = String(Number(record.amount1));
        receivable = Number(record.revenue) || "";
    } else {
        // RATIO
        rate = record.ratioSnapshot ? String(Number(record.ratioSnapshot)) : "";
        settlement = String(Number(record.amount1) + Number(record.amount2));
        receivable = Number(record.revenue) || "";
    }

    return {
        id: record.id,
        date: formatBusinessDate(record.recordDate),
        advertiser: record.adSite.upstream.name,
        advertiserId: record.adSite.upstream.id,
        adOrder: record.adSite.adOrder?.name ?? '',
        adOrderId: record.adSite.adOrder?.id ?? null,
        adOrderCode: record.adSite.adOrder?.adType?.code ?? record.adSite.upstream.adType.code,
        type: billingMethod,
        adId: String(record.adSite.id),
        adIdNum: record.adSite.id,
        rate,
        traffic,
        settlement,
        receivable,
        status: record.status === "confirmed" ? "confirmed" : "pending",
    };
}

/**
 * Maps an AdSite master record to a generated advertiser entry row (no DailyInput yet).
 * Used when there is no existing DailyInput for this adSite on the selected date.
 */
// adOrder.adType is only available when controller includes it via adOrder: { include: { adType: true } }
// Otherwise fall back to upstream.adType.code (AdOrder.adTypeId == upstream.adTypeId — same AdType)
export function mapAdSiteToAdvertiserEntry(
    site: {
        id: number;
        name: string;
        billingMethod: string;
        adOrderId: number | null;
        currentUnitPrice?: unknown;
        currentRatio?: unknown;
        upstream: {
            id: number;
            name: string;
            adType: { id: number; code: string; name: string };
        };
        adOrder?: {
            id: number;
            name: string;
            orderNumber?: string;
            adType?: { id: number; code: string; name: string };
        } | null;
    },
    dateStr: string
): BFFAdvertiserEntryRow {
    let rate = "";
    if (site.billingMethod === "CPM") {
        rate = site.currentUnitPrice != null ? String(Number(site.currentUnitPrice)) : "";
    } else if (site.billingMethod === "RATIO" || site.billingMethod === "CPA") {
        rate = site.currentRatio != null ? String(Number(site.currentRatio)) : "";
    }
    const adOrderCode = site.adOrder?.adType?.code ?? site.upstream.adType.code;
    return {
        id: -site.id,
        date: dateStr,
        advertiser: site.upstream.name,
        advertiserId: site.upstream.id,
        adOrder: site.adOrder?.name ?? '',
        adOrderId: site.adOrder?.id ?? null,
        adOrderCode,
        type: site.billingMethod as "CPM" | "RATIO",
        adId: String(site.id),
        adIdNum: site.id,
        rate,
        traffic: "",
        settlement: "",
        receivable: "",
        status: "pending",
    };
}

/**
 * Maps Prisma DailyInput + shareRatio → BFFMediaEntryRow
 */
export function mapDailyInputToMediaEntry(
    record: {
        id: number;
        recordDate: Date;
        qty: number | null;
        unitPriceSnapshot: Prisma.Decimal | null;
        amount1: Prisma.Decimal;
        amount2: Prisma.Decimal;
        ratioSnapshot: Prisma.Decimal | null;
        revenue: Prisma.Decimal;
        status: string;
        adSite: {
            id: number;
            name: string;
            billingMethod: string;
            upstreamId: number;
            upstream: {
                id: number;
                name: string;
                adType: { id: number; code: string; name: string };
            };
            adOrder?: {
                id: number;
                name: string;
                orderNumber?: string;
                adType?: { id: number; code: string; name: string };
            } | null;
        };
    },
    shareRatio: number | null,
    adTypeCode: string
): BFFMediaEntryRow {
    const billingMethod = record.adSite.billingMethod as "CPM" | "RATIO";

    let rate = "";
    let traffic = "";
    let settlement = "";

    if (billingMethod === "CPM") {
        rate = record.unitPriceSnapshot ? String(Number(record.unitPriceSnapshot)) : "";
        traffic = record.qty ? String(record.qty) : "";
        settlement = String(Number(record.amount1));
    } else {
        // RATIO
        rate = record.ratioSnapshot ? String(Number(record.ratioSnapshot)) : "";
        settlement = String(Number(record.amount1) + Number(record.amount2));
    }

    const receivable = Number(record.revenue) || "";
    const actualReceived =
        shareRatio !== null && receivable !== "" && receivable !== 0
            ? Number((Number(record.revenue) * shareRatio).toFixed(3))
            : null;
    const adOrderCode = record.adSite.adOrder?.adType?.code ?? record.adSite.upstream.adType.code;

    return {
        id: record.id,
        date: formatBusinessDate(record.recordDate),
        media: record.adSite.name,
        mediaId: record.adSite.id,
        mediaIdStr: String(record.adSite.id),
        mediaAdOrder: record.adSite.adOrder?.name ?? '',
        mediaAdOrderId: record.adSite.adOrder?.id ?? null,
        mediaAdOrderCode: adOrderCode,
        type: billingMethod,
        upstreamAdId: String(record.adSite.upstreamId),
        upstreamAdIdNum: record.adSite.upstreamId,
        rate,
        traffic,
        settlement,
        dataCoefficient: "1", // legacy backend has no concept, always neutral
        receivable,
        shareRatio: shareRatio !== null ? String(shareRatio) : "",
        shareRatioNum: shareRatio,
        actualReceived,
        status: record.status === "confirmed" ? "confirmed" : "pending",
    };
}

/**
 * Maps an AdSite + shareRatio to a generated media entry row (no DailyInput yet).
 * Used when there is no existing DailyInput for this adSite on the selected date.
 */
export function mapAdSiteToMediaEntry(
    site: {
        id: number;
        name: string;
        billingMethod: string;
        currentUnitPrice?: unknown;
        currentRatio?: unknown;
        upstreamId: number;
        upstream: {
            id: number;
            name: string;
            adType: { id: number; code: string; name: string };
        };
        adOrder?: {
            id: number;
            name: string;
            orderNumber?: string;
            adType?: { id: number; code: string; name: string };
        } | null;
    },
    dateStr: string,
    shareRatio: number | null
): BFFMediaEntryRow {
    let rate = "";
    if (site.billingMethod === "CPM") {
        rate = site.currentUnitPrice != null ? String(Number(site.currentUnitPrice)) : "";
    } else if (site.billingMethod === "RATIO" || site.billingMethod === "CPA") {
        rate = site.currentRatio != null ? String(Number(site.currentRatio)) : "";
    }
    const adOrderCode = site.adOrder?.adType?.code ?? site.upstream.adType.code;
    return {
        id: -site.id, // negative so it's distinguishable from real DailyInput ids
        date: dateStr,
        media: site.name,
        mediaId: site.id,
        mediaIdStr: String(site.id),
        mediaAdOrder: site.adOrder?.name ?? '',
        mediaAdOrderId: site.adOrder?.id ?? null,
        mediaAdOrderCode: adOrderCode,
        type: site.billingMethod as "CPM" | "RATIO",
        upstreamAdId: String(site.upstreamId),
        upstreamAdIdNum: site.upstreamId,
        rate,
        traffic: "",
        settlement: "",
        dataCoefficient: "1",
        receivable: "",
        shareRatio: shareRatio !== null ? String(shareRatio) : "",
        shareRatioNum: shareRatio,
        actualReceived: null,
        status: "pending",
    };
}
