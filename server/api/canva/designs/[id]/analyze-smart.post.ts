// Analise inteligente de design usando IA
// Detecta automaticamente: ofertas, institucional, misto
// Classifica cada elemento: produto, logo, texto, contato, etc.

import { canvaCancelEditingTransaction, canvaStartEditingTransaction } from '../../../../utils/canva-client'
import { resolveCanvaDesignRoute } from '../../../../utils/canva-design-route'

export default defineEventHandler(async (event) => {
  const { canvaDesignId } = await resolveCanvaDesignRoute(event)

  try {
    // Iniciar transacao de edicao para ler elementos
    const txnResponse = await canvaStartEditingTransaction(canvaDesignId)
    const txn = txnResponse.transaction

    const richtexts = txn.richtexts || []
    const fills = txn.fills || []
    const pages = txn.pages || []

    // Analise inteligente com IA
    const { analyzeDesignWithAI } = await import('../../../../utils/canva-ai-analyzer')
    const analysis = await analyzeDesignWithAI(canvaDesignId, richtexts, fills, pages)

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
      statusMessage: err.statusMessage || err.message || 'Erro ao analisar design',
    })
  }
})
