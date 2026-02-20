import { requireAuthenticatedUser } from '../utils/auth'
import { parseAndStringifyJsonbParam } from '../utils/jsonb'
import { enforceRateLimit } from '../utils/rate-limit'
import { pgOneOrNull } from '../utils/postgres'

const isUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)

const toIsoOrNull = (value: unknown): string | null => {
  if (value == null || value === '') return null
  const asString = String(value).trim()
  if (!asString) return null
  const date = new Date(asString)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

const parseSharedWith = (value: unknown): string[] => {
  if (value == null) return []
  if (!Array.isArray(value)) {
    throw createError({ statusCode: 400, statusMessage: 'shared_with must be an array' })
  }
  const parsed = value
    .map((item) => String(item || '').trim())
    .filter(Boolean)
  if (parsed.some((item) => !isUuid(item))) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid shared_with UUID format' })
  }
  return parsed
}

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event)
  enforceRateLimit(event, `projects-patch:${user.id}`, 180, 60_000)

  const body = await readBody<Record<string, any>>(event)
  const projectId = String(body?.id || '').trim()
  if (!projectId || !isUuid(projectId)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid project id format' })
  }

  const updates: string[] = []
  const params: any[] = []
  const pushParam = (value: any) => {
    params.push(value)
    return `$${params.length}`
  }

  if ('name' in body) {
    const name = String(body?.name || '').trim()
    if (!name) throw createError({ statusCode: 400, statusMessage: 'Project name required' })
    if (name.length > 120) throw createError({ statusCode: 400, statusMessage: 'Project name too long (max 120 chars)' })
    updates.push(`name = ${pushParam(name)}`)
  }

  if ('preview_url' in body) {
    const previewUrl = body?.preview_url == null ? null : String(body.preview_url).trim()
    if (previewUrl && previewUrl.length > 2048) {
      throw createError({ statusCode: 400, statusMessage: 'preview_url too long' })
    }
    updates.push(`preview_url = ${pushParam(previewUrl)}`)
  }

  if ('folder_id' in body) {
    const folderIdRaw = body?.folder_id
    const folderId = folderIdRaw == null || folderIdRaw === '' ? null : String(folderIdRaw).trim()
    if (folderId && !isUuid(folderId)) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid folder_id format' })
    }
    updates.push(`folder_id = ${pushParam(folderId)}::uuid`)
  }

  if ('last_viewed' in body) {
    const lastViewed = toIsoOrNull(body?.last_viewed)
    if (body?.last_viewed != null && !lastViewed) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid last_viewed date format' })
    }
    updates.push(`last_viewed = ${pushParam(lastViewed)}::timestamptz`)
  }

  if ('is_starred' in body) {
    updates.push(`is_starred = ${pushParam(Boolean(body?.is_starred))}`)
  }

  if ('is_shared' in body) {
    updates.push(`is_shared = ${pushParam(Boolean(body?.is_shared))}`)
  }

  if ('shared_with' in body) {
    const sharedWith = parseSharedWith(body?.shared_with)
    updates.push(`shared_with = ${pushParam(sharedWith)}::uuid[]`)
  }

  if ('canvas_data' in body) {
    if (body?.canvas_data == null) {
      throw createError({ statusCode: 400, statusMessage: 'canvas_data cannot be empty' })
    }
    const canvasDataJson = parseAndStringifyJsonbParam(body.canvas_data, 'canvas_data')
    updates.push(`canvas_data = ${pushParam(canvasDataJson)}::jsonb`)
  }

  if (updates.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No valid fields to update' })
  }

  updates.push(`updated_at = timezone('utc', now())`)

  const idPlaceholder = pushParam(projectId)
  const userPlaceholder = pushParam(user.id)

  try {
    const row = await pgOneOrNull<any>(
      `update public.projects
       set ${updates.join(', ')}
       where id = ${idPlaceholder}
         and user_id = ${userPlaceholder}
       returning *`,
      params
    )
    if (!row) throw createError({ statusCode: 404, statusMessage: 'Project not found' })

    return { success: true, project: row }
  } catch (error: any) {
    if (error?.statusCode) throw error
    throw createError({ statusCode: 500, statusMessage: error?.message || 'Failed to update project' })
  }
})
