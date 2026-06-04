"use strict";
/**
 * Phase 5B: Operation Log Controller
 *
 * GET /api/bff/operation-logs — read-only with filtering and pagination.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOperationLogs = getOperationLogs;
const oplog_service_1 = require("./oplog.service");
async function getOperationLogs(req, res) {
    const { startDate, endDate, keyword, module, action, page, pageSize } = req.query;
    const params = {
        ...(startDate !== undefined && { startDate: String(startDate) }),
        ...(endDate !== undefined && { endDate: String(endDate) }),
        ...(keyword !== undefined && { keyword: String(keyword) }),
        ...(module !== undefined && { module: String(module) }),
        ...(action !== undefined && { action: String(action) }),
        ...(page !== undefined && { page: parseInt(String(page), 10) }),
        ...(pageSize !== undefined && { pageSize: parseInt(String(pageSize), 10) }),
    };
    const result = await (0, oplog_service_1.listOperationLogs)(params);
    res.json(result);
}
//# sourceMappingURL=oplog.controller.js.map