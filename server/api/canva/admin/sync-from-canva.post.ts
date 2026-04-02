// Sincroniza designs da pasta "Job Varejo" do Canva com a tabela canva_templates
// Busca designs na pasta do Canva e insere os novos como is_active = false

import { requireAdminUser } from '../../../utils/auth'
import { enforceRateLimit } from '../../../utils/rate-limit'
import { pgQuery } from '../../../utils/postgres'
import { canvaFetch } from '../../../utils/canva-client'

const CANVA_FOLDER_ID = process.env.CANVA_FOLDER_ID || 'FAFvyPGKYO0'

export default defineEventHandler(async (event) => {
  const { user } = await requireAdminUser(event)
  enforceRateLimit(event, `admin-canva-sync:${user.id}`, 10, 60_000)

  // Buscar todos os designs da pasta do Canva (com paginacao)
  const allItems: any[] = []
  let continuation: string | undefined

  do {
    const query: Record<string, string | undefined> = { item_types: 'design' }
    if (continuation) {
      query.continuation = continuation
    }

    const response = await (canvaFetch as any)(`/folders/${CANVA_FOLDER_ID}/items`, { query })

    if (response.items && Array.isArray(response.items)) {
      allItems.push(...response.items)
    }

    continuation = response.continuation
  } while (continuation)

  // Buscar IDs de designs ja existentes na tabela
  const existingResult = await pgQuery(
    `SELECT canva_design_id FROM public.canva_templates`
  )
  const existingIds = new Set(existingResult.rows.map((r: any) => r.canva_design_id))

  // Filtrar designs novos e inserir
  let added = 0
  const designs: any[] = []

  for (const item of allItems) {
    const design = item.design
    if (!design || !design.id) continue

    designs.push({
      canva_design_id: design.id,
      title: design.title || 'Sem titulo',
      thumbnail_url: design.thumbnail?.url || null,
      already_exists: existingIds.has(design.id),
    })

    if (!existingIds.has(design.id)) {
      await pgQuery(
        `INSERT INTO public.canva_templates
           (canva_design_id, title, thumbnail_url, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, false, timezone('utc', now()), timezone('utc', now()))
         ON CONFLICT (canva_design_id) DO NOTHING`,
        [design.id, design.title || 'Sem titulo', design.thumbnail?.url || null]
      )
      added++
    }
  }

  return {
    added,
    total: designs.length,
    designs,
  }
})
