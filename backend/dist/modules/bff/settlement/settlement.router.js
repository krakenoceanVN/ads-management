"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.settlementRouter = settlementRouter;
const settlement_controller_1 = require("./settlement.controller");
const requireAuth_1 = require("../../../middleware/requireAuth");
const requirePermission_1 = require("../../../middleware/requirePermission");
function settlementRouter(router) {
    router.get('/settlement/advertisers', requireAuth_1.requireAuth, (0, requirePermission_1.requirePermission)('settlement.read'), settlement_controller_1.getAdvertiserSettlementHandler);
    router.get('/settlement/media', requireAuth_1.requireAuth, (0, requirePermission_1.requirePermission)('settlement.read'), settlement_controller_1.getMediaSettlementHandler);
}
//# sourceMappingURL=settlement.router.js.map