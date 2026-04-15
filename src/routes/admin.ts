import { Router, Request, Response } from "express"
import { body, param, query, validationResult } from "express-validator"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import { requirePermission, requireAuth, AuthRequest } from "../middleware/auth.js"
import { UserPublic, UserStatus } from "../types/index.js"
import prisma from "../prisma.js"
import { formatBusinessDate, getBusinessDayRange, getBusinessMonthRange } from "../utils/date.js"

const router = Router()
const JWT_SECRET = process.env.JWT_SECRET ?? "change-me-in-production"
const JWT_EXPIRES_IN = "8h"
const DEFAULT_DOWNSTREAM_PRICES: Record<string, number> = {
  "18": 95,
  "19": 16,
  "21": 80,
  "22": 75,
  "23": 70,
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
// GET /api/admin/ad-sites
// ============================================================
router.get(
  "/admin/ad-sites",
  requireAuth,
  requirePermission("perm_admin"),
  async (_req: Request, res: Response) => {
    try {
      const sites = await prisma.adSite.findMany({
        include: {
          upstream: {
            include: { adType: true },
          },
          downstreams: {
            include: { downstream: true },
          },
        },
        orderBy: [{ upstream: { name: "asc" } }, { name: "asc" }],
      })

      // Get active downstream periods for pricing
      const now = new Date()
      const periods = await prisma.downstreamPeriod.findMany({
        where: {
          startDate: { lte: now },
          OR: [{ endDate: null }, { endDate: { gte: now } }],
        },
        include: { downstream: true },
      })
      const periodMap = new Map(periods.map((p) => [p.downstreamId, p]))

      const result = sites.map((site) => ({
        id: site.id,
        ad_type_code: site.upstream.adType.code,
        upstream_name: site.upstream.name,
        ad_site_name: site.name,
        billing_method: site.billingMethod,
        current_unit_price: site.currentUnitPrice ? Number(site.currentUnitPrice) : null,
        current_ratio: site.currentRatio ? Number(site.currentRatio) : null,
        status: site.status,
        downstream_ids: site.downstreams.map((d) => d.downstreamId),
        downstream_prices: site.downstreams.reduce((acc: Record<string, number>, d) => {
          if (d.customPrice !== null) {
            acc[d.downstreamId] = Number(d.customPrice)
          }
          return acc
        }, {}),
      }))

      res.json({ success: true, data: result })
    } catch (err: any) {
      console.error("GET /api/admin/ad-sites error:", err)
      res.status(500).json({ success: false, error: "Internal server error" })
    }
  }
)

// ============================================================
// GET /api/admin/downstreams
// ============================================================
router.get(
  "/admin/downstreams",
  requireAuth,
  async (_req: Request, res: Response) => {
    try {
      const downstreams = await prisma.downstream.findMany({
        include: {
          adType: true,
          adSites: true,
        },
        orderBy: { id: "asc" },
      })

      const result = downstreams.map((d) => ({
        id: d.id,
        ad_type_code: d.adType.code,
        downstream_type: d.downstreamType,
        payout_rate: Number(d.payoutRate),
        site_count: d.adSites.length,
        status: d.status,
      }))

      res.json({ success: true, data: result })
    } catch (err: any) {
      console.error("GET /api/admin/downstreams error:", err)
      res.status(500).json({ success: false, error: "Internal server error" })
    }
  }
)

// ============================================================
// GET /api/admin/downstream-periods
// ============================================================
router.get(
  "/admin/downstream-periods",
  requireAuth,
  async (_req: Request, res: Response) => {
    try {
      const periods = await prisma.downstreamPeriod.findMany({
        include: {
          downstream: {
            include: { adType: true },
          },
        },
        orderBy: { startDate: "desc" },
      })

      const result = periods.map((p) => ({
        id: p.id,
        downstream_id: p.downstreamId,
        downstream_type: p.downstream.downstreamType,
        ad_type_code: p.downstream.adType.code,
        pct_hal: Number(p.pctHal),
        unit_price: p.unitPrice ? Number(p.unitPrice) : null,
        start_date: formatBusinessDate(p.startDate),
        end_date: p.endDate ? formatBusinessDate(p.endDate) : null,
        note: p.note,
      }))

      res.json({ success: true, data: result })
    } catch (err: any) {
      console.error("GET /api/admin/downstream-periods error:", err)
      res.status(500).json({ success: false, error: "Internal server error" })
    }
  }
)

// ============================================================
// GET /api/admin/downstream-sites/:downstreamId/inputs
// Query: date (optional, YYYY-MM-DD) or month (optional, YYYY-MM)
// If neither is provided, returns the latest input per site
// ============================================================
router.get(
  "/admin/downstream-sites/:downstreamId/inputs",
  requireAuth,
  [
    query("date").optional().isISO8601(),
    query("month").optional().matches(/^\d{4}-\d{2}$/).withMessage("month must be YYYY-MM"),
  ],
  handleValidation,
  async (req: AuthRequest, res: Response) => {
    try {
      const isOfficialView = req.user?.perm_admin === true
      const downstreamId = parseInt(req.params.downstreamId as string)
      const dateStr = req.query.date as string | undefined
      const monthStr = req.query.month as string | undefined

      // Get the downstream to know ad_type
      const downstream = await prisma.downstream.findUnique({
        where: { id: downstreamId },
        include: { adType: true },
      })
      if (!downstream) {
        res.status(404).json({ success: false, error: "Downstream not found" })
        return
      }

      // Get ad sites linked to this downstream
      const siteDownstreams = await prisma.adSiteDownstream.findMany({
        where: { downstreamId },
        include: {
          adSite: {
            include: { upstream: { include: { adType: true } } },
          },
        },
      })

      if (siteDownstreams.length === 0) {
        res.json({ success: true, data: [] })
        return
      }

      const siteIds = siteDownstreams.map((sd) => sd.adSiteId)
      const priceReferenceDate = dateStr
        ? new Date(dateStr)
        : monthStr
          ? new Date(`${monthStr}-01`)
          : new Date()
      const activePeriod = await prisma.downstreamPeriod.findFirst({
        where: {
          downstreamId,
          startDate: { lte: priceReferenceDate },
          OR: [{ endDate: null }, { endDate: { gte: priceReferenceDate } }],
        },
        orderBy: { startDate: "desc" },
      })

      // Get daily inputs for these sites
      let inputsQuery: any = {
        where: {
          adSiteId: { in: siteIds },
          status: isOfficialView ? "confirmed" : undefined,
        },
        orderBy: [{ adSiteId: "asc" }, { recordDate: "desc" }],
      }

      // If date provided, filter by that date; if month provided, fetch all inputs in month; otherwise get latest per site
      if (dateStr) {
        const { gte: startOfDay, lt: endOfDay } = getBusinessDayRange(dateStr)
        inputsQuery = {
          where: {
            adSiteId: { in: siteIds },
            status: isOfficialView ? "confirmed" : undefined,
            recordDate: { gte: startOfDay, lt: endOfDay },
          },
          orderBy: [{ adSiteId: "asc" }, { recordDate: "asc" }],
        }
      } else if (monthStr) {
        const [year, month] = monthStr.split("-").map(Number)
        const { gte: startOfMonth, lt: endOfMonth } = getBusinessMonthRange(year, month)
        inputsQuery = {
          where: {
            adSiteId: { in: siteIds },
            status: isOfficialView ? "confirmed" : undefined,
            recordDate: { gte: startOfMonth, lt: endOfMonth },
          },
          orderBy: [{ adSiteId: "asc" }, { recordDate: "asc" }],
        }
      }

      const inputs = await prisma.dailyInput.findMany(inputsQuery)

      const inputMap = new Map<number, any[]>()
      const inputByDateMap = new Map<number, Record<string, any>>()
      for (const input of inputs) {
        const formattedInput = {
          date: formatBusinessDate(input.recordDate),
          qty: input.qty,
          amount1: input.amount1 ? Number(input.amount1) : null,
          amount2: input.amount2 ? Number(input.amount2) : null,
          revenue: Number(input.revenue),
          status: input.status,
        }

        const currentByDate = inputByDateMap.get(input.adSiteId) ?? {}
        currentByDate[formattedInput.date] = formattedInput
        inputByDateMap.set(input.adSiteId, currentByDate)

        if (monthStr || dateStr) {
          const current = inputMap.get(input.adSiteId) ?? []
          current.push(formattedInput)
          inputMap.set(input.adSiteId, current)
          continue
        }

        if (!inputMap.has(input.adSiteId)) {
          inputMap.set(input.adSiteId, [formattedInput])
        }
      }

      const result = siteDownstreams.map((sd) => ({
        id: sd.adSite.id,
        ad_site_name: sd.adSite.name,
        upstream_name: sd.adSite.upstream.name,
        billing_method: sd.adSite.billingMethod,
        custom_price: (sd as any).customPrice ? Number((sd as any).customPrice) : null,
        resolved_price:
          (sd as any).customPrice !== null
            ? Number((sd as any).customPrice)
            : Number(activePeriod?.unitPrice ?? DEFAULT_DOWNSTREAM_PRICES[String(downstreamId)] ?? 0),
        input: inputMap.get(sd.adSite.id)?.[0] ?? null,
        inputs: inputMap.get(sd.adSite.id) ?? [],
        inputs_by_date: inputByDateMap.get(sd.adSite.id) ?? {},
      }))

      res.json({ success: true, data: result })
    } catch (err: any) {
      console.error("GET /api/admin/downstream-sites/:downstreamId/inputs error:", err)
      res.status(500).json({ success: false, error: "Internal server error" })
    }
  }
)

// ============================================================
// CRUD: Upstreams
// ============================================================
router.get(
  "/admin/upstreams",
  requireAuth,
  requirePermission("perm_admin"),
  async (_req: Request, res: Response) => {
    try {
      const upstreams = await prisma.upstream.findMany({
        include: { adType: true },
        orderBy: [{ adType: { code: "asc" } }, { name: "asc" }],
      })
      const result = upstreams.map((u) => ({
        id: u.id,
        ad_type_id: u.adTypeId,
        ad_type_code: u.adType.code,
        ad_type_name: u.adType.name,
        name: u.name,
        status: u.status,
      }))
      res.json({ success: true, data: result })
    } catch (err: any) {
      console.error("GET /api/admin/upstreams error:", err)
      res.status(500).json({ success: false, error: "Internal server error" })
    }
  }
)

router.post(
  "/admin/upstreams",
  requireAuth,
  requirePermission("perm_admin"),
  [
    body("name").notEmpty().withMessage("name required").isLength({ max: 200 }),
    body("ad_type_id").isInt().toInt(),
    body("status").optional().isIn(["active", "inactive"]),
  ],
  handleValidation,
  async (req: Request, res: Response) => {
    try {
      const { name, ad_type_id, status } = req.body
      const existing = await prisma.adType.findUnique({ where: { id: ad_type_id } })
      if (!existing) {
        res.status(400).json({ success: false, error: "Ad type not found" })
        return
      }
      const upstream = await prisma.upstream.create({
        data: { name, adTypeId: ad_type_id, status: status ?? "active" },
      })
      res.status(201).json({ success: true, data: { id: upstream.id, name: upstream.name, ad_type_id: upstream.adTypeId, status: upstream.status } })
    } catch (err: any) {
      console.error("POST /api/admin/upstreams error:", err)
      res.status(500).json({ success: false, error: "Internal server error" })
    }
  }
)

router.put(
  "/admin/upstreams/:id",
  requireAuth,
  requirePermission("perm_admin"),
  [
    param("id").isInt().toInt(),
    body("name").optional().isLength({ max: 200 }),
    body("ad_type_id").optional().isInt().toInt(),
    body("status").optional().isIn(["active", "inactive"]),
  ],
  handleValidation,
  async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id)
      const { name, ad_type_id, status } = req.body
      const existing = await prisma.upstream.findUnique({ where: { id } })
      if (!existing) {
        res.status(404).json({ success: false, error: "Upstream not found" })
        return
      }
      const updateData: Record<string, unknown> = {}
      if (name !== undefined) updateData.name = name
      if (ad_type_id !== undefined) {
        const at = await prisma.adType.findUnique({ where: { id: ad_type_id } })
        if (!at) { res.status(400).json({ success: false, error: "Ad type not found" }); return }
        updateData.adTypeId = ad_type_id
      }
      if (status !== undefined) updateData.status = status
      const updated = await prisma.upstream.update({ where: { id }, data: updateData })
      res.json({ success: true, data: { id: updated.id, name: updated.name, ad_type_id: updated.adTypeId, status: updated.status } })
    } catch (err: any) {
      console.error("PUT /api/admin/upstreams/:id error:", err)
      res.status(500).json({ success: false, error: "Internal server error" })
    }
  }
)

