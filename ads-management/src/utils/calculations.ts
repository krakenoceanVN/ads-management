export function calculateCpmRevenue(quantity: number, unitPrice: number): number {
  return quantity * unitPrice
}

export function calculateRebateAmount(baseRevenue: number, rebateRate: number): number {
  return baseRevenue * rebateRate
}

export function calculateActualRevenue(baseRevenue: number, rebateAmount: number): number {
  return baseRevenue - rebateAmount
}
