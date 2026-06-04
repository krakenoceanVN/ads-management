"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userRouter = userRouter;
const user_controller_1 = require("./user.controller");
const requireAuth_1 = require("../../middleware/requireAuth");
const requirePermission_1 = require("../../middleware/requirePermission");
function userRouter(router) {
    router.get('/users', requireAuth_1.requireAuth, (0, requirePermission_1.requirePermission)('user.update'), user_controller_1.getAll);
    router.post('/users', requireAuth_1.requireAuth, (0, requirePermission_1.requirePermission)('user.create'), user_controller_1.create);
    router.put('/users/:id', requireAuth_1.requireAuth, (0, requirePermission_1.requirePermission)('user.update'), user_controller_1.update);
    router.post('/users/:id/reset-password', requireAuth_1.requireAuth, (0, requirePermission_1.requirePermission)('user.update'), user_controller_1.doResetPassword);
}
//# sourceMappingURL=user.router.js.map