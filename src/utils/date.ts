export const BUSINESS_TIME_ZONE = "Asia/Bangkok"
const BUSINESS_UTC_OFFSET_HOURS = 7

function parseDateParts(dateStr: string): [number, number, number] {
  const [year, month, day] = dateStr.split("-").map(Number)
  return [year, month, day]
}

export function formatBusinessDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)

  const year = parts.find((part) => part.type === "year")?.value ?? "0000"
  const month = parts.find((part) => part.type === "month")?.value ?? "00"
  const day = parts.find((part) => part.type === "day")?.value ?? "00"
  return `${year}-${month}-${day}`
}

export function getBusinessDayStart(dateStr: string): Date {
  const [year, month, day] = parseDateParts(dateStr)
  return new Date(Date.UTC(year, month - 1, day, -BUSINESS_UTC_OFFSET_HOURS, 0, 0))
}

export function getBusinessDateAtHour(dateStr: string, hour: number): Date {
  const [year, month, day] = parseDateParts(dateStr)
  return new Date(Date.UTC(year, month - 1, day, hour - BUSINESS_UTC_OFFSET_HOURS, 0, 0))
}

export function getBusinessDayRange(dateStr: string): { gte: Date; lt: Date } {
  const [year, month, day] = parseDateParts(dateStr)
  return {
    gte: getBusinessDayStart(dateStr),
    lt: new Date(Date.UTC(year, month - 1, day + 1, -BUSINESS_UTC_OFFSET_HOURS, 0, 0)),
  }
}

export function getBusinessMonthRange(year: number, month: number): { gte: Date; lt: Date } {
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`
  const nextYear = month === 12 ? year + 1 : year
  const nextMonth = month === 12 ? 1 : month + 1
  const nextMonthDate = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`
  return {
    gte: getBusinessDayStart(startDate),
    lt: getBusinessDayStart(nextMonthDate),
  }
}

export function getDaysInMonth(year: number, month: number): string[] {
  const days: string[] = []
  const date = new Date(Date.UTC(year, month - 1, 1))
  while (date.getUTCMonth() === month - 1) {
    const dayStr = String(date.getUTCDate()).padStart(2, "0")
    days.push(`${year}-${String(month).padStart(2, "0")}-${dayStr}`)
    date.setUTCDate(date.getUTCDate() + 1)
  }
  return days
}
