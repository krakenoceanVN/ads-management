import { PrismaClient } from "@prisma/client"
import { getBusinessDayStart } from "../utils/date.js"

export const YIYI_DEFAULT_UNIT_PRICE = 2
export const YIYI_DEFAULT_PROFIT_UNIT_PRICE = 1

export interface YiyiDailyPricingValues {
  unitPrice: number
  profitUnitPrice: number
}

export async function getYiyiDailyPricing(
  dateStr: string,
  prisma: PrismaClient
): Promise<YiyiDailyPricingValues> {
  const recordDate = getBusinessDayStart(dateStr)
  const pricing = await prisma.yiyiDailyPricing.findUnique({
    where: { recordDate },
  })

  return {
    unitPrice: Number(pricing?.unitPrice ?? YIYI_DEFAULT_UNIT_PRICE),
    profitUnitPrice: Number(pricing?.profitUnitPrice ?? YIYI_DEFAULT_PROFIT_UNIT_PRICE),
  }
}

export function calculateYiyiAmount(totalQty: number, unitPrice: number): number {
  return (totalQty * unitPrice) / 1000
}

export function calculateYiyiProfit(totalQty: number, profitUnitPrice: number): number {
  return (totalQty * profitUnitPrice) / 1000
}

export function calculateYiyiTotal(
  totalQty: number,
  unitPrice: number,
  profitUnitPrice: number
): number {
  return calculateYiyiAmount(totalQty, unitPrice) + calculateYiyiProfit(totalQty, profitUnitPrice)
}
