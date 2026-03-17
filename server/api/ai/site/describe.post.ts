import { describeSiteStyle } from '~/server/utils/ai-site-style'
import { requireAuthenticatedUser } from '~/server/utils/auth'
import { enforceRateLimit } from '~/server/utils/rate-limit'
import { assertSafeExternalHttpUrl } from '~/server/utils/url-safety'

// FIX #12: in-memory cache for site style results (avoids re-fetching + re-calling GPT)
const siteStyleCache = new Map<string, { result: any; expiresAt: number }>()
const CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event)
  // FIX #8: reduced from 40 to 15 — each call fetches an external URL + calls GPT.
  // 40/min was too generous and could be abused to use the server as a proxy/scraper.
  await enforceRateLimit(event, `ai:site:describe:${user.id}`, 15, 60_000)

  const body = await readBody(event)
  const rawUrl = String(body?.url || '').trim()
  let url = ''
  try {
    url = assertSafeExternalHttpUrl(rawUrl, { maxLength: 2048 })
  } catch (err: any) {
    throw createError({ statusCode: 400, statusMessage: err?.message || 'invalid url' })
  }

  // FIX #12: check cache first
  const cacheKey = url.toLowerCase()
  const cached = siteStyleCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return { success: true, ...cached.result }
  }

  try {
    const result = await describeSiteStyle(url)
    // Store in cache
    siteStyleCache.set(cacheKey, { result, expiresAt: Date.now() + CACHE_TTL_MS })
    // Prune old entries if cache grows too large
    if (siteStyleCache.size > 200) {
      const now = Date.now()
      for (const [key, entry] of siteStyleCache) {
        if (entry.expiresAt < now) siteStyleCache.delete(key)
      }
    }
    return { success: true, ...result }
  } catch (err: any) {
    // FIX #8: sanitize error message — don't leak internal details (DNS, network errors)
    console.error('[ai:site:describe] Error:', err?.message?.slice?.(0, 200))
    throw createError({ statusCode: 502, statusMessage: 'Falha ao analisar o estilo do site. Verifique a URL e tente novamente.' })
  }
})
