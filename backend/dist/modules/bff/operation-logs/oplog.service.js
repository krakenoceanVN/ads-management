"use strict";
/**
 * Phase 5B: Operation Log Service
 *
 * Read-only operation log retrieval with filtering and pagination.
 * Logs ordered by createdAt DESC.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.listOperationLogs = listOperationLogs;
const client_1 = require("../../../shared/prisma/client");
async function listOperationLogs(params) {
    const { startDate, endDate, keyword, module, action, page = 1, pageSize = 20, } = params;
    // Build date filter
    const dateFilter = {};
    if (startDate) {
        const start = new Date(startDate + 'T00:00:00.000Z');
        dateFilter.createdAt = { gte: start };
    }
    if (endDate) {
        const end = new Date(endDate + 'T23:59:59.999Z');
        if (dateFilter.createdAt) {
            dateFilter.createdAt = { ...dateFilter.createdAt, lte: end };
        }
        else {
            dateFilter.createdAt = { lte: end };
        }
    }
    // Build keyword filter (search username/action/module/targetType/targetId/detail)
    const keywordFilter = keyword
        ? {
            OR: [
                { username: { contains: keyword, mode: 'insensitive' } },
                { action: { contains: keyword, mode: 'insensitive' } },
                { module: { contains: keyword, mode: 'insensitive' } },
                { targetType: { contains: keyword, mode: 'insensitive' } },
                { targetId: { contains: keyword, mode: 'insensitive' } },
                { detail: { contains: keyword, mode: 'insensitive' } },
            ],
        }
        : undefined;
    const where = {
        ...dateFilter,
        ...(module && { module }),
        ...(action && { action }),
        ...keywordFilter,
    };
    const pageNum = Math.max(1, page);
    const size = Math.min(Math.max(1, pageSize), 100);
    const skip = (pageNum - 1) * size;
    const [rows, total] = await Promise.all([
        client_1.prisma.operationLog.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip,
            take: size,
        }),
        client_1.prisma.operationLog.count({ where }),
    ]);
    return {
        data: rows,
        pagination: {
            page: pageNum,
            pageSize: size,
            total,
            totalPages: Math.ceil(total / size),
        },
    };
}
//# sourceMappingURL=oplog.service.js.map