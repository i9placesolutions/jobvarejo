import { requireAuthenticatedUser } from '../../utils/auth'
import { parseAndStringifyJsonbParam } from '../../utils/jsonb'
import {
  normalizeProjectCanvasDataStorageRefs,
} from '../../utils/project-storage-refs'
import { pgOneOrNull } from '../../utils/postgres'

/**
 * Endpoint de emergência para navigator.sendBeacon no beforeunload.
 *
 * Recebe o canvas_data completo (com canvasData inline) e grava direto no
 * Postgres.  Não tenta upload Wasabi — a prioridade é não perder dados.
 * O próximo load do projeto usará pickBestRemoteCanvasData para reconciliar.
 *
 * Body: JSON { id, canvas_data, name? }
 * sendBeacon envia como Blob com content-type application/json.
 */

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event)

  const body = await readBody<Record<string, any>>(event)
  const projectId = String(body?.id || '').trim()
  if (!projectId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(projectId)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid project id' })
  }

  const canvasData = body?.canvas_data
  if (!canvasData || (Array.isArray(canvasData) && canvasData.length === 0)) {
    throw createError({ statusCode: 400, statusMessage: 'canvas_data required' })
  }

  const normalizedCanvasData = normalizeProjectCanvasDataStorageRefs(canvasData)
  const canvasDataJson = parseAndStringifyJsonbParam(normalizedCanvasData, 'canvas_data')

  try {
    await pgOneOrNull<any>(
      `UPDATE public.projects
       SET canvas_data = $1::jsonb, updated_at = timezone('utc', now())
       WHERE id = $2 AND user_id = $3
       RETURNING id`,
      [canvasDataJson, projectId, user.id]
    )
    console.log(`🚨 [beacon-save] Dados salvos de emergência para projeto ${projectId} (user=${user.id})`)
    return { ok: true }
  } catch (err: any) {
    console.error(`❌ [beacon-save] Falha ao salvar projeto ${projectId}:`, err?.message)
    throw createError({ statusCode: 500, statusMessage: 'Beacon save failed' })
  }
})
