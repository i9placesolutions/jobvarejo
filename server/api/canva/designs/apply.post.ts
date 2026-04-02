// Aplicar mapeamentos de produtos no design do Canva
// Recebe os mapeamentos e executa as operacoes de edicao

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { transaction_id, mappings } = body

  if (!transaction_id) {
    throw createError({ statusCode: 400, message: 'transaction_id e obrigatorio' })
  }

  if (!mappings || !Array.isArray(mappings) || mappings.length === 0) {
    throw createError({ statusCode: 400, message: 'Mapeamentos sao obrigatorios' })
  }

  const errors: string[] = []
  let productsApplied = 0

  // Agrupar operacoes por pagina
  const operationsByPage: Record<number, any[]> = {}

  for (const mapping of mappings) {
    if (!mapping.product) continue

    const pageIndex = mapping.page_index || 1
    if (!operationsByPage[pageIndex]) {
      operationsByPage[pageIndex] = []
    }

    try {
      if (mapping.type === 'name' && mapping.product.name) {
        operationsByPage[pageIndex].push({
          type: 'replace_text',
          element_id: mapping.element_id,
          text: mapping.product.name,
        })
      } else if (mapping.type === 'price' && mapping.product.offer_price !== null) {
        const formattedPrice = mapping.product.offer_price.toLocaleString('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        })
        operationsByPage[pageIndex].push({
          type: 'replace_text',
          element_id: mapping.element_id,
          text: formattedPrice,
        })
      } else if (mapping.type === 'unit' && mapping.product.unit) {
        operationsByPage[pageIndex].push({
          type: 'replace_text',
          element_id: mapping.element_id,
          text: mapping.product.unit,
        })
      } else if (mapping.type === 'image' && mapping.product.canva_asset_id) {
        operationsByPage[pageIndex].push({
          type: 'update_fill',
          element_id: mapping.element_id,
          asset_type: 'image',
          asset_id: mapping.product.canva_asset_id,
          alt_text: mapping.product.name || 'Produto',
        })
      }

      productsApplied++
    } catch (err: any) {
      errors.push(`Erro no slot ${mapping.slot_index}: ${err.message}`)
    }
  }

  // Executar operacoes agrupadas por pagina
  for (const [pageIndex, operations] of Object.entries(operationsByPage)) {
    if (operations.length === 0) continue
    try {
      await canvaPerformEditingOperations(transaction_id, operations, Number(pageIndex))
    } catch (err: any) {
      errors.push(`Erro na pagina ${pageIndex}: ${err.message}`)
    }
  }

  return {
    success: errors.length === 0,
    products_applied: productsApplied,
    pages_updated: Object.keys(operationsByPage).length,
    errors,
  }
})
