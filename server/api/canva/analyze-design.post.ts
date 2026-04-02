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

    const structuralAnalysis = analyzeCanvaDesign(canvaDesignId, richtexts, fills, pages)
    let smartAnalysis: any = {}

    try {
      const { analyzeDesignWithAI } = await import('../../utils/canva-ai-analyzer')
      smartAnalysis = await analyzeDesignWithAI(canvaDesignId, richtexts, fills, pages)
    } catch (smartErr: any) {
      console.error('[canva/analyze-design] Analise inteligente falhou, seguindo com analise estrutural:', smartErr?.message || smartErr)
      smartAnalysis = {
        pages: [],
        design_type: 'offer',
        summary: '',
      }
    }

    await canvaCancelEditingTransaction(txn.transaction_id)

    return {
      ...structuralAnalysis,
      ...smartAnalysis,
      products: structuralAnalysis.products || [],
      products_per_page: structuralAnalysis.products_per_page || {},
      pages: smartAnalysis.pages || [],
      design_type: smartAnalysis.design_type || 'offer',
      summary: smartAnalysis.summary || '',
      thumbnail: txn.thumbnails?.[0]?.url || smartAnalysis.thumbnail || null,
    }
  } catch (err: any) {
    console.error('[canva/analyze-design] Erro:', err.message || err)
    throw createError({
      statusCode: err.statusCode || 500,
      statusMessage: err.statusMessage || err.message || 'Erro ao analisar design',
    })
  }
})
