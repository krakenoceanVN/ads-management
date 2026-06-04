"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthCheck = healthCheck;
const success_1 = require("../../shared/response/success");
function healthCheck(_req, res) {
    res.json((0, success_1.bffData)({ status: 'ok', timestamp: new Date().toISOString() }));
}
//# sourceMappingURL=health.controller.js.map