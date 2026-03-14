import { requireAuthenticatedUser } from '../utils/auth'
import { parseAndStringifyJsonbParam } from '../utils/jsonb'
import {
  normalizeProjectCanvasDataStorageRefs,
  normalizeStoredStorageRef
} from '../utils/project-storage-refs'
import { publishProjectChange } from '../utils/project-realtime'
import { enforceRateLimit } from '../utils/rate-limit'
import { pgOneOrNull, pgQuery } from '../utils/postgres'

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

const ensureCanvasDataNotEmpty = (value: unknown) => {
  if (Array.isArray(value) && value.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'canvas_data cannot be an empty array' })
  }
}

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event)
  await enforceRateLimit(event, `projects-post:${user.id}`, 90, 60_000)

  const body = await readBody(event)
  const payload = (body && typeof body === 'object') ? body as Record<string, any> : null

  if (!payload || !('canvas_data' in payload)) {
    throw createError({ statusCode: 400, statusMessage: 'Canvas Data required' })
  }
  if (payload.canvas_data === null || payload.canvas_data === undefined) {
    throw createError({ statusCode: 400, statusMessage: 'canvas_data cannot be empty' })
  }
  ensureCanvasDataNotEmpty(payload.canvas_data)
  const normalizedCanvasData = normalizeProjectCanvasDataStorageRefs(payload.canvas_data)
  const canvasDataJson = parseAndStringifyJsonbParam(normalizedCanvasData, 'canvas_data')

  const projectId = String(payload.id || '').trim()
  if (projectId && !isUuid(projectId)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid project id format' })
  }

  const nameRaw = String(payload.name || '').trim()
  const name = nameRaw || 'Untitled Project'
  if (name.length > 120) {
    throw createError({ statusCode: 400, statusMessage: 'Project name too long (max 120 chars)' })
  }

  const previewUrl = normalizeStoredStorageRef(payload.preview_url)
  if (previewUrl && previewUrl.length > 2048) {
    throw createError({ statusCode: 400, statusMessage: 'preview_url too long' })
  }

  const folderIdRaw = payload.folder_id
  const folderId = folderIdRaw == null || folderIdRaw === '' ? null : String(folderIdRaw).trim()
  if (folderId && !isUuid(folderId)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid folder_id format' })
  }

  const lastViewed = toIsoOrNull(payload.last_viewed)
  if (payload.last_viewed != null && !lastViewed) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid last_viewed date format' })
  }

  const updatedAt = new Date().toISOString()
  const actorClientId = String(getHeader(event, 'x-client-id') || '').trim() || null
  let result: any = null
  let didPersistMutation = false

  try {
    if (projectId) {
      result = await pgOneOrNull<any>(
        `update public.projects
         set name = $1,
             canvas_data = $2::jsonb,
             preview_url = $3,
             user_id = $4,
             updated_at = $5
         where id = $6
           and user_id = $7
           and (
             name is distinct from $1
             or canvas_data is distinct from $2::jsonb
             or preview_url is distinct from $3
           )
         returning *`,
        [name, canvasDataJson, previewUrl, user.id, updatedAt, projectId, user.id]
      )

      if (!result) {
        const existing = await pgOneOrNull<any>(
          `select *
             from public.projects
            where id = $1
              and user_id = $2
            limit 1`,
          [projectId, user.id]
        )
        if (!existing) throw createError({ statusCode: 404, statusMessage: 'Project not found' })
        result = existing
      } else {
        didPersistMutation = true
      }
    } else {
      const { rows } = await pgQuery<any>(
        `insert into public.projects
           (name, canvas_data, preview_url, user_id, updated_at, folder_id, last_viewed)
         values
           ($1, $2::jsonb, $3, $4, $5, $6::uuid, $7::timestamptz)
         returning *`,
        [name, canvasDataJson, previewUrl, user.id, updatedAt, folderId, lastViewed]
      )
      result = rows[0] || null
      didPersistMutation = !!result
    }
  } catch (error: any) {
    if (error?.statusCode) throw error
    const message = String(error?.message || error?.detail || error?.hint || '').trim() || 'Failed to persist project'
    console.error('[api/projects:post] Persist failed', {
      code: error?.code || null,
      message,
      detail: error?.detail || null,
      hint: error?.hint || null,
      constraint: error?.constraint || null
    })
    throw createError({ statusCode: 500, statusMessage: message })
  }

  if (result?.id && didPersistMutation) {
    try {
      await publishProjectChange({
        projectId: String(result.id),
        userId: user.id,
        action: projectId ? 'updated' : 'created',
        updatedAt: String(result.updated_at || updatedAt),
        actorClientId
      })
    } catch (notifyErr) {
      console.warn('[api/projects:post] Failed to publish realtime notification:', notifyErr)
    }
  }

  return { success: true, project: result }
})
