import { describeSiteStyle } from '~/server/utils/ai-site-style'
import { requireAuthenticatedUser } from '~/server/utils/auth'
import { enforceRateLimit } from '~/server/utils/rate-limit'
import { assertSafeExternalHttpUrl } from '~/server/utils/url-safety'

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event)
  enforceRateLimit(event, `ai:site:describe:${user.id}`, 40, 60_000)

  const body = await readBody(event)
  const rawUrl = String(body?.url || '').trim()
  let url = ''
  try {
    url = assertSafeExternalHttpUrl(rawUrl, { maxLength: 2048 })
  } catch (err: any) {
    throw createError({ statusCode: 400, statusMessage: err?.message || 'invalid url' })
  }

  try {
    const result = await describeSiteStyle(url)
    return { success: true, ...result }
  } catch (err: any) {
    throw createError({ statusCode: 500, statusMessage: err?.message || 'Failed to describe site' })
  }
})
