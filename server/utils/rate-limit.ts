import type { H3Event } from 'h3'

// ---------------------------------------------------------------------------
// In-memory rate limit (por instância de servidor)
// ---------------------------------------------------------------------------
type Bucket = { count: number; resetAt: number }
const buckets = new Map<string, Bucket>()
const PRUNE_INTERVAL_MS = 30_000
const MAX_BUCKETS = 5_000
let lastPruneAt = 0

const pruneBuckets = (now: number) => {
  if (now - lastPruneAt < PRUNE_INTERVAL_MS && buckets.size <= MAX_BUCKETS) return
  lastPruneAt = now
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
  if (buckets.size > MAX_BUCKETS) {
    let overflow = buckets.size - MAX_BUCKETS
    for (const key of buckets.keys()) {
      buckets.delete(key)
      if (--overflow <= 0) break
    }
  }
}

const localRateLimit = (key: string, limit: number, windowMs: number): number => {
  const now = Date.now()
  pruneBuckets(now)
  const current = buckets.get(key)
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return 1
  }
  current.count += 1
  buckets.set(key, current)
  return current.count
}

const getLocalResetAt = (key: string, windowMs: number): number => {
  return buckets.get(key)?.resetAt ?? Date.now() + windowMs
}

// ---------------------------------------------------------------------------
// Headers helpers
// ---------------------------------------------------------------------------
const setRateLimitHeaders = (
  event: H3Event,
  opts: { limit: number; remaining: number; resetAt: number }
) => {
  setResponseHeader(event, 'X-RateLimit-Limit', String(Math.max(0, opts.limit)))
  setResponseHeader(event, 'X-RateLimit-Remaining', String(Math.max(0, opts.remaining)))
  setResponseHeader(event, 'X-RateLimit-Reset', String(Math.max(0, Math.ceil(opts.resetAt / 1000))))
}

// ---------------------------------------------------------------------------
// enforceRateLimit — in-memory por instância de servidor
// ---------------------------------------------------------------------------
export const enforceRateLimit = (
  event: H3Event,
  key: string,
  limit: number,
  windowMs: number
) => {
  const count = localRateLimit(key, limit, windowMs)
  const resetAt = getLocalResetAt(key, windowMs)
  const remaining = Math.max(0, limit - count)
  setRateLimitHeaders(event, { limit, remaining, resetAt })

  if (count > limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))
    setResponseHeader(event, 'Retry-After', retryAfterSeconds)
    throw createError({
      statusCode: 429,
      statusMessage: `Rate limit exceeded. Try again in ${retryAfterSeconds}s`
    })
  }
}
