import { Router, Request, Response } from "express"
import { body, query, validationResult } from "express-validator"
import { requirePermission, requireAuth, AuthRequest } from "../middleware/auth.js"
import prisma from "../prisma.js"
import { formatBusinessDate, getBusinessDayRange, getBusinessDayStart, getBusinessMonthRange } from "../utils/date.js"
import {
  YIYI_DEFAULT_PROFIT_UNIT_PRICE,
  YIYI_DEFAULT_UNIT_PRICE,
} from "../services/yiyiPricing.service.js"

const router = Router()

const YIYI_CHANNELS = ["yy-02-01", "yy-02-02", "yy-02-03", "yy-02-04"] as const
type YiyiChannel = (typeof YIYI_CHANNELS)[number]

function createEmptyChannelValues(): Record<YiyiChannel, number> {
  return {
    "yy-02-01": 0,
    "yy-02-02": 0,
    "yy-02-03": 0,
    "yy-02-04": 0,
  }
}

function isYiyiChannel(value: string): value is YiyiChannel {
  return (YIYI_CHANNELS as readonly string[]).includes(value)
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

function normalizeNonNegativeNumber(value: unknown, defaultValue = 0): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : defaultValue
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
// GET /api/yiyi-data
// Query: date (YYYY-MM-DD)
// ============================================================
router.get(
  "/yiyi-data",
  requireAuth,
  [query("date").notEmpty().withMessage("date is required").isISO8601()],
  handleValidation,
  async (req: AuthRequest, res: Response) => {
    try {
      const dateStr = req.query.date as string
      const { gte: startOfDay, lt: endOfDay } = getBusinessDayRange(dateStr)

      const records = await prisma.yiyiDailyData.findMany({
        where: { recordDate: { gte: startOfDay, lt: endOfDay } },
      })

      // Return all 4 channels, filling missing ones with qty=0
      const result = YIYI_CHANNELS.map((channel) => {
        const rec = records.find((r) => r.channel === channel)
        return {
          channel,
          qty: rec?.qty ?? 0,
          hasData: !!rec,
        }
      })

      res.json({ success: true, data: result })
    } catch (err: any) {
      console.error("GET /api/yiyi-data error:", err)
      res.status(500).json({ success: false, error: "Internal server error" })
    }
  }
)

// ============================================================
// GET /api/yiyi-data/monthly
// Query: year, month
// ============================================================
router.get(
  "/yiyi-data/monthly",
  requireAuth,
  [
    query("year").notEmpty().withMessage("year is required").isInt({ min: 2020, max: 2100 }).toInt(),
    query("month").notEmpty().withMessage("month is required").isInt({ min: 1, max: 12 }).toInt(),
  ],
  handleValidation,
  async (req: AuthRequest, res: Response) => {
    try {
      const year = Number(req.query.year)
      const month = Number(req.query.month)
      const { gte: startOfMonth, lt: endOfMonth } = getBusinessMonthRange(year, month)

      const records = await prisma.yiyiDailyData.findMany({
        where: {
          recordDate: { gte: startOfMonth, lt: endOfMonth },
        },
        orderBy: [{ recordDate: "asc" }, { channel: "asc" }],
      })
      const pricings = await prisma.yiyiDailyPricing.findMany({
        where: {
          recordDate: { gte: startOfMonth, lt: endOfMonth },
        },
        orderBy: { recordDate: "asc" },
      })

      const byDate = new Map<string, Record<string, number>>()
      const pricingByDate = new Map<
        string,
        { unit_price: number; profit_unit_price: number }
      >()

      for (const record of records) {
        const dateKey = formatBusinessDate(record.recordDate)
        const current = byDate.get(dateKey) ?? createEmptyChannelValues()
        if (isYiyiChannel(record.channel)) {
          current[record.channel] = record.qty
        }
        byDate.set(dateKey, current)
      }

      for (const pricing of pricings) {
        const dateKey = formatBusinessDate(pricing.recordDate)
        pricingByDate.set(dateKey, {
          unit_price: Number(pricing.unitPrice),
          profit_unit_price: Number(pricing.profitUnitPrice),
        })
      }

      const result = getDaysInMonth(year, month).map((date) => ({
        date,
        unit_price: pricingByDate.get(date)?.unit_price ?? YIYI_DEFAULT_UNIT_PRICE,
        profit_unit_price:
          pricingByDate.get(date)?.profit_unit_price ?? YIYI_DEFAULT_PROFIT_UNIT_PRICE,
        ...Object.fromEntries(
          YIYI_CHANNELS.map((channel) => [channel, byDate.get(date)?.[channel] ?? 0])
        ),
      }))

      res.json({ success: true, data: result })
    } catch (err: any) {
      console.error("GET /api/yiyi-data/monthly error:", err)
      res.status(500).json({ success: false, error: "Internal server error" })
    }
  }
)

// ============================================================
// POST /api/yiyi-data/batch
// Body: { date: string, channels: [{ channel, qty }] }
// ============================================================
router.post(
  "/yiyi-data/batch",
  requireAuth,
  requirePermission("perm_data_input"),
  [
    body("date").notEmpty().withMessage("date is required").isISO8601(),
    body("channels").isArray({ min: 1 }).withMessage("channels must be a non-empty array"),
  ],
  handleValidation,
  async (req: AuthRequest, res: Response) => {
    try {
      const { date, channels, unit_price, profit_unit_price } = req.body as {
        date: string
        channels: Array<{ channel: string; qty: number }>
        unit_price?: number
        profit_unit_price?: number
      }
      const recordDate = getBusinessDayStart(date)
      const { gte: startOfDay, lt: endOfDay } = getBusinessDayRange(date)

      // Validate channels
      for (const ch of channels) {
        if (!isYiyiChannel(ch.channel)) {
          res.status(400).json({
            success: false,
            error: `Invalid channel: ${ch.channel}. Must be one of: ${YIYI_CHANNELS.join(", ")}`,
          })
          return
        }
      }

      await prisma.yiyiDailyPricing.upsert({
        where: { recordDate },
        update: {
          unitPrice: normalizeNonNegativeNumber(unit_price, YIYI_DEFAULT_UNIT_PRICE),
          profitUnitPrice: normalizeNonNegativeNumber(
            profit_unit_price,
            YIYI_DEFAULT_PROFIT_UNIT_PRICE
          ),
        },
        create: {
          recordDate,
          unitPrice: normalizeNonNegativeNumber(unit_price, YIYI_DEFAULT_UNIT_PRICE),
          profitUnitPrice: normalizeNonNegativeNumber(
            profit_unit_price,
            YIYI_DEFAULT_PROFIT_UNIT_PRICE
          ),
        },
      })

      let saved = 0
      for (const ch of channels) {
        const existing = await prisma.yiyiDailyData.findFirst({
          where: {
            channel: ch.channel,
            recordDate: { gte: startOfDay, lt: endOfDay },
          },
        })

        if (existing) {
          await prisma.yiyiDailyData.update({
            where: { id: existing.id },
            data: { qty: ch.qty },
          })
        } else {
          await prisma.yiyiDailyData.create({
            data: {
              recordDate,
              channel: ch.channel,
              qty: ch.qty,
            },
          })
        }
        saved++
      }

      res.json({ success: true, saved })
    } catch (err: any) {
      console.error("POST /api/yiyi-data/batch error:", err)
      res.status(500).json({ success: false, error: "Internal server error" })
    }
  }
)

// ============================================================
// POST /api/yiyi-data/monthly-batch
// Body:
//   { rows: [{ date, unit_price, profit_unit_price, yy-02-01, yy-02-02, yy-02-03, yy-02-04 }] }
// or legacy:
//   { records: [{ date, channel, qty }] }
// ============================================================
router.post(
  "/yiyi-data/monthly-batch",
  requireAuth,
  requirePermission("perm_data_input"),
  [
    body().custom((value) => {
      const hasRows = Array.isArray(value?.rows) && value.rows.length > 0
      const hasRecords = Array.isArray(value?.records) && value.records.length > 0

      if (!hasRows && !hasRecords) {
        throw new Error("rows or records must be a non-empty array")
      }

      return true
    }),
  ],
  handleValidation,
  async (req: AuthRequest, res: Response) => {
    try {
      const { rows, records } = req.body as {
        rows?: Array<
          {
            date: string
            unit_price?: number
            profit_unit_price?: number
          } & Partial<Record<(typeof YIYI_CHANNELS)[number], number>>
        >
        records?: Array<{ date: string; channel: string; qty: number }>
      }

      let saved = 0
      let deleted = 0

      if (Array.isArray(rows) && rows.length > 0) {
        for (const row of rows) {
          if (!row.date) {
            res.status(400).json({ success: false, error: "date is required for every row" })
            return
          }

          const recordDate = getBusinessDayStart(row.date)

          await prisma.yiyiDailyPricing.upsert({
            where: { recordDate },
            update: {
              unitPrice: normalizeNonNegativeNumber(row.unit_price, YIYI_DEFAULT_UNIT_PRICE),
              profitUnitPrice: normalizeNonNegativeNumber(
                row.profit_unit_price,
                YIYI_DEFAULT_PROFIT_UNIT_PRICE
              ),
            },
            create: {
              recordDate,
              unitPrice: normalizeNonNegativeNumber(row.unit_price, YIYI_DEFAULT_UNIT_PRICE),
              profitUnitPrice: normalizeNonNegativeNumber(
                row.profit_unit_price,
                YIYI_DEFAULT_PROFIT_UNIT_PRICE
              ),
            },
          })

          for (const channel of YIYI_CHANNELS) {
            const qty = Math.max(0, Number(row[channel] ?? 0))
            const existing = await prisma.yiyiDailyData.findUnique({
              where: {
                recordDate_channel: {
                  recordDate,
                  channel,
                },
              },
            })

            if (existing) {
              if (qty > 0) {
                await prisma.yiyiDailyData.update({
                  where: { id: existing.id },
                  data: { qty },
                })
                saved++
              } else {
                await prisma.yiyiDailyData.delete({
                  where: { id: existing.id },
                })
                deleted++
              }
            } else if (qty > 0) {
              await prisma.yiyiDailyData.create({
                data: {
                  recordDate,
                  channel,
                  qty,
                },
              })
              saved++
            }
          }
        }

        res.json({ success: true, saved, deleted, processed: rows.length })
        return
      }

      for (const record of records ?? []) {
        if (!record.date) {
          res.status(400).json({ success: false, error: "date is required for every record" })
          return
        }

        if (!isYiyiChannel(record.channel)) {
          res.status(400).json({
            success: false,
            error: `Invalid channel: ${record.channel}. Must be one of: ${YIYI_CHANNELS.join(", ")}`,
          })
          return
        }

        const qty = Math.max(0, Number(record.qty ?? 0))
        const recordDate = getBusinessDayStart(record.date)
        const { gte: startOfDay, lt: endOfDay } = getBusinessDayRange(record.date)

        const existing = await prisma.yiyiDailyData.findFirst({
          where: {
            channel: record.channel,
            recordDate: { gte: startOfDay, lt: endOfDay },
          },
        })

        if (existing) {
          if (qty > 0) {
            await prisma.yiyiDailyData.update({
              where: { id: existing.id },
              data: { qty },
            })
            saved++
          } else {
            await prisma.yiyiDailyData.delete({
              where: { id: existing.id },
            })
            deleted++
          }
        } else if (qty > 0) {
          await prisma.yiyiDailyData.create({
            data: {
              recordDate,
              channel: record.channel,
              qty,
            },
          })
          saved++
        }
      }

      res.json({ success: true, saved, deleted, processed: records?.length ?? 0 })
    } catch (err: any) {
      console.error("POST /api/yiyi-data/monthly-batch error:", err)
      res.status(500).json({ success: false, error: "Internal server error" })
    }
  }
)

export default router
