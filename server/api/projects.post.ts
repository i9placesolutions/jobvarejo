import { requireAuthenticatedUser } from '../utils/auth'
import { parseAndStringifyJsonbParam } from '../utils/jsonb'
import {
  normalizeProjectCanvasDataStorageRefs,
  normalizeStoredStorageRef,
  stripInlineCanvasDataFromProjectCanvasData
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
  const normalizedCanvasData = stripInlineCanvasDataFromProjectCanvasData(
    normalizeProjectCanvasDataStorageRefs(payload.canvas_data)
  )
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
  // NOTA: optimistic concurrency control (expected_updated_at) foi removido porque
  // a comparacao estrita de timestamps entre JS (ms) e Postgres (microssegundos)
  // e updates laterais (realtime/history-snapshot) disparavam 409 em loop no
  // caminho feliz. Se for necessario no futuro, precisa de margem de tolerancia
  // e de uma UI de reconciliacao de conflito. O campo continua sendo aceito
  // no payload para nao quebrar clientes ja deployados, mas e ignorado.
  let result: any = null
  let didPersistMutation = false

  try {
    if (projectId) {
      // Simple UPDATE: always write the new data and return the updated row.
      // Previous approach used `canvas_data IS DISTINCT FROM $2::jsonb` which
      // caused PostgreSQL to decompress and compare multi-MB JSONB blobs,
      // routinely exceeding 60s on large canvas payloads with inline backups.
      const row = await pgOneOrNull<any>(
        `update public.projects
         set name = $1,
             canvas_data = $2::jsonb,
             preview_url = $3,
             user_id = $4,
             updated_at = $5
         where id = $6
           and user_id = $7
         returning *`,
        [name, canvasDataJson, previewUrl, user.id, updatedAt, projectId, user.id]
      )

      if (!row) throw createError({ statusCode: 404, statusMessage: 'Project not found' })
      didPersistMutation = true
      result = row
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
