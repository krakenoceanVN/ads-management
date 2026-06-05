/**
 * Operation Log Write Helper
 *
 * Shared helper used by master-data controllers (advertisers, ad-orders,
 * ad-ids, media, media-ids, downstreams, ad-types) to record create/update/
 * delete operations into the OperationLog table that the Operation Log page
 * reads from.
 *
 * Writing is best-effort: a logging failure must never break the underlying
 * mutation, so recordOperation swallows its own errors.
 */

import type { Request } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../../../shared/prisma/client';
import { config } from '../../../config';

export interface OperationActor {
  userId: number | null;
  username: string | null;
}

/**
 * Resolve the acting user for an operation-log entry.
 *
 * Prefers req.authUser (populated by requireAuth). For routes that are not
 * behind requireAuth, falls back to decoding the Bearer token so the operation
 * is still attributed to the logged-in user. Returns an anonymous actor when
 * no usable token is present.
 */
export function actorFromRequest(req: Request): OperationActor {
  const authUser = (req as Request & { authUser?: { id?: number; username?: string } }).authUser;
  if (authUser?.id) {
    return { userId: authUser.id, username: authUser.username ?? null };
  }

  const header = req.headers['authorization'];
  if (header?.startsWith('Bearer ')) {
    const token = header.slice(7);
    try {
      const payload = jwt.verify(token, config.jwt.secret) as jwt.JwtPayload;
      const userId = typeof payload.sub === 'number' ? payload.sub : null;
      const username = typeof payload['username'] === 'string' ? payload['username'] : null;
      return { userId, username };
    } catch {
      // Expired/invalid token — record as anonymous rather than failing.
    }
  }

  return { userId: null, username: null };
}

export interface OperationLogEntry {
  /** UPPER_SNAKE verb, e.g. CREATE_ADVERTISER. */
  action: string;
  /** Functional area, e.g. 'masterData'. */
  module: string;
  /** Entity kind, e.g. 'advertiser' — used for keyword filtering. */
  targetType?: string | null;
  /** Affected record id. */
  targetId?: string | number | null;
  /** Human-readable summary (name/slot) or any JSON-serialisable payload. */
  detail?: unknown;
}

/**
 * Write a single OperationLog row. Never throws.
 */
export async function recordOperation(actor: OperationActor, entry: OperationLogEntry): Promise<void> {
  try {
    await prisma.operationLog.create({
      data: {
        userId: actor.userId,
        username: actor.username,
        action: entry.action,
        module: entry.module,
        targetType: entry.targetType ?? null,
        targetId: entry.targetId != null ? String(entry.targetId) : null,
        detail:
          entry.detail === undefined || entry.detail === null
            ? null
            : typeof entry.detail === 'string'
              ? entry.detail
              : JSON.stringify(entry.detail),
      },
    });
  } catch (err) {
    console.error(`[oplog] failed to record ${entry.action}:`, err);
  }
}

/** Convenience helper to record a master-data mutation in one call. */
export async function recordMasterDataOperation(
  req: Request,
  action: string,
  targetType: string,
  targetId: string | number | null | undefined,
  detail?: unknown
): Promise<void> {
  await recordOperation(actorFromRequest(req), {
    action,
    module: 'masterData',
    targetType,
    targetId,
    detail,
  });
}
