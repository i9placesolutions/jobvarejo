// Sincroniza designs da pasta "Job Varejo" do Canva com a tabela canva_templates
// Pode ser chamado por: admin (manual) ou cron (automatico a cada 30min)

import { pgQuery } from '../../../utils/postgres'

const CANVA_FOLDER_ID = process.env.CANVA_FOLDER_ID || 'FAFvyPGKYO0'

// Aceita admin autenticado OU cron via header x-cron-secret
const requireAdminOrCron = async (event: any) => {
  const cronSecret = String(process.env.CRON_SECRET || process.env.NUXT_CRON_SECRET || '').trim()
  const headerKey = String(getHeader(event, 'x-cron-secret') || '').trim()

  if (cronSecret && headerKey && cronSecret === headerKey) {
    return { id: 'cron', source: 'cron' }
  }

  // Fallback: admin autenticado
  try {
    const { requireAdminUser } = await import('../../../utils/auth')
    const { user } = await requireAdminUser(event)
    return { id: user.id, source: 'admin' }
  } catch {
    throw createError({ statusCode: 401, statusMessage: 'Nao autorizado' })
  }
}

export default defineEventHandler(async (event) => {
  const caller = await requireAdminOrCron(event)

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
      page_count: design.page_count || 1,
      already_exists: existingIds.has(design.id),
    })

    if (!existingIds.has(design.id)) {
      await pgQuery(
        `INSERT INTO public.canva_templates
           (canva_design_id, title, thumbnail_url, page_count, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, false, NOW(), NOW())
         ON CONFLICT (canva_design_id) DO UPDATE SET
           thumbnail_url = EXCLUDED.thumbnail_url,
           page_count = EXCLUDED.page_count,
           updated_at = NOW()`,
        [design.id, design.title || 'Sem titulo', design.thumbnail?.url || null, design.page_count || 1]
      )
      added++
    }
  }

  return {
    added,
    total: designs.length,
    source: caller.source,
    synced_at: new Date().toISOString(),
    designs,
  }
})
