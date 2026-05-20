import { Router, Request, Response } from "express"
import { body, param, query, validationResult } from "express-validator"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import { requirePermission, requireAuth, requireWriteAccess, AuthRequest } from "../middleware/auth.js"
import { UserPublic, UserRole, UserStatus } from "../types/index.js"
import prisma from "../prisma.js"
import { formatBusinessDate, getBusinessDayRange, getBusinessDayStart, getBusinessMonthRange } from "../utils/date.js"
import { getRequiredEnv } from "../utils/env.js"
import { DEFAULT_DOWNSTREAM_PRICES } from "../utils/constants.js"
import { createMemoryRateLimiter } from "../utils/rateLimit.js"
import { calculateActualRevenue, calculateCpmRevenue, calculateRebateAmount } from "../utils/calculations.js"
import { createOperationLog } from "../services/operationLog.service.js"

const router = Router()
const JWT_EXPIRES_IN = "8h"

const handleValidation = (req: Request, res: Response, next: Function) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, error: errors.array()[0].msg })
    return
  }
  next()
}

const loginRateLimiter = createMemoryRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => {
    const username = typeof req.body?.username === "string" ? req.body.username.trim().toLowerCase() : ""
    return `${req.ip}:${username}`
  },
  errorMessage: "Too many login attempts. Please try again later.",
})

type AdSiteEventType = "CREATED" | "PAUSED" | "RESUMED" | "DIED" | "NOTE"
type UserWithRoleShape = {
  role: string
  permAdmin: boolean
}

function resolveUserRole(user: UserWithRoleShape): UserRole {
  if (user.role === "VIEWER") return "VIEWER"
  if (user.permAdmin || user.role === "ADMIN") return "ADMIN"
  return "EDITOR"
}

type UserApiShape = {
  id: number
  username: string
  role: string
  permDataInput: boolean
  permDataConfirm: boolean
  permAdmin: boolean
  status: string
  lastLoginAt?: Date | null
  createdAt: Date
}

type AdSiteEventCreateInput = {
  eventDate?: Date
  note?: string
}

type RebateWindow = {
  id: string
  startDate: Date
  endDate: Date | null
}

function toUserPublic(user: UserApiShape): UserPublic {
  const resolvedRole = resolveUserRole(user)

  return {
    id: user.id,
    username: user.username,
    role: resolvedRole,
    perm_data_input: resolvedRole === "VIEWER" ? false : resolvedRole === "ADMIN" ? true : Boolean(user.permDataInput),
    perm_data_confirm: resolvedRole === "VIEWER" ? false : resolvedRole === "ADMIN" ? true : Boolean(user.permDataConfirm),
    perm_admin: resolvedRole === "ADMIN",
    status: user.status as UserStatus,
    last_login_at: user.lastLoginAt ?? undefined,
    created_at: user.createdAt,
  }
}

async function createAdSiteEvent(
  adSiteId: number,
  eventType: AdSiteEventType,
  input: AdSiteEventCreateInput = {}
) {
  return prisma.adSiteEvent.create({
    data: {
      adSiteId,
      eventType,
      note: input.note,
      eventDate: input.eventDate ?? new Date(),
    },
  })
}

function normalizeRebateBoundary(dateValue: string | Date) {
  return getBusinessDayStart(typeof dateValue === "string" ? dateValue : formatBusinessDate(dateValue))
}

function rebateWindowsOverlap(
  startDate: Date,
  endDate: Date | null,
  otherStartDate: Date,
  otherEndDate: Date | null
) {
  const selfEnd = endDate ?? new Date("9999-12-31T00:00:00.000Z")
  const otherEnd = otherEndDate ?? new Date("9999-12-31T00:00:00.000Z")
  return startDate.getTime() <= otherEnd.getTime() && otherStartDate.getTime() <= selfEnd.getTime()
}

async function ensureSmAdSite(adSiteId: number) {
  const adSite = await prisma.adSite.findUnique({
    where: { id: adSiteId },
    include: {
      upstream: {
        include: { adType: true },
      },
    },
  })

  if (!adSite) {
    return { ok: false as const, error: "Ad site not found" }
  }

  if (adSite.upstream.adType.code !== "SM") {
    return { ok: false as const, error: "Rebate config is only available for SM ad sites" }
  }

  return { ok: true as const, adSite }
}

