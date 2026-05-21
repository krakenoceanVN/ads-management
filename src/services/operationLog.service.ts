/**
 * Operation Logging Service
 * Best-effort async logging — failures are swallowed silently.
 */

import { Prisma } from "@prisma/client";
import prisma from "../prisma.js";

export type LogModule = "Advertiser" | "Media" | "DataEntry" | "Auth";
export type LogAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "SAVE"
  | "CONFIRM"
  | "UNCONFIRM"
  | "LOGIN_SUCCESS"
  | "LOGIN_FAILED";

interface CreateLogParams {
  userId?: number | null;
  username?: string | null;
  action: LogAction;
  module: LogModule;
  targetType?: string | null;
  targetId?: string | null;
  detail?: string | null;
}

/**
 * Best-effort operation logger.
 * Silently ignores all errors so it never breaks the main business action.
 */
export function createOperationLog(params: CreateLogParams): void {
  try {
    if (!prisma.operationLog) return;
    prisma.operationLog
      .create({
        data: {
          userId: params.userId ?? null,
          username: params.username ?? null,
          action: params.action,
          module: params.module,
          targetType: params.targetType ?? null,
          targetId: params.targetId ?? null,
          detail: params.detail ?? null,
        },
      })
      .catch(() => {
        // Swallow error — logging must never affect business operations
      });
  } catch {
    // Swallow sync errors too, e.g. prisma.operationLog is undefined before generate
  }
}