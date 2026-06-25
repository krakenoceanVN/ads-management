/**
 * Centralized Payout / Cost Calculation Service
 *
 * Implements confirmed payout/cost rules:
 * - Only ACTIVE downstreams (downstream.status = 'active') are included in cost
 * - resolveDownstreamRate is PER-DOWNSTREAM: each active junction resolves its own rate
 * - Rate priority for that same downstream:
 *   AdSiteDownstream.customPrice → DailyDownstreamRate.effectiveRate
 *   → DownstreamPeriod.unitPrice → Downstream.payoutRate
 * - pctHal: DownstreamPeriod.pctHal, stored as a decimal ratio in [0,1] (1.0=100%, 0.8=80%)
 * - Cost formulas: CPM / CPA / CPS each with shareRatio multiplier
 * - Tax: grossProfit > 0 ? grossProfit * 0.06 : 0 (clamped to 0 on a loss)
 * - Revenue: always from DailyInput.revenue (no recalculation)
 * - Profit: grossProfit = revenue - cost; net = grossProfit - tax
 * - Rounding: all financial output to 2 decimal places
 *
 * Used by: media settlement, total-profit, order-profit, dashboard
 */

import { prisma } from '../../shared/prisma/client';
import type { Prisma } from '@prisma/client';
import { normalizeBillingMethod, type BillingMethod } from './revenue.service';

export const TAX_RATE = 0.06;
const DECIMAL_PLACES = 2;

// ─── pctHal Normalization ─────────────────────────────────────────────────────

/**
 * Canonical convention (per schema: `pctHal Decimal @default(1.0)` — "tỷ lệ"):
 * pctHal is stored as a DECIMAL RATIO in [0, 1]  (1.0 = 100%, 0.8 = 80%, 0.5 = 50%).
 *
 * Normalization rules (single, unambiguous convention):
 *   - null/undefined/non-finite → 1.0 (100%, the schema default)
 *   - value < 0                 → 0   (invalid, no share)
 *   - 0 <= value <= 1           → use as-is  (decimal ratio; 0 means 0%)
 *   - value > 1                 → legacy/mis-entered percentage (e.g. 80) → /100, capped at 1.0
 *
 * Note: 1 resolves to 100% (ratio), consistent with the schema default of 1.0.
 */
export function normalizePctHal(raw: number | string | Prisma.Decimal | null | undefined): number {
  if (raw == null) return 1.0;
  const val = typeof raw === 'number' ? raw : parseFloat(String(raw));
  if (!isFinite(val)) return 1.0;
  if (val < 0) return 0;
  if (val <= 1) return Math.round(val * 1000) / 1000;
  // value > 1: treat as a legacy percentage entry and convert, capping at 1.0
  return Math.min(1, Math.round((val / 100) * 1000) / 1000);
}

// ─── Rate Resolution ────────────────────────────────────────────────────────

export interface ResolvedRate {
  rate: number;
  source: 'customPrice' | 'DailyDownstreamRate' | 'DownstreamPeriod' | 'Downstream.payoutRate';
}

/**
 * Resolve payout rate for a specific downstream of a given adSite + date.
 * Rate priority for that SAME downstream:
 *   1. AdSiteDownstream.customPrice  (this adSiteId + downstreamId junction)
 *   2. DailyDownstreamRate.effectiveRate  (this downstreamId / date)
 *   3. DownstreamPeriod.unitPrice  (this downstreamId / active on recordDate)
 *   4. Downstream.payoutRate  (this downstreamId / active only)
 * Throws if no rate is found.
 */
export async function resolveDownstreamRate(
  adSiteId: string,
  downstreamId: string,
  recordDate: Date
): Promise<ResolvedRate> {
  // 1. AdSiteDownstream.customPrice — scoped to this adSiteId + downstreamId
  const customPriceRow = await prisma.adSiteDownstream.findFirst({
    where: {
      adSiteId,
      downstreamId,
      status: 'active',
      downstream: { status: 'active' },
    },
    include: { downstream: true },
  });
  if (customPriceRow?.customPrice != null) {
    const val = parseFloat(customPriceRow.customPrice.toString());
    if (val > 0) {
      return { rate: round(val), source: 'customPrice' };
    }
  }

  // 2. DailyDownstreamRate.effectiveRate for this downstreamId on this date
  const dailyRate = await prisma.dailyDownstreamRate.findFirst({
    where: {
      downstreamId,
      date: recordDate,
    },
  });
  if (dailyRate) {
    const val = parseFloat(dailyRate.effectiveRate.toString());
    if (val > 0) {
      return { rate: round(val), source: 'DailyDownstreamRate' };
    }
  }

  // 3. DownstreamPeriod.unitPrice — this downstreamId, active on recordDate
  const period = await prisma.downstreamPeriod.findFirst({
    where: {
      downstreamId,
      startDate: { lte: recordDate },
      OR: [{ endDate: null }, { endDate: { gte: recordDate } }],
    },
    orderBy: { startDate: 'desc' },
  });
  if (period?.unitPrice != null) {
    const val = parseFloat(period.unitPrice.toString());
    if (val > 0) {
      return { rate: round(val), source: 'DownstreamPeriod' };
    }
  }

  // 4. Downstream.payoutRate — kept for backward compat (column may not exist on schema)
  const downstream = await prisma.downstream.findFirst({
    where: { id: downstreamId, status: 'active' },
  });
  if (downstream) {
    const payoutRate = (downstream as unknown as { payoutRate?: { toString(): string } }).payoutRate;
    if (payoutRate) {
      const val = parseFloat(payoutRate.toString());
      if (val > 0) {
        return { rate: round(val), source: 'Downstream.payoutRate' };
      }
    }
  }

  // No rate found — error (NOT default to 0)
  throw new Error(`No payout rate found for adSiteId=${adSiteId} downstreamId=${downstreamId} date=${recordDate.toISOString().slice(0, 10)}`);
}

// ─── Cost Calculation ────────────────────────────────────────────────────────

function toNum(v: string | number | Prisma.Decimal | null | undefined): number {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  const f = parseFloat(String(v));
  return isNaN(f) ? 0 : f;
}

function round(v: number): number {
  return Math.round(v * 100) / 100;
}

function roundCurrency(v: number): number {
  return Math.round(v * 100) / 100;
}

/**
 * Calculate downstream cost for a single DailyInput record.
 * billingMethod comes from the AdSite (already queried).
 * shareRatio comes from DownstreamPeriod.pctHal.
 *
 * CPM:  cost = qty * rate / 1000 * shareRatio
 * CPA:  cost = qty * rate * shareRatio
 * CPS:  cost = (amount1 + amount2) * rate * shareRatio
 */
export function calculateCost(
  billingMethod: BillingMethod,
  qty: number,
  rate: number,
  shareRatio: number,
  amount1?: number,
  amount2?: number
): number {
  const q = toNum(qty);
  const r = toNum(rate);
  const sr = toNum(shareRatio);

  switch (billingMethod) {
    case 'CPM':
      return roundCurrency((q * r / 1000) * sr);
    case 'CPA':
      return roundCurrency(q * r * sr);
    case 'CPS':
      return roundCurrency((toNum(amount1) + toNum(amount2)) * r * sr);
    default:
      return 0;
  }
}

// ─── Profit Calculation ───────────────────────────────────────────────────────

export interface ProfitResult {
  revenue: number;      // SUM(DailyInput.revenue)
  cost: number;         // SUM(resolved downstream costs)
  grossProfit: number; // revenue - cost
  tax: number;          // grossProfit > 0 ? grossProfit * TAX_RATE : 0 (clamped on loss)
  profit: number;       // grossProfit - tax
  profitRate: number;  // profit / revenue (or 0 if revenue=0)
}

/**
 * Calculate profit breakdown from pre-aggregated revenue and cost sums.
 */
