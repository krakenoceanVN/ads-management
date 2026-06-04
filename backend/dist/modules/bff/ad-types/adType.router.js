"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adTypeRouter = adTypeRouter;
const asyncHandler_1 = require("../../../shared/errors/asyncHandler");
const adType_controller_1 = require("./adType.controller");
const requireAuth_1 = require("../../../middleware/requireAuth");
function adTypeRouter(router) {
    router.get('/ad-types', requireAuth_1.requireAuth, (0, asyncHandler_1.asyncHandler)(adType_controller_1.getAll));
    router.get('/ad-types/:id', requireAuth_1.requireAuth, (0, asyncHandler_1.asyncHandler)(adType_controller_1.getById));
    router.post('/ad-types', requireAuth_1.requireAuth, (0, asyncHandler_1.asyncHandler)(adType_controller_1.create));
    router.put('/ad-types/:id', requireAuth_1.requireAuth, (0, asyncHandler_1.asyncHandler)(adType_controller_1.update));
    router.delete('/ad-types/:id', requireAuth_1.requireAuth, (0, asyncHandler_1.asyncHandler)(adType_controller_1.remove));
}
//# sourceMappingURL=adType.router.js.map