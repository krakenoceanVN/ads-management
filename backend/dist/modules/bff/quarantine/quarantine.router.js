"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.quarantineRouter = quarantineRouter;
const asyncHandler_1 = require("../../../shared/errors/asyncHandler");
const quarantine_controller_1 = require("./quarantine.controller");
const requireAuth_1 = require("../../../middleware/requireAuth");
const requirePermission_1 = require("../../../middleware/requirePermission");
function quarantineRouter(router) {
    router.post('/daily-input/quarantine', requireAuth_1.requireAuth, (0, requirePermission_1.requirePermission)('quarantine.execute'), (0, asyncHandler_1.asyncHandler)(quarantine_controller_1.postQuarantine));
    router.post('/daily-input/quarantine/:batchId/restore', requireAuth_1.requireAuth, (0, requirePermission_1.requirePermission)('quarantine.restore'), (0, asyncHandler_1.asyncHandler)(quarantine_controller_1.postRestore));
    router.get('/daily-input/quarantine', requireAuth_1.requireAuth, (0, requirePermission_1.requirePermission)('quarantine.execute'), (0, asyncHandler_1.asyncHandler)(quarantine_controller_1.getQuarantineBatches));
    router.get('/daily-input/quarantine/:batchId/records', requireAuth_1.requireAuth, (0, requirePermission_1.requirePermission)('quarantine.execute'), (0, asyncHandler_1.asyncHandler)(quarantine_controller_1.getQuarantineBatchRecords));
}
//# sourceMappingURL=quarantine.router.js.map