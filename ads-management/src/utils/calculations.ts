export function calculateCpmRevenue(quantity: number, unitPrice: number): number {
  return quantity * unitPrice
}

export function calculateRebateAmount(quantity: number, rebateRate: number): number {
  return quantity * rebateRate
}

export function calculateActualRevenue(baseRevenue: number, rebateAmount: number): number {
  return baseRevenue - rebateAmount
}
