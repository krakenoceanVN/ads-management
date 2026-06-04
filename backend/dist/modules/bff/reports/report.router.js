"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportRouter = reportRouter;
const report_controller_1 = require("./report.controller");
const profitReport_controller_1 = require("./profitReport.controller");
const requireAuth_1 = require("../../../middleware/requireAuth");
const requirePermission_1 = require("../../../middleware/requirePermission");
function reportRouter(router) {
    router.get('/reports/advertisers', requireAuth_1.requireAuth, (0, requirePermission_1.requirePermission)('report.read'), report_controller_1.getAdvertisersReport);
    router.get('/reports/media', requireAuth_1.requireAuth, (0, requirePermission_1.requirePermission)('report.read'), report_controller_1.getMediaReportHandler);
    router.get('/reports/total-profit', requireAuth_1.requireAuth, (0, requirePermission_1.requirePermission)('report.read'), profitReport_controller_1.getTotalProfitReport);
    router.get('/reports/order-profit', requireAuth_1.requireAuth, (0, requirePermission_1.requirePermission)('report.read'), profitReport_controller_1.getOrderProfitReport);
}
//# sourceMappingURL=report.router.js.map