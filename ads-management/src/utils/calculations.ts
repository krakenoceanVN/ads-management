import type { AdTypeCode } from '../types'

export const TAX_RATE = 0.06
export const DEFAULT_ML_PAYOUT_RATE = 0.8
export const YIYI_DEFAULT_UNIT_PRICE = 2
export const YIYI_DEFAULT_PROFIT_UNIT_PRICE = 1

export function calculateCpmRevenue(quantity: number, unitPrice: number): number {
  return quantity * unitPrice
}

export function calculateRatioRevenue(amount1: number, amount2: number, ratio: number): number {
  return (amount1 + amount2) * ratio
}

export function calculateYiyiAmount(totalQty: number, unitPrice: number): number {
  return (totalQty * unitPrice) / 1000
}

export function calculateYiyiProfit(totalQty: number, profitUnitPrice: number): number {
  return (totalQty * profitUnitPrice) / 1000
}

export function calculateYiyiTotal(totalQty: number, unitPrice: number, profitUnitPrice: number): number {
  return calculateYiyiAmount(totalQty, unitPrice) + calculateYiyiProfit(totalQty, profitUnitPrice)
}

export function calculateTaxOnMargin(revenue: number, cost: number, taxRate = TAX_RATE): number {
  return (revenue - cost) * taxRate
}

export function calculateGrossProfit(revenue: number, cost: number): number {
  return revenue - cost
}

export function calculateNetProfit(revenue: number, cost: number, tax: number): number {
  return revenue - cost - tax
}

export function calculateProfitRate(profit: number, revenue: number): number {
  return revenue > 0 ? profit / revenue : 0
}

// Preserve current display logic in upstream dashboard.
export function calculateDisplayMl80(adType: AdTypeCode, revenue: number, downstreamMl80 = 0): number {
  if (adType === '360') {
    return revenue * DEFAULT_ML_PAYOUT_RATE
  }

  return downstreamMl80
}

// Preserve current display logic in upstream dashboard.
export function calculateDisplayCostByAdType(adType: AdTypeCode, revenue: number, ml80 = 0, le = 0): number {
  if (adType === '360') {
    return revenue * DEFAULT_ML_PAYOUT_RATE
  }

  return ml80 + le
}
