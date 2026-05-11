import { Router, Request, Response } from "express"
import { body, param, query, validationResult } from "express-validator"
import { requirePermission, requireAuth, requireWriteAccess, AuthRequest } from "../middleware/auth.js"
import { AdSite, DailyInputRow, DailyInputRecord, BatchInputItem, AdTypeCode, InputStatus } from "../types/index.js"
import prisma from "../prisma.js"
import { formatBusinessDate, getBusinessDayRange, getBusinessDayStart } from "../utils/date.js"
import { calculateActualRevenue, calculateCpmRevenue, calculateRatioRevenue, calculateRebateAmount } from "../utils/calculations.js"

const router = Router()

// ============================================================
// Validation helpers
// ============================================================
const handleValidation = (req: Request, res: Response, next: Function) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, error: errors.array()[0].msg })
    return
  }
  next()
}

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

async function unconfirmDailyInputRecord(req: AuthRequest, res: Response) {
  try {
    const id = Number(req.params.id)

    const existing = await prisma.dailyInput.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ success: false, error: "Record not found" })
      return
    }
    if (existing.status !== "confirmed") {
      res.status(409).json({ success: false, error: "Record not confirmed — cannot unconfirm" })
      return
    }

    const updated = await prisma.dailyInput.update({
      where: { id },
      data: { status: "unconfirmed" },
    })

    res.json({ success: true, data: updated, message: "Unconfirmed" })
  } catch (err: any) {
    console.error("PUT /api/daily-input/:id/unconfirm error:", err)
    res.status(500).json({ success: false, error: "Internal server error" })
  }
}

// ============================================================
// GET /api/daily-input
// Query: date (YYYY-MM-DD), ad_type (SM|360|BAIDU_JS)
// ============================================================
router.get(
  "/",
  requireAuth,
  [
    query("date").notEmpty().withMessage("date is required").isISO8601(),
    query("ad_type").notEmpty().withMessage("ad_type is required"),
    query("search").optional().isString(),
    query("status").optional().isIn(["confirmed", "unconfirmed"]),
  ],
  handleValidation,
  async (req: AuthRequest, res: Response) => {
    try {
      const dateStr = (req.query.date as string)
      const adTypeCode = (req.query.ad_type as AdTypeCode)
      const search = (req.query.search as string | undefined)?.trim()
      const { gte: startOfDay, lt: endOfDay } = getBusinessDayRange(dateStr)
      const searchFilter = search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              {
                upstream: {
                  name: { contains: search, mode: "insensitive" as const },
                },
              },
            ],
          }
        : undefined

      // 1. Site đang chạy + site đã có record lịch sử trong ngày đó
      const [activeSites, records] = await Promise.all([
        prisma.adSite.findMany({
          where: {
            isActive: true,
            isArchived: false,
            status: "active",
            upstream: {
              status: "active",
              adType: { code: adTypeCode },
            },
            ...searchFilter,
          },
          include: {
            upstream: { include: { adType: true } },
          },
          orderBy: { name: "asc" },
        }),
        prisma.dailyInput.findMany({
          where: {
            recordDate: { gte: startOfDay, lt: endOfDay },
            adSite: {
              isArchived: false,
              status: "active",
              upstream: {
                status: "active",
                adType: { code: adTypeCode },
              },
              ...searchFilter,
            },
          },
          include: {
            adSite: {
              include: {
                upstream: { include: { adType: true } },
              },
            },
          },
        }),
      ])

      const siteMap = new Map<number, (typeof activeSites)[number]>()
      for (const site of activeSites) {
        siteMap.set(site.id, site)
      }
      for (const record of records) {
        if (!siteMap.has(record.adSiteId)) {
          siteMap.set(record.adSiteId, record.adSite)
        }
      }
      const adSites = Array.from(siteMap.values()).sort((a, b) => a.name.localeCompare(b.name))

      if (adSites.length === 0) {
        res.json({ success: true, data: [] })
        return
      }

      const siteIds = adSites.map((s) => s.id)
      const activeRebateRateMap =
        adTypeCode === "SM"
          ? await getActiveAdSiteRebateRateMap(siteIds, getBusinessDayStart(dateStr))
          : new Map<number, number>()

      // Map Prisma camelCase → snake_case DailyInputRecord
      const recordMap = new Map<number, DailyInputRecord>()
      for (const r of records) {
        recordMap.set(r.adSiteId, {
          id: r.id,
          record_date: formatBusinessDate(r.recordDate),
          ad_site_id: r.adSiteId,
          qty: r.qty ?? undefined,
          unit_price_snapshot: r.unitPriceSnapshot ? Number(r.unitPriceSnapshot) : undefined,
          amount1: Number(r.amount1),
          amount2: Number(r.amount2),
          ratio_snapshot: r.ratioSnapshot ? Number(r.ratioSnapshot) : undefined,
          rebate_amount: Number(r.rebateAmount),
          rebate_rate_snapshot: Number(r.rebateRateSnapshot),
          actual_revenue: Number(r.revenue),
          revenue: Number(r.revenue),
          status: r.status as InputStatus,
          created_at: r.createdAt,
          updated_at: r.updatedAt,
        })
      }

      // 3. Build DailyInputRow[] (AdSite snake_case shape + existing_record)
      const rows = adSites.map((site) => ({
        id: site.id,
        upstream_id: site.upstreamId,
        name: site.name,
        billing_method: site.billingMethod as AdSite["billing_method"],
        current_unit_price: site.currentUnitPrice ? Number(site.currentUnitPrice) : undefined,
        current_ratio: site.currentRatio ? Number(site.currentRatio) : undefined,
        status: site.status as AdSite["status"],
        upstream_name: site.upstream.name,
        ad_type_id: site.upstream.adTypeId,
        ad_type_code: site.upstream.adType.code as AdTypeCode,
        active_rebate_rate: adTypeCode === "SM" ? (activeRebateRateMap.get(site.id) ?? 0) : undefined,
        existing_record: recordMap.get(site.id) ?? null,
        created_at: site.createdAt,
        updated_at: site.updatedAt,
      })) as DailyInputRow[]

      res.json({ success: true, data: rows })
    } catch (err: any) {
      console.error("GET /api/daily-input error:", err)
      res.status(500).json({ success: false, error: "Internal server error" })
    }
  }
)