router.delete(
  "/admin/upstreams/:id",
  requireAuth,
  requirePermission("perm_admin"),
  [param("id").isInt().toInt()],
  handleValidation,
  async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id)
      const sites = await prisma.adSite.findMany({ where: { upstreamId: id }, take: 1 })
      if (sites.length > 0) {
        res.status(409).json({ success: false, error: "Upstream has ad sites — delete sites first" })
        return
      }
      await prisma.upstream.delete({ where: { id } })
      res.json({ success: true, message: "Upstream deleted" })
    } catch (err: any) {
      console.error("DELETE /api/admin/upstreams/:id error:", err)
      res.status(500).json({ success: false, error: "Internal server error" })
    }
  }
)

// ============================================================
// GET: AdTypes
// ============================================================
router.get(
  "/admin/ad-types",
  requireAuth,
  requirePermission("perm_admin"),
  handleValidation,
  async (_req: Request, res: Response) => {
    try {
      const adTypes = await prisma.adType.findMany({ orderBy: { code: "asc" } })
      res.json({ success: true, data: adTypes })
    } catch (err: any) {
      console.error("GET /api/admin/ad-types error:", err)
      res.status(500).json({ success: false, error: "Internal server error" })
    }
  }
)

// ============================================================
// CRUD: AdSites
// ============================================================
router.post(
  "/admin/ad-sites",
  requireAuth,
  requirePermission("perm_admin"),
  [
    body("name").notEmpty().withMessage("name required").isLength({ max: 200 }),
    body("upstream_id").isInt().toInt(),
    body("billing_method").isIn(["CPM", "RATIO"]),
    body("current_unit_price").optional().isDecimal().toFloat(),
    body("current_ratio").optional().isDecimal().toFloat(),
    body("status").optional().isIn(["active", "inactive"]),
    body("downstream_ids").optional().isArray(),
  ],
  handleValidation,
  async (req: Request, res: Response) => {
    try {
      const { name, upstream_id, billing_method, current_unit_price, current_ratio, status, downstream_ids } = req.body
      const upstream = await prisma.upstream.findUnique({ where: { id: upstream_id } })
      if (!upstream) {
        res.status(400).json({ success: false, error: "Upstream not found" })
        return
      }
      const site = await prisma.adSite.create({
        data: {
          name,
          upstreamId: upstream_id,
          billingMethod: billing_method,
          currentUnitPrice: billing_method === "CPM" ? (current_unit_price ?? 0) : undefined,
          currentRatio: billing_method === "RATIO" ? (current_ratio ?? 1) : undefined,
          status: status ?? "active",
          downstreams: downstream_ids?.length
            ? { create: downstream_ids.map((did: number) => ({ downstreamId: did })) }
            : undefined,
        },
      })
      res.status(201).json({ success: true, data: { id: site.id, name: site.name } })
    } catch (err: any) {
      console.error("POST /api/admin/ad-sites error:", err)
      res.status(500).json({ success: false, error: "Internal server error" })
    }
  }
)

