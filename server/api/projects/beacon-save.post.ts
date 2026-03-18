import { requireAuthenticatedUser } from '../../utils/auth'
import {
  normalizeProjectCanvasDataStorageRefs,
  stripInlineCanvasDataFromProjectCanvasData,
} from '../../utils/project-storage-refs'
import { pgOneOrNull } from '../../utils/postgres'

/**
 * Endpoint de emergência para navigator.sendBeacon no beforeunload.
 *
 * Mantém apenas metadados/refs no Postgres. Qualquer canvasData inline enviado
 * por clientes antigos é descartado aqui para preservar o contrato
 * "Wasabi para design, banco para referências".
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

  const rawCanvasData = body?.canvas_data
  if (!rawCanvasData || (Array.isArray(rawCanvasData) && rawCanvasData.length === 0)) {
    throw createError({ statusCode: 400, statusMessage: 'canvas_data required' })
  }

  const incomingPages: any[] = Array.isArray(rawCanvasData) ? rawCanvasData : []
  const normalizedIncoming = stripInlineCanvasDataFromProjectCanvasData(
    normalizeProjectCanvasDataStorageRefs(incomingPages)
  ) as any[]

  try {
    const existing = await pgOneOrNull<{ canvas_data: any }>(
      `SELECT canvas_data FROM public.projects WHERE id = $1 AND user_id = $2`,
      [projectId, user.id]
    )
    const existingPages: any[] = Array.isArray(existing?.canvas_data) ? existing.canvas_data : []
    const existingById = new Map<string, any>(
      existingPages.map((p: any) => [String(p?.id || ''), p])
    )

    const mergedPages = normalizedIncoming.map((incoming: any) => {
      const pageId = String(incoming?.id || '')
      const existingPage = existingById.get(pageId)
      if (!existingPage || typeof existingPage !== 'object') return incoming
      const nextExisting = { ...existingPage }
      delete nextExisting.canvasData
      return { ...nextExisting, ...incoming }
    })

    const mergedJson = JSON.stringify(mergedPages)
    await pgOneOrNull<any>(
      `UPDATE public.projects
       SET canvas_data = $1::jsonb, updated_at = timezone('utc', now())
       WHERE id = $2 AND user_id = $3
       RETURNING id`,
      [mergedJson, projectId, user.id]
    )
    console.log(`🚨 [beacon-save] Metadados sanitizados salvos para projeto ${projectId} (user=${user.id}, páginas=${mergedPages.length})`)

    return { ok: true }
  } catch (err: any) {
    console.error(`❌ [beacon-save] Falha ao salvar projeto ${projectId}:`, err?.message)
    throw createError({ statusCode: 500, statusMessage: 'Beacon save failed' })
  }
})
