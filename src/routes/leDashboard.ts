import { Router, Request, Response } from "express"
import { query, validationResult } from "express-validator"
import { requireAuth, AuthRequest } from "../middleware/auth.js"
import prisma from "../prisma.js"
import { formatBusinessDate, getBusinessDateAtHour, getBusinessDayRange, getBusinessMonthRange } from "../utils/date.js"

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

      const leDownstream = await prisma.downstream.findFirst({
        where: {
          downstreamType: "LE",
          adTypeId: 1, // SM
          status: "active",
        },
        include: {
          adSites: {
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
          adSiteId: siteIds.length > 0 ? { in: siteIds } : undefined,
          adSite: {
            upstream: {
              adTypeId: 1, // SM
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

      // Fetch all LE daily costs for the month
      const leCosts = await prisma.lEDailyCost.findMany({
        where: {
          recordDate: { gte: startOfMonth, lt: endOfMonth },
        },
      })
      const leCostMap = new Map(
        leCosts.map((cost) => {
          const vendorCost = Number(cost.vendorCost ?? 0)
          const mlCost = Number(cost.mlCost ?? 0)
          const legacyTotalCost = Number(cost.costAmount ?? 0)
          const hasBreakdown = vendorCost !== 0 || mlCost !== 0

          return [
            formatBusinessDate(cost.recordDate),
            {
              vendorCost: hasBreakdown ? vendorCost : legacyTotalCost,
              mlCost: hasBreakdown ? mlCost : 0,
              totalCost: hasBreakdown ? vendorCost + mlCost : legacyTotalCost,
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
          const rev = Number(inp.revenue)
          smRevenue += rev
          upstreamBreakdown[name] = (upstreamBreakdown[name] ?? 0) + rev
        }

        const leRevenue = smRevenue * 0.9
        const downstreamCosts = leCostMap.get(date) ?? { vendorCost: 0, mlCost: 0, totalCost: 0 }
        const taxRate = 0.06
        const tax = leRevenue * taxRate
        const profit = leRevenue - tax - downstreamCosts.totalCost
        const profitRate = leRevenue > 0 ? profit / leRevenue : 0

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
        taxRate: 0.06,
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
  async (req: Request, res: Response) => {
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
