/**
 * Shared ID helpers — used by every write service that needs to allocate a
 * short random id (6 characters, alphanumeric, both cases) and by every
 * controller that needs to validate an id path/query parameter.
 *
 * Why a 6-char alphanumeric?
 * - 62^6 ≈ 56 tỷ keyspace — collision cực thấp (vài triệu record thì xác suất
 *   < 0.001%). Vẫn cần retry loop trên create, nhưng 5 lần là đủ.
 * - Dễ đọc, dễ viết tay khi debug, in ra CSV/URL cũng gọn.
 *
 * Why no `@default` in schema?
 * - Postgres default cho random text phải viết trigger hoặc dùng uuid(). App-side
 *   generate cho phép retry khi trùng (uuid không retry được).
 */

import { randomBytes } from 'crypto';
import type { Request } from 'express';
import { NotFoundError } from './errors/AppError';

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
export const ID_LENGTH = 6;
export const ID_PATTERN = /^[0-9A-Za-z]{6}$/;

/**
 * Generate a random 6-character id using rejection sampling to avoid modulo bias.
 * Uses `crypto.randomBytes` for cryptographic-quality randomness.
 *
 * Extremely unlikely to return empty (would require ~all bytes to fail the
 * modulo check); we still recurse once as a safety net.
 */
export function generateShortId(): string {
  // Request 16 bytes → enough for 6 chars with high margin for rejections.
  const bytes = randomBytes(16);
  let result = '';
  for (let i = 0; i < bytes.length && result.length < ID_LENGTH; i++) {
    // 62 * 4 = 248. Reject any byte ≥ 248 to avoid bias.
    if (bytes[i] < 248) {
      result += ALPHABET[bytes[i] % 62];
    }
  }
  if (result.length === ID_LENGTH) return result;
  return generateShortId();
}

/** Type-narrowing validator for runtime checks. */
export function isValidId(value: unknown): value is string {
  return typeof value === 'string' && ID_PATTERN.test(value);
}

/**
 * Read and validate an id path parameter from an Express request.
 * Throws NotFoundError if missing or malformed — keeps controllers terse.
 */
export function requireIdParam(req: Request, paramName = 'id'): string {
  const raw = req.params[paramName];
  if (!isValidId(raw)) {
    throw new NotFoundError(`Invalid id: ${paramName}`);
  }
  return raw;
}

/**
 * Convenience for query parameters that are optional id filters.
 * Returns the raw string when present (Prisma will pass it through to where
 * clauses — id columns are now String, no parsing needed). Returns undefined
 * for missing params.
 */
export function optionalIdParam(req: Request, paramName: string): string | undefined {
  const raw = req.query[paramName];
  if (raw == null) return undefined;
  const s = String(raw);
  return s === '' ? undefined : s;
}

/**
 * Retry helper for `prisma.create` calls that need a unique id.
 * Retries up to 5 times on unique-constraint collisions.
 *
 * Used by write services since `generateShortId` could theoretically collide
 * (62^6 ≈ 56 tỷ — practically never — but the cost of a guardrail is trivial).
 */
export async function createWithUniqueId<T extends { id: string }>(
  prismaModel: { create: (args: { data: Record<string, unknown>; select?: Record<string, true> }) => Promise<T> },
  data: Record<string, unknown>,
  select?: Record<string, true>
): Promise<T> {
  // Lazy-import Prisma here to avoid pulling it into routes that don't need it.
  const { Prisma } = await import('@prisma/client');
  for (let attempt = 0; attempt < 5; attempt++) {
    const id = generateShortId();
    try {
      return await prismaModel.create({ data: { id, ...data }, ...(select ? { select } : {}) });
    } catch (err: any) {
      const code = err instanceof Prisma.PrismaClientKnownRequestError ? err.code : null;
      const isUniqueViolation = code === 'P2002' || err.message?.includes('duplicate key');
      if (!isUniqueViolation || attempt === 4) throw err;
    }
  }
  throw new Error('unreachable');
}
