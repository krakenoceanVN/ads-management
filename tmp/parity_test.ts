/**
 * Temporary Total Profit Parity Test Script
 * Compares old per-day loop vs new monthly bulk output for May 2026
 */
import { PrismaClient } from "@prisma/client";
import { calculateCostBreakdown, calculateCostBreakdownMonthly } from "../src/services/mlPayout.service";
import { getDaysInMonth } from "../src/utils/date";

const prisma = new PrismaClient();
const YEAR = 2026;
const MONTH = 5;
const AD_TYPE = "SM";

async function main() {
  console.log("=== TOTAL PROFIT PARITY TEST: May 2026 ===\n");

  const days = getDaysInMonth(YEAR, MONTH);
  const oldResults = new Map<string, any>();
  const newResults = await calculateCostBreakdownMonthly(YEAR, MONTH, AD_TYPE, prisma);

  console.log("Running old per-day loop...");
  for (const day of days) {
    try {
      const breakdown = await calculateCostBreakdown(day, AD_TYPE, prisma);
      oldResults.set(day, breakdown);
    } catch (e: any) {
      console.warn(`  Day ${day} error: ${e.message}`);
    }
  }

  let maxProfitDiff = 0;
  let maxProfitRateDiff = 0;
  let totalRevenueDiff = 0;
  let totalCostDiff = 0;
  let totalProfitDiff = 0;
  let totalMlPayoutDiff = 0;
  let totalLePayoutDiff = 0;
  let totalYiyiPayoutDiff = 0;
  let totalTaxDiff = 0;
  let mismatches = 0;

  for (const day of days) {
    const oldDay = oldResults.get(day);
    const newDay = newResults.get(day);

    if (!oldDay && !newDay) continue;

    const revenueDiff = Math.abs((newDay?.revenue ?? 0) - (oldDay?.revenue ?? 0));
    const costDiff = Math.abs((newDay?.cost ?? 0) - (oldDay?.cost ?? 0));
    const profitDiff = Math.abs((newDay?.profit ?? 0) - (oldDay?.profit ?? 0));
    const profitRateDiff = Math.abs((newDay?.profit_rate ?? 0) - (oldDay?.profit_rate ?? 0));
    const mlPayoutDiff = Math.abs((newDay?.ml_payout ?? 0) - (oldDay?.ml_payout ?? 0));
    const lePayoutDiff = Math.abs((newDay?.le_payout ?? 0) - (oldDay?.le_payout ?? 0));
    const yiyiPayoutDiff = Math.abs((newDay?.yiyi_payout ?? 0) - (oldDay?.yiyi_payout ?? 0));
    const taxDiff = Math.abs((newDay?.tax ?? 0) - (oldDay?.tax ?? 0));

    totalRevenueDiff += revenueDiff;
    totalCostDiff += costDiff;
    totalProfitDiff += profitDiff;
    totalMlPayoutDiff += mlPayoutDiff;
    totalLePayoutDiff += lePayoutDiff;
    totalYiyiPayoutDiff += yiyiPayoutDiff;
    totalTaxDiff += taxDiff;

    if (revenueDiff > 0.001 || costDiff > 0.001 || profitDiff > 0.001 || profitRateDiff > 0.0001) {
      mismatches++;
      console.log(`MISMATCH ${day}:`);
      console.log(`  old: revenue=${oldDay?.revenue}, cost=${oldDay?.cost}, profit=${oldDay?.profit}, profit_rate=${oldDay?.profit_rate}`);
      console.log(`  new: revenue=${newDay?.revenue}, cost=${newDay?.cost}, profit=${newDay?.profit}, profit_rate=${newDay?.profit_rate}`);
      console.log(`  old: ml_payout=${oldDay?.ml_payout}, le_payout=${oldDay?.le_payout}, yiyi_payout=${oldDay?.yiyi_payout}, tax=${oldDay?.tax}`);
      console.log(`  new: ml_payout=${newDay?.ml_payout}, le_payout=${newDay?.le_payout}, yiyi_payout=${newDay?.yiyi_payout}, tax=${newDay?.tax}`);
      console.log(`  diffs: revenue=${revenueDiff}, cost=${costDiff}, profit=${profitDiff}, ml_pay=${mlPayoutDiff}, le_pay=${lePayoutDiff}, yiyi=${yiyiPayoutDiff}, tax=${taxDiff}`);
    }

    if (profitDiff > maxProfitDiff) maxProfitDiff = profitDiff;
    if (profitRateDiff > maxProfitRateDiff) maxProfitRateDiff = profitRateDiff;
  }

  let oldMonthlyTotal = { revenue: 0, cost: 0, profit: 0, ml_payout: 0, le_payout: 0, yiyi_payout: 0, tax: 0 };
  let newMonthlyTotal = { revenue: 0, cost: 0, profit: 0, ml_payout: 0, le_payout: 0, yiyi_payout: 0, tax: 0 };

  for (const day of days) {
    const oldDay = oldResults.get(day);
    const newDay = newResults.get(day);
    if (oldDay) {
      oldMonthlyTotal.revenue += oldDay.revenue;
      oldMonthlyTotal.cost += oldDay.cost;
      oldMonthlyTotal.profit += oldDay.profit;
      oldMonthlyTotal.ml_payout += oldDay.ml_payout;
      oldMonthlyTotal.le_payout += oldDay.le_payout ?? 0;
      oldMonthlyTotal.yiyi_payout += oldDay.yiyi_payout ?? 0;
      oldMonthlyTotal.tax += oldDay.tax;
    }
    if (newDay) {
      newMonthlyTotal.revenue += newDay.revenue;
      newMonthlyTotal.cost += newDay.cost;
      newMonthlyTotal.profit += newDay.profit;
      newMonthlyTotal.ml_payout += newDay.ml_payout;
      newMonthlyTotal.le_payout += newDay.le_payout ?? 0;
      newMonthlyTotal.yiyi_payout += newDay.yiyi_payout ?? 0;
      newMonthlyTotal.tax += newDay.tax;
    }
  }

  console.log("\n=== MONTHLY TOTALS ===");
  console.log(`revenue:    old=${oldMonthlyTotal.revenue}, new=${newMonthlyTotal.revenue}, diff=${totalRevenueDiff}`);
  console.log(`cost:       old=${oldMonthlyTotal.cost}, new=${newMonthlyTotal.cost}, diff=${totalCostDiff}`);
  console.log(`profit:     old=${oldMonthlyTotal.profit}, new=${newMonthlyTotal.profit}, diff=${totalProfitDiff}`);
  console.log(`ml_payout:  old=${oldMonthlyTotal.ml_payout}, new=${newMonthlyTotal.ml_payout}, diff=${totalMlPayoutDiff}`);
  console.log(`le_payout:  old=${oldMonthlyTotal.le_payout}, new=${newMonthlyTotal.le_payout}, diff=${totalLePayoutDiff}`);
  console.log(`yiyi_pay:   old=${oldMonthlyTotal.yiyi_payout}, new=${newMonthlyTotal.yiyi_payout}, diff=${totalYiyiPayoutDiff}`);
  console.log(`tax:        old=${oldMonthlyTotal.tax}, new=${newMonthlyTotal.tax}, diff=${totalTaxDiff}`);

  console.log("\n=== SUMMARY ===");
  console.log(`Days with data: ${oldResults.size}`);
  console.log(`Mismatches: ${mismatches}`);
  console.log(`Max profit diff: ${maxProfitDiff}`);
  console.log(`Max profit_rate diff: ${maxProfitRateDiff}`);

  console.log(mismatches === 0 ? "\nPARITY TEST PASSED" : "\nPARITY TEST FAILED");

  await prisma.$disconnect();
  process.exit(mismatches === 0 ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });