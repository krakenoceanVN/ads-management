import { Router, Request, Response } from "express"
import { body, param, query, validationResult } from "express-validator"
import { requirePermission, requireAuth, AuthRequest } from "../middleware/auth.js"
import { AdSite, DailyInputRow, DailyInputRecord, BatchInputItem, AdTypeCode, InputStatus } from "../types/index.js"
import prisma from "../prisma.js"
import { formatBusinessDate, getBusinessDayRange, getBusinessDayStart } from "../utils/date.js"

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

// ============================================================
// GET /api/daily-input
// Query: date (YYYY-MM-DD), ad_type (SM|360|BAIDU_JS)
// ============================================================
router.get(
  "/",
  [
    query("date").notEmpty().withMessage("date is required").isISO8601(),
    query("ad_type").notEmpty().withMessage("ad_type is required").isIn(["SM", "360", "BAIDU_JS", "OTHER"]),
    query("search").optional().isString(),
    query("status").optional().isIn(["confirmed", "unconfirmed"]),
  ],
  handleValidation,
  async (req: AuthRequest, res: Response) => {
    try {
      const dateStr = (req.query.date as string)
      const adTypeCode = (req.query.ad_type as AdTypeCode)
      const search = (req.query.search as string | undefined)?.trim()
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

      // 1. Lấy tất cả ad_sites theo ad_type + search (Nguồn trên OR Ad Site)
      const adSites = await prisma.adSite.findMany({
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
      })

      if (adSites.length === 0) {
        res.json({ success: true, data: [] })
        return
      }

      const siteIds = adSites.map((s) => s.id)

      // 2. LEFT JOIN daily_input WHERE record_date = date (using range for TZ safety)
      const { gte: startOfDay, lt: endOfDay } = getBusinessDayRange(dateStr)
      const records = await prisma.dailyInput.findMany({
        where: {
          recordDate: { gte: startOfDay, lt: endOfDay },
          adSiteId: { in: siteIds },
        },
      })

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
  requirePermission("perm_data_input"),
  [
    body("date").notEmpty().withMessage("date is required").isISO8601(),
    body("ad_type").notEmpty().withMessage("ad_type is required").isIn(["SM", "360", "BAIDU_JS", "OTHER"]),
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
      if (date > formatBusinessDate(new Date())) {
        res.status(400).json({ success: false, error: "Cannot input future date" })
        return
      }

      // Fetch all involved ad_sites
      const siteIds = records.map((r) => r.ad_site_id)
      const adSites = await prisma.adSite.findMany({
        where: { id: { in: siteIds } },
        include: { upstream: { include: { adType: true } } },
      })
      const siteMap = new Map(adSites.map((s) => [s.id, s]))

      const errors: { ad_site_id: number; message: string }[] = []
      let saved = 0

      for (const item of records) {
        const site = siteMap.get(item.ad_site_id)
        if (!site) {
          errors.push({ ad_site_id: item.ad_site_id, message: "Ad site not found" })
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

        if (site.billingMethod === "CPM") {
          // CPM: use stored snapshot price (or override) for revenue calculation
          const basePrice = existing?.unitPriceSnapshot ?? site.currentUnitPrice ?? 0
          const unitPrice = item.unit_price_override ?? Number(basePrice)
          revenue = (item.qty ?? 0) * unitPrice
        } else {
          // RATIO: ratio_override from frontend > existing snapshot > current ratio
          const baseRatio = item.ratio_override ?? existing?.ratioSnapshot ?? site.currentRatio ?? 1
          const ratio = item.ratio_override !== undefined
            ? Number(item.ratio_override)
            : (item.amount1 !== undefined || item.amount2 !== undefined
              ? Number(baseRatio)
              : Number(site.currentRatio ?? 1))
          revenue = ((item.amount1 ?? 0) + (item.amount2 ?? 0)) * ratio
        }

        if (existing) {
          // UPDATE unconfirmed record
          const updateData: Record<string, unknown> = {
            amount1: item.amount1,
            amount2: item.amount2,
            ratioSnapshot: site.billingMethod === "RATIO"
              ? (item.ratio_override ?? existing.ratioSnapshot ?? site.currentRatio)
              : undefined,
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
// POST /api/daily-input/:id/unconfirm
// ============================================================
router.post(
  "/:id/unconfirm",
  requireAuth,
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
      if (existing.status !== "confirmed") {
        res.status(409).json({ success: false, error: "Record not confirmed — cannot unconfirm" })
        return
      }

      await prisma.dailyInput.update({
        where: { id },
        data: { status: "unconfirmed" },
      })

      res.json({ success: true, message: "Unconfirmed" })
    } catch (err: any) {
      console.error("POST /api/daily-input/:id/unconfirm error:", err)
      res.status(500).json({ success: false, error: "Internal server error" })
    }
  }
)

// ============================================================
// DELETE /api/daily-input/:id
// ============================================================
router.delete(
  "/:id",
  requireAuth,
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