router.put(
  "/admin/ad-sites/:id",
  requireAuth,
  requirePermission("perm_admin"),
  [
    param("id").isInt().toInt(),
    body("name").optional().isLength({ max: 200 }),
    body("upstream_id").optional().isInt().toInt(),
    body("billing_method").optional().isIn(["CPM", "RATIO"]),
    body("current_unit_price").optional().isDecimal().toFloat(),
    body("current_ratio").optional().isDecimal().toFloat(),
    body("status").optional().isIn(["active", "inactive"]),
    body("downstream_ids").optional().isArray(),
  ],
  handleValidation,
  async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id)
      const { name, upstream_id, billing_method, current_unit_price, current_ratio, status, downstream_ids } = req.body
      const existing = await prisma.adSite.findUnique({ where: { id } })
      if (!existing) {
        res.status(404).json({ success: false, error: "Ad site not found" })
        return
      }
      const updateData: Record<string, unknown> = {}
      if (name !== undefined) updateData.name = name
      if (upstream_id !== undefined) {
        const up = await prisma.upstream.findUnique({ where: { id: upstream_id } })
        if (!up) { res.status(400).json({ success: false, error: "Upstream not found" }); return }
        updateData.upstreamId = upstream_id
      }
      if (billing_method !== undefined) updateData.billingMethod = billing_method
      if (current_unit_price !== undefined) updateData.currentUnitPrice = current_unit_price
      if (current_ratio !== undefined) updateData.currentRatio = current_ratio
      if (status !== undefined) updateData.status = status
      await prisma.adSite.update({ where: { id }, data: updateData })
      // Update downstreams if provided
      if (downstream_ids !== undefined) {
        await prisma.adSiteDownstream.deleteMany({ where: { adSiteId: id } })
        if (downstream_ids?.length) {
          await prisma.adSiteDownstream.createMany({
            data: downstream_ids.map((did: number) => ({ adSiteId: id, downstreamId: did })),
          })
        }
      }
      res.json({ success: true, message: "Ad site updated" })
    } catch (err: any) {
      console.error("PUT /api/admin/ad-sites/:id error:", err)
      res.status(500).json({ success: false, error: "Internal server error" })
    }
  }
)