// ============================================================
// POST /api/daily-input/batch
// Body: { date: string, ad_type: AdTypeCode, records: BatchInputItem[] }
// ============================================================
router.post(
  "/batch",
  requireAuth,
  requireWriteAccess,
  requirePermission("perm_data_input"),
  [
    body("date").notEmpty().withMessage("date is required").isISO8601(),
    body("ad_type").notEmpty().withMessage("ad_type is required"),
    body("records").isArray({ min: 1 }).withMessage("records must be a non-empty array"),
  ],
  handleValidation,
  async (req: AuthRequest, res: Response) => {
    try {
      const { date, ad_type, records } = req.body as {
        date: string
        ad_type: AdTypeCode
        records: BatchInputItem[]
      }
      const userId = req.user!.id

      // Validate: date <= today
      const inputDate = getBusinessDayStart(date)
      const todayDate = getBusinessDayStart(formatBusinessDate(new Date()))
      if (inputDate.getTime() > todayDate.getTime()) {
        res.status(400).json({ success: false, error: "Cannot input future date" })
        return
      }

      const { gte: startOfDay, lt: endOfDay } = getBusinessDayRange(date)

      // Fetch all involved ad_sites
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
        ad_type === "SM"
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
        if (site.upstream.adType.code !== ad_type) {
          errors.push({ ad_site_id: item.ad_site_id, message: `Site does not belong to ${ad_type}` })
          continue
        }

        // Check existing record
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

          if (ad_type === "SM") {
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
            rebateAmount: site.billingMethod === "CPM" && ad_type === "SM" ? rebateAmount : existing.rebateAmount,
            rebateRateSnapshot: site.billingMethod === "CPM" && ad_type === "SM" ? rebateRateSnapshot : existing.rebateRateSnapshot,
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
              rebateAmount: site.billingMethod === "CPM" && ad_type === "SM" ? rebateAmount : 0,
              rebateRateSnapshot: site.billingMethod === "CPM" && ad_type === "SM" ? rebateRateSnapshot : 0,
              revenue,
              status: "unconfirmed",
              createdBy: userId,
            },
          })
        }
        saved++
      }

      res.json({ success: true, saved, errors })
    } catch (err: any) {
      console.error("POST /api/daily-input/batch error:", err)
      res.status(500).json({ success: false, error: "Internal server error" })
    }
  }
)

// ============================================================
// POST /api/daily-input/confirm-batch
// Body: { ids: number[] }
// ============================================================
router.post(
  "/confirm-batch",
  requireAuth,
  requireWriteAccess,
  requirePermission("perm_data_confirm"),
  [
    body("ids").isArray({ min: 1 }).withMessage("ids must be a non-empty array"),
    body("ids.*").isInt().toInt().withMessage("all ids must be integers"),
  ],
  handleValidation,
  async (req: AuthRequest, res: Response) => {
    try {
      const ids = [...new Set((req.body.ids as number[]).map(Number).filter(Number.isInteger))]

      if (ids.length === 0) {
        res.status(400).json({ success: false, error: "No valid ids provided" })
        return
      }

      const result = await prisma.dailyInput.updateMany({
        where: {
          id: { in: ids },
          status: "unconfirmed",
        },
        data: {
          status: "confirmed",
        },
      })

      res.json({ success: true, updated: result.count })
    } catch (err: any) {
      console.error("POST /api/daily-input/confirm-batch error:", err)
      res.status(500).json({ success: false, error: "Internal server error" })
    }
  }
)

// ============================================================
// POST /api/daily-input/:id/confirm
// ============================================================
router.post(
  "/:id/confirm",
  requireAuth,
  requireWriteAccess,
  requirePermission("perm_data_confirm"),
  [param("id").isInt().toInt()],
  handleValidation,
  async (req: AuthRequest, res: Response) => {
    try {
      const id = Number(req.params.id)

      const existing = await prisma.dailyInput.findUnique({ where: { id } })
      if (!existing) {
        res.status(404).json({ success: false, error: "Record not found" })
        return
      }
      if (existing.status === "confirmed") {
        res.status(409).json({ success: false, error: "Already confirmed" })
        return
      }

      await prisma.dailyInput.update({
        where: { id },
        data: { status: "confirmed" },
      })

      res.json({ success: true, message: "Confirmed" })
    } catch (err: any) {
      console.error("POST /api/daily-input/:id/confirm error:", err)
      res.status(500).json({ success: false, error: "Internal server error" })
    }
  }
)

// ============================================================
// PUT /api/daily-input/:id/unconfirm
// ============================================================
router.put(
  "/:id/unconfirm",
  requireAuth,
  requireWriteAccess,
  requirePermission("perm_admin"),
  [param("id").isInt().toInt()],
  handleValidation,
  unconfirmDailyInputRecord
)

// Backward-compatible alias, still admin-only
router.post(
  "/:id/unconfirm",
  requireAuth,
  requireWriteAccess,
  requirePermission("perm_admin"),
  [param("id").isInt().toInt()],
  handleValidation,
  unconfirmDailyInputRecord
)

// ============================================================
// DELETE /api/daily-input/:id
// ============================================================
router.delete(
  "/:id",
  requireAuth,
  requireWriteAccess,
  requirePermission("perm_data_input"),
  [param("id").isInt().toInt()],
  handleValidation,
  async (req: AuthRequest, res: Response) => {
    try {
      const id = Number(req.params.id)

      const existing = await prisma.dailyInput.findUnique({ where: { id } })
      if (!existing) {
        res.status(404).json({ success: false, error: "Record not found" })
        return
      }
      if (existing.status === "confirmed") {
        res.status(409).json({ success: false, error: "Cannot delete confirmed record" })
        return
      }

      await prisma.dailyInput.delete({ where: { id } })

      res.json({ success: true, message: "Deleted" })
    } catch (err: any) {
      console.error("DELETE /api/daily-input/:id error:", err)
      res.status(500).json({ success: false, error: "Internal server error" })
    }
  }
)

export default router