export function calculateProfit(revenue: number, cost: number): ProfitResult {
  const rev = roundCurrency(revenue);
  const cst = roundCurrency(cost);
  const grossProfit = roundCurrency(rev - cst);
  // Tax is clamped to 0 on a loss — no negative tax when grossProfit < 0.
  const tax = grossProfit > 0 ? roundCurrency(grossProfit * TAX_RATE) : 0;
  const profit = roundCurrency(grossProfit - tax);
  const profitRate = rev > 0 ? roundCurrency(profit / rev) : 0;
  return { revenue: rev, cost: cst, grossProfit, tax, profit, profitRate };
}

// ─── Aggregate DailyInput Cost ───────────────────────────────────────────────

export interface DailyInputWithSite extends Prisma.DailyInputGetPayload<{
  include: {
    adSite: {
      include: {
        downstreams: { include: { downstream: true } };
      };
    };
  };
}> {}

export interface CostAggregation {
  totalCost: number;
  unresolvedCount: number;
  errors: string[];
}

/**
 * Aggregate total downstream cost for an array of DailyInput records.
 * Only ACTIVE downstreams are included (downstream.status = 'active').
 * Each active AdSiteDownstream junction resolves its OWN rate via resolveDownstreamRate,
 * then cost is calculated and summed — so multiple active downstreams each contribute
 * their own cost, not a single shared rate.
 * If no active downstream resolves a rate, the record contributes 0 cost.
 */
export async function aggregateDownstreamCost(
  inputs: DailyInputWithSite[]
): Promise<CostAggregation> {
  let totalCost = 0;
  const errors: string[] = [];

  for (const di of inputs) {
    const adSite = di.adSite;
    const downstreams = adSite.downstreams;

    if (downstreams.length === 0) {
      // No downstream junction — media side has no downstream cost
      continue;
    }

    let recordCost = 0;
    for (const j of downstreams) {
      // Skip inactive downstreams — only active downstreams are billable
      if (j.downstream?.status !== 'active') continue;

      const recordDate = di.recordDate;
      const adSiteId = adSite.id;
      // Defensive: normalizeBillingMethod() maps any incoming 'RATIO' to 'CPS'
      // so calculateCost matches the CPS branch. Once the DB is fully migrated
      // (no more RATIO rows) this is a no-op, but kept as a safety net.
      const billingMethod = normalizeBillingMethod(adSite.billingMethod);

      try {
        const { rate } = await resolveDownstreamRate(adSiteId, j.downstreamId, recordDate);

        // Resolve shareRatio from DownstreamPeriod
        const period = await prisma.downstreamPeriod.findFirst({
          where: {
            downstreamId: j.downstreamId,
            startDate: { lte: recordDate },
            OR: [{ endDate: null }, { endDate: { gte: recordDate } }],
          },
          orderBy: { startDate: 'desc' },
        });
        const pctHal = normalizePctHal(period?.pctHal ?? 1.0);
        const shareRatio = pctHal;

        const cost = calculateCost(
          billingMethod,
          toNum(di.qty),
          rate,
          shareRatio,
          toNum(di.amount1),
          toNum(di.amount2)
        );
        recordCost += cost;
      } catch (err: any) {
        errors.push(`adSiteId=${adSiteId} date=${recordDate.toISOString().slice(0,10)}: ${err.message}`);
      }
    }

    // Only accumulate if at least one active downstream resolved successfully
    if (recordCost === 0 && downstreams.some(j => j.downstream?.status === 'active')) {
      // Active downstream(s) exist but none resolved a rate — report unresolved
      for (const j of downstreams) {
        if (j.downstream?.status !== 'active') continue;
        try {
          await resolveDownstreamRate(adSite.id, j.downstreamId, di.recordDate);
        } catch (err: any) {
          errors.push(`adSiteId=${adSite.id} date=${di.recordDate.toISOString().slice(0,10)}: ${err.message}`);
        }
      }
    }

    totalCost = roundCurrency(totalCost + recordCost);
  }

  return {
    totalCost,
    unresolvedCount: errors.length,
    errors,
  };
}