router.delete(
  "/admin/ad-sites/:id",
  requireAuth,
  requirePermission("perm_admin"),
  [param("id").isInt().toInt()],
  handleValidation,
  async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id)
      const force = req.query.force === '1'
      if (!force) {
        const inputs = await prisma.dailyInput.findMany({ where: { adSiteId: id }, take: 1 })
        if (inputs.length > 0) {
          res.status(409).json({ success: false, error: "Ad site has daily inputs — cannot delete. Add ?force=1 to delete anyway." })
          return
        }
      }
      // Delete related daily inputs first if force
      if (force) {
        await prisma.dailyInput.deleteMany({ where: { adSiteId: id } })
      }
      await prisma.adSite.delete({ where: { id } })
      res.json({ success: true, message: "Ad site deleted" })
    } catch (err: any) {
      console.error("DELETE /api/admin/ad-sites/:id error:", err)
      res.status(500).json({ success: false, error: "Internal server error" })
    }
  }
)

// ============================================================
// PUT /api/admin/ad-sites/:id/downstream-price
// ============================================================
router.put(
  "/admin/ad-sites/:id/downstream-price",
  requireAuth,
  requirePermission("perm_admin"),
  [param("id").isInt().toInt(), body("prices").isObject()],
  handleValidation,
  async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id)
      const { prices } = req.body as { prices: Record<string, number> }

      // prices is a map of downstreamId -> price
      for (const [downstreamIdStr, price] of Object.entries(prices)) {
        const downstreamId = parseInt(downstreamIdStr)
        // Upsert downstream price in ad_site_downstream table
        await prisma.adSiteDownstream.upsert({
          where: {
            adSiteId_downstreamId: {
              adSiteId: id,
              downstreamId: downstreamId,
            },
          },
          create: {
            adSiteId: id,
            downstreamId: downstreamId,
            customPrice: price,
          },
          update: {
            customPrice: price,
          },
        })
      }

      res.json({ success: true, message: "Downstream price updated" })
    } catch (err: any) {
      console.error("PUT /api/admin/ad-sites/:id/downstream-price error:", err)
      res.status(500).json({ success: false, error: "Internal server error" })
    }
  }
)

// ============================================================
// CRUD: Downstreams
// ============================================================
router.post(
  "/admin/downstreams",
  requireAuth,
  requirePermission("perm_admin"),
  [
    body("ad_type_id").isInt().toInt(),
    body("downstream_type").isIn(["ML", "LE", "YIYI"]),
    body("payout_rate").isDecimal().toFloat(),
    body("status").optional().isIn(["active", "inactive"]),
  ],
  handleValidation,
  async (req: Request, res: Response) => {
    try {
      const { ad_type_id, downstream_type, payout_rate, status } = req.body
      const adType = await prisma.adType.findUnique({ where: { id: ad_type_id } })
      if (!adType) { res.status(400).json({ success: false, error: "Ad type not found" }); return }
      const ds = await prisma.downstream.create({
        data: { adTypeId: ad_type_id, downstreamType: downstream_type, payoutRate: payout_rate, status: status ?? "active" },
      })
      res.status(201).json({ success: true, data: { id: ds.id, downstream_type: ds.downstreamType, ad_type_code: adType.code } })
    } catch (err: any) {
      console.error("POST /api/admin/downstreams error:", err)
      res.status(500).json({ success: false, error: "Internal server error" })
    }
  }
)

router.put(
  "/admin/downstreams/:id",
  requireAuth,
  requirePermission("perm_admin"),
  [
    param("id").isInt().toInt(),
    body("payout_rate").optional().isDecimal().toFloat(),
    body("status").optional().isIn(["active", "inactive"]),
  ],
  handleValidation,
  async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id)
      const { payout_rate, status } = req.body
      const updateData: Record<string, unknown> = {}
      if (payout_rate !== undefined) updateData.payoutRate = payout_rate
      if (status !== undefined) updateData.status = status
      const updated = await prisma.downstream.update({ where: { id }, data: updateData })
      res.json({ success: true, message: "Downstream updated" })
    } catch (err: any) {
      console.error("PUT /api/admin/downstreams/:id error:", err)
      res.status(500).json({ success: false, error: "Internal server error" })
    }
  }
)

router.delete(
  "/admin/downstreams/:id",
  requireAuth,
  requirePermission("perm_admin"),
  [param("id").isInt().toInt()],
  handleValidation,
  async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id)
      await prisma.downstream.delete({ where: { id } })
      res.json({ success: true, message: "Downstream deleted" })
    } catch (err: any) {
      console.error("DELETE /api/admin/downstreams/:id error:", err)
      res.status(500).json({ success: false, error: "Internal server error" })
    }
  }
)

// ============================================================
// Edit/Delete: DownstreamPeriods
// ============================================================
router.put(
  "/admin/downstream-periods/:id",
  requireAuth,
  requirePermission("perm_admin"),
  [
    param("id").isInt().toInt(),
    body("pct_hal").optional().isDecimal().toFloat(),
    body("unit_price").optional().isDecimal().toFloat(),
    body("end_date").optional().isISO8601(),
    body("note").optional().isString(),
  ],
  handleValidation,
  async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id)
      const { pct_hal, unit_price, end_date, note } = req.body
      const existing = await prisma.downstreamPeriod.findUnique({ where: { id } })
      if (!existing) { res.status(404).json({ success: false, error: "Period not found" }); return }
      const updateData: Record<string, unknown> = {}
      if (pct_hal !== undefined) updateData.pctHal = pct_hal
      if (unit_price !== undefined) updateData.unitPrice = unit_price
      if (end_date !== undefined) updateData.endDate = end_date ? new Date(end_date) : null
      if (note !== undefined) updateData.note = note
      await prisma.downstreamPeriod.update({ where: { id }, data: updateData })
      res.json({ success: true, message: "Period updated" })
    } catch (err: any) {
      console.error("PUT /api/admin/downstream-periods/:id error:", err)
      res.status(500).json({ success: false, error: "Internal server error" })
    }
  }
)

router.delete(
  "/admin/downstream-periods/:id",
  requireAuth,
  requirePermission("perm_admin"),
  [param("id").isInt().toInt()],
  handleValidation,
  async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id)
      await prisma.downstreamPeriod.delete({ where: { id } })
      res.json({ success: true, message: "Period deleted" })
    } catch (err: any) {
      console.error("DELETE /api/admin/downstream-periods/:id error:", err)
      res.status(500).json({ success: false, error: "Internal server error" })
    }
  }
)

// ============================================================
// POST /api/admin/downstream-rates
// Body: { downstream_id, date (YYYY-MM-DD), effective_rate }
// ============================================================
router.post(
  "/admin/downstream-rates",
  requireAuth,
  requirePermission("perm_admin"),
  [
    body("downstream_id").isInt().toInt(),
    body("date").notEmpty().withMessage("date required").isISO8601(),
    body("effective_rate").isDecimal().toFloat(),
  ],
  handleValidation,
  async (req: Request, res: Response) => {
    try {
      const { downstream_id, date, effective_rate } = req.body
      const downstream = await prisma.downstream.findUnique({ where: { id: downstream_id } })
      if (!downstream) {
        res.status(404).json({ success: false, error: "Downstream not found" })
        return
      }
      const record = await prisma.dailyDownstreamRate.upsert({
        where: {
          downstreamId_date: {
            downstreamId: downstream_id,
            date: new Date(date),
          },
        },
        create: {
          downstreamId: downstream_id,
          date: new Date(date),
          effectiveRate: effective_rate,
        },
        update: {
          effectiveRate: effective_rate,
        },
      })
      res.json({ success: true, data: record })
    } catch (err: any) {
      console.error("POST /api/admin/downstream-rates error:", err)
      res.status(500).json({ success: false, error: "Internal server error" })
    }
  }
)

// ============================================================
// GET /api/admin/downstream-rates
// Query: downstream_id, start_date, end_date
// ============================================================
router.get(
  "/admin/downstream-rates",
  requireAuth,
  [
    query("downstream_id").isInt().toInt(),
    query("start_date").optional().isISO8601(),
    query("end_date").optional().isISO8601(),
  ],
  handleValidation,
  async (req: Request, res: Response) => {
    try {
      const downstreamId = Number(req.query.downstream_id)
      const where: any = { downstreamId }

      if (req.query.start_date) {
        where.date = { ...where.date, gte: new Date(req.query.start_date as string) }
      }
      if (req.query.end_date) {
        where.date = { ...where.date, lte: new Date(req.query.end_date as string) }
      }

      const rates = await prisma.dailyDownstreamRate.findMany({
        where,
        orderBy: { date: "asc" },
      })

      const result = rates.map((r) => ({
        id: r.id,
        downstream_id: r.downstreamId,
        date: formatBusinessDate(r.date),
        effective_rate: Number(r.effectiveRate),
      }))

      res.json({ success: true, data: result })
    } catch (err: any) {
      console.error("GET /api/admin/downstream-rates error:", err)
      res.status(500).json({ success: false, error: "Internal server error" })
    }
  }
)

// ============================================================
// DELETE /api/users/:id
// ============================================================
router.delete(
  "/users/:id",
  requireAuth,
  requirePermission("perm_admin"),
  [param("id").isInt().toInt()],
  handleValidation,
  async (req: Request, res: Response) => {
    try {
      const userId = Number(req.params.id)
      const existing = await prisma.user.findUnique({ where: { id: userId } })
      if (!existing) {
        res.status(404).json({ success: false, error: "User not found" })
        return
      }
      await prisma.user.delete({ where: { id: userId } })
      res.json({ success: true, message: "User deleted" })
    } catch (err: any) {
      console.error("DELETE /api/users/:id error:", err)
      res.status(500).json({ success: false, error: "Internal server error" })
    }
  }
)

// ============================================================
// PUT /api/ad-sites/:id/price
// ============================================================
router.put(
  "/ad-sites/:id/price",
  requireAuth,
  requirePermission("perm_admin"),
  [
    param("id").isInt().toInt(),
    body("new_unit_price").optional().isDecimal().toFloat(),
    body("new_ratio").optional().isDecimal().toFloat(),
  ],
  handleValidation,
  async (req: Request, res: Response) => {
    try {
      const siteId = Number(req.params.id)
      const { new_unit_price, new_ratio } = req.body

      const site = await prisma.adSite.findUnique({ where: { id: siteId } })
      if (!site) {
        res.status(404).json({ success: false, error: "Ad site not found" })
        return
      }

      if (site.billingMethod === "CPM") {
        if (new_unit_price === undefined) {
          res.status(400).json({ success: false, error: "new_unit_price required for CPM" })
          return
        }
        await prisma.adSite.update({
          where: { id: siteId },
          data: { currentUnitPrice: new_unit_price },
        })
      } else {
        if (new_ratio === undefined) {
          res.status(400).json({ success: false, error: "new_ratio required for RATIO" })
          return
        }
        await prisma.adSite.update({
          where: { id: siteId },
          data: { currentRatio: new_ratio },
        })
      }

      res.json({ success: true, message: "Price updated" })
    } catch (err: any) {
      console.error("PUT /api/ad-sites/:id/price error:", err)
      res.status(500).json({ success: false, error: "Internal server error" })
    }
  }
)

// ============================================================
// GET /api/downstream/:id/periods
// ============================================================
router.get(
  "/downstream/:id/periods",
  requireAuth,
  requirePermission("perm_admin"),
  [param("id").isInt().toInt()],
  handleValidation,
  async (req: Request, res: Response) => {
    try {
      const downstreamId = Number(req.params.id)

      const periods = await prisma.downstreamPeriod.findMany({
        where: { downstreamId: downstreamId },
        orderBy: { startDate: "desc" },
      })

      res.json({ success: true, data: periods })
    } catch (err: any) {
      console.error("GET /api/downstream/:id/periods error:", err)
      res.status(500).json({ success: false, error: "Internal server error" })
    }
  }
)

// ============================================================
// POST /api/downstream/:id/periods
// ============================================================
router.post(
  "/downstream/:id/periods",
  requireAuth,
  requirePermission("perm_admin"),
  [
    param("id").isInt().toInt(),
    body("pct_ha").notEmpty().withMessage("pct_ha is required").isDecimal().toFloat(),
    body("unit_price").notEmpty().withMessage("unit_price is required").isDecimal().toFloat(),
    body("start_date").notEmpty().withMessage("start_date is required").isISO8601().toDate(),
    body("note").optional().isString(),
  ],
  handleValidation,
  async (req: AuthRequest, res: Response) => {
    try {
      const downstreamId = Number(req.params.id)
      const { pct_ha, unit_price, start_date, note } = req.body
      const userId = req.user!.id

      const startDate = new Date(start_date)

      // 1. Check for overlap — reject if start_date already in an existing period
      const overlapping = await prisma.downstreamPeriod.findFirst({
        where: {
          downstreamId: downstreamId,
          startDate: { lte: startDate },
          OR: [
            { endDate: null },
            { endDate: { gte: startDate } },
          ],
        },
      })
      if (overlapping) {
        res.status(409).json({ success: false, error: "start_date overlaps with existing period" })
        return
      }

      // 2. Close current active period (end_date IS NULL) — set to day before new start
      const activePeriod = await prisma.downstreamPeriod.findFirst({
        where: { downstreamId: downstreamId, endDate: null },
      })

      if (activePeriod) {
        const endDate = new Date(startDate)
        endDate.setDate(endDate.getDate() - 1)
        await prisma.downstreamPeriod.update({
          where: { id: activePeriod.id },
          data: { endDate: endDate },
        })
      }

      // 3. Insert new period
      const newPeriod = await prisma.downstreamPeriod.create({
        data: {
          downstreamId: downstreamId,
          pctHal: pct_ha,
          unitPrice: unit_price,
          startDate: startDate,
          endDate: null,
          note,
          createdBy: userId,
        },
      })

      res.json({ success: true, data: newPeriod })
    } catch (err: any) {
      console.error("POST /api/downstream/:id/periods error:", err)
      res.status(500).json({ success: false, error: "Internal server error" })
    }
  }
)

// ============================================================
// GET /api/users
// ============================================================
router.get(
  "/users",
  requireAuth,
  requirePermission("perm_admin"),
  async (_req: Request, res: Response) => {
    try {
      const users = await prisma.user.findMany({
        select: {
          id: true,
          username: true,
          permDataInput: true,
          permDataConfirm: true,
          permAdmin: true,
          status: true,
          lastLoginAt: true,
          createdAt: true,
        },
        orderBy: { id: "asc" },
      })
      res.json({ success: true, data: users })
    } catch (err: any) {
      console.error("GET /api/users error:", err)
      res.status(500).json({ success: false, error: "Internal server error" })
    }
  }
)

// ============================================================
// POST /api/users
// ============================================================
router.post(
  "/users",
  requireAuth,
  requirePermission("perm_admin"),
  [
    body("username").notEmpty().withMessage("username required").isLength({ max: 100 }),
    body("password").notEmpty().withMessage("password required").isLength({ min: 6 }),
    body("perm_data_input").isInt({ min: 0, max: 1 }).toInt(),
    body("perm_data_confirm").isInt({ min: 0, max: 1 }).toInt(),
    body("perm_admin").isInt({ min: 0, max: 1 }).toInt(),
  ],
  handleValidation,
  async (req: Request, res: Response) => {
    try {
      const { username, password, perm_data_input, perm_data_confirm, perm_admin } = req.body

      const existing = await prisma.user.findUnique({ where: { username } })
      if (existing) {
        res.status(409).json({ success: false, error: "Username already exists" })
        return
      }

      const passwordHash = await bcrypt.hash(password, 10)
      const user = await prisma.user.create({
        data: {
          username,
          passwordHash: passwordHash,
          permDataInput: Boolean(perm_data_input),
          permDataConfirm: Boolean(perm_data_confirm),
          permAdmin: Boolean(perm_admin),
        },
        select: {
          id: true,
          username: true,
          permDataInput: true,
          permDataConfirm: true,
          permAdmin: true,
          status: true,
          createdAt: true,
        },
      })

      res.status(201).json({ success: true, data: user })
    } catch (err: any) {
      console.error("POST /api/users error:", err)
      res.status(500).json({ success: false, error: "Internal server error" })
    }
  }
)

// ============================================================
// PUT /api/users/:id
// ============================================================
router.put(
  "/users/:id",
  requireAuth,
  requirePermission("perm_admin"),
  [
    param("id").isInt().toInt(),
    body("password").optional().isLength({ min: 6 }),
    body("perm_data_input").isInt({ min: 0, max: 1 }).toInt(),
    body("perm_data_confirm").isInt({ min: 0, max: 1 }).toInt(),
    body("perm_admin").isInt({ min: 0, max: 1 }).toInt(),
    body("status").isIn(["active", "inactive"]),
  ],
  handleValidation,
  async (req: Request, res: Response) => {
    try {
      const userId = Number(req.params.id)
      const { password, perm_data_input, perm_data_confirm, perm_admin, status } = req.body

      const existing = await prisma.user.findUnique({ where: { id: userId } })
      if (!existing) {
        res.status(404).json({ success: false, error: "User not found" })
        return
      }

      const updateData: Parameters<typeof prisma.user.update>[0]["data"] = {
        permDataInput: Boolean(perm_data_input),
        permDataConfirm: Boolean(perm_data_confirm),
        permAdmin: Boolean(perm_admin),
        status,
      }

      if (password) {
        updateData.passwordHash = await bcrypt.hash(password, 10)
      }

      const user = await prisma.user.update({
        where: { id: userId },
        data: updateData,
        select: {
          id: true,
          username: true,
          permDataInput: true,
          permDataConfirm: true,
          permAdmin: true,
          status: true,
          lastLoginAt: true,
          createdAt: true,
        },
      })

      res.json({ success: true, data: user })
    } catch (err: any) {
      console.error("PUT /api/users/:id error:", err)
      res.status(500).json({ success: false, error: "Internal server error" })
    }
  }
)

// ============================================================
// POST /api/auth/login
// ============================================================
router.post(
  "/auth/login",
  [
    body("username").notEmpty().withMessage("username required"),
    body("password").notEmpty().withMessage("password required"),
  ],
  handleValidation,
  async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body

      const user = await prisma.user.findUnique({ where: { username } })
      if (!user || user.status === "inactive") {
        res.status(401).json({ success: false, error: "Invalid credentials" })
        return
      }

      const valid = await bcrypt.compare(password, user.passwordHash)
      if (!valid) {
        res.status(401).json({ success: false, error: "Invalid credentials" })
        return
      }

      // Update last_login_at
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      })

      const payload: UserPublic = {
        id: user.id,
        username: user.username,
        perm_data_input: user.permDataInput,
        perm_data_confirm: user.permDataConfirm,
        perm_admin: user.permAdmin,
        status: user.status as UserStatus,
        last_login_at: user.lastLoginAt ?? undefined,
        created_at: user.createdAt,
      }

      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })

      res.json({ success: true, token, user: payload })
    } catch (err: any) {
      console.error("POST /api/auth/login error:", err)
      res.status(500).json({ success: false, error: "Internal server error" })
    }
  }
)

// ============================================================
// GET /api/auth/me
// ============================================================
router.get(
  "/auth/me",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: {
          id: true,
          username: true,
          permDataInput: true,
          permDataConfirm: true,
          permAdmin: true,
          status: true,
          lastLoginAt: true,
          createdAt: true,
        },
      })
      if (!user) {
        res.status(404).json({ success: false, error: "User not found" })
        return
      }
      res.json({ success: true, data: user })
    } catch (err: any) {
      console.error("GET /api/auth/me error:", err)
      res.status(500).json({ success: false, error: "Internal server error" })
    }
  }
)

export default router
