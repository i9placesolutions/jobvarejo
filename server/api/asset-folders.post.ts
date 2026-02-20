import { requireAuthenticatedUser } from '../utils/auth'
import { enforceRateLimit } from '../utils/rate-limit'
import { pgQuery } from '../utils/postgres'

const isUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)

const isMissingTableError = (error: any, tableName: string): boolean => {
  const code = String(error?.code || error?.cause?.code || '').trim()
  const message = String(error?.message || error?.cause?.message || '').toLowerCase()
  return code === '42P01' || (message.includes('does not exist') && message.includes(tableName))
}

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event)
  enforceRateLimit(event, `asset-folders-post:${user.id}`, 180, 60_000)

  const body = await readBody<Record<string, any>>(event)
  const assetKey = String(body?.asset_key || '').trim()
  const folderIdRaw = body?.folder_id
  const folderId = folderIdRaw == null || folderIdRaw === '' ? null : String(folderIdRaw).trim()

  if (!assetKey) throw createError({ statusCode: 400, statusMessage: 'asset_key is required' })
  if (assetKey.length > 2048) throw createError({ statusCode: 400, statusMessage: 'asset_key too long' })
  if (folderId && !isUuid(folderId)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid folder_id format' })
  }

  try {
    const { rows } = await pgQuery<any>(
      `insert into public.asset_folders
         (user_id, asset_key, folder_id, updated_at)
       values
         ($1, $2, $3::uuid, timezone('utc', now()))
       on conflict (user_id, asset_key)
       do update set
         folder_id = excluded.folder_id,
         updated_at = timezone('utc', now())
       returning asset_key, folder_id`,
      [user.id, assetKey, folderId]
    )

    return { success: true, mapping: rows[0] || null }
  } catch (error: any) {
    if (isMissingTableError(error, 'asset_folders')) {
      throw createError({ statusCode: 404, statusMessage: 'Table asset_folders does not exist' })
    }
    throw createError({ statusCode: 500, statusMessage: error?.message || 'Failed to persist asset folder mapping' })
  }
})
