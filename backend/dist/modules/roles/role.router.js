"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.roleRouter = roleRouter;
const role_controller_1 = require("./role.controller");
const requireAuth_1 = require("../../middleware/requireAuth");
const requirePermission_1 = require("../../middleware/requirePermission");
function roleRouter(router) {
    router.get('/roles', requireAuth_1.requireAuth, (0, requirePermission_1.requirePermission)('role.update'), role_controller_1.getAllRoles);
    router.get('/permissions', requireAuth_1.requireAuth, (0, requirePermission_1.requirePermission)('role.update'), role_controller_1.getAllPermissions);
    router.put('/roles/:id/permissions', requireAuth_1.requireAuth, (0, requirePermission_1.requirePermission)('role.update'), role_controller_1.updatePermissionsHandler);
}
//# sourceMappingURL=role.router.js.map