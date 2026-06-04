/**
 * Phase 6A: Yiyi Data Service
 *
 * Handles GET daily, GET monthly, and POST batch for Yiyi data.
 * Not under /api/bff — mounted directly at /api/yiyi-data
 *
 * Fixed channels: yy-02-01, yy-02-02, yy-02-03, yy-02-04
 *
 * GET daily: returns all 4 channels for a date, qty=0 if missing
 * GET monthly: returns all days of the month with channel data
 * POST batch: upserts YiyiDailyData (channel qty) and YiyiDailyPricing (pricing)
 */

import { prisma } from '../../shared/prisma/client';
import { Prisma } from '@prisma/client';

export const YIYI_CHANNELS = ['yy-02-01', 'yy-02-02', 'yy-02-03', 'yy-02-04'] as const;
export type YiyiChannel = typeof YIYI_CHANNELS[number];

export interface YiyiDailyRow {
  channel: string;
  qty: number;
  unitPrice?: number;
  profitUnitPrice?: number;
}

export interface YiyiMonthlyRow {
  date: string;
  unit_price: number;
  profit_unit_price: number;
  'yy-02-01': number;
  'yy-02-02': number;
  'yy-02-03': number;
  'yy-02-04': number;
}

type YiyiChannelKey = 'yy-02-01' | 'yy-02-02' | 'yy-02-03' | 'yy-02-04';

export interface BatchItem {
  channel: string;
  qty: number;
  unitPrice?: number;
  profitUnitPrice?: number;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function formatCalendarDate(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function formatUtcDate(date: Date): string {
  return formatCalendarDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

// ─── GET Daily ──────────────────────────────────────────────────────────────

export async function getYiyiDaily(date: string): Promise<YiyiDailyRow[]> {
  const recordDate = new Date(date + 'T00:00:00.000Z');

  const rows = await prisma.yiyiDailyData.findMany({
    where: { recordDate },
    orderBy: { channel: 'asc' },
  });

  const pricing = await prisma.yiyiDailyPricing.findUnique({
    where: { recordDate },
  });

  // Return all 4 channels, qty=0 if missing
  return YIYI_CHANNELS.map(channel => {
    const data = rows.find(r => r.channel === channel);
    return {
      channel,
      qty: data?.qty ?? 0,
      unitPrice: pricing ? parseFloat(pricing.unitPrice.toString()) : undefined,
      profitUnitPrice: pricing ? parseFloat(pricing.profitUnitPrice.toString()) : undefined,
    };
  });
}

// ─── GET Monthly ───────────────────────────────────────────────────────────────

export async function getYiyiMonthly(year: number, month: number): Promise<YiyiMonthlyRow[]> {
  const startDate = new Date(Date.UTC(year, month - 1, 1));
  const endDateExclusive = new Date(Date.UTC(year, month, 1));

  const allData = await prisma.yiyiDailyData.findMany({
    where: { recordDate: { gte: startDate, lt: endDateExclusive } },
    orderBy: { recordDate: 'asc' },
  });

  const pricingMap = new Map<string, { unitPrice: number; profitUnitPrice: number }>();
  const allPricing = await prisma.yiyiDailyPricing.findMany({
    where: { recordDate: { gte: startDate, lt: endDateExclusive } },
  });
  allPricing.forEach(p => {
    const d = formatUtcDate(p.recordDate);
    pricingMap.set(d, {
      unitPrice: parseFloat(p.unitPrice.toString()),
      profitUnitPrice: parseFloat(p.profitUnitPrice.toString()),
    });
  });

  const dataByDate = new Map<string, typeof allData>();
  allData.forEach(d => {
    const key = formatUtcDate(d.recordDate);
    if (!dataByDate.has(key)) dataByDate.set(key, []);
    dataByDate.get(key)!.push(d);
  });

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const result: YiyiMonthlyRow[] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = formatCalendarDate(year, month, day);
    const dayData = dataByDate.get(dateStr) ?? [];
    const pricing = pricingMap.get(dateStr);

    const row: YiyiMonthlyRow = {
      date: dateStr,
      unit_price: pricing?.unitPrice ?? 2,
      profit_unit_price: pricing?.profitUnitPrice ?? 1,
      'yy-02-01': 0,
      'yy-02-02': 0,
      'yy-02-03': 0,
      'yy-02-04': 0,
    };

    for (const channel of YIYI_CHANNELS) {
      const data = dayData.find(r => r.channel === channel);
      if (data) {
        row[channel as YiyiChannelKey] = data.qty;
      }
    }

    result.push(row);
  }

  return result;
}

// ─── POST Batch ───────────────────────────────────────────────────────────────

export interface BatchResult {
  savedData: number;
  savedPricing: boolean;
  errors: string[];
}

export async function saveYiyiBatch(
  date: string,
  items: BatchItem[],
  pricing?: { unitPrice?: number; profitUnitPrice?: number }
): Promise<BatchResult> {
  const recordDate = new Date(date + 'T00:00:00.000Z');
  const result: BatchResult = { savedData: 0, savedPricing: false, errors: [] };

  // Validate channels
  for (const item of items) {
    if (!YIYI_CHANNELS.includes(item.channel as YiyiChannel)) {
      result.errors.push(`Invalid channel: ${item.channel}`);
    }
  }

  if (result.errors.length > 0) {
    throw new Error(result.errors.join('; '));
  }

  // Upsert YiyiDailyData for each channel
  for (const item of items) {
    await prisma.yiyiDailyData.upsert({
      where: {
        recordDate_channel: { recordDate, channel: item.channel },
      },
      update: { qty: item.qty },
      create: { recordDate, channel: item.channel, qty: item.qty },
    });
    result.savedData++;
  }

  // Upsert YiyiDailyPricing if provided
  if (pricing && (pricing.unitPrice !== undefined || pricing.profitUnitPrice !== undefined)) {
    await prisma.yiyiDailyPricing.upsert({
      where: { recordDate },
      update: {
        unitPrice: pricing.unitPrice !== undefined ? new Prisma.Decimal(pricing.unitPrice) : undefined,
        profitUnitPrice: pricing.profitUnitPrice !== undefined ? new Prisma.Decimal(pricing.profitUnitPrice) : undefined,
      },
      create: {
        recordDate,
        unitPrice: new Prisma.Decimal(pricing.unitPrice ?? 2),
        profitUnitPrice: new Prisma.Decimal(pricing.profitUnitPrice ?? 1),
      },
    });
    result.savedPricing = true;
  }

  return result;
}
