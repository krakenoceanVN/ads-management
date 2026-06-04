"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.yiyiRouter = yiyiRouter;
const yiyi_controller_1 = require("./yiyi.controller");
const requireAuth_1 = require("../../middleware/requireAuth");
function yiyiRouter(router) {
    // GET /api/yiyi-data?date=YYYY-MM-DD
    router.get('/yiyi-data', requireAuth_1.requireAuth, yiyi_controller_1.getYiyiDailyHandler);
    // GET /api/yiyi-data/monthly?year=YYYY&month=M
    router.get('/yiyi-data/monthly', requireAuth_1.requireAuth, yiyi_controller_1.getYiyiMonthlyHandler);
    // POST /api/yiyi-data/batch
    router.post('/yiyi-data/batch', requireAuth_1.requireAuth, yiyi_controller_1.postYiyiBatch);
}
//# sourceMappingURL=yiyi.router.js.map