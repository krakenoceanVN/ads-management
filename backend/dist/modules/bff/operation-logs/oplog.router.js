"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.oplogRouter = oplogRouter;
const oplog_controller_1 = require("./oplog.controller");
const requireAuth_1 = require("../../../middleware/requireAuth");
const requirePermission_1 = require("../../../middleware/requirePermission");
function oplogRouter(router) {
    router.get('/operation-logs', requireAuth_1.requireAuth, (0, requirePermission_1.requirePermission)('oplog.read'), oplog_controller_1.getOperationLogs);
}
//# sourceMappingURL=oplog.router.js.map