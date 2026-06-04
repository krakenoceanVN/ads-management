"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.YIYI_CHANNELS = void 0;
exports.getYiyiDaily = getYiyiDaily;
exports.getYiyiMonthly = getYiyiMonthly;
exports.saveYiyiBatch = saveYiyiBatch;
const client_1 = require("../../shared/prisma/client");
const client_2 = require("@prisma/client");
exports.YIYI_CHANNELS = ['yy-02-01', 'yy-02-02', 'yy-02-03', 'yy-02-04'];
function pad2(value) {
    return String(value).padStart(2, '0');
}
function formatCalendarDate(year, month, day) {
    return `${year}-${pad2(month)}-${pad2(day)}`;
}
function formatUtcDate(date) {
    return formatCalendarDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}
// ─── GET Daily ──────────────────────────────────────────────────────────────
async function getYiyiDaily(date) {
    const recordDate = new Date(date + 'T00:00:00.000Z');
    const rows = await client_1.prisma.yiyiDailyData.findMany({
        where: { recordDate },
        orderBy: { channel: 'asc' },
    });
    const pricing = await client_1.prisma.yiyiDailyPricing.findUnique({
        where: { recordDate },
    });
    // Return all 4 channels, qty=0 if missing
    return exports.YIYI_CHANNELS.map(channel => {
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
async function getYiyiMonthly(year, month) {
    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDateExclusive = new Date(Date.UTC(year, month, 1));
    const allData = await client_1.prisma.yiyiDailyData.findMany({
        where: { recordDate: { gte: startDate, lt: endDateExclusive } },
        orderBy: { recordDate: 'asc' },
    });
    const pricingMap = new Map();
    const allPricing = await client_1.prisma.yiyiDailyPricing.findMany({
        where: { recordDate: { gte: startDate, lt: endDateExclusive } },
    });
    allPricing.forEach(p => {
        const d = formatUtcDate(p.recordDate);
        pricingMap.set(d, {
            unitPrice: parseFloat(p.unitPrice.toString()),
            profitUnitPrice: parseFloat(p.profitUnitPrice.toString()),
        });
    });
    const dataByDate = new Map();
    allData.forEach(d => {
        const key = formatUtcDate(d.recordDate);
        if (!dataByDate.has(key))
            dataByDate.set(key, []);
        dataByDate.get(key).push(d);
    });
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const result = [];
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = formatCalendarDate(year, month, day);
        const dayData = dataByDate.get(dateStr) ?? [];
        const pricing = pricingMap.get(dateStr);
        const row = {
            date: dateStr,
            unit_price: pricing?.unitPrice ?? 2,
            profit_unit_price: pricing?.profitUnitPrice ?? 1,
            'yy-02-01': 0,
            'yy-02-02': 0,
            'yy-02-03': 0,
            'yy-02-04': 0,
        };
        for (const channel of exports.YIYI_CHANNELS) {
            const data = dayData.find(r => r.channel === channel);
            if (data) {
                row[channel] = data.qty;
            }
        }
        result.push(row);
    }
    return result;
}
async function saveYiyiBatch(date, items, pricing) {
    const recordDate = new Date(date + 'T00:00:00.000Z');
    const result = { savedData: 0, savedPricing: false, errors: [] };
    // Validate channels
    for (const item of items) {
        if (!exports.YIYI_CHANNELS.includes(item.channel)) {
            result.errors.push(`Invalid channel: ${item.channel}`);
        }
    }
    if (result.errors.length > 0) {
        throw new Error(result.errors.join('; '));
    }
    // Upsert YiyiDailyData for each channel
    for (const item of items) {
        await client_1.prisma.yiyiDailyData.upsert({
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
        await client_1.prisma.yiyiDailyPricing.upsert({
            where: { recordDate },
            update: {
                unitPrice: pricing.unitPrice !== undefined ? new client_2.Prisma.Decimal(pricing.unitPrice) : undefined,
                profitUnitPrice: pricing.profitUnitPrice !== undefined ? new client_2.Prisma.Decimal(pricing.profitUnitPrice) : undefined,
            },
            create: {
                recordDate,
                unitPrice: new client_2.Prisma.Decimal(pricing.unitPrice ?? 2),
                profitUnitPrice: new client_2.Prisma.Decimal(pricing.profitUnitPrice ?? 1),
            },
        });
        result.savedPricing = true;
    }
    return result;
}
//# sourceMappingURL=yiyi.service.js.map