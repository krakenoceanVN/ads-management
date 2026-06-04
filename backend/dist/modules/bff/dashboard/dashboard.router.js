"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dashboardRouter = dashboardRouter;
const requireAuth_1 = require("../../../middleware/requireAuth");
const requirePermission_1 = require("../../../middleware/requirePermission");
const dashboard_controller_1 = require("./dashboard.controller");
function dashboardRouter(router) {
    // GET /api/bff/dashboard/monthly?year=YYYY&month=M
    router.get('/dashboard/monthly', requireAuth_1.requireAuth, (0, requirePermission_1.requirePermission)('report.read'), dashboard_controller_1.getDashboardMonthly);
}
//# sourceMappingURL=dashboard.router.js.map