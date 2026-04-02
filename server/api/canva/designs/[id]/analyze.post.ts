// Analisar estrutura de um design do Canva
// Detecta slots de produtos (nome, preco, unidade, imagem)

export default defineEventHandler(async (event) => {
  const designId = getRouterParam(event, 'id')

  if (!designId) {
    throw createError({ statusCode: 400, message: 'ID do design e obrigatorio' })
  }

  try {
    // Iniciar transacao de edicao para ler os elementos
    const txnResponse = await canvaStartEditingTransaction(designId)
    const txn = txnResponse.transaction

    // Extrair dados da transacao
    const richtexts = txn.richtexts || []
    const fills = txn.fills || []
    const pages = txn.pages || []

    // Analisar a estrutura
    const analysis = analyzeCanvaDesign(designId, richtexts, fills, pages)

    // Cancelar a transacao (era so leitura)
    await canvaCancelEditingTransaction(txn.transaction_id)

    return {
      ...analysis,
      thumbnail: txn.thumbnails?.[0]?.url || null,
    }
  } catch (err: any) {
    console.error('Erro ao analisar design:', err.message || err)
    throw createError({
      statusCode: err.statusCode || 500,
      message: err.statusMessage || err.message || 'Erro ao analisar design',
    })
  }
})
