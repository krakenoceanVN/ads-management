"use strict";
/**
 * Phase 3C: Hard Delete Router
 *
 * Registers hard delete endpoints under /api/bff/hard-delete/.
 * Permission: masterData.hardDelete (falls back to permAdmin for existing roles).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.hardDeleteRouter = hardDeleteRouter;
const asyncHandler_1 = require("../../../shared/errors/asyncHandler");
const hardDelete_controller_1 = require("./hardDelete.controller");
const requireAuth_1 = require("../../../middleware/requireAuth");
const requirePermission_1 = require("../../../middleware/requirePermission");
function hardDeleteRouter(router) {
    router.delete('/hard-delete/advertisers/:id', requireAuth_1.requireAuth, (0, requirePermission_1.requirePermission)('masterData.hardDelete'), (0, asyncHandler_1.asyncHandler)(hardDelete_controller_1.deleteAdvertiser));
    router.delete('/hard-delete/ad-types/:id', requireAuth_1.requireAuth, (0, requirePermission_1.requirePermission)('masterData.hardDelete'), (0, asyncHandler_1.asyncHandler)(hardDelete_controller_1.deleteAdType));
    router.delete('/hard-delete/ad-ids/:id', requireAuth_1.requireAuth, (0, requirePermission_1.requirePermission)('masterData.hardDelete'), (0, asyncHandler_1.asyncHandler)(hardDelete_controller_1.deleteAdId));
    router.delete('/hard-delete/media/:id', requireAuth_1.requireAuth, (0, requirePermission_1.requirePermission)('masterData.hardDelete'), (0, asyncHandler_1.asyncHandler)(hardDelete_controller_1.deleteMedia));
    router.delete('/hard-delete/media-ad-orders/:id', requireAuth_1.requireAuth, (0, requirePermission_1.requirePermission)('masterData.hardDelete'), (0, asyncHandler_1.asyncHandler)(hardDelete_controller_1.deleteMediaAdOrder));
    router.delete('/hard-delete/media-ids/:id', requireAuth_1.requireAuth, (0, requirePermission_1.requirePermission)('masterData.hardDelete'), (0, asyncHandler_1.asyncHandler)(hardDelete_controller_1.deleteMediaId));
}
//# sourceMappingURL=hardDelete.router.js.map