async function findOverlappingAdSiteRebate(
  adSiteId: number,
  startDate: Date,
  endDate: Date | null,
  excludeId?: string
) {
  const existing = await prisma.adSiteRebateRate.findMany({
    where: {
      adSiteId,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: {
      id: true,
      startDate: true,
      endDate: true,
    },
  })

  return existing.find((rate: RebateWindow) =>
    rebateWindowsOverlap(startDate, endDate, rate.startDate, rate.endDate)
  )
}

function resolveAdSiteRebateRateForDate(
  rates: Array<{ startDate: Date; endDate: Date | null; rate: number }>,
  targetDate: Date
) {
  for (const rate of rates) {
    if (
      rate.startDate.getTime() <= targetDate.getTime() &&
      (rate.endDate === null || rate.endDate.getTime() >= targetDate.getTime())
    ) {
      return rate.rate
    }
  }

  return 0
}

// ============================================================
// GET /api/admin/ad-sites
// ============================================================
router.get(
  "/admin/ad-sites",
  requireAuth,
  [query("archived").optional().isIn(["0", "1"])],
  handleValidation,
  async (req: Request, res: Response) => {
    try {
      const archivedMode = req.query.archived === "1"
      const sites = await prisma.adSite.findMany({
        where: {
          isArchived: archivedMode,
        },
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

      const result = sites.map((site) => ({
        id: site.id,
        ad_type_code: site.upstream.adType.code,
        upstream_name: site.upstream.name,
        ad_site_name: site.name,
        billing_method: site.billingMethod,
        current_unit_price: site.currentUnitPrice ? Number(site.currentUnitPrice) : null,
        current_ratio: site.currentRatio ? Number(site.currentRatio) : null,
        is_active: site.isActive,
        is_archived: site.isArchived,
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
          adSites: {
            where: {
              adSite: {
                isArchived: false,
              },
            },
          },
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
        where: {
          downstreamId,
          adSite: {
            isArchived: false,
          },
        },
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
          adSite: { isArchived: false },
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
            adSite: { isArchived: false },
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
            adSite: { isArchived: false },
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
          unit_price_snapshot:
            input.unitPriceSnapshot === null ? null : Number(input.unitPriceSnapshot),
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
        is_active: sd.adSite.isActive,
        upstream_name: sd.adSite.upstream.name,
        billing_method: sd.adSite.billingMethod,
        current_unit_price:
          sd.adSite.currentUnitPrice === null ? null : Number(sd.adSite.currentUnitPrice),
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
  requireWriteAccess,
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
  requireWriteAccess,
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
  requireWriteAccess,
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

router.get(
  "/admin/ad-sites/:id/rebates",
  requireAuth,
  requirePermission("perm_admin"),
  [param("id").isInt().toInt()],
  handleValidation,
  async (req: Request, res: Response) => {
    try {
      const adSiteId = Number(req.params.id)
      const adSiteResult = await ensureSmAdSite(adSiteId)
      if (!adSiteResult.ok) {
        res.status(adSiteResult.error === "Ad site not found" ? 404 : 400).json({ success: false, error: adSiteResult.error })
        return
      }

      const rebates = await prisma.adSiteRebateRate.findMany({
        where: { adSiteId },
        orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
      })

      res.json({
        success: true,
        data: rebates.map((rebate) => ({
          id: rebate.id,
          ad_site_id: rebate.adSiteId,
          rate: Number(rebate.rate),
          start_date: formatBusinessDate(rebate.startDate),
          end_date: rebate.endDate ? formatBusinessDate(rebate.endDate) : null,
          created_at: rebate.createdAt,
          updated_at: rebate.updatedAt,
        })),
      })
    } catch (err: any) {
      console.error("GET /api/admin/ad-sites/:id/rebates error:", err)
      res.status(500).json({ success: false, error: "Internal server error" })
    }
  }
)

router.post(
  "/admin/ad-sites/:id/rebates",
  requireAuth,
  requireWriteAccess,
  requirePermission("perm_admin"),
  [
    param("id").isInt().toInt(),
    body("rate").notEmpty().withMessage("rate required").isDecimal().toFloat(),
    body("start_date").notEmpty().withMessage("start_date required").isISO8601(),
    body("end_date").optional({ nullable: true }).isISO8601(),
  ],
  handleValidation,
  async (req: Request, res: Response) => {
    try {
      const adSiteId = Number(req.params.id)
      const adSiteResult = await ensureSmAdSite(adSiteId)
      if (!adSiteResult.ok) {
        res.status(adSiteResult.error === "Ad site not found" ? 404 : 400).json({ success: false, error: adSiteResult.error })
        return
      }

      const startDate = normalizeRebateBoundary(req.body.start_date)
      const endDate = req.body.end_date ? normalizeRebateBoundary(req.body.end_date) : null
      if (endDate && endDate.getTime() < startDate.getTime()) {
        res.status(400).json({ success: false, error: "end_date must be greater than or equal to start_date" })
        return
      }

      const overlap = await findOverlappingAdSiteRebate(adSiteId, startDate, endDate)
      if (overlap) {
        res.status(409).json({ success: false, error: "Rebate period overlaps with existing config" })
        return
      }

      const created = await prisma.adSiteRebateRate.create({
        data: {
          adSiteId,
          rate: req.body.rate,
          startDate,
          endDate,
        },
      })

      res.status(201).json({
        success: true,
        data: {
          id: created.id,
          ad_site_id: created.adSiteId,
          rate: Number(created.rate),
          start_date: formatBusinessDate(created.startDate),
          end_date: created.endDate ? formatBusinessDate(created.endDate) : null,
          created_at: created.createdAt,
          updated_at: created.updatedAt,
        },
      })
    } catch (err: any) {
      console.error("POST /api/admin/ad-sites/:id/rebates error:", err)
      res.status(500).json({ success: false, error: "Internal server error" })
    }
  }
)

router.put(
  "/admin/ad-sites/:id/rebates/:rebateId",
  requireAuth,
  requireWriteAccess,
  requirePermission("perm_admin"),
  [
    param("id").isInt().toInt(),
    param("rebateId").notEmpty().isString(),
    body("rate").notEmpty().withMessage("rate required").isDecimal().toFloat(),
    body("start_date").notEmpty().withMessage("start_date required").isISO8601(),
    body("end_date").optional({ nullable: true }).isISO8601(),
  ],
  handleValidation,
  async (req: Request, res: Response) => {
    try {
      const adSiteId = Number(req.params.id)
      const rebateId = String(req.params.rebateId)
      const adSiteResult = await ensureSmAdSite(adSiteId)
      if (!adSiteResult.ok) {
        res.status(adSiteResult.error === "Ad site not found" ? 404 : 400).json({ success: false, error: adSiteResult.error })
        return
      }

      const existing = await prisma.adSiteRebateRate.findFirst({
        where: {
          id: rebateId,
          adSiteId,
        },
      })
      if (!existing) {
        res.status(404).json({ success: false, error: "Rebate config not found" })
        return
      }

      const startDate = normalizeRebateBoundary(req.body.start_date)
      const endDate = req.body.end_date ? normalizeRebateBoundary(req.body.end_date) : null
      if (endDate && endDate.getTime() < startDate.getTime()) {
        res.status(400).json({ success: false, error: "end_date must be greater than or equal to start_date" })
        return
      }

      const overlap = await findOverlappingAdSiteRebate(adSiteId, startDate, endDate, rebateId)
      if (overlap) {
        res.status(409).json({ success: false, error: "Rebate period overlaps with existing config" })
        return
      }

      const updated = await prisma.adSiteRebateRate.update({
        where: { id: rebateId },
        data: {
          rate: req.body.rate,
          startDate,
          endDate,
        },
      })

      res.json({
        success: true,
        data: {
          id: updated.id,
          ad_site_id: updated.adSiteId,
          rate: Number(updated.rate),
          start_date: formatBusinessDate(updated.startDate),
          end_date: updated.endDate ? formatBusinessDate(updated.endDate) : null,
          created_at: updated.createdAt,
          updated_at: updated.updatedAt,
        },
      })
    } catch (err: any) {
      console.error("PUT /api/admin/ad-sites/:id/rebates/:rebateId error:", err)
      res.status(500).json({ success: false, error: "Internal server error" })
    }
  }
)

router.delete(
  "/admin/ad-sites/:id/rebates/:rebateId",
  requireAuth,
  requireWriteAccess,
  requirePermission("perm_admin"),
  [
    param("id").isInt().toInt(),
    param("rebateId").notEmpty().isString(),
  ],
  handleValidation,
  async (req: Request, res: Response) => {
    try {
      const adSiteId = Number(req.params.id)
      const rebateId = String(req.params.rebateId)
      const existing = await prisma.adSiteRebateRate.findFirst({
        where: {
          id: rebateId,
          adSiteId,
        },
      })

      if (!existing) {
        res.status(404).json({ success: false, error: "Rebate config not found" })
        return
      }

      await prisma.adSiteRebateRate.delete({ where: { id: rebateId } })
      res.json({ success: true, message: "Rebate config deleted" })
    } catch (err: any) {
      console.error("DELETE /api/admin/ad-sites/:id/rebates/:rebateId error:", err)
      res.status(500).json({ success: false, error: "Internal server error" })
    }
  }
)

router.post(
  "/admin/ad-sites/:id/rebates/recalculate",
  requireAuth,
  requireWriteAccess,
  requirePermission("perm_admin"),
  [
    param("id").isInt().toInt(),
    body("start_date").notEmpty().withMessage("start_date required").isISO8601(),
    body("end_date").notEmpty().withMessage("end_date required").isISO8601(),
    body("include_confirmed").optional().isBoolean(),
  ],
  handleValidation,
  async (req: Request, res: Response) => {
    try {
      const adSiteId = Number(req.params.id)
      const adSiteResult = await ensureSmAdSite(adSiteId)
      if (!adSiteResult.ok) {
        res.status(adSiteResult.error === "Ad site not found" ? 404 : 400).json({ success: false, error: adSiteResult.error })
        return
      }

      const startDate = normalizeRebateBoundary(req.body.start_date)
      const endDate = normalizeRebateBoundary(req.body.end_date)
      const includeConfirmed = Boolean(req.body.include_confirmed)
      if (endDate.getTime() < startDate.getTime()) {
        res.status(400).json({ success: false, error: "end_date must be greater than or equal to start_date" })
        return
      }

      const rateWindows = await prisma.adSiteRebateRate.findMany({
        where: { adSiteId },
        orderBy: { startDate: "desc" },
      })

      const rangeEnd = getBusinessDayRange(req.body.end_date).lt
      const records = await prisma.dailyInput.findMany({
        where: {
          recordDate: { gte: startDate, lt: rangeEnd },
          status: includeConfirmed ? { in: ["unconfirmed", "confirmed"] } : "unconfirmed",
          adSite: {
            id: adSiteId,
            billingMethod: "CPM",
          },
        },
        include: {
          adSite: {
            select: {
              currentUnitPrice: true,
            },
          },
        },
        orderBy: { recordDate: "asc" },
      })

      if (records.length === 0) {
        res.json({ success: true, updated: 0 })
        return
      }

      const normalizedRates = rateWindows.map((rate) => ({
        startDate: normalizeRebateBoundary(rate.startDate),
        endDate: rate.endDate ? normalizeRebateBoundary(rate.endDate) : null,
        rate: Number(rate.rate),
      }))

      await prisma.$transaction(
        records.map((record) => {
          const unitPrice = Number(record.unitPriceSnapshot ?? record.adSite.currentUnitPrice ?? 0)
          const qty = Number(record.qty ?? 0)
          const baseRevenue = calculateCpmRevenue(qty, unitPrice)
          const activeRate = resolveAdSiteRebateRateForDate(
            normalizedRates,
            getBusinessDayStart(formatBusinessDate(record.recordDate))
          )
          const rebateAmount = calculateRebateAmount(qty, activeRate)
          const actualRevenue = calculateActualRevenue(baseRevenue, rebateAmount)

          return prisma.dailyInput.update({
            where: { id: record.id },
            data: {
              rebateAmount,
              rebateRateSnapshot: activeRate,
              revenue: actualRevenue,
            },
          })
        })
      )

      res.json({ success: true, updated: records.length })
    } catch (err: any) {
      console.error("POST /api/admin/ad-sites/:id/rebates/recalculate error:", err)
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
      // Add slug to each adType (slug = code in lowercase, with special handling for mixed-case codes)
      const adTypesWithSlug = adTypes.map((at) => {
        let slug = at.code.toLowerCase()
        if (at.code === 'BAIDU_JS') slug = 'baidu' // Keep backwards compatible with existing URLs
        return { ...at, slug }
      })
      res.json({ success: true, data: adTypesWithSlug })
    } catch (err: any) {
      console.error("GET /api/admin/ad-types error:", err)
      res.status(500).json({ success: false, error: "Internal server error" })
    }
  }
)

// ============================================================
// CRUD: AdTypes
// ============================================================
router.post(
  "/admin/ad-types",
  requireAuth,
  requireWriteAccess,
  requirePermission("perm_admin"),
  [
    body("code").notEmpty().withMessage("code required").isLength({ min: 2, max: 20 }),
    body("name").notEmpty().withMessage("name required").isLength({ max: 200 }),
  ],
  handleValidation,
  async (req: Request, res: Response) => {
    try {
      const { code, name } = req.body

      // Check if code already exists
      const existing = await prisma.adType.findUnique({ where: { code } })
      if (existing) {
        res.status(400).json({ success: false, error: "AdType code already exists" })
        return
      }

      // Get max id to determine next id
      const maxIdRow = await prisma.adType.findFirst({ orderBy: { id: "desc" } })
      const nextId = (maxIdRow?.id ?? 0) + 1

      const adType = await prisma.adType.create({
        data: { id: nextId, code, name },
      })
      res.json({ success: true, data: adType })
    } catch (err: any) {
      console.error("POST /api/admin/ad-types error:", err)
      res.status(500).json({ success: false, error: "Internal server error" })
    }
  }
)

router.put(
  "/admin/ad-types/:id",
  requireAuth,
  requireWriteAccess,
  requirePermission("perm_admin"),
  [
    body("code").optional().isLength({ min: 2, max: 20 }),
    body("name").optional().isLength({ max: 200 }),
  ],
  handleValidation,
  async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string)
      const { code, name } = req.body

      const existing = await prisma.adType.findUnique({ where: { id } })
      if (!existing) {
        res.status(404).json({ success: false, error: "AdType not found" })
        return
      }

      // Check if new code conflicts with another AdType
      if (code && code !== existing.code) {
        const conflict = await prisma.adType.findFirst({
          where: { code, id: { not: id } },
        })
        if (conflict) {
          res.status(400).json({ success: false, error: "AdType code already exists" })
          return
        }
      }

      const adType = await prisma.adType.update({
        where: { id },
        data: {
          code: code ?? existing.code,
          name: name ?? existing.name,
        },
      })
      res.json({ success: true, data: adType })
    } catch (err: any) {
      console.error("PUT /api/admin/ad-types/:id error:", err)
      res.status(500).json({ success: false, error: "Internal server error" })
    }
  }
)

router.delete(
  "/admin/ad-types/:id",
  requireAuth,
  requireWriteAccess,
  requirePermission("perm_admin"),
  async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string)

      const existing = await prisma.adType.findUnique({ where: { id } })
      if (!existing) {
        res.status(404).json({ success: false, error: "AdType not found" })
        return
      }

      // Check if AdType has associated upstreams or downstreams
      const upstreams = await prisma.upstream.findMany({ where: { adTypeId: id } })
      const downstreams = await prisma.downstream.findMany({ where: { adTypeId: id } })
      if (upstreams.length > 0 || downstreams.length > 0) {
        res.status(400).json({
          success: false,
          error: "Cannot delete AdType with associated upstreams or downstreams",
        })
        return
      }

      await prisma.adType.delete({ where: { id } })
      res.json({ success: true, message: "AdType deleted" })
    } catch (err: any) {
      console.error("DELETE /api/admin/ad-types/:id error:", err)
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
  requireWriteAccess,
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
      const site = await prisma.$transaction(async (tx) => {
        const created = await tx.adSite.create({
          data: {
            name,
            upstreamId: upstream_id,
            billingMethod: billing_method,
            currentUnitPrice: billing_method === "CPM" ? (current_unit_price ?? 0) : undefined,
            currentRatio: billing_method === "RATIO" ? (current_ratio ?? 1) : undefined,
            isActive: true,
            isArchived: false,
            status: status ?? "active",
            downstreams: downstream_ids?.length
              ? { create: downstream_ids.map((did: number) => ({ downstreamId: did })) }
              : undefined,
          },
        })

        await tx.adSiteEvent.create({
          data: {
            adSiteId: created.id,
            eventType: "CREATED",
          },
        })

        return created
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
  requireWriteAccess,
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

router.put(
  "/admin/ad-sites/:id/toggle-active",
  requireAuth,
  requireWriteAccess,
  requirePermission("perm_admin"),
  [
    param("id").isInt().toInt(),
    body("eventDate").optional().isISO8601().withMessage("eventDate must be YYYY-MM-DD"),
    body("note").optional().isLength({ max: 1000 }),
  ],
  handleValidation,
  async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id)
      const eventDate = typeof req.body.eventDate === "string" ? getBusinessDayStart(req.body.eventDate) : undefined
      const note = typeof req.body.note === "string" ? req.body.note.trim() || undefined : undefined
      const existing = await prisma.adSite.findUnique({ where: { id } })
      if (!existing) {
        res.status(404).json({ success: false, error: "Ad site not found" })
        return
      }

      const nextIsActive = !existing.isActive
      const updated = await prisma.$transaction(async (tx) => {
        const site = await tx.adSite.update({
          where: { id },
          data: { isActive: nextIsActive },
        })

        await tx.adSiteEvent.create({
          data: {
            adSiteId: id,
            eventType: nextIsActive ? "RESUMED" : "PAUSED",
            eventDate: eventDate ?? new Date(),
            note,
          },
        })

        return site
      })

      res.json({
        success: true,
        data: {
          id: updated.id,
          is_active: updated.isActive,
          is_archived: updated.isArchived,
        },
      })
    } catch (err: any) {
      console.error("PUT /api/admin/ad-sites/:id/toggle-active error:", err)
      res.status(500).json({ success: false, error: "Internal server error" })
    }
  }
)

router.put(
  "/admin/ad-sites/:id/toggle-archive",
  requireAuth,
  requireWriteAccess,
  requirePermission("perm_admin"),
  [
    param("id").isInt().toInt(),
    body("eventDate").optional().isISO8601().withMessage("eventDate must be YYYY-MM-DD"),
    body("note").optional().isLength({ max: 1000 }),
  ],
  handleValidation,
  async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id)
      const eventDate = typeof req.body.eventDate === "string" ? getBusinessDayStart(req.body.eventDate) : undefined
      const note = typeof req.body.note === "string" ? req.body.note.trim() || undefined : undefined
      const existing = await prisma.adSite.findUnique({ where: { id } })
      if (!existing) {
        res.status(404).json({ success: false, error: "Ad site not found" })
        return
      }

      const nextIsArchived = !existing.isArchived
      const updated = await prisma.$transaction(async (tx) => {
        const site = await tx.adSite.update({
          where: { id },
          data: { isArchived: nextIsArchived },
        })

        await tx.adSiteEvent.create({
          data: {
            adSiteId: id,
            eventType: nextIsArchived ? "DIED" : "RESUMED",
            eventDate: eventDate ?? new Date(),
            note,
          },
        })

        return site
      })

      res.json({
        success: true,
        data: {
          id: updated.id,
          is_active: updated.isActive,
          is_archived: updated.isArchived,
        },
      })
    } catch (err: any) {
      console.error("PUT /api/admin/ad-sites/:id/toggle-archive error:", err)
      res.status(500).json({ success: false, error: "Internal server error" })
    }
  }
)

router.delete(
  "/admin/ad-sites/:id",
  requireAuth,
  requireWriteAccess,
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

router.get(
  "/admin/ad-sites/:id/events",
  requireAuth,
  [param("id").isInt().toInt()],
  handleValidation,
  async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id)
      const site = await prisma.adSite.findUnique({
        where: { id },
        select: { id: true },
      })

      if (!site) {
        res.status(404).json({ success: false, error: "Ad site not found" })
        return
      }

      const events = await prisma.adSiteEvent.findMany({
        where: { adSiteId: id },
        orderBy: [{ eventDate: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      })

      res.json({
        success: true,
        data: events.map((event) => ({
          id: event.id,
          ad_site_id: event.adSiteId,
          event_type: event.eventType,
          note: event.note,
          event_date: event.eventDate,
          created_at: event.createdAt,
        })),
      })
    } catch (err: any) {
      console.error("GET /api/admin/ad-sites/:id/events error:", err)
      res.status(500).json({ success: false, error: "Internal server error" })
    }
  }
)

router.post(
  "/admin/ad-sites/:id/events",
  requireAuth,
  requireWriteAccess,
  requirePermission("perm_admin"),
  [
    param("id").isInt().toInt(),
    body("note").notEmpty().withMessage("note required").isLength({ max: 1000 }),
    body("eventDate").optional().isISO8601().withMessage("eventDate must be YYYY-MM-DD"),
  ],
  handleValidation,
  async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id)
      const note = String(req.body.note ?? "").trim()
      const eventDate = typeof req.body.eventDate === "string" ? getBusinessDayStart(req.body.eventDate) : undefined
      const site = await prisma.adSite.findUnique({
        where: { id },
        select: { id: true },
      })

      if (!site) {
        res.status(404).json({ success: false, error: "Ad site not found" })
        return
      }

      const event = await createAdSiteEvent(id, "NOTE", { note, eventDate })

      res.status(201).json({
        success: true,
        data: {
          id: event.id,
          ad_site_id: event.adSiteId,
          event_type: event.eventType,
          note: event.note,
          event_date: event.eventDate,
          created_at: event.createdAt,
        },
      })
    } catch (err: any) {
      console.error("POST /api/admin/ad-sites/:id/events error:", err)
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
  requireWriteAccess,
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
  requireWriteAccess,
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
  requireWriteAccess,
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
  requireWriteAccess,
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
  requireWriteAccess,
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
  requireWriteAccess,
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
  requireWriteAccess,
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
  requireWriteAccess,
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
  requireWriteAccess,
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
// GET /api/admin/ad-sites/:id/reconciliation?month=YYYY-MM
// GET /api/admin/ad-sites/:id/reconciliation?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
// ============================================================
router.get(
  "/admin/ad-sites/:id/reconciliation",
  requireAuth,
  [
    param("id").isInt().toInt(),
    query("month").optional().matches(/^\d{4}-\d{2}$/).withMessage("month must be YYYY-MM"),
    query("start_date").optional().isISO8601().withMessage("start_date must be YYYY-MM-DD"),
    query("end_date").optional().isISO8601().withMessage("end_date must be YYYY-MM-DD"),
    query().custom((_, { req }) => {
      const queryParams = req.query ?? {}
      const hasMonth = typeof queryParams.month === "string" && queryParams.month.length > 0
      const hasStart = typeof queryParams.start_date === "string" && queryParams.start_date.length > 0
      const hasEnd = typeof queryParams.end_date === "string" && queryParams.end_date.length > 0

      if (!hasMonth && !(hasStart && hasEnd)) {
        throw new Error("month or start_date/end_date is required")
      }

      if (hasStart !== hasEnd) {
        throw new Error("start_date and end_date must be provided together")
      }

      return true
    }),
  ],
  handleValidation,
  async (req: Request, res: Response) => {
    try {
      const siteId = Number(req.params.id)
      const monthStr = typeof req.query.month === "string" ? req.query.month : undefined
      const startDateStr = typeof req.query.start_date === "string" ? req.query.start_date : undefined
      const endDateStr = typeof req.query.end_date === "string" ? req.query.end_date : undefined

      let startAt: Date
      let endExclusive: Date

      if (startDateStr && endDateStr) {
        startAt = getBusinessDayStart(startDateStr)
        endExclusive = getBusinessDayRange(endDateStr).lt

        if (startAt.getTime() >= endExclusive.getTime()) {
          res.status(400).json({ success: false, error: "end_date must be greater than or equal to start_date" })
          return
        }
      } else {
        const [year, month] = String(monthStr).split("-").map(Number)
        const range = getBusinessMonthRange(year, month)
        startAt = range.gte
        endExclusive = range.lt
      }

      const site = await prisma.adSite.findUnique({
        where: { id: siteId },
        select: {
          id: true,
          name: true,
        },
      })

      if (!site) {
        res.status(404).json({ success: false, error: "Ad site not found" })
        return
      }

      const dailyInputs = await prisma.dailyInput.findMany({
        where: {
          adSiteId: siteId,
          status: "confirmed",
          recordDate: { gte: startAt, lt: endExclusive },
        },
        select: {
          recordDate: true,
          qty: true,
          revenue: true,
        },
        orderBy: { recordDate: "asc" },
      })

      const dailyDetails = dailyInputs.map((row) => ({
        date: formatBusinessDate(row.recordDate),
        qty: row.qty ?? 0,
        revenue: Number(row.revenue),
        actualRevenue: 0,
      }))

      const totalQty = dailyDetails.reduce((sum, row) => sum + row.qty, 0)
      const totalRevenue = dailyDetails.reduce((sum, row) => sum + row.revenue, 0)

      res.json({
        success: true,
        data: {
          siteInfo: {
            id: site.id,
            name: site.name,
          },
          range: {
            startDate: startDateStr ?? `${monthStr}-01`,
            endDate:
              endDateStr ??
              formatBusinessDate(new Date(endExclusive.getTime() - 1)),
          },
          summary: {
            totalQty,
            totalRevenue,
            totalActualQty: 0,
            totalActualRevenue: 0,
          },
          dailyDetails,
        },
      })
    } catch (err: any) {
      console.error("GET /api/admin/ad-sites/:id/reconciliation error:", err)
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
  requireWriteAccess,
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
          role: true,
          permDataInput: true,
          permDataConfirm: true,
          permAdmin: true,
          status: true,
          lastLoginAt: true,
          createdAt: true,
        },
        orderBy: { id: "asc" },
      })
      res.json({ success: true, data: users.map(toUserPublic) })
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
  requireWriteAccess,
  requirePermission("perm_admin"),
  [
    body("username").notEmpty().withMessage("username required").isLength({ max: 100 }),
    body("password").notEmpty().withMessage("password required").isLength({ min: 6 }),
    body("role").notEmpty().withMessage("role required").isIn(["ADMIN", "EDITOR", "VIEWER"]),
    body("perm_data_input").isInt({ min: 0, max: 1 }).toInt(),
    body("perm_data_confirm").isInt({ min: 0, max: 1 }).toInt(),
    body("perm_admin").isInt({ min: 0, max: 1 }).toInt(),
  ],
  handleValidation,
  async (req: Request, res: Response) => {
    try {
      const { username, password, role, perm_data_input, perm_data_confirm, perm_admin, status } = req.body
      const normalizedRole = role as UserRole
      const isViewerRole = normalizedRole === "VIEWER"
      const isAdminRole = normalizedRole === "ADMIN"

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
          role: normalizedRole,
          permDataInput: isViewerRole ? false : (isAdminRole ? true : Boolean(perm_data_input)),
          permDataConfirm: isViewerRole ? false : (isAdminRole ? true : Boolean(perm_data_confirm)),
          permAdmin: isAdminRole,
          status: status ?? "active",
        },
        select: {
          id: true,
          username: true,
          role: true,
          permDataInput: true,
          permDataConfirm: true,
          permAdmin: true,
          status: true,
          createdAt: true,
        },
      })

      res.status(201).json({ success: true, data: toUserPublic(user) })
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
  requireWriteAccess,
  requirePermission("perm_admin"),
  [
    param("id").isInt().toInt(),
    body("password").optional().isLength({ min: 6 }),
    body("role").notEmpty().withMessage("role required").isIn(["ADMIN", "EDITOR", "VIEWER"]),
    body("perm_data_input").isInt({ min: 0, max: 1 }).toInt(),
    body("perm_data_confirm").isInt({ min: 0, max: 1 }).toInt(),
    body("perm_admin").isInt({ min: 0, max: 1 }).toInt(),
    body("status").isIn(["active", "inactive"]),
  ],
  handleValidation,
  async (req: Request, res: Response) => {
    try {
      const userId = Number(req.params.id)
      const { password, role, perm_data_input, perm_data_confirm, perm_admin, status } = req.body
      const normalizedRole = role as UserRole
      const isViewerRole = normalizedRole === "VIEWER"
      const isAdminRole = normalizedRole === "ADMIN"

      const existing = await prisma.user.findUnique({ where: { id: userId } })
      if (!existing) {
        res.status(404).json({ success: false, error: "User not found" })
        return
      }

      const updateData: Parameters<typeof prisma.user.update>[0]["data"] = {
        role: normalizedRole,
        permDataInput: isViewerRole ? false : (isAdminRole ? true : Boolean(perm_data_input)),
        permDataConfirm: isViewerRole ? false : (isAdminRole ? true : Boolean(perm_data_confirm)),
        permAdmin: isAdminRole ? true : (isViewerRole ? false : Boolean(perm_admin)),
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
          role: true,
          permDataInput: true,
          permDataConfirm: true,
          permAdmin: true,
          status: true,
          lastLoginAt: true,
          createdAt: true,
        },
      })

      res.json({ success: true, data: toUserPublic(user) })
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
  loginRateLimiter.middleware,
  async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body

      const user = await prisma.user.findUnique({ where: { username } })
      if (!user || user.status === "inactive") {
        createOperationLog({
          userId: null,
          username: username ?? null,
          action: "LOGIN_FAILED",
          module: "Auth",
          targetType: "User",
          targetId: null,
          detail: "Invalid credentials",
        });
        res.status(401).json({ success: false, error: "Invalid credentials" })
        return
      }

      const valid = await bcrypt.compare(password, user.passwordHash)
      if (!valid) {
        createOperationLog({
          userId: null,
          username: username ?? null,
          action: "LOGIN_FAILED",
          module: "Auth",
          targetType: "User",
          targetId: null,
          detail: "Invalid credentials",
        });
        res.status(401).json({ success: false, error: "Invalid credentials" })
        return
      }

      loginRateLimiter.reset(req)

      // Update last_login_at
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      })

      const payload: UserPublic = {
        id: user.id,
        username: user.username,
        role: resolveUserRole(user),
        perm_data_input: user.permDataInput,
        perm_data_confirm: user.permDataConfirm,
        perm_admin: user.permAdmin,
        status: user.status as UserStatus,
        last_login_at: user.lastLoginAt ?? undefined,
        created_at: user.createdAt,
      }

      const token = jwt.sign(payload, getRequiredEnv("JWT_SECRET"), { expiresIn: JWT_EXPIRES_IN })

      createOperationLog({
        userId: user.id,
        username: user.username,
        action: "LOGIN_SUCCESS",
        module: "Auth",
        targetType: "User",
        targetId: String(user.id),
        detail: null,
      });

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
          role: true,
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
      res.json({ success: true, data: toUserPublic(user) })
    } catch (err: any) {
      console.error("GET /api/auth/me error:", err)
      res.status(500).json({ success: false, error: "Internal server error" })
    }
  }
)

export default router
