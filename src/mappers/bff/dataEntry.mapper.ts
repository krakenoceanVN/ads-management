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
 * CPA/CPS → 400 error
 */
export function mapTypeToBillingMethod(type: string): "CPM" | "RATIO" | "UNSUPPORTED" {
    if (type === "CPM") return "CPM";
    if (type === "RATIO") return "RATIO";
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
    adOrderId: number;
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
    mediaAdOrderId: number;
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
            upstream: {
                id: number;
                name: string;
                adType: { id: number; code: string; name: string };
            };
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
        adOrder: record.adSite.upstream.adType.name,
        adOrderId: record.adSite.upstream.adType.id,
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

    return {
        id: record.id,
        date: formatBusinessDate(record.recordDate),
        media: record.adSite.name,
        mediaId: record.adSite.id,
        mediaIdStr: String(record.adSite.id),
        mediaAdOrder: record.adSite.upstream.adType.name,
        mediaAdOrderId: record.adSite.upstream.adType.id,
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
