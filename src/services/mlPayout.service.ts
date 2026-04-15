import { PrismaClient } from "@prisma/client"
import { MLPayoutResult, AdTypeCode } from "../types/index.js"
import { getBusinessDayRange } from "../utils/date.js"
import { calculateYiyiAmount, getYiyiDailyPricing } from "./yiyiPricing.service.js"

const AD_TYPE_ID_MAP: Record<AdTypeCode, number> = {
  SM: 1,
  "360": 2,
  BAIDU_JS: 3,
  OTHER: 4,
}

/** Convert "YYYY-MM-DD" → { startOfDay, endOfDay } in business TZ */
function dateRange(dateStr: string): { gte: Date; lt: Date } {
  return getBusinessDayRange(dateStr)
}

// ============================================================
// ML Payout — ALL ad types, ALWAYS ×0.8
// ============================================================
export async function calculateMLPayout(
  date: string,
  adTypeCode: AdTypeCode,
  prisma: PrismaClient
): Promise<MLPayoutResult> {
  const adTypeId = AD_TYPE_ID_MAP[adTypeCode]

  // 1. Sum confirmed revenue for this ad_type on this date
  const result = await prisma.dailyInput.aggregate({
    where: {
      recordDate: dateRange(date),
      status: "confirmed",
      adSite: {
        upstream: {
          adTypeId: adTypeId,
          status: "active",
        },
      },
    },
    _sum: { revenue: true },
  })

  const totalRevenue = result._sum.revenue ?? 0

  // 2. Get ML downstream period active on this date
  const downstream = await prisma.downstreamPeriod.findFirst({
    where: {
      downstream: {
        adTypeId: adTypeId,
        downstreamType: "ML",
        status: "active",
      },
      startDate: { lte: new Date(date) },
      OR: [
        { endDate: null },
        { endDate: { gte: new Date(date) } },
      ],
    },
    include: { downstream: true },
    orderBy: { startDate: "desc" },
  })

  // 3. ML payout = total × payout_rate (always 0.8)
  const payoutRate = downstream?.downstream.payoutRate ?? 0.8
  const mlPayout = Number(totalRevenue) * Number(payoutRate)

  return {
    total_revenue: Number(totalRevenue),
    ml_payout: mlPayout,
    payout_rate: Number(payoutRate),
  }
}

// ============================================================
// LE Payout — SM ONLY
// LE payout = SM_revenue × payout_rate - tax(net) - ML_cost
// tax = (LE_revenue - ML_cost) × 0.06
// ML_cost = SM_qty × unit_price / 1000
// ============================================================
export async function calculateLEPayout(
  date: string,
  smUpstreamRevenue: number,
  prisma: PrismaClient
): Promise<number> {
  // 1. Get LE downstream period
  const lePeriod = await prisma.downstreamPeriod.findFirst({
    where: {
      downstream: {
        adTypeId: AD_TYPE_ID_MAP.SM,
        downstreamType: "LE",
        status: "active",
      },
      startDate: { lte: new Date(date) },
      OR: [
        { endDate: null },
        { endDate: { gte: new Date(date) } },
      ],
    },
    include: { downstream: true },
    orderBy: { startDate: "desc" },
  })

  // LE revenue from upstream
  const lePayoutRate = Number(lePeriod?.downstream.payoutRate ?? 0.9)
  const leRevenue = smUpstreamRevenue * lePayoutRate

  // 2. Get total SM qty for ML cost calculation
  const qtyResult = await prisma.dailyInput.aggregate({
    where: {
      recordDate: dateRange(date),
      status: "confirmed",
      adSite: {
        upstream: {
          adTypeId: AD_TYPE_ID_MAP.SM,
          status: "active",
        },
      },
    },
    _sum: { qty: true },
  })

  const totalQty = qtyResult._sum.qty ?? 0
  const mlUnitPrice = Number(lePeriod?.unitPrice ?? 16)
  const leMlCost = Number(totalQty) * mlUnitPrice / 1000

  // 3. Tax = (revenue - ML_cost) × 0.06, then LE = revenue - tax - ML_cost
  const leTax = (leRevenue - leMlCost) * 0.06
  return leRevenue - leTax - leMlCost
}

// ============================================================
// yiyi Payout — SM ONLY
// Priority: YiyiDailyData if available, else fallback to UV from DailyInput
// Formula: SUM(qty across channels) × unit_price / 1000
// ============================================================
export async function calculateYiyiPayout(
  dateStr: string,
  totalUV: number,
  prisma: PrismaClient
): Promise<number> {
  const { gte: startOfDay, lt: endOfDay } = dateRange(dateStr)
  const pricing = await getYiyiDailyPricing(dateStr, prisma)

  const yiyiRecords = await prisma.yiyiDailyData.findMany({
    where: {
      recordDate: { gte: startOfDay, lt: endOfDay },
    },
  })

  if (yiyiRecords.length > 0) {
    const totalQty = yiyiRecords.reduce((s, r) => s + r.qty, 0)
    return calculateYiyiAmount(totalQty, pricing.unitPrice)
  }

  // Fallback: use UV from DailyInput
  return calculateYiyiAmount(totalUV, pricing.unitPrice)
}

// ============================================================
// Full cost breakdown for a date + ad_type
// ============================================================
export interface CostBreakdown {
  revenue: number
  ml_payout: number
  le_payout?: number
  yiyi_payout?: number
  cost: number
  tax: number
  profit: number
  profit_rate: number
}

export async function calculateCostBreakdown(
  date: string,
  adTypeCode: AdTypeCode,
  prisma: PrismaClient
): Promise<CostBreakdown> {
  const mlResult = await calculateMLPayout(date, adTypeCode, prisma)
  const { total_revenue, ml_payout } = mlResult

  let lePayout: number | undefined
  let yiyiPayout: number | undefined

  if (adTypeCode === "SM") {
    // For SM: LE payout uses SM upstream revenue (sum of all upstream revenues)
    lePayout = await calculateLEPayout(date, total_revenue, prisma)

    // yiyi = total UV × 2/1000 — UV is the sum of qty for SM
    // (qty represents UV/impressions in SM billing)
    const uvResult = await prisma.dailyInput.aggregate({
      where: {
        recordDate: dateRange(date),
        status: "confirmed",
        adSite: {
          upstream: {
            adTypeId: AD_TYPE_ID_MAP.SM,
            status: "active",
          },
        },
      },
      _sum: { qty: true },
    })
    yiyiPayout = await calculateYiyiPayout(date, Number(uvResult._sum.qty ?? 0), prisma)
  }

  const cost = adTypeCode === "SM"
    ? ml_payout + (lePayout ?? 0) + (yiyiPayout ?? 0)
    : ml_payout

  const tax = (total_revenue - cost) * 0.06
  const profit = total_revenue - cost - tax
  const profit_rate = total_revenue > 0 ? profit / total_revenue : 0

  return {
    revenue: total_revenue,
    ml_payout,
    le_payout: lePayout,
    yiyi_payout: yiyiPayout,
    cost,
    tax,
    profit,
    profit_rate,
  }
}
