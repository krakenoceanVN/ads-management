"use strict";
/**
 * Dashboard Controller
 *
 * GET /api/bff/dashboard/monthly?year=YYYY&month=M
 *
 * Reuses getTotalProfit() internally — no duplicate payout/cost logic.
 * Revenue from DailyInput.revenue, confirmed records only.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDashboardMonthly = getDashboardMonthly;
const profitReport_service_1 = require("../reports/profitReport.service");
const success_1 = require("../../../shared/response/success");
async function getDashboardMonthly(req, res) {
    const { year, month } = req.query;
    if (!year || !month) {
        res.status(400).json({
            success: false,
            error: 'year and month query params are required',
            code: 'BAD_REQUEST',
        });
        return;
    }
    const yearNum = parseInt(String(year), 10);
    const monthNum = parseInt(String(month), 10);
    if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
        res.status(400).json({
            success: false,
            error: 'Invalid year or month',
            code: 'BAD_REQUEST',
        });
        return;
    }
    const startDate = `${String(yearNum).padStart(4, '0')}-${String(monthNum).padStart(2, '0')}-01`;
    const lastDay = new Date(yearNum, monthNum, 0).getDate();
    const endDate = `${String(yearNum).padStart(4, '0')}-${String(monthNum).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    const params = { startDate, endDate };
    try {
        const dailyRows = await (0, profitReport_service_1.getTotalProfit)(params);
        // Aggregate daily rows into monthly totals
        let totalRevenue = 0;
        let totalCost = 0;
        let totalGrossProfit = 0;
        let totalTax = 0;
        let totalProfit = 0;
        let totalRecordCount = 0;
        for (const row of dailyRows) {
            totalRevenue += row.revenue;
            totalCost += row.cost;
            totalGrossProfit += row.grossProfit;
            totalTax += row.tax;
            totalProfit += row.profit;
            totalRecordCount += row.recordCount;
        }
        const roundCurrency = (v) => Math.round(v * 100) / 100;
        const totalRevenueR = roundCurrency(totalRevenue);
        const totalCostR = roundCurrency(totalCost);
        const totalGrossProfitR = roundCurrency(totalGrossProfit);
        const totalTaxR = roundCurrency(totalTax);
        const totalProfitR = roundCurrency(totalProfit);
        const profitRateR = totalRevenueR > 0 ? roundCurrency(totalProfitR / totalRevenueR) : 0;
        res.json((0, success_1.bffData)({
            monthly: {
                revenue: totalRevenueR,
                cost: totalCostR,
                grossProfit: totalGrossProfitR,
                tax: totalTaxR,
                profit: totalProfitR,
                profitRate: profitRateR,
                recordCount: totalRecordCount,
            },
            daily: dailyRows,
        }));
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message, code: 'INTERNAL' });
    }
}
//# sourceMappingURL=dashboard.controller.js.map