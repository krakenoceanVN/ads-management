"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.downstreamRouter = downstreamRouter;
const asyncHandler_1 = require("../../../shared/errors/asyncHandler");
const downstream_controller_1 = require("./downstream.controller");
const requireAuth_1 = require("../../../middleware/requireAuth");
function downstreamRouter(router) {
    router.get('/downstreams', requireAuth_1.requireAuth, (0, asyncHandler_1.asyncHandler)(downstream_controller_1.getAll));
    router.get('/downstreams/:id', requireAuth_1.requireAuth, (0, asyncHandler_1.asyncHandler)(downstream_controller_1.getById));
    router.post('/downstreams', requireAuth_1.requireAuth, (0, asyncHandler_1.asyncHandler)(downstream_controller_1.create));
    router.put('/downstreams/:id', requireAuth_1.requireAuth, (0, asyncHandler_1.asyncHandler)(downstream_controller_1.update));
    router.delete('/downstreams/:id', requireAuth_1.requireAuth, (0, asyncHandler_1.asyncHandler)(downstream_controller_1.remove));
}
//# sourceMappingURL=downstream.router.js.map