/**
 * Phase 5B: Operation Log Service
 *
 * Read-only operation log retrieval with filtering and pagination.
 * Logs ordered by createdAt DESC.
 */

import { prisma } from '../../../shared/prisma/client';
import type { Prisma } from '@prisma/client';

export interface OperationLogParams {
  startDate?: string;
  endDate?: string;
  keyword?: string;
  module?: string;
  action?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export async function listOperationLogs(
  params: OperationLogParams
): Promise<PaginatedResult<any>> {
  const {
    startDate,
    endDate,
    keyword,
    module,
    action,
    page = 1,
    pageSize = 20,
  } = params;

  // Build date filter
  const dateFilter: Prisma.OperationLogWhereInput = {};
  if (startDate) {
    const start = new Date(startDate + 'T00:00:00.000Z');
    dateFilter.createdAt = { gte: start };
  }
  if (endDate) {
    const end = new Date(endDate + 'T23:59:59.999Z');
    if (dateFilter.createdAt) {
      dateFilter.createdAt = { ...dateFilter.createdAt as object, lte: end };
    } else {
      dateFilter.createdAt = { lte: end };
    }
  }

  // Build keyword filter (search username/action/module/targetType/targetId/detail)
  const keywordFilter: Prisma.OperationLogWhereInput | undefined = keyword
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

  const where: Prisma.OperationLogWhereInput = {
    ...dateFilter,
    ...(module && { module }),
    ...(action && { action }),
    ...keywordFilter,
  };

  const pageNum = Math.max(1, page);
  const size = Math.min(Math.max(1, pageSize), 100);
  const skip = (pageNum - 1) * size;

  const [rows, total] = await Promise.all([
    prisma.operationLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: size,
    }),
    prisma.operationLog.count({ where }),
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