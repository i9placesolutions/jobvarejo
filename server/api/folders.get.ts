import { requireAuthenticatedUser } from '../utils/auth'
import { enforceRateLimit } from '../utils/rate-limit'
import { pgOneOrNull, pgQuery } from '../utils/postgres'

const isUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)

const isMissingTableError = (error: any, tableName: string): boolean => {
  const code = String(error?.code || error?.cause?.code || '').trim()
  const message = String(error?.message || error?.cause?.message || '').toLowerCase()
  return code === '42P01' || (message.includes('does not exist') && message.includes(tableName))
}

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event)
  enforceRateLimit(event, `folders-get:${user.id}`, 240, 60_000)

  const query = getQuery(event)
  const id = String(query.id || '').trim()
  const scopeRaw = String(query.scope || 'all').trim().toLowerCase()
  const scope = scopeRaw === 'project' || scopeRaw === 'asset' ? scopeRaw : 'all'

  try {
    if (id) {
      if (!isUuid(id)) {
        throw createError({ statusCode: 400, statusMessage: 'Invalid folder id format' })
      }

      const row = await pgOneOrNull<any>(
        `select *
         from public.folders
         where id = $1
           and user_id = $2
         limit 1`,
        [id, user.id]
      )
      if (!row) throw createError({ statusCode: 404, statusMessage: 'Folder not found' })
      return row
    }

    if (scope === 'project') {
      try {
        const { rows } = await pgQuery<any>(
          `select f.*
           from public.folders f
           where f.user_id = $1
             and (
               f.icon = 'project-folder'
               or (
                 coalesce(f.icon, 'folder') <> 'asset-folder'
                 and not exists (
                   select 1
                   from public.asset_folders af
                   where af.user_id = $1
                     and af.folder_id = f.id
                 )
               )
             )
           order by f.order_index asc, f.created_at asc`,
          [user.id]
        )
        return rows || []
      } catch (error: any) {
        if (!isMissingTableError(error, 'asset_folders')) throw error
        const { rows } = await pgQuery<any>(
          `select *
           from public.folders
           where user_id = $1
             and coalesce(icon, 'folder') <> 'asset-folder'
           order by order_index asc, created_at asc`,
          [user.id]
        )
        return rows || []
      }
    }

    if (scope === 'asset') {
      try {
        const { rows } = await pgQuery<any>(
          `select f.*
           from public.folders f
           where f.user_id = $1
             and (
               f.icon = 'asset-folder'
               or exists (
                 select 1
                 from public.asset_folders af
                 where af.user_id = $1
                   and af.folder_id = f.id
               )
             )
           order by f.order_index asc, f.created_at asc`,
          [user.id]
        )
        return rows || []
      } catch (error: any) {
        if (!isMissingTableError(error, 'asset_folders')) throw error
        const { rows } = await pgQuery<any>(
          `select *
           from public.folders
           where user_id = $1
             and coalesce(icon, 'folder') = 'asset-folder'
           order by order_index asc, created_at asc`,
          [user.id]
        )
        return rows || []
      }
    }

    const { rows } = await pgQuery<any>(
      `select *
       from public.folders
       where user_id = $1
       order by order_index asc, created_at asc`,
      [user.id]
    )
    return rows || []
  } catch (error: any) {
    if (error?.statusCode) throw error
    throw createError({ statusCode: 500, statusMessage: error?.message || 'Failed to list folders' })
  }
})
