export const TAX_RATE = 0.06
export const DEFAULT_ML_PAYOUT_RATE = 0.8
export const DEFAULT_LE_PAYOUT_RATE = 0.9
export const DEFAULT_LE_UNIT_PRICE = 16
export const YIYI_DEFAULT_UNIT_PRICE = 2
export const YIYI_DEFAULT_PROFIT_UNIT_PRICE = 1

export function calculateCpmRevenue(quantity: number, unitPrice: number): number {
  return quantity * unitPrice
}

export function calculateRatioRevenue(amount1: number, amount2: number, ratio: number): number {
  return (amount1 + amount2) * ratio
}

export function calculateMlPayoutAmount(
  totalRevenue: number,
  payoutRate = DEFAULT_ML_PAYOUT_RATE
): number {
  return totalRevenue * payoutRate
}

export function calculateLeRevenueFromSmRevenue(
  smRevenue: number,
  payoutRate = DEFAULT_LE_PAYOUT_RATE
): number {
  return smRevenue * payoutRate
}

export function calculateUnitPricePayout(quantity: number, unitPrice: number): number {
  return (quantity * unitPrice) / 1000
}

export function calculateFlatTax(amount: number, taxRate = TAX_RATE): number {
  return amount * taxRate
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

export function calculateYiyiAmount(totalQty: number, unitPrice: number): number {
  return calculateUnitPricePayout(totalQty, unitPrice)
}

export function calculateYiyiProfit(totalQty: number, profitUnitPrice: number): number {
  return calculateUnitPricePayout(totalQty, profitUnitPrice)
}

export function calculateYiyiTotal(
  totalQty: number,
  unitPrice: number,
  profitUnitPrice: number
): number {
  return calculateYiyiAmount(totalQty, unitPrice) + calculateYiyiProfit(totalQty, profitUnitPrice)
}

// Preserve current dashboard behavior for SM: monthly dashboard cost excludes ml_payout.
export function calculateSmDashboardCost(lePayout = 0, yiyiPayout = 0): number {
  return lePayout + yiyiPayout
}

// Preserve current service behavior for SM cost breakdown: include ML + LE + YIYI.
export function calculateSmServiceCost(
  mlPayout: number,
  lePayout = 0,
  yiyiPayout = 0
): number {
  return mlPayout + lePayout + yiyiPayout
}

export function applyMl80Rate(amount: number, payoutRate = DEFAULT_ML_PAYOUT_RATE): number {
  return amount * payoutRate
}
