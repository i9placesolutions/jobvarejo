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
  enforceRateLimit(event, `asset-names-get:${user.id}`, 240, 60_000)

  try {
    const { rows } = await pgQuery<{ asset_key: string; display_name: string }>(
      `select asset_key, display_name
       from public.asset_names
       where user_id = $1`,
      [user.id]
    )
    return rows || []
  } catch (error: any) {
    if (isMissingTableError(error, 'asset_names')) {
      throw createError({ statusCode: 404, statusMessage: 'Table asset_names does not exist' })
    }
    throw createError({ statusCode: 500, statusMessage: error?.message || 'Failed to load asset names' })
  }
})
