import { Router, Request, Response, NextFunction } from "express"
import { query, validationResult } from "express-validator"
import { requireAuth, requireWriteAccess, AuthRequest } from "../middleware/auth.js"
import prisma from "../prisma.js"
import { formatBusinessDate, getBusinessDateAtHour, getBusinessDayRange, getBusinessMonthRange } from "../utils/date.js"
import {
  DEFAULT_LE_PAYOUT_RATE,
  TAX_RATE,
  calculateCpmRevenue,
  calculateFlatTax,
  calculateLeRevenueFromSmRevenue,
  calculateNetProfit,
  calculateProfitRate,
  calculateYiyiTotal,
  YIYI_DEFAULT_PROFIT_UNIT_PRICE,
  YIYI_DEFAULT_UNIT_PRICE,
} from "../utils/calculations.js"

const router = Router()

interface DailyRow {
  date: string
  smRevenue: number
  leRevenue: number
  taxRate: number
  tax: number
  vendorCost: number
  mlCost: number
  totalCost: number
  profit: number
  profitRate: number
  upstreamBreakdown: Record<string, number>
}

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

const handleValidation = (req: Request, res: Response, next: Function) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, error: errors.array()[0].msg })
    return
  }
  next()
}

// ============================================================
// GET /api/dashboard/le?month=YYYY-MM
// ============================================================
router.get(
  "/le",
  requireAuth,
  [
    query("month").notEmpty().withMessage("month is required").matches(/^\d{4}-(0[1-9]|1[0-2])$/).withMessage("month must be YYYY-MM"),
  ],
  handleValidation,
  async (req: AuthRequest, res: Response) => {
    try {
      const isOfficialView = req.user?.perm_admin === true
      const monthStr = req.query.month as string
      const [year, month] = monthStr.split("-").map(Number)
      const days = getDaysInMonth(year, month)
      const { gte: startOfMonth, lt: endOfMonth } = getBusinessMonthRange(year, month)

      // Look up SM AdType ID from database instead of hardcoded 1
      const smAdType = await prisma.adType.findUnique({
        where: { code: "SM" },
        select: { id: true }
      })
      const smAdTypeId = smAdType?.id ?? 1

      const leDownstream = await prisma.downstream.findFirst({
        where: {
          downstreamType: "LE",
          adTypeId: smAdTypeId, // SM
          status: "active",
        },
        include: {
          adSites: {
            where: {
              adSite: {
                isArchived: false,
              },
            },
            include: {
              adSite: {
                include: {
                  upstream: {
                    select: { name: true },
                  },
                },
              },
            },
          },
        },
        orderBy: { id: "asc" },
      })

      const linkedSites = (leDownstream?.adSites ?? [])
        .map((item) => item.adSite)
        .sort((a, b) => {
          const upstreamCompare = a.upstream.name.localeCompare(b.upstream.name)
          if (upstreamCompare !== 0) return upstreamCompare
          return a.name.localeCompare(b.name)
        })
      const siteIds = linkedSites.map((site) => site.id)
      const siteNames = linkedSites.map((site) => site.name)

      // Fetch all linked LE-SM daily inputs for the month
      const dailyInputs = await prisma.dailyInput.findMany({
        where: {
          recordDate: { gte: startOfMonth, lt: endOfMonth },
          status: isOfficialView ? "confirmed" : undefined,
          adSiteId: { in: siteIds.length > 0 ? siteIds : [-1] },
          adSite: {
            isArchived: false,
            upstream: {
              adTypeId: smAdTypeId, // SM
              status: "active",
            },
          },
        },
        include: {
          adSite: {
            include: { upstream: { select: { name: true } } },
          },
        },
      })

      // Fetch all Yiyi data/pricing for the month.
      // LE downstream expense now follows the Yiyi page "Tổng cộng" value by date.
      const yiyiRecords = await prisma.yiyiDailyData.findMany({
        where: {
          recordDate: { gte: startOfMonth, lt: endOfMonth },
        },
      })
      const yiyiPricings = await prisma.yiyiDailyPricing.findMany({
        where: {
          recordDate: { gte: startOfMonth, lt: endOfMonth },
        },
      })
      const yiyiQtyMap = new Map<string, number>()
      for (const record of yiyiRecords) {
        const dateKey = formatBusinessDate(record.recordDate)
        yiyiQtyMap.set(dateKey, (yiyiQtyMap.get(dateKey) ?? 0) + Number(record.qty ?? 0))
      }
      const yiyiPricingMap = new Map(
        yiyiPricings.map((pricing) => [
          formatBusinessDate(pricing.recordDate),
          {
            unitPrice: Number(pricing.unitPrice ?? YIYI_DEFAULT_UNIT_PRICE),
            profitUnitPrice: Number(
              pricing.profitUnitPrice ?? YIYI_DEFAULT_PROFIT_UNIT_PRICE
            ),
          },
        ] as const)
      )
      const leCostMap = new Map(
        days.map((date) => {
          const totalQty = yiyiQtyMap.get(date) ?? 0
          const pricing = yiyiPricingMap.get(date) ?? {
            unitPrice: YIYI_DEFAULT_UNIT_PRICE,
            profitUnitPrice: YIYI_DEFAULT_PROFIT_UNIT_PRICE,
          }
          const yiyiTotal = calculateYiyiTotal(
            totalQty,
            pricing.unitPrice,
            pricing.profitUnitPrice
          )

          return [
            date,
            {
              vendorCost: yiyiTotal,
              mlCost: 0,
              totalCost: yiyiTotal,
            },
          ] as const
        })
      )

      // Build per-day rows
      const results: DailyRow[] = []
      for (const date of days) {
        const { gte: startOfDay, lt: endOfDay } = getBusinessDayRange(date)

        const dayInputs = dailyInputs.filter((inp) => {
          const rd = new Date(inp.recordDate)
          return rd >= startOfDay && rd < endOfDay
        })

        // SM revenue and ad site breakdown
        const upstreamBreakdown: Record<string, number> = {}
        let smRevenue = 0
        for (const inp of dayInputs) {
          const name = inp.adSite.name
          const actualRevenue = Number(inp.revenue)
          const rebateAmount = Number(inp.rebateAmount ?? 0)
          const quantity = Number(inp.qty ?? 0)
          const unitPriceSnapshot =
            inp.unitPriceSnapshot === null ? null : Number(inp.unitPriceSnapshot)
          const grossRevenue =
            unitPriceSnapshot !== null
              ? calculateCpmRevenue(quantity, unitPriceSnapshot)
              : actualRevenue + rebateAmount

          smRevenue += grossRevenue
          upstreamBreakdown[name] = (upstreamBreakdown[name] ?? 0) + grossRevenue
        }

        const leRevenue = calculateLeRevenueFromSmRevenue(smRevenue, DEFAULT_LE_PAYOUT_RATE)
        const downstreamCosts = leCostMap.get(date) ?? { vendorCost: 0, mlCost: 0, totalCost: 0 }
        const taxRate = TAX_RATE
        const tax = calculateFlatTax(leRevenue, taxRate)
        const profit = calculateNetProfit(leRevenue, downstreamCosts.totalCost, tax)
        const profitRate = calculateProfitRate(profit, leRevenue)

        results.push({
          date,
          smRevenue,
          leRevenue,
          taxRate,
          tax,
          vendorCost: downstreamCosts.vendorCost,
          mlCost: downstreamCosts.mlCost,
          totalCost: downstreamCosts.totalCost,
          profit,
          profitRate,
          upstreamBreakdown,
        })
      }

      // Total row
      const totalSmRevenue = results.reduce((s, r) => s + r.smRevenue, 0)
      const totalLeRevenue = results.reduce((s, r) => s + r.leRevenue, 0)
      const totalVendorCost = results.reduce((s, r) => s + r.vendorCost, 0)
      const totalMlCost = results.reduce((s, r) => s + r.mlCost, 0)
      const totalCost = results.reduce((s, r) => s + r.totalCost, 0)
      const totalTax = results.reduce((s, r) => s + r.tax, 0)
      const totalProfit = results.reduce((s, r) => s + r.profit, 0)
      const totalProfitRate = totalLeRevenue > 0 ? totalProfit / totalLeRevenue : 0
      const totalUpstreamBreakdown: Record<string, number> = {}
      for (const r of results) {
        for (const [k, v] of Object.entries(r.upstreamBreakdown)) {
          totalUpstreamBreakdown[k] = (totalUpstreamBreakdown[k] ?? 0) + v
        }
      }

      const totalRow: DailyRow & { isTotal: true } = {
        date: "TOTAL",
        smRevenue: totalSmRevenue,
        leRevenue: totalLeRevenue,
        taxRate: TAX_RATE,
        tax: totalTax,
        vendorCost: totalVendorCost,
        mlCost: totalMlCost,
        totalCost,
        profit: totalProfit,
        profitRate: totalProfitRate,
        upstreamBreakdown: totalUpstreamBreakdown,
        isTotal: true,
      }

      res.json({
        success: true,
        data: {
          upstreamNames: siteNames,
          rows: [...results, totalRow],
        },
      })
    } catch (err: any) {
      console.error("GET /api/dashboard/le error:", err)
      res.status(500).json({ success: false, error: "Internal server error" })
    }
  }
)

