import type { Request, Response, NextFunction } from "express"

type KeyGenerator = (req: Request) => string

interface RateLimitOptions {
  windowMs: number
  max: number
  message?: string
  keyGenerator?: KeyGenerator
}

interface RateLimitEntry {
  count: number
  resetAt: number
}

export interface SimpleRateLimiter {
  middleware: (req: Request, res: Response, next: NextFunction) => void
  reset: (req: Request) => void
}

function defaultKeyGenerator(req: Request): string {
  return req.ip || req.socket.remoteAddress || "unknown"
}

export function createSimpleRateLimiter(options: RateLimitOptions): SimpleRateLimiter {
  const store = new Map<string, RateLimitEntry>()
  const keyGenerator = options.keyGenerator ?? defaultKeyGenerator

  const cleanupTimer = setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of store.entries()) {
      if (entry.resetAt <= now) {
        store.delete(key)
      }
    }
  }, Math.max(60_000, Math.min(options.windowMs, 5 * 60_000)))

  cleanupTimer.unref?.()

  const middleware = (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now()
    const key = keyGenerator(req)
    const current = store.get(key)

    if (!current || current.resetAt <= now) {
      store.set(key, { count: 1, resetAt: now + options.windowMs })
      next()
      return
    }

    current.count += 1
    const remainingMs = Math.max(current.resetAt - now, 0)
    res.setHeader("Retry-After", String(Math.ceil(remainingMs / 1000)))

    if (current.count > options.max) {
      res.status(429).json({
        success: false,
        error: options.message ?? "Too many requests",
      })
      return
    }

    next()
  }

  const reset = (req: Request) => {
    store.delete(keyGenerator(req))
  }

  return { middleware, reset }
}
