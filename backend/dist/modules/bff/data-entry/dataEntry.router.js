"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dataEntryRouter = dataEntryRouter;
const asyncHandler_1 = require("../../../shared/errors/asyncHandler");
const dataEntry_controller_1 = require("./dataEntry.controller");
const dataEntryWrite_controller_1 = require("./dataEntryWrite.controller");
const requireAuth_1 = require("../../../middleware/requireAuth");
const requirePermission_1 = require("../../../middleware/requirePermission");
function dataEntryRouter(router) {
    // Read
    router.get('/data-entry/advertisers', requireAuth_1.requireAuth, (0, asyncHandler_1.asyncHandler)(dataEntry_controller_1.getAdvertiserEntries));
    router.get('/data-entry/media', requireAuth_1.requireAuth, (0, asyncHandler_1.asyncHandler)(dataEntry_controller_1.getMediaEntries));
    // Advertiser write
    router.post('/data-entry/advertisers/batch', requireAuth_1.requireAuth, (0, requirePermission_1.requirePermission)('dataEntry.create'), (0, asyncHandler_1.asyncHandler)(dataEntryWrite_controller_1.postAdvertiserBatch));
    router.post('/data-entry/advertisers/confirm-batch', requireAuth_1.requireAuth, (0, requirePermission_1.requirePermission)('dataEntry.confirm'), (0, asyncHandler_1.asyncHandler)(dataEntryWrite_controller_1.postAdvertiserConfirmBatch));
    router.put('/data-entry/advertisers/:id/unconfirm', requireAuth_1.requireAuth, (0, requirePermission_1.requirePermission)('dataEntry.unconfirm'), (0, asyncHandler_1.asyncHandler)(dataEntryWrite_controller_1.putAdvertiserUnconfirm));
    // Media write
    router.post('/data-entry/media/batch', requireAuth_1.requireAuth, (0, requirePermission_1.requirePermission)('dataEntry.create'), (0, asyncHandler_1.asyncHandler)(dataEntryWrite_controller_1.postMediaBatch));
    router.post('/data-entry/media/confirm-batch', requireAuth_1.requireAuth, (0, requirePermission_1.requirePermission)('dataEntry.confirm'), (0, asyncHandler_1.asyncHandler)(dataEntryWrite_controller_1.postMediaConfirmBatch));
    router.put('/data-entry/media/:id/unconfirm', requireAuth_1.requireAuth, (0, requirePermission_1.requirePermission)('dataEntry.unconfirm'), (0, asyncHandler_1.asyncHandler)(dataEntryWrite_controller_1.putMediaUnconfirm));
}
//# sourceMappingURL=dataEntry.router.js.map