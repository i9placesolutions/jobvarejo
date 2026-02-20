import { toWasabiProxyUrl } from '~/utils/storageProxy'
import { requireAuthenticatedUser } from '../utils/auth'
import { enforceRateLimit } from '../utils/rate-limit'
import { pgOneOrNull, pgQuery } from '../utils/postgres'

const isUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event)
  enforceRateLimit(event, `projects-get:${user.id}`, 180, 60_000)

  const query = getQuery(event)
  const id = String(query.id || '').trim()
  const limitParam = query.limit
  const requestedLimitRaw = Array.isArray(limitParam) ? limitParam[0] : limitParam
  const requestedLimit = Number.parseInt(String(requestedLimitRaw || ''), 10)
  const safeLimit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), 1000)
    : null

  if (id) {
    if (!isUuid(id)) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid project id format' })
    }

    try {
      const row = await pgOneOrNull<any>(
        `select *
         from public.projects
         where id = $1
           and user_id = $2
         limit 1`,
        [id, user.id]
      )
      if (!row) throw createError({ statusCode: 404, statusMessage: 'Project not found' })
      return row
    } catch (error: any) {
      if (error?.statusCode) throw error
      throw createError({ statusCode: 500, statusMessage: error?.message || 'Failed to fetch project' })
    }
  }

  try {
    const baseSql = `
      select id, name, created_at, updated_at, preview_url, folder_id, last_viewed, is_shared, shared_with, is_starred
      from public.projects
      where user_id = $1
      order by updated_at desc
    `
    const params: any[] = [user.id]
    const sql = safeLimit !== null ? `${baseSql} limit $2` : baseSql
    if (safeLimit !== null) params.push(safeLimit)

    const { rows } = await pgQuery<any>(sql, params)

    return (rows || []).map((p: any) => ({
      ...p,
      preview_url: toWasabiProxyUrl(p?.preview_url)
    }))
  } catch (error: any) {
    throw createError({ statusCode: 500, statusMessage: error?.message || 'Failed to list projects' })
  }
})
