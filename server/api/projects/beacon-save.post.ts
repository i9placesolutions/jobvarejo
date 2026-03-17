import { requireAuthenticatedUser } from '../../utils/auth'
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
 * Estratégia de merge por página:
 * - Se a nova página inclui canvasData inline → substitui toda a página
 * - Se a nova página NÃO inclui canvasData inline → preserva o canvasData existente no banco
 * Isso evita que um beacon com payload reduzido destrua o backup existente.
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
  const normalizedIncoming = normalizeProjectCanvasDataStorageRefs(incomingPages)

  // Verificar se pelo menos uma página tem canvasData inline
  const hasAnyInlineCanvasData = normalizedIncoming.some((p: any) => !!p?.canvasData)

  try {
    if (hasAnyInlineCanvasData) {
      // Merge por página: preservar canvasData existente para páginas que não trazem inline
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
        // Se a página chegou com canvasData, usar o incoming completo
        if (incoming?.canvasData) return incoming
        // Senão, mesclar metadados com o canvasData já existente no banco
        const existingPage = existingById.get(pageId)
        if (existingPage?.canvasData) {
          return { ...existingPage, ...incoming, canvasData: existingPage.canvasData }
        }
        return incoming
      })

      const mergedJson = JSON.stringify(mergedPages)
      await pgOneOrNull<any>(
        `UPDATE public.projects
         SET canvas_data = $1::jsonb, updated_at = timezone('utc', now())
         WHERE id = $2 AND user_id = $3
         RETURNING id`,
        [mergedJson, projectId, user.id]
      )
      console.log(`🚨 [beacon-save] Merge salvo para projeto ${projectId} (user=${user.id}, páginas=${mergedPages.length})`)
    } else {
      // Payload sem nenhum canvasData inline — apenas atualizar metadados (paths, thumbnail)
      // preservando o canvasData existente via merge SQL
      const metaOnlyJson = JSON.stringify(normalizedIncoming)
      await pgOneOrNull<any>(
        `UPDATE public.projects
         SET canvas_data = (
           SELECT jsonb_agg(
             CASE
               WHEN (new_page->>'canvasData') IS NOT NULL OR old_page IS NULL
               THEN new_page
               ELSE old_page || (new_page - 'canvasData')
             END
           )
           FROM jsonb_array_elements($1::jsonb) AS new_page
           LEFT JOIN jsonb_array_elements(canvas_data) AS old_page
             ON (new_page->>'id') = (old_page->>'id')
         ),
         updated_at = timezone('utc', now())
         WHERE id = $2 AND user_id = $3
         RETURNING id`,
        [metaOnlyJson, projectId, user.id]
      )
      console.log(`🚨 [beacon-save] Metadados mesclados (sem canvasData) para projeto ${projectId} (user=${user.id})`)
    }

    return { ok: true }
  } catch (err: any) {
    console.error(`❌ [beacon-save] Falha ao salvar projeto ${projectId}:`, err?.message)
    throw createError({ statusCode: 500, statusMessage: 'Beacon save failed' })
  }
})
