"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mediaRouter = mediaRouter;
const asyncHandler_1 = require("../../../shared/errors/asyncHandler");
const media_controller_1 = require("./media.controller");
function mediaRouter(router) {
    router.get('/media', (0, asyncHandler_1.asyncHandler)(media_controller_1.getAll));
    router.get('/media/:id', (0, asyncHandler_1.asyncHandler)(media_controller_1.getById));
    router.post('/media', (0, asyncHandler_1.asyncHandler)(media_controller_1.create));
    router.put('/media/:id', (0, asyncHandler_1.asyncHandler)(media_controller_1.update));
    router.delete('/media/:id', (0, asyncHandler_1.asyncHandler)(media_controller_1.remove));
}
//# sourceMappingURL=media.router.js.map