// Analisar estrutura de um design do Canva
// Detecta slots de produtos (nome, preco, unidade, imagem)

import { analyzeCanvaDesign } from '../../../../utils/canva-analyzer'
import { canvaCancelEditingTransaction, canvaStartEditingTransaction } from '../../../../utils/canva-client'
import { resolveCanvaDesignRoute } from '../../../../utils/canva-design-route'

export default defineEventHandler(async (event) => {
  const { canvaDesignId } = await resolveCanvaDesignRoute(event)

  try {
    // Iniciar transacao de edicao para ler os elementos
    const txnResponse = await canvaStartEditingTransaction(canvaDesignId)
    const txn = txnResponse.transaction

    // Extrair dados da transacao
    const richtexts = txn.richtexts || []
    const fills = txn.fills || []
    const pages = txn.pages || []

    // Analisar a estrutura
    const analysis = analyzeCanvaDesign(canvaDesignId, richtexts, fills, pages)

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
      statusMessage: err.statusMessage || err.message || 'Erro ao analisar design',
    })
  }
})
