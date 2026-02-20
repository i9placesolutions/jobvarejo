import type { H3Event } from 'h3'

type Bucket = {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()
const PRUNE_INTERVAL_MS = 30_000
const MAX_BUCKETS = 5_000
let lastPruneAt = 0

const pruneBuckets = (now: number) => {
  if (now - lastPruneAt < PRUNE_INTERVAL_MS && buckets.size <= MAX_BUCKETS) return
  lastPruneAt = now

  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key)
    }
  }

  // Safety valve: if key cardinality explodes (many unique users/keys),
  // keep memory bounded by evicting oldest iterated entries.
  if (buckets.size > MAX_BUCKETS) {
    let overflow = buckets.size - MAX_BUCKETS
    for (const key of buckets.keys()) {
      buckets.delete(key)
      overflow -= 1
      if (overflow <= 0) break
    }
  }
}

const setRateLimitHeaders = (event: H3Event, opts: { limit: number; remaining: number; resetAt: number }) => {
  setResponseHeader(event, 'X-RateLimit-Limit', String(Math.max(0, opts.limit)))
  setResponseHeader(event, 'X-RateLimit-Remaining', String(Math.max(0, opts.remaining)))
  setResponseHeader(event, 'X-RateLimit-Reset', String(Math.max(0, Math.ceil(opts.resetAt / 1000))))
}

export const enforceRateLimit = (
  event: H3Event,
  key: string,
  limit: number,
  windowMs: number
) => {
  const now = Date.now()
  pruneBuckets(now)
  const current = buckets.get(key)

  if (!current || current.resetAt <= now) {
    const resetAt = now + windowMs
    buckets.set(key, { count: 1, resetAt })
    setRateLimitHeaders(event, { limit, remaining: limit - 1, resetAt })
    return
  }

  if (current.count >= limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000))
    setRateLimitHeaders(event, { limit, remaining: 0, resetAt: current.resetAt })
    setResponseHeader(event, 'Retry-After', retryAfterSeconds)
    throw createError({
      statusCode: 429,
      statusMessage: `Rate limit exceeded. Try again in ${retryAfterSeconds}s`
    })
  }

  current.count += 1
  buckets.set(key, current)
  setRateLimitHeaders(event, { limit, remaining: limit - current.count, resetAt: current.resetAt })
}
