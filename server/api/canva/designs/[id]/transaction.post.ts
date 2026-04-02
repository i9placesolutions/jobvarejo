// Iniciar transacao de edicao no Canva

import { canvaStartEditingTransaction } from '../../../../utils/canva-client'
import { resolveCanvaDesignRoute } from '../../../../utils/canva-design-route'

export default defineEventHandler(async (event) => {
  const { localDesign, canvaDesignId } = await resolveCanvaDesignRoute(event)

  const response = await canvaStartEditingTransaction(canvaDesignId)
  const txn = response.transaction

  return {
    transaction_id: txn.id,
    design_id: txn.design.id,
    local_design_id: localDesign?.id || null,
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
