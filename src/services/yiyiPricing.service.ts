import { PrismaClient } from "@prisma/client"
import { getBusinessDayStart } from "../utils/date.js"
import {
  YIYI_DEFAULT_PROFIT_UNIT_PRICE,
  YIYI_DEFAULT_UNIT_PRICE,
  calculateYiyiAmount,
  calculateYiyiProfit,
  calculateYiyiTotal,
} from "../utils/calculations.js"

export {
  YIYI_DEFAULT_PROFIT_UNIT_PRICE,
  YIYI_DEFAULT_UNIT_PRICE,
  calculateYiyiAmount,
  calculateYiyiProfit,
  calculateYiyiTotal,
}

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
