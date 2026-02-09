import type { H3Event } from 'h3'

type Bucket = {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

export const enforceRateLimit = (
  event: H3Event,
  key: string,
  limit: number,
  windowMs: number
) => {
  const now = Date.now()
  const current = buckets.get(key)

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return
  }

  if (current.count >= limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000))
    setResponseHeader(event, 'Retry-After', retryAfterSeconds)
    throw createError({
      statusCode: 429,
      statusMessage: `Rate limit exceeded. Try again in ${retryAfterSeconds}s`
    })
  }

  current.count += 1
  buckets.set(key, current)
}
