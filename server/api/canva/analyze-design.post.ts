// Analisar design — retorna informacoes do template pre-configuradas
// A Canva Connect REST API nao tem endpoint de leitura de conteudo,
// entao usamos os dados cadastrados no banco (canva_templates) pelo admin.

import { canvaGetDesign, canvaGetDesignPages } from '../../utils/canva-client'
import { requireBuilderTenant } from '../../utils/builder-auth'
import { pgOneOrNull } from '../../utils/postgres'

export default defineEventHandler(async (event) => {
  const tenant = await requireBuilderTenant(event)
  const body = await readBody(event)
  const designId = body.design_id

  if (!designId) {
    throw createError({ statusCode: 400, message: 'design_id e obrigatorio' })
  }

  // Buscar design local no banco com dados do template
  const localDesign = await pgOneOrNull<any>(
    `SELECT d.id, d.canva_design_id, d.title, d.template_id,
            d.canva_edit_url, d.canva_view_url,
            t.products_per_page, t.pattern, t.design_type,
            t.page_count as template_page_count, t.category
     FROM canva_designs d
     LEFT JOIN canva_templates t ON t.id = d.template_id
     WHERE d.tenant_id = $1::uuid AND (d.id::text = $2 OR d.canva_design_id = $2)
     LIMIT 1`,
    [tenant.id, designId]
  )

  if (!localDesign) {
    throw createError({ statusCode: 404, message: 'Design nao encontrado' })
  }

  const canvaDesignId = localDesign.canva_design_id

  // Obter info atualizada do Canva (metadata + paginas)
  let designInfo: any = null
  let pages: any[] = []
  let thumbnail: string | null = null

  try {
    designInfo = await canvaGetDesign(canvaDesignId)
    thumbnail = designInfo.thumbnail?.url || null
  } catch (err: any) {
    console.warn('[analyze-design] Erro ao obter design do Canva:', err.message)
  }

  try {
    const pagesResponse = await canvaGetDesignPages(canvaDesignId)
    pages = (pagesResponse.items || []).map((p: any) => ({
      index: p.index,
      thumbnail: p.thumbnail?.url || null,
    }))
  } catch (err: any) {
    console.warn('[analyze-design] Erro ao obter paginas:', err.message)
  }

  const productsPerPage = localDesign.products_per_page || {}
  const designType = localDesign.design_type || 'offer'
  const totalPages = designInfo?.page_count || localDesign.template_page_count || 1

  // Criar slots de produtos vazios baseado no products_per_page do template
  const products: any[] = []
  let productIndex = 0
  for (let pageIdx = 1; pageIdx <= totalPages; pageIdx++) {
    const count = productsPerPage[String(pageIdx)] || 0
    for (let i = 0; i < count; i++) {
      products.push({
        index: productIndex++,
        page_index: pageIdx,
        page_id: `page_${pageIdx}`,
        name: null,
        price: null,
        currency: null,
        images: [],
        unit: 'UN',
      })
    }
  }

  return {
    design_id: canvaDesignId,
    local_design_id: localDesign.id,
    design_type: designType,
    total_pages: totalPages,
    products_per_page: productsPerPage,
    products,
    pattern: localDesign.pattern || 'unknown',
    has_unit_in_name: true,
    has_images: false,
    fixed_elements: [],
    pages: pages.length > 0 ? pages : Array.from({ length: totalPages }, (_, i) => ({
      index: i + 1,
      thumbnail: i === 0 ? thumbnail : null,
    })),
    thumbnail,
    category: localDesign.category,
    summary: `Design ${designType} com ${products.length} slots em ${totalPages} paginas`,
    // Edicao de conteudo requer edicao manual no Canva
    editing_mode: 'manual',
    edit_url: localDesign.canva_edit_url || designInfo?.urls?.edit_url || null,
    view_url: localDesign.canva_view_url || designInfo?.urls?.view_url || null,
  }
})
