"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthRouter = healthRouter;
const health_controller_1 = require("./health.controller");
function healthRouter(router) {
    router.get('/health', health_controller_1.healthCheck);
}
//# sourceMappingURL=health.router.js.map