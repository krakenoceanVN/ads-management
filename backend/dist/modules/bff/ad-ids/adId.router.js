"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adIdRouter = adIdRouter;
const asyncHandler_1 = require("../../../shared/errors/asyncHandler");
const adId_controller_1 = require("./adId.controller");
function adIdRouter(router) {
    router.get('/ad-ids', (0, asyncHandler_1.asyncHandler)(adId_controller_1.getAll));
    router.get('/ad-ids/:id', (0, asyncHandler_1.asyncHandler)(adId_controller_1.getById));
    router.post('/ad-ids', (0, asyncHandler_1.asyncHandler)(adId_controller_1.create));
    router.put('/ad-ids/:id', (0, asyncHandler_1.asyncHandler)(adId_controller_1.update));
    router.delete('/ad-ids/:id', (0, asyncHandler_1.asyncHandler)(adId_controller_1.remove));
}
//# sourceMappingURL=adId.router.js.map