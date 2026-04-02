// Duplicar pagina de um design do Canva
// Body: { page_index: number } - indice da pagina a duplicar (default: 1)
//
// A Canva Connect API tem limitacoes para duplicar paginas programaticamente.
// Esta API tenta a operacao via editing transaction.
// Se falhar, retorna instrucao para o cliente duplicar manualmente no Canva.

import { canvaDuplicatePage } from '~/server/utils/canva-client'
import { resolveCanvaDesignRoute } from '~/server/utils/canva-design-route'

export default defineEventHandler(async (event) => {
  const { canvaDesignId } = await resolveCanvaDesignRoute(event)
  const body = await readBody(event)
  const pageIndex = body?.page_index || 1

  if (typeof pageIndex !== 'number' || pageIndex < 1) {
    throw createError({
      statusCode: 400,
      message: 'page_index deve ser um numero maior ou igual a 1',
    })
  }

  try {
    const result = await canvaDuplicatePage(canvaDesignId, pageIndex)
    return result
  } catch (err: any) {
    throw createError({
      statusCode: 500,
      statusMessage: err.message || 'Erro ao duplicar pagina',
    })
  }
})
