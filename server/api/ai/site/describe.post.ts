import { describeSiteStyle } from '~/server/utils/ai-site-style'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const url = String(body?.url || '').trim()
  if (!url) throw createError({ statusCode: 400, statusMessage: 'url required' })

  try {
    const result = await describeSiteStyle(url)
    return { success: true, ...result }
  } catch (err: any) {
    throw createError({ statusCode: 500, statusMessage: err?.message || 'Failed to describe site' })
  }
})

