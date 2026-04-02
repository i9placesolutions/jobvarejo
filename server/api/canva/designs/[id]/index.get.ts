// Obter informacoes de um design especifico do Canva

import { canvaGetDesign } from '../../../../utils/canva-client'
import { resolveCanvaDesignRoute } from '../../../../utils/canva-design-route'

export default defineEventHandler(async (event) => {
  try {
    const { localDesign, canvaDesignId } = await resolveCanvaDesignRoute(event)
    const design = await canvaGetDesign(canvaDesignId)

    return {
      id: localDesign?.id || design.id,
      canva_design_id: design.id,
      title: localDesign?.title || design.title,
      thumbnail: design.thumbnail || null,
      urls: design.urls,
      template_id: localDesign?.template_id || null,
      status: localDesign?.status || null,
      created_at: design.created_at,
      updated_at: design.updated_at,
      page_count: design.page_count || 1,
    }
  } catch (err: any) {
    console.error('[canva/designs/get] Erro:', err.statusCode, err.statusMessage || err.message)
    throw createError({
      statusCode: err.statusCode || 500,
      statusMessage: err.statusMessage || err.message || 'Erro ao carregar design',
    })
  }
})