// ============================================================
// POST /api/dashboard/le/cost
// Body: { date: string, vendorCost?: number, mlCost?: number, costAmount?: number }
// ============================================================
router.post(
  "/le/cost",
  requireAuth,
  requireWriteAccess,
  (req: AuthRequest, res: Response, next: NextFunction) => {
    if (req.user?.perm_admin || req.user?.perm_data_input) {
      next()
      return
    }
    res.status(403).json({ success: false, error: "Permission denied" })
  },
  async (req: AuthRequest, res: Response) => {
    try {
      const {
        date,
        vendorCost: rawVendorCost,
        mlCost: rawMlCost,
        costAmount,
      } = req.body as {
        date: string
        vendorCost?: number
        mlCost?: number
        costAmount?: number
      }

      if (
        !date ||
        (
          typeof rawVendorCost !== "number" &&
          typeof rawMlCost !== "number" &&
          typeof costAmount !== "number"
        )
      ) {
        res.status(400).json({
          success: false,
          error: "date and at least one of vendorCost, mlCost, costAmount are required",
        })
        return
      }

      const vendorCost =
        typeof rawVendorCost === "number"
          ? rawVendorCost
          : typeof costAmount === "number"
            ? costAmount
            : 0
      const mlCost = typeof rawMlCost === "number" ? rawMlCost : 0
      const totalCost = vendorCost + mlCost
      const recordDate = getBusinessDateAtHour(date, 12)

      const record = await prisma.lEDailyCost.upsert({
        where: { recordDate },
        update: {
          vendorCost,
          mlCost,
          costAmount: totalCost,
        },
        create: {
          recordDate,
          vendorCost,
          mlCost,
          costAmount: totalCost,
        },
      })

      res.json({ success: true, data: record })
    } catch (err: any) {
      console.error("POST /api/dashboard/le/cost error:", err)
      res.status(500).json({ success: false, error: "Internal server error" })
    }
  }
)

export default router
