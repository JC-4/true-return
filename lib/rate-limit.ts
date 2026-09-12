import type { NextRequest } from 'next/server'
import { redis } from '@/lib/redis'

/**
 * Fixed-window IP rate limiter backed by the Redis already in the project.
 *
 * A fixed window can let through up to 2x the limit across a window boundary.
 * That is fine here: the point is to stop a script hammering the Make webhook,
 * not to meter anything precisely.
 */

export type RateLimitResult = {
  ok: boolean
  /** Requests remaining in the current window. */
  remaining: number
  /** Seconds until the window resets. Only meaningful when `ok` is false. */
  retryAfter: number
}

/**
 * Vercel sets x-forwarded-for; the left-most entry is the client. Falls back to
 * a shared 'unknown' bucket, which is deliberately strict — if we cannot tell
 * callers apart we would rather throttle them together than not at all. Local
 * dev has no proxy header, so everything shares that bucket there.
 */
export function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return req.headers.get('x-real-ip')?.trim() || 'unknown'
}

/**
 * Counts one hit against `${bucket}:${ip}`. Fails open: if Redis is unreachable
 * the request proceeds, because dropping real leads is worse than briefly
 * losing the limiter.
 */
export async function rateLimit(
  bucket: string,
  ip: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const key = `rl:${bucket}:${ip}`
  try {
    const hits = await redis.incr(key)
    // Only the first hit sets the TTL, so the window runs from the first
    // request rather than sliding forward with every later one.
    if (hits === 1) await redis.expire(key, windowSeconds)

    if (hits > limit) {
      const ttl = await redis.ttl(key)
      return { ok: false, remaining: 0, retryAfter: ttl > 0 ? ttl : windowSeconds }
    }
    return { ok: true, remaining: limit - hits, retryAfter: 0 }
  } catch (err) {
    console.error('[rate-limit] Redis unavailable, allowing request:', err)
    return { ok: true, remaining: limit, retryAfter: 0 }
  }
}

/** "10 minutes" / "45 seconds" — for a message a visitor has to read. */
export function humanRetry(seconds: number): string {
  if (seconds >= 60) {
    const mins = Math.ceil(seconds / 60)
    return `${mins} minute${mins === 1 ? '' : 's'}`
  }
  return `${Math.max(seconds, 1)} second${seconds === 1 ? '' : 's'}`
}
