// Duplicar pagina de um design do Canva
// Body: { page_index: number } - indice da pagina a duplicar (default: 1)
//
// A Canva Connect API tem limitacoes para duplicar paginas programaticamente.
// Esta API tenta a operacao via editing transaction.
// Se falhar, retorna instrucao para o cliente duplicar manualmente no Canva.

import { canvaDuplicatePage } from '~/server/utils/canva-client'

export default defineEventHandler(async (event) => {
  const designId = getRouterParam(event, 'id')
  const body = await readBody(event)
  const pageIndex = body?.page_index || 1

  if (!designId) {
    throw createError({
      statusCode: 400,
      message: 'ID do design e obrigatorio',
    })
  }

  if (typeof pageIndex !== 'number' || pageIndex < 1) {
    throw createError({
      statusCode: 400,
      message: 'page_index deve ser um numero maior ou igual a 1',
    })
  }

  try {
    const result = await canvaDuplicatePage(designId, pageIndex)
    return result
  } catch (err: any) {
    throw createError({
      statusCode: 500,
      message: err.message || 'Erro ao duplicar pagina',
    })
  }
})
