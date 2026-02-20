import { requireAuthenticatedUser } from '../utils/auth'
import { enforceRateLimit } from '../utils/rate-limit'
import { pgQuery } from '../utils/postgres'

const isMissingTableError = (error: any, tableName: string): boolean => {
  const code = String(error?.code || error?.cause?.code || '').trim()
  const message = String(error?.message || error?.cause?.message || '').toLowerCase()
  return code === '42P01' || (message.includes('does not exist') && message.includes(tableName))
}

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event)
  enforceRateLimit(event, `asset-names-post:${user.id}`, 180, 60_000)

  const body = await readBody<Record<string, any>>(event)
  const assetKey = String(body?.asset_key || '').trim()
  const displayName = String(body?.display_name || '').trim()

  if (!assetKey) throw createError({ statusCode: 400, statusMessage: 'asset_key is required' })
  if (!displayName) throw createError({ statusCode: 400, statusMessage: 'display_name is required' })
  if (assetKey.length > 2048) throw createError({ statusCode: 400, statusMessage: 'asset_key too long' })
  if (displayName.length > 256) throw createError({ statusCode: 400, statusMessage: 'display_name too long' })

  try {
    const { rows } = await pgQuery<any>(
      `insert into public.asset_names
         (user_id, asset_key, display_name, updated_at)
       values
         ($1, $2, $3, timezone('utc', now()))
       on conflict (user_id, asset_key)
       do update set
         display_name = excluded.display_name,
         updated_at = timezone('utc', now())
       returning asset_key, display_name`,
      [user.id, assetKey, displayName]
    )

    return { success: true, mapping: rows[0] || null }
  } catch (error: any) {
    if (isMissingTableError(error, 'asset_names')) {
      throw createError({ statusCode: 404, statusMessage: 'Table asset_names does not exist' })
    }
    throw createError({ statusCode: 500, statusMessage: error?.message || 'Failed to persist asset name' })
  }
})
