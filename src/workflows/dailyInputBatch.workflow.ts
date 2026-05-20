import prisma from "../prisma.js"
import { formatBusinessDate, getBusinessDayRange, getBusinessDayStart } from "../utils/date.js"
import { calculateActualRevenue, calculateCpmRevenue, calculateRatioRevenue, calculateRebateAmount } from "../utils/calculations.js"
import { AdTypeCode } from "../types/index.js"

function toNumber(value: unknown, fallback = 0): number {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
}

async function getActiveAdSiteRebateRateMap(adSiteIds: number[], targetDate: Date) {
    if (adSiteIds.length === 0) {
        return new Map<number, number>()
    }

    const rates = await prisma.adSiteRebateRate.findMany({
        where: {
            adSiteId: { in: adSiteIds },
            startDate: { lte: targetDate },
            OR: [{ endDate: null }, { endDate: { gte: targetDate } }],
        },
        orderBy: [{ adSiteId: "asc" }, { startDate: "desc" }],
    })

    const rateMap = new Map<number, number>()
    for (const rate of rates) {
        if (!rateMap.has(rate.adSiteId)) {
            rateMap.set(rate.adSiteId, Number(rate.rate))
        }
    }

    return rateMap
}

// ============================================================
// Shared workflow function for daily input batch save
// This contains ALL the financial calculation logic.
// Both legacy route and BFF route MUST call this function.
// ============================================================

export interface DailyInputBatchRecord {
    ad_site_id: number
    qty?: number
    unit_price_override?: number
    amount1?: number
    amount2?: number
    ratio_override?: number
    rebate_amount?: number
    actual_revenue?: number
}

export interface SaveDailyInputBatchOptions {
    date: string // YYYY-MM-DD
    adTypeCode: AdTypeCode
    records: DailyInputBatchRecord[]
    userId: number
}

export interface SaveDailyInputBatchResult {
    success: boolean
    saved: number
    errors: { ad_site_id: number; message: string }[]
}

