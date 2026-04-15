"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.YIYI_DEFAULT_PROFIT_UNIT_PRICE = exports.YIYI_DEFAULT_UNIT_PRICE = void 0;
exports.getYiyiDailyPricing = getYiyiDailyPricing;
exports.calculateYiyiAmount = calculateYiyiAmount;
exports.calculateYiyiProfit = calculateYiyiProfit;
exports.calculateYiyiTotal = calculateYiyiTotal;
const date_js_1 = require("../utils/date.js");
exports.YIYI_DEFAULT_UNIT_PRICE = 2;
exports.YIYI_DEFAULT_PROFIT_UNIT_PRICE = 1;
async function getYiyiDailyPricing(dateStr, prisma) {
    const recordDate = (0, date_js_1.getBusinessDayStart)(dateStr);
    const pricing = await prisma.yiyiDailyPricing.findUnique({
        where: { recordDate },
    });
    return {
        unitPrice: Number(pricing?.unitPrice ?? exports.YIYI_DEFAULT_UNIT_PRICE),
        profitUnitPrice: Number(pricing?.profitUnitPrice ?? exports.YIYI_DEFAULT_PROFIT_UNIT_PRICE),
    };
}
function calculateYiyiAmount(totalQty, unitPrice) {
    return (totalQty * unitPrice) / 1000;
}
function calculateYiyiProfit(totalQty, profitUnitPrice) {
    return (totalQty * profitUnitPrice) / 1000;
}
function calculateYiyiTotal(totalQty, unitPrice, profitUnitPrice) {
    return calculateYiyiAmount(totalQty, unitPrice) + calculateYiyiProfit(totalQty, profitUnitPrice);
}
