// Analise inteligente de design usando IA
// Detecta automaticamente: ofertas, institucional, misto
// Classifica cada elemento: produto, logo, texto, contato, etc.

export default defineEventHandler(async (event) => {
  const designId = getRouterParam(event, 'id')

  if (!designId) {
    throw createError({ statusCode: 400, message: 'ID do design e obrigatorio' })
  }

  try {
    // Iniciar transacao de edicao para ler elementos
    const txnResponse = await canvaStartEditingTransaction(designId)
    const txn = txnResponse.transaction

    const richtexts = txn.richtexts || []
    const fills = txn.fills || []
    const pages = txn.pages || []

    // Analise inteligente com IA
    const { analyzeDesignWithAI } = await import('~/server/utils/canva-ai-analyzer')
    const analysis = await analyzeDesignWithAI(designId, richtexts, fills, pages)

    // Cancelar transacao (era so leitura)
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
