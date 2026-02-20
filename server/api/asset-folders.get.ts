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
  enforceRateLimit(event, `asset-folders-get:${user.id}`, 240, 60_000)

  try {
    const { rows } = await pgQuery<{ asset_key: string; folder_id: string | null }>(
      `select asset_key, folder_id
       from public.asset_folders
       where user_id = $1`,
      [user.id]
    )
    return rows || []
  } catch (error: any) {
    if (isMissingTableError(error, 'asset_folders')) {
      throw createError({ statusCode: 404, statusMessage: 'Table asset_folders does not exist' })
    }
    throw createError({ statusCode: 500, statusMessage: error?.message || 'Failed to load asset folder mappings' })
  }
})
