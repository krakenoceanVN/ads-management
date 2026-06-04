"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.advertiserRouter = advertiserRouter;
const asyncHandler_1 = require("../../../shared/errors/asyncHandler");
const advertiser_controller_1 = require("./advertiser.controller");
function advertiserRouter(router) {
    router.get('/advertisers', (0, asyncHandler_1.asyncHandler)(advertiser_controller_1.getAll));
    router.get('/advertisers/:id', (0, asyncHandler_1.asyncHandler)(advertiser_controller_1.getById));
    router.post('/advertisers', (0, asyncHandler_1.asyncHandler)(advertiser_controller_1.create));
    router.put('/advertisers/:id', (0, asyncHandler_1.asyncHandler)(advertiser_controller_1.update));
    router.delete('/advertisers/:id', (0, asyncHandler_1.asyncHandler)(advertiser_controller_1.remove));
}
//# sourceMappingURL=advertiser.router.js.map