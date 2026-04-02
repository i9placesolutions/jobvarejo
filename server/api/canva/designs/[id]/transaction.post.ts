// Iniciar transacao de edicao no Canva

export default defineEventHandler(async (event) => {
  const designId = getRouterParam(event, 'id')

  if (!designId) {
    throw createError({ statusCode: 400, message: 'ID do design e obrigatorio' })
  }

  const response = await canvaStartEditingTransaction(designId)
  const txn = response.transaction

  return {
    transaction_id: txn.id,
    design_id: txn.design.id,
    pages: txn.design.pages.map(page => ({
      index: page.index,
      id: page.id,
      elements: page.elements.map(el => ({
        id: el.id,
        type: el.type,
        text: el.text || null,
        asset_id: el.asset_id || null,
        dimensions: el.dimensions || null,
      })),
      thumbnail: page.thumbnail?.url || null,
    })),
  }
})
