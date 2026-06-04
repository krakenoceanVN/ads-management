"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mediaIdRouter = mediaIdRouter;
const asyncHandler_1 = require("../../../shared/errors/asyncHandler");
const mediaId_controller_1 = require("./mediaId.controller");
function mediaIdRouter(router) {
    router.get('/media-ids', (0, asyncHandler_1.asyncHandler)(mediaId_controller_1.getAll));
    router.get('/media-ids/:id', (0, asyncHandler_1.asyncHandler)(mediaId_controller_1.getById));
    router.post('/media-ids', (0, asyncHandler_1.asyncHandler)(mediaId_controller_1.create));
    router.put('/media-ids/:id', (0, asyncHandler_1.asyncHandler)(mediaId_controller_1.update));
    router.delete('/media-ids/:id', (0, asyncHandler_1.asyncHandler)(mediaId_controller_1.remove));
}
//# sourceMappingURL=mediaId.router.js.map