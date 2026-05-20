/**
 * BFF Operation Logs Controller
 * Provides operation log API for frontend
 */

import { Router, Request, Response } from "express";
import { query, validationResult } from "express-validator";
import { Prisma } from "@prisma/client";
import prisma from "../../prisma.js";
import { requireAuth } from "../../middleware/auth.js";

const router = Router();

const handleValidation = (req: Request, res: Response, next: Function) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, error: errors.array()[0].msg });
    return;
  }
  next();
};

// ============================================================
// GET /api/bff/operation-logs
// Query: startDate, endDate, keyword, module, action, page, pageSize
// ============================================================
router.get(
  "/",
  requireAuth,
  [
    query("startDate").optional().isISO8601(),
    query("endDate").optional().isISO8601(),
    query("keyword").optional().isString(),
    query("module").optional().isString(),
    query("action").optional().isString(),
    query("page").optional().isInt({ min: 1 }).toInt(),
    query("pageSize").optional().isInt({ min: 1, max: 100 }).toInt(),
  ],
  handleValidation,
  async (req: Request, res: Response) => {
    try {
      const {
        startDate,
        endDate,
        keyword,
        module: moduleFilter,
        action: actionFilter,
        page = 1,
        pageSize = 20,
      } = req.query as {
        startDate?: string;
        endDate?: string;
        keyword?: string;
        module?: string;
        action?: string;
        page?: number;
        pageSize?: number;
      };

      const where: Prisma.OperationLogWhereInput = {};

      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate);
        if (endDate) where.createdAt.lte = new Date(endDate);
      }

      if (moduleFilter) where.module = moduleFilter;
      if (actionFilter) where.action = actionFilter;

      if (keyword) {
        where.OR = [
          { username: { contains: keyword, mode: "insensitive" } },
          { action: { contains: keyword, mode: "insensitive" } },
          { module: { contains: keyword, mode: "insensitive" } },
          { detail: { contains: keyword, mode: "insensitive" } },
          { targetType: { contains: keyword, mode: "insensitive" } },
          { targetId: { contains: keyword, mode: "insensitive" } },
        ];
      }

      const skip = (page - 1) * pageSize;

      const [items, total] = await Promise.all([
        prisma.operationLog.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take: pageSize,
        }),
        prisma.operationLog.count({ where }),
      ]);

      const response = {
        items: items.map((log) => ({
          id: log.id,
          userId: log.userId,
          username: log.username,
          action: log.action,
          module: log.module,
          targetType: log.targetType,
          targetId: log.targetId,
          detail: log.detail,
          createdAt: log.createdAt.toISOString(),
        })),
        total,
        page,
        pageSize,
      };

      res.json({ success: true, data: response });
    } catch (err: any) {
      console.error("GET /api/bff/operation-logs error:", err);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  }
);

export default router;