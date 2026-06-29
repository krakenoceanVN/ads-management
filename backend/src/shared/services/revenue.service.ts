/**
 * Shared revenue calculation service.
 * All financial formulas live here — controllers call calculateRevenue().
 *
 * CPM/CPC: baseRevenue = qty * unitPrice / 1000
 *          if rebateRate present: revenue = baseRevenue - (qty * rebateRate)
 *          else: revenue = baseRevenue
 * CPS:     revenue = (amount1 + amount2) * ratio
 * CPA:     revenue = qty * unitPrice
 */

export type BillingMethod = 'CPM' | 'CPC' | 'CPS' | 'CPA';

export interface RevenueInput {
  billingMethod: string;
  qty?: number | null;
  unitPrice?: string | number | null;
  amount1?: string | number | null;
  amount2?: string | number | null;
  ratio?: string | number | null;
  /** CPM rebate rate (decimal, e.g. 0.001 for 0.1%). Omit for no rebate. */
  rebateRate?: number | null;
}

export function normalizeBillingMethod(m: string): BillingMethod | undefined {
  if (m === 'RATIO') return 'CPS'; // legacy alias (DB now canonical on CPS)
  if (m === 'CPM' || m === 'CPC' || m === 'CPS' || m === 'CPA') return m;
  return undefined;
}

function toNum(v: string | number | null | undefined): number {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  return parseFloat(v) || 0;
}

export function calculateRevenue(input: RevenueInput): number {
  const { billingMethod, qty, unitPrice, amount1, amount2, ratio, rebateRate } = input;
  const bm = normalizeBillingMethod(billingMethod);

  switch (bm) {
    case 'CPM':
    case 'CPC': {
      const q = toNum(qty);
      const p = toNum(unitPrice);
      const baseRevenue = q * p / 1000;
      if (rebateRate != null && rebateRate > 0) {
        const rebateAmount = q * rebateRate;
        return baseRevenue - rebateAmount;
      }
      return baseRevenue;
    }
    case 'CPS': {
      const a1 = toNum(amount1);
      const a2 = toNum(amount2);
      const r = toNum(ratio);
      return (a1 + a2) * r;
    }
    case 'CPA': {
      const q = toNum(qty);
      const p = toNum(unitPrice);
      return q * p;
    }
    default:
      return 0;
  }
}

export function buildRevenuePayload(input: RevenueInput): number {
  return calculateRevenue(input);
}