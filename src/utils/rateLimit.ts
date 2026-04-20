import type { NextFunction, Request, Response } from "express"

interface RateLimitOptions {
  windowMs: number
  max: number
  keyGenerator: (req: Request) => string
  errorMessage: string
}

interface RateLimitEntry {
  count: number
  expiresAt: number
}

export function createMemoryRateLimiter(options: RateLimitOptions) {
  const store = new Map<string, RateLimitEntry>()

  function getKey(req: Request): string {
    return options.keyGenerator(req)
  }

  function cleanup(now: number) {
    for (const [key, entry] of store.entries()) {
      if (entry.expiresAt <= now) {
        store.delete(key)
      }
    }
  }

  function middleware(req: Request, res: Response, next: NextFunction) {
    const now = Date.now()
    cleanup(now)

    const key = getKey(req)
    const current = store.get(key)

    if (!current || current.expiresAt <= now) {
      store.set(key, {
        count: 1,
        expiresAt: now + options.windowMs,
      })
      next()
      return
    }

    if (current.count >= options.max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((current.expiresAt - now) / 1000))
      res.setHeader("Retry-After", String(retryAfterSeconds))
      res.status(429).json({ success: false, error: options.errorMessage })
      return
    }

    current.count += 1
    store.set(key, current)
    next()
  }

  function reset(req: Request) {
    store.delete(getKey(req))
  }

  return { middleware, reset }
}
