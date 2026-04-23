import { Router, Request, Response } from "express"
import { query, validationResult } from "express-validator"
import { SummaryRow, AdTypeCode } from "../types/index.js"
import prisma from "../prisma.js"
import { requireAuth } from "../middleware/auth.js"
import { formatBusinessDate, getBusinessMonthRange } from "../utils/date.js"
import { AD_TYPE_ID_MAP, DEFAULT_DOWNSTREAM_PRICES } from "../utils/constants.js"
import {
  DEFAULT_LE_PAYOUT_RATE,
  DEFAULT_LE_UNIT_PRICE,
  DEFAULT_ML_PAYOUT_RATE,
  YIYI_DEFAULT_UNIT_PRICE,
  applyMl80Rate,
  calculateLeRevenueFromSmRevenue,
  calculateMlPayoutAmount,
  calculateNetProfit,
  calculateProfitRate,
  calculateSmDashboardCost,
  calculateTaxOnMargin,
  calculateUnitPricePayout,
  calculateYiyiAmount,
} from "../utils/calculations.js"

const router = Router()

interface DailyInputWithUpstream {
  recordDate: Date
  revenue: unknown
  qty: number
  adSiteId: number
  adSite: {
    upstream: {
      name: string
    }
    downstreams?: Array<{
      customPrice: unknown
      downstream: {
        id: number
        downstreamType: string
      }
    }>
  }
}

interface PeriodWithDownstream {
  downstreamId: number
  pctHal: unknown
  unitPrice: unknown
  startDate: Date
  endDate: Date | null
  downstream: {
    payoutRate: unknown
  }
}

// ============================================================
// Helpers
// ============================================================
function getDaysInMonth(year: number, month: number): string[] {
  const days: string[] = []
  const date = new Date(year, month - 1, 1)
  while (date.getMonth() === month - 1) {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, "0")
    const d = String(date.getDate()).padStart(2, "0")
    days.push(`${y}-${m}-${d}`)
    date.setDate(date.getDate() + 1)
  }
  return days
}

function finalizeUpstreamDetailBreakdown(
  metrics: Record<string, { pv: number; unit_price: number; amount: number }>
): Record<string, { pv: number; unit_price: number; amount: number }> {
  const result: Record<string, { pv: number; unit_price: number; amount: number }> = {}

  for (const [name, metric] of Object.entries(metrics)) {
    const pv = metric.pv ?? 0
    const amount = metric.amount ?? 0

    result[name] = {
      pv,
      amount,
      unit_price: pv > 0 ? (amount / pv) * 1000 : 0,
    }
  }

  return result
}

function buildMonthlyTotal(rows: SummaryRow[]): SummaryRow {
  const revenue = rows.reduce((s, r) => s + r.revenue, 0)
  const cost = rows.reduce((s, r) => s + r.cost, 0)
  const tax = rows.reduce((s, r) => s + r.tax, 0)
  const profit = calculateNetProfit(revenue, cost, tax)
  const mlPayout = rows.reduce((s, r) => s + r.ml_payout, 0)
  const lePayout = rows.reduce((s, r) => s + (r.le_payout ?? 0), 0)
  const yiyiPayout = rows.reduce((s, r) => s + (r.yiyi_payout ?? 0), 0)

  const upstreamBreakdown: Record<string, number> = {}
  const upstreamDetailBreakdown: Record<string, { pv: number; unit_price: number; amount: number }> = {}
  for (const r of rows) {
    for (const [k, v] of Object.entries(r.upstream_breakdown)) {
      upstreamBreakdown[k] = (upstreamBreakdown[k] ?? 0) + v
    }
    for (const [k, v] of Object.entries(r.upstream_detail_breakdown ?? {})) {
      const current = upstreamDetailBreakdown[k] ?? { pv: 0, unit_price: 0, amount: 0 }
      current.pv += v.pv ?? 0
      current.amount += v.amount ?? 0
      upstreamDetailBreakdown[k] = current
    }
  }

  const finalizedUpstreamDetailBreakdown =
    Object.keys(upstreamDetailBreakdown).length > 0
      ? finalizeUpstreamDetailBreakdown(upstreamDetailBreakdown)
      : undefined

  return {
    date: "TOTAL",
    revenue,
    cost,
    tax,
    profit,
    profit_rate: calculateProfitRate(profit, revenue),
    upstream_breakdown: upstreamBreakdown,
    upstream_detail_breakdown: finalizedUpstreamDetailBreakdown,
    ml_payout: mlPayout,
    le_payout: lePayout > 0 ? lePayout : undefined,
    yiyi_payout: yiyiPayout > 0 ? yiyiPayout : undefined,
  }
}

function groupDailyInputsByBusinessDate(inputs: DailyInputWithUpstream[]): Map<string, DailyInputWithUpstream[]> {
  const grouped = new Map<string, DailyInputWithUpstream[]>()
  for (const input of inputs) {
    const date = formatBusinessDate(input.recordDate)
    const current = grouped.get(date) ?? []
    current.push(input)
    grouped.set(date, current)
  }
  return grouped
}

function groupNumbersByBusinessDate(
  rows: Array<{ recordDate: Date; value: number }>
): Map<string, number> {
  const grouped = new Map<string, number>()
  for (const row of rows) {
    const date = formatBusinessDate(row.recordDate)
    grouped.set(date, (grouped.get(date) ?? 0) + row.value)
  }
  return grouped
}

function groupPricingByBusinessDate(
  rows: Array<{ recordDate: Date; unitPrice: unknown }>
): Map<string, number> {
  const grouped = new Map<string, number>()
  for (const row of rows) {
    grouped.set(formatBusinessDate(row.recordDate), Number(row.unitPrice ?? YIYI_DEFAULT_UNIT_PRICE))
  }
  return grouped
}

function buildPeriodMap(periods: PeriodWithDownstream[]): Map<number, PeriodWithDownstream[]> {
  const map = new Map<number, PeriodWithDownstream[]>()
  for (const period of periods) {
    const current = map.get(period.downstreamId) ?? []
    current.push(period)
    map.set(period.downstreamId, current)
  }
  for (const rows of map.values()) {
    rows.sort((a, b) => b.startDate.getTime() - a.startDate.getTime())
  }
  return map
}

function getActivePeriodForDate(periods: PeriodWithDownstream[] | undefined, date: string): PeriodWithDownstream | undefined {
  if (!periods || periods.length === 0) return undefined
  const currentDate = new Date(date)
  return periods.find(
    (period) =>
      period.startDate <= currentDate &&
      (period.endDate === null || period.endDate >= currentDate)
  )
}

function calculateDownstreamSiteValue(quantity: number, unitPrice: number): number {
  return quantity * unitPrice
}

const handleValidation = (req: Request, res: Response, next: Function) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, error: errors.array()[0].msg })
    return
  }
  next()
}

// ============================================================
// GET /api/dashboard/monthly
// Query: year, month (1-12), ad_type (SM|360|BAIDU_JS|OTHER)
// ============================================================
router.get(
  "/monthly",
  requireAuth,
  [
    query("year").notEmpty().withMessage("year is required").isInt({ min: 2020, max: 2100 }).toInt(),
    query("month").notEmpty().withMessage("month is required").isInt({ min: 1, max: 12 }).toInt(),
    query("ad_type").notEmpty().withMessage("ad_type is required").isIn(["SM", "360", "BAIDU_JS", "OTHER"]),
  ],
  handleValidation,
  async (req: Request, res: Response) => {
    try {
      const year = Number(req.query.year)
      const month = Number(req.query.month)
      const adTypeCode = req.query.ad_type as AdTypeCode
      const adTypeId = AD_TYPE_ID_MAP[adTypeCode]
      const days = getDaysInMonth(year, month)
      const { gte: startOfMonth, lt: endOfMonth } = getBusinessMonthRange(year, month)

      const [activeUpstreams, monthlyInputs, mlPeriods, lePeriods, yiyiData, yiyiPricing] = await Promise.all([
        adTypeCode === "360"
          ? prisma.upstream.findMany({
              where: {
                adTypeId,
                status: "active",
              },
              select: { name: true },
              orderBy: { name: "asc" },
            })
          : Promise.resolve([]),
        prisma.dailyInput.findMany({
          where: {
            recordDate: { gte: startOfMonth, lt: endOfMonth },
            status: "confirmed",
            adSite: {
              isArchived: false,
              upstream: {
                adTypeId,
                status: "active",
              },
            },
          },
          select: {
            recordDate: true,
            revenue: true,
            qty: true,
            adSiteId: true,
            adSite: {
              select: {
                upstream: {
                  select: { name: true },
                },
              },
            },
          },
        }) as Promise<DailyInputWithUpstream[]>,
        prisma.downstreamPeriod.findMany({
          where: {
            downstream: {
              adTypeId,
              downstreamType: "ML",
              status: "active",
            },
            startDate: { lte: endOfMonth },
            OR: [{ endDate: null }, { endDate: { gte: startOfMonth } }],
          },
          include: {
            downstream: {
              select: { payoutRate: true },
            },
          },
        }) as Promise<PeriodWithDownstream[]>,
        adTypeCode === "SM"
          ? (prisma.downstreamPeriod.findMany({
              where: {
                downstream: {
                  adTypeId: AD_TYPE_ID_MAP.SM,
                  downstreamType: "LE",
                  status: "active",
                },
                startDate: { lte: endOfMonth },
                OR: [{ endDate: null }, { endDate: { gte: startOfMonth } }],
              },
              include: {
                downstream: {
                  select: { payoutRate: true },
                },
              },
            }) as Promise<PeriodWithDownstream[]>)
          : Promise.resolve([]),
        adTypeCode === "SM"
          ? prisma.yiyiDailyData.findMany({
              where: {
                recordDate: { gte: startOfMonth, lt: endOfMonth },
              },
              select: {
                recordDate: true,
                qty: true,
              },
            })
          : Promise.resolve([]),
        adTypeCode === "SM"
          ? prisma.yiyiDailyPricing.findMany({
              where: {
                recordDate: { gte: startOfMonth, lt: endOfMonth },
              },
              select: {
                recordDate: true,
                unitPrice: true,
              },
            })
          : Promise.resolve([]),
      ])

      const activeUpstreamNames = activeUpstreams.map((upstream) => upstream.name)
      const inputsByDate = groupDailyInputsByBusinessDate(monthlyInputs)
      const mlPeriodMap = buildPeriodMap(mlPeriods)
      const lePeriodMap = buildPeriodMap(lePeriods)
      const yiyiQtyByDate = groupNumbersByBusinessDate(
        yiyiData.map((row) => ({ recordDate: row.recordDate, value: row.qty }))
      )
      const yiyiPricingByDate = groupPricingByBusinessDate(yiyiPricing)

      const results: SummaryRow[] = []

      for (const date of days) {
        const dayInputs = inputsByDate.get(date) ?? []

        const upstreamBreakdown: Record<string, number> = {}
        const upstreamDetailBreakdown: Record<string, { pv: number; unit_price: number; amount: number }> =
          adTypeCode === "360"
            ? Object.fromEntries(
                activeUpstreamNames.map((name) => [
                  name,
                  { pv: 0, unit_price: 0, amount: 0 },
                ])
              )
            : {}

        let totalRevenue = 0
        let totalUV = 0

        for (const row of dayInputs) {
          const upstreamName = row.adSite.upstream.name
          const amount = Number(row.revenue ?? 0)
          const qty = Number(row.qty ?? 0)

          totalRevenue += amount
          totalUV += qty
          upstreamBreakdown[upstreamName] = (upstreamBreakdown[upstreamName] ?? 0) + amount

          if (adTypeCode === "360") {
            const current = upstreamDetailBreakdown[upstreamName] ?? { pv: 0, unit_price: 0, amount: 0 }
            current.pv += qty
            current.amount += amount
            upstreamDetailBreakdown[upstreamName] = current
          }
        }

        const finalizedUpstreamDetailBreakdown =
          adTypeCode === "360"
            ? finalizeUpstreamDetailBreakdown(upstreamDetailBreakdown)
            : undefined

        const activeMlPeriod = getActivePeriodForDate(mlPeriodMap.values().next().value, date)
        const mlPayoutRate = Number(activeMlPeriod?.downstream.payoutRate ?? DEFAULT_ML_PAYOUT_RATE)
        const mlPayout = calculateMlPayoutAmount(totalRevenue, mlPayoutRate)

        let cost = mlPayout
        let lePayout: number | undefined
        let yiyiPayout: number | undefined

        if (adTypeCode === "SM") {
          const activeLePeriod = getActivePeriodForDate(lePeriodMap.values().next().value, date)
          const lePayoutRate = Number(activeLePeriod?.downstream.payoutRate ?? DEFAULT_LE_PAYOUT_RATE)
          const leRevenue = calculateLeRevenueFromSmRevenue(totalRevenue, lePayoutRate)
          const mlUnitPrice = Number(activeLePeriod?.unitPrice ?? DEFAULT_LE_UNIT_PRICE)
          const leMlCost = calculateUnitPricePayout(totalUV, mlUnitPrice)
          const leTax = calculateTaxOnMargin(leRevenue, leMlCost)
          lePayout = calculateNetProfit(leRevenue, leMlCost, leTax)

          const yiyiQty = yiyiQtyByDate.get(date)
          const yiyiUnitPrice = yiyiPricingByDate.get(date) ?? YIYI_DEFAULT_UNIT_PRICE
          yiyiPayout = calculateYiyiAmount(yiyiQty ?? totalUV, yiyiUnitPrice)

          cost = calculateSmDashboardCost(lePayout, yiyiPayout)
        }

        const tax = calculateTaxOnMargin(totalRevenue, cost)
        const profit = calculateNetProfit(totalRevenue, cost, tax)

        results.push({
          date,
          revenue: totalRevenue,
          cost,
          tax,
          profit,
          profit_rate: calculateProfitRate(profit, totalRevenue),
          upstream_breakdown: upstreamBreakdown,
          upstream_detail_breakdown: finalizedUpstreamDetailBreakdown,
          ml_payout: mlPayout,
          le_payout: lePayout,
          yiyi_payout: yiyiPayout,
        })
      }

      results.push(buildMonthlyTotal(results))

      res.json({ success: true, data: results })
    } catch (err: any) {
      console.error("GET /api/dashboard/monthly error:", err)
      res.status(500).json({ success: false, error: "Internal server error" })
    }
  }
)

// ============================================================
// GET /api/dashboard/downstream-monthly
// Query: year, month (1-12), ad_type (SM|360|BAIDU_JS|OTHER)
// Returns aggregated ML and LE from downstream site inputs
// ============================================================
router.get(
  "/downstream-monthly",
  requireAuth,
  [
    query("year").notEmpty().withMessage("year is required").isInt({ min: 2020, max: 2100 }).toInt(),
    query("month").notEmpty().withMessage("month is required").isInt({ min: 1, max: 12 }).toInt(),
    query("ad_type").notEmpty().withMessage("ad_type is required").isIn(["SM", "360", "BAIDU_JS", "OTHER"]),
  ],
  handleValidation,
  async (req: Request, res: Response) => {
    try {
      const year = Number(req.query.year)
      const month = Number(req.query.month)
      const adTypeCode = req.query.ad_type as AdTypeCode
      const adTypeId = AD_TYPE_ID_MAP[adTypeCode]
      const days = getDaysInMonth(year, month)
      const { gte: startOfMonth, lt: endOfMonth } = getBusinessMonthRange(year, month)

      const inputs = (await prisma.dailyInput.findMany({
        where: {
          recordDate: { gte: startOfMonth, lt: endOfMonth },
          status: "confirmed",
          adSite: {
            isArchived: false,
            status: "active",
            downstreams: {
              some: {
                downstream: {
                  adTypeId,
                  status: "active",
                },
              },
            },
          },
        },
        select: {
          recordDate: true,
          qty: true,
          adSite: {
            select: {
              downstreams: {
                where: {
                  downstream: {
                    adTypeId,
                    status: "active",
                  },
                },
                select: {
                  customPrice: true,
                  downstream: {
                    select: {
                      id: true,
                      downstreamType: true,
                    },
                  },
                },
              },
            },
          },
        },
      })) as DailyInputWithUpstream[]

      const downstreamIds = [...new Set(
        inputs.flatMap((input) => input.adSite.downstreams?.map((sd) => sd.downstream.id) ?? [])
      )]

      const [periods, dailyRates] = await Promise.all([
        downstreamIds.length > 0
          ? (prisma.downstreamPeriod.findMany({
              where: {
                downstreamId: { in: downstreamIds },
                startDate: { lte: endOfMonth },
                OR: [{ endDate: null }, { endDate: { gte: startOfMonth } }],
              },
              include: {
                downstream: {
                  select: { payoutRate: true },
                },
              },
            }) as Promise<PeriodWithDownstream[]>)
          : Promise.resolve([]),
        downstreamIds.length > 0
          ? prisma.dailyDownstreamRate.findMany({
              where: {
                downstreamId: { in: downstreamIds },
                date: { gte: startOfMonth, lt: endOfMonth },
              },
              select: {
                downstreamId: true,
                date: true,
                effectiveRate: true,
              },
            })
          : Promise.resolve([]),
      ])

      const inputsByDate = groupDailyInputsByBusinessDate(inputs)
      const periodMap = buildPeriodMap(periods)
      const dailyRateMap = new Map<string, number>()
      const activePeriodCache = new Map<string, { pctHal: number; unitPrice: number }>()

      for (const rate of dailyRates) {
        dailyRateMap.set(`${rate.downstreamId}:${formatBusinessDate(rate.date)}`, Number(rate.effectiveRate))
      }

      const results: { date: string; ml: number; ml_80: number; le: number }[] = []

      for (const date of days) {
        const dayInputs = inputsByDate.get(date) ?? []
        let totalML = 0
        let totalLE = 0

        for (const input of dayInputs) {
          for (const sd of input.adSite.downstreams ?? []) {
            const ds = sd.downstream
            if (ds.downstreamType !== "ML" && ds.downstreamType !== "LE") continue

            const cacheKey = `${ds.id}:${date}`
            let cachedPeriod = activePeriodCache.get(cacheKey)
            if (!cachedPeriod) {
              const activePeriod = getActivePeriodForDate(periodMap.get(ds.id), date)
              cachedPeriod = {
                pctHal: Number(activePeriod?.pctHal ?? 1),
                unitPrice: Number(activePeriod?.unitPrice ?? DEFAULT_DOWNSTREAM_PRICES[String(ds.id)] ?? 0),
              }
              activePeriodCache.set(cacheKey, cachedPeriod)
            }

            const price = sd.customPrice !== null
              ? Number(sd.customPrice)
              : cachedPeriod.unitPrice

            if (price <= 0) continue

            const effectiveRate =
              dailyRateMap.get(cacheKey) ??
              cachedPeriod.pctHal * 100

            const adjustedUV = Math.trunc((input.qty ?? 0) * (effectiveRate / 100))
            const mlValue = calculateDownstreamSiteValue(adjustedUV, price)

            if (ds.downstreamType === "ML") {
              totalML += mlValue
            } else {
              totalLE += mlValue
            }
          }
        }

        results.push({
          date,
          ml: totalML,
          ml_80: applyMl80Rate(totalML),
          le: totalLE,
        })
      }

      res.json({ success: true, data: results })
    } catch (err: any) {
      console.error("GET /api/dashboard/downstream-monthly error:", err)
      res.status(500).json({ success: false, error: "Internal server error" })
    }
  }
)

export default router
