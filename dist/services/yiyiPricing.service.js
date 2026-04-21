"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateYiyiTotal = exports.calculateYiyiProfit = exports.calculateYiyiAmount = exports.YIYI_DEFAULT_UNIT_PRICE = exports.YIYI_DEFAULT_PROFIT_UNIT_PRICE = void 0;
exports.getYiyiDailyPricing = getYiyiDailyPricing;
const date_js_1 = require("../utils/date.js");
const calculations_js_1 = require("../utils/calculations.js");
Object.defineProperty(exports, "YIYI_DEFAULT_PROFIT_UNIT_PRICE", { enumerable: true, get: function () { return calculations_js_1.YIYI_DEFAULT_PROFIT_UNIT_PRICE; } });
Object.defineProperty(exports, "YIYI_DEFAULT_UNIT_PRICE", { enumerable: true, get: function () { return calculations_js_1.YIYI_DEFAULT_UNIT_PRICE; } });
Object.defineProperty(exports, "calculateYiyiAmount", { enumerable: true, get: function () { return calculations_js_1.calculateYiyiAmount; } });
Object.defineProperty(exports, "calculateYiyiProfit", { enumerable: true, get: function () { return calculations_js_1.calculateYiyiProfit; } });
Object.defineProperty(exports, "calculateYiyiTotal", { enumerable: true, get: function () { return calculations_js_1.calculateYiyiTotal; } });
async function getYiyiDailyPricing(dateStr, prisma) {
    const recordDate = (0, date_js_1.getBusinessDayStart)(dateStr);
    const pricing = await prisma.yiyiDailyPricing.findUnique({
        where: { recordDate },
    });
    return {
        unitPrice: Number(pricing?.unitPrice ?? calculations_js_1.YIYI_DEFAULT_UNIT_PRICE),
        profitUnitPrice: Number(pricing?.profitUnitPrice ?? calculations_js_1.YIYI_DEFAULT_PROFIT_UNIT_PRICE),
    };
}
