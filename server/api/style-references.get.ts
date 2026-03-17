import { requireAuthenticatedUser } from '~/server/utils/auth'
import { enforceRateLimit } from '~/server/utils/rate-limit'
import { resolveStorageReadUrl } from '~/server/utils/project-storage-refs'

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event)
  await enforceRateLimit(event, `style-refs:get:${user.id}`, 60, 60_000)

  const rows = await pgQuery<{
    id: string
    s3_key: string
    display_name: string | null
    style_analysis: any
    tags: string[]
    usage_count: number
    created_at: string
  }>(
    `SELECT id, s3_key, display_name, style_analysis, tags, usage_count, created_at
     FROM public.style_references
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [user.id]
  )

  const items = await Promise.all(
    rows.rows.map(async (r) => ({
      id: r.id,
      s3Key: r.s3_key,
      displayName: r.display_name,
      styleAnalysis: r.style_analysis || {},
      tags: r.tags || [],
      usageCount: r.usage_count,
      createdAt: r.created_at,
      url: await resolveStorageReadUrl(r.s3_key, user.id).catch(() => null)
    }))
  )

  return { items }
})
