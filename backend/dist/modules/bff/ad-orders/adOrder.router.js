"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adOrderRouter = adOrderRouter;
const asyncHandler_1 = require("../../../shared/errors/asyncHandler");
const adOrder_controller_1 = require("./adOrder.controller");
function adOrderRouter(router) {
    router.get('/ad-orders', (0, asyncHandler_1.asyncHandler)(adOrder_controller_1.getAll));
    router.get('/ad-orders/:id', (0, asyncHandler_1.asyncHandler)(adOrder_controller_1.getById));
    router.post('/ad-orders', (0, asyncHandler_1.asyncHandler)(adOrder_controller_1.create));
    router.put('/ad-orders/:id', (0, asyncHandler_1.asyncHandler)(adOrder_controller_1.update));
    router.delete('/ad-orders/:id', (0, asyncHandler_1.asyncHandler)(adOrder_controller_1.remove));
}
//# sourceMappingURL=adOrder.router.js.map