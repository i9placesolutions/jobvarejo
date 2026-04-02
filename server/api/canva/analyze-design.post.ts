// Analisar design - rota alternativa sem subpasta [id]
import { canvaCancelEditingTransaction, canvaStartEditingTransaction } from '../../utils/canva-client'
import { analyzeCanvaDesign } from '../../utils/canva-analyzer'
import { requireBuilderTenant } from '../../utils/builder-auth'
import { pgOneOrNull } from '../../utils/postgres'

export default defineEventHandler(async (event) => {
  const tenant = await requireBuilderTenant(event)
  const body = await readBody(event)
  const designId = body.design_id

  if (!designId) {
    throw createError({ statusCode: 400, message: 'design_id e obrigatorio' })
  }

  // Buscar canva_design_id no banco
  const localDesign = await pgOneOrNull<any>(
    `SELECT canva_design_id FROM canva_designs
     WHERE tenant_id = $1::uuid AND (id::text = $2 OR canva_design_id = $2)
     LIMIT 1`,
    [tenant.id, designId]
  )

  const canvaDesignId = localDesign?.canva_design_id || designId

  try {
    const txnResponse = await canvaStartEditingTransaction(canvaDesignId)
    const txn = txnResponse.transaction

    const richtexts = txn.richtexts || []
    const fills = txn.fills || []
    const pages = txn.pages || []

    const analysis = analyzeCanvaDesign(canvaDesignId, richtexts, fills, pages)

    await canvaCancelEditingTransaction(txn.transaction_id)

    return {
      ...analysis,
      thumbnail: txn.thumbnails?.[0]?.url || null,
    }
  } catch (err: any) {
    console.error('[canva/analyze-design] Erro:', err.message || err)
    throw createError({
      statusCode: err.statusCode || 500,
      statusMessage: err.statusMessage || err.message || 'Erro ao analisar design',
    })
  }
})
