const Database = require("better-sqlite3")

import path from "node:path"
import prisma from "../prisma.js"

type SqliteRow = Record<string, unknown>

const SQLITE_DB_PATH = path.join(process.cwd(), "prisma", "dev.db")
const CHUNK_SIZE = 1000

function openSqlite() {
  return new Database(SQLITE_DB_PATH, { readonly: true })
}

function getTableRows(db: any, tableName: string): SqliteRow[] {
  return db.prepare(`SELECT * FROM "${tableName}" ORDER BY id ASC`).all()
}

function getTableColumns(db: any, tableName: string): Set<string> {
  const columns = db.prepare(`PRAGMA table_info("${tableName}")`).all() as Array<{ name: string }>
  return new Set(columns.map((column) => column.name))
}

function toDate(value: unknown): Date | null {
  if (value === null || value === undefined) return null
  if (value instanceof Date) return value
  if (typeof value === "number") return new Date(value)
  if (typeof value === "string") {
    const trimmed = value.trim()
    if (!trimmed) return null
    if (/^\d+$/.test(trimmed)) return new Date(Number(trimmed))
    return new Date(trimmed)
  }
  throw new Error(`Unsupported date value: ${String(value)}`)
}

function toDecimal(value: unknown): string | null {
  if (value === null || value === undefined) return null
  return String(value)
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null
  return Number(value)
}

function toBoolean(value: unknown, fallback = false): boolean {
  if (value === null || value === undefined) return fallback
  if (typeof value === "boolean") return value
  if (typeof value === "number") return value !== 0
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase()
    if (normalized === "true") return true
    if (normalized === "false") return false
    if (normalized === "1") return true
    if (normalized === "0") return false
  }
  return Boolean(value)
}

async function createManyInChunks<T>(
  label: string,
  executor: (data: T[]) => Promise<unknown>,
  rows: T[],
): Promise<number> {
  for (let index = 0; index < rows.length; index += CHUNK_SIZE) {
    const chunk = rows.slice(index, index + CHUNK_SIZE)
    await executor(chunk)
  }
  console.log(`✓ Migrated ${rows.length} ${label}`)
  return rows.length
}

async function resetSequence(tableName: string): Promise<void> {
  const sequenceRows = await prisma.$queryRawUnsafe<Array<{ seq: string | null }>>(
    `SELECT pg_get_serial_sequence('public."${tableName}"', 'id') AS seq`
  )
  const sequenceName = sequenceRows[0]?.seq
  if (!sequenceName) return

  const maxRows = await prisma.$queryRawUnsafe<Array<{ max: number | null }>>(
    `SELECT COALESCE(MAX(id), 1) AS max FROM "public"."${tableName}"`
  )
  const maxId = Number(maxRows[0]?.max ?? 1)
  await prisma.$executeRawUnsafe(`SELECT setval('${sequenceName}', ${maxId}, true)`)
}

async function main() {
  const sqlite = openSqlite()
  const counts: Record<string, number> = {}

  try {
    const adSiteColumns = getTableColumns(sqlite, "AdSite")

    const users = getTableRows(sqlite, "User").map((row) => ({
      id: Number(row.id),
      username: String(row.username),
      passwordHash: String(row.passwordHash),
      permDataInput: toBoolean(row.permDataInput),
      permDataConfirm: toBoolean(row.permDataConfirm),
      permAdmin: toBoolean(row.permAdmin),
      status: String(row.status),
      lastLoginAt: toDate(row.lastLoginAt),
      createdAt: toDate(row.createdAt) ?? new Date(),
    }))

    const adTypes = getTableRows(sqlite, "AdType").map((row) => ({
      id: Number(row.id),
      code: String(row.code),
      name: String(row.name),
      createdAt: toDate(row.createdAt) ?? new Date(),
      updatedAt: toDate(row.updatedAt) ?? new Date(),
    }))

    const upstreams = getTableRows(sqlite, "Upstream").map((row) => ({
      id: Number(row.id),
      adTypeId: Number(row.adTypeId),
      name: String(row.name),
      status: String(row.status),
      createdAt: toDate(row.createdAt) ?? new Date(),
      updatedAt: toDate(row.updatedAt) ?? new Date(),
    }))

    const adSites = getTableRows(sqlite, "AdSite").map((row) => ({
      id: Number(row.id),
      upstreamId: Number(row.upstreamId),
      name: String(row.name),
      billingMethod: String(row.billingMethod),
      rebateRate: toNumber(row.rebateRate),
      currentUnitPrice: toDecimal(row.currentUnitPrice),
      currentRatio: toDecimal(row.currentRatio),
      isActive: adSiteColumns.has("isActive") ? toBoolean(row.isActive, true) : true,
      isArchived: adSiteColumns.has("isArchived") ? toBoolean(row.isArchived, false) : false,
      status: String(row.status),
      createdAt: toDate(row.createdAt) ?? new Date(),
      updatedAt: toDate(row.updatedAt) ?? new Date(),
    }))

    const downstreams = getTableRows(sqlite, "Downstream").map((row) => ({
      id: Number(row.id),
      adTypeId: Number(row.adTypeId),
      downstreamType: String(row.downstreamType),
      payoutRate: toDecimal(row.payoutRate) ?? "0",
      status: String(row.status),
      createdAt: toDate(row.createdAt) ?? new Date(),
      updatedAt: toDate(row.updatedAt) ?? new Date(),
    }))

    const adSiteDownstreams = getTableRows(sqlite, "AdSiteDownstream").map((row) => ({
      id: Number(row.id),
      adSiteId: Number(row.adSiteId),
      downstreamId: Number(row.downstreamId),
      customPrice: toDecimal(row.customPrice),
    }))

    const downstreamPeriods = getTableRows(sqlite, "DownstreamPeriod").map((row) => ({
      id: Number(row.id),
      downstreamId: Number(row.downstreamId),
      pctHal: toDecimal(row.pctHal) ?? "1",
      unitPrice: toDecimal(row.unitPrice),
      startDate: toDate(row.startDate) ?? new Date(),
      endDate: toDate(row.endDate),
      note: row.note === null || row.note === undefined ? null : String(row.note),
      createdBy: row.createdBy === null || row.createdBy === undefined ? null : Number(row.createdBy),
      createdAt: toDate(row.createdAt) ?? new Date(),
    }))

    const dailyDownstreamRates = getTableRows(sqlite, "DailyDownstreamRate").map((row) => ({
      id: Number(row.id),
      downstreamId: Number(row.downstreamId),
      date: toDate(row.date) ?? new Date(),
      effectiveRate: toDecimal(row.effectiveRate) ?? "0",
    }))

    const dailyInputs = getTableRows(sqlite, "DailyInput").map((row) => ({
      id: Number(row.id),
      recordDate: toDate(row.recordDate) ?? new Date(),
      adSiteId: Number(row.adSiteId),
      qty: Number(row.qty ?? 0),
      unitPriceSnapshot: toDecimal(row.unitPriceSnapshot),
      amount1: toDecimal(row.amount1) ?? "0",
      amount2: toDecimal(row.amount2) ?? "0",
      ratioSnapshot: toDecimal(row.ratioSnapshot),
      revenue: toDecimal(row.revenue) ?? "0",
      status: String(row.status),
      note: row.note === null || row.note === undefined ? null : String(row.note),
      createdBy: row.createdBy === null || row.createdBy === undefined ? null : Number(row.createdBy),
      createdAt: toDate(row.createdAt) ?? new Date(),
      updatedAt: toDate(row.updatedAt) ?? new Date(),
    }))

    const leDailyCosts = getTableRows(sqlite, "LEDailyCost").map((row) => ({
      id: Number(row.id),
      recordDate: toDate(row.recordDate) ?? new Date(),
      vendorCost: toDecimal(row.vendorCost) ?? "0",
      mlCost: toDecimal(row.mlCost) ?? "0",
      costAmount: toDecimal(row.costAmount) ?? "0",
      updatedAt: toDate(row.updatedAt) ?? new Date(),
    }))

    const yiyiDailyData = getTableRows(sqlite, "YiyiDailyData").map((row) => ({
      id: Number(row.id),
      recordDate: toDate(row.recordDate) ?? new Date(),
      channel: String(row.channel),
      qty: Number(row.qty),
      createdAt: toDate(row.createdAt) ?? new Date(),
    }))

    const yiyiDailyPricing = getTableRows(sqlite, "YiyiDailyPricing").map((row) => ({
      id: Number(row.id),
      recordDate: toDate(row.recordDate) ?? new Date(),
      unitPrice: toDecimal(row.unitPrice) ?? "0",
      profitUnitPrice: toDecimal(row.profitUnitPrice) ?? "0",
      updatedAt: toDate(row.updatedAt) ?? new Date(),
    }))

    console.log("🧹 Cleaning target PostgreSQL database...")
    await prisma.dailyInput.deleteMany()
    await prisma.lEDailyCost.deleteMany()
    await prisma.yiyiDailyData.deleteMany()
    await prisma.yiyiDailyPricing.deleteMany()
    await prisma.dailyDownstreamRate.deleteMany()
    await prisma.downstreamPeriod.deleteMany()
    await prisma.adSiteDownstream.deleteMany()
    await prisma.downstream.deleteMany()
    await prisma.adSite.deleteMany()
    await prisma.upstream.deleteMany()
    await prisma.adType.deleteMany()
    await prisma.user.deleteMany()

    console.log("🚚 Migrating SQLite data to PostgreSQL...")
    counts.User = await createManyInChunks("User", (data) => prisma.user.createMany({ data }), users)
    counts.AdType = await createManyInChunks("AdType", (data) => prisma.adType.createMany({ data }), adTypes)
    counts.Upstream = await createManyInChunks("Upstream", (data) => prisma.upstream.createMany({ data }), upstreams)
    counts.AdSite = await createManyInChunks("AdSite", (data) => prisma.adSite.createMany({ data }), adSites)
    counts.Downstream = await createManyInChunks("Downstream", (data) => prisma.downstream.createMany({ data }), downstreams)
    counts.AdSiteDownstream = await createManyInChunks(
      "AdSiteDownstream",
      (data) => prisma.adSiteDownstream.createMany({ data }),
      adSiteDownstreams,
    )
    counts.DownstreamPeriod = await createManyInChunks(
      "DownstreamPeriod",
      (data) => prisma.downstreamPeriod.createMany({ data }),
      downstreamPeriods,
    )
    counts.DailyDownstreamRate = await createManyInChunks(
      "DailyDownstreamRate",
      (data) => prisma.dailyDownstreamRate.createMany({ data }),
      dailyDownstreamRates,
    )
    counts.DailyInput = await createManyInChunks("DailyInput", (data) => prisma.dailyInput.createMany({ data }), dailyInputs)
    counts.LEDailyCost = await createManyInChunks("LEDailyCost", (data) => prisma.lEDailyCost.createMany({ data }), leDailyCosts)
    counts.YiyiDailyData = await createManyInChunks(
      "YiyiDailyData",
      (data) => prisma.yiyiDailyData.createMany({ data }),
      yiyiDailyData,
    )
    counts.YiyiDailyPricing = await createManyInChunks(
      "YiyiDailyPricing",
      (data) => prisma.yiyiDailyPricing.createMany({ data }),
      yiyiDailyPricing,
    )

    for (const tableName of [
      "User",
      "Upstream",
      "AdSite",
      "Downstream",
      "AdSiteDownstream",
      "DownstreamPeriod",
      "DailyDownstreamRate",
      "DailyInput",
      "LEDailyCost",
      "YiyiDailyData",
      "YiyiDailyPricing",
    ]) {
      await resetSequence(tableName)
    }

    console.log("✅ Migration complete")
    console.log(JSON.stringify(counts, null, 2))
  } finally {
    sqlite.close()
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error("❌ Migration failed:", error)
  process.exit(1)
})