export async function saveDailyInputBatch(
    options: SaveDailyInputBatchOptions
): Promise<SaveDailyInputBatchResult> {
    const { date, adTypeCode, records, userId } = options

    const inputDate = getBusinessDayStart(date)
    const todayDate = getBusinessDayStart(formatBusinessDate(new Date()))
    if (inputDate.getTime() > todayDate.getTime()) {
        return { success: false, saved: 0, errors: [{ ad_site_id: 0, message: "Cannot input future date" }] }
    }

    const { gte: startOfDay, lt: endOfDay } = getBusinessDayRange(date)

    const siteIds = records.map((r) => r.ad_site_id)
    const [adSites, existingRecords] = await Promise.all([
        prisma.adSite.findMany({
            where: {
                id: { in: siteIds },
                isArchived: false,
                status: "active",
                upstream: {
                    status: "active",
                },
            },
            include: { upstream: { include: { adType: true } } },
        }),
        prisma.dailyInput.findMany({
            where: {
                recordDate: { gte: startOfDay, lt: endOfDay },
                adSiteId: { in: siteIds },
            },
            select: {
                adSiteId: true,
            },
        }),
    ])

    const siteMap = new Map(adSites.map((s) => [s.id, s]))
    const existingRecordSiteIds = new Set(existingRecords.map((record) => record.adSiteId))
    const activeRebateRateMap =
        adTypeCode === "SM"
            ? await getActiveAdSiteRebateRateMap(siteIds, inputDate)
            : new Map<number, number>()

    const errors: { ad_site_id: number; message: string }[] = []
    let saved = 0

    for (const item of records) {
        const site = siteMap.get(item.ad_site_id)
        if (!site) {
            errors.push({ ad_site_id: item.ad_site_id, message: "Ad site not found" })
            continue
        }
        if (!site.isActive && !existingRecordSiteIds.has(item.ad_site_id)) {
            errors.push({ ad_site_id: item.ad_site_id, message: "Ad site is paused" })
            continue
        }
        if (site.upstream.adType.code !== adTypeCode) {
            errors.push({ ad_site_id: item.ad_site_id, message: `Site does not belong to ${adTypeCode}` })
            continue
        }

        const existing = await prisma.dailyInput.findUnique({
            where: {
                recordDate_adSiteId: {
                    recordDate: inputDate,
                    adSiteId: item.ad_site_id,
                },
            },
        })

        if (existing && existing.status === "confirmed") {
            errors.push({ ad_site_id: item.ad_site_id, message: "Record confirmed — cannot edit" })
            continue
        }

        let revenue: number
        let rebateAmount = 0
        let rebateRateSnapshot = 0

        if (site.billingMethod === "CPM") {
            // CPM: use stored snapshot price (or override) for revenue calculation
            const basePrice = existing?.unitPriceSnapshot ?? site.currentUnitPrice ?? 0
            const unitPrice = item.unit_price_override ?? Number(basePrice)
            const qty = item.qty ?? existing?.qty ?? 0
            const baseRevenue = calculateCpmRevenue(qty, unitPrice)

            if (adTypeCode === "SM") {
                rebateRateSnapshot = activeRebateRateMap.get(site.id) ?? 0

                if (item.actual_revenue !== undefined) {
                    revenue = toNumber(item.actual_revenue)
                    rebateAmount = baseRevenue - revenue
                } else if (item.rebate_amount !== undefined) {
                    rebateAmount = toNumber(item.rebate_amount)
                    revenue = calculateActualRevenue(baseRevenue, rebateAmount)
                } else if (
                    existing &&
                    item.qty === undefined &&
                    item.unit_price_override === undefined
                ) {
                    rebateAmount = Number(existing.rebateAmount)
                    revenue = Number(existing.revenue)
                    rebateRateSnapshot = Number(existing.rebateRateSnapshot)
                } else {
                    rebateAmount = calculateRebateAmount(qty, rebateRateSnapshot)
                    revenue = calculateActualRevenue(baseRevenue, rebateAmount)
                }
            } else {
                revenue = baseRevenue
            }
        } else {
            // RATIO: ratio_override from frontend > existing snapshot > current ratio
            const baseRatio = item.ratio_override ?? existing?.ratioSnapshot ?? site.currentRatio ?? 1
            const ratio = item.ratio_override !== undefined
                ? Number(item.ratio_override)
                : (item.amount1 !== undefined || item.amount2 !== undefined
                    ? Number(baseRatio)
                    : Number(site.currentRatio ?? 1))
            revenue = calculateRatioRevenue(item.amount1 ?? 0, item.amount2 ?? 0, ratio)
        }

        if (existing) {
            // UPDATE unconfirmed record
            const updateData: Record<string, unknown> = {
                amount1: item.amount1,
                amount2: item.amount2,
                ratioSnapshot: site.billingMethod === "RATIO"
                    ? (item.ratio_override ?? existing.ratioSnapshot ?? site.currentRatio)
                    : undefined,
                rebateAmount: site.billingMethod === "CPM" && adTypeCode === "SM" ? rebateAmount : existing.rebateAmount,
                rebateRateSnapshot: site.billingMethod === "CPM" && adTypeCode === "SM" ? rebateRateSnapshot : existing.rebateRateSnapshot,
                revenue,
                updatedAt: new Date(),
            }
            // Only touch qty if explicitly provided (don't overwrite existing qty for RATIO records)
            if (item.qty !== undefined) {
                updateData.qty = item.qty
            }
            if (site.billingMethod === "CPM") {
                updateData.unitPriceSnapshot = item.unit_price_override ?? existing.unitPriceSnapshot ?? site.currentUnitPrice
            }
            await prisma.dailyInput.update({
                where: { id: existing.id },
                data: updateData,
            })
        } else {
            // INSERT
            await prisma.dailyInput.create({
                data: {
                    recordDate: inputDate,
                    adSiteId: item.ad_site_id,
                    qty: item.qty ?? 0,
                    unitPriceSnapshot: site.billingMethod === "CPM"
                        ? (item.unit_price_override ?? site.currentUnitPrice)
                        : undefined,
                    amount1: item.amount1 ?? 0,
                    amount2: item.amount2 ?? 0,
                    ratioSnapshot: site.billingMethod === "RATIO"
                        ? (item.ratio_override ?? site.currentRatio)
                        : undefined,
                    rebateAmount: site.billingMethod === "CPM" && adTypeCode === "SM" ? rebateAmount : 0,
                    rebateRateSnapshot: site.billingMethod === "CPM" && adTypeCode === "SM" ? rebateRateSnapshot : 0,
                    revenue,
                    status: "unconfirmed",
                    createdBy: userId,
                },
            })
        }
        saved++
    }

    return { success: true, saved, errors }
}