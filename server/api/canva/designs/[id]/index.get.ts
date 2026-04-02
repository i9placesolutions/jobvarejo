// Obter informacoes de um design especifico do Canva

export default defineEventHandler(async (event) => {
  const designId = getRouterParam(event, 'id')

  if (!designId) {
    throw createError({ statusCode: 400, message: 'ID do design e obrigatorio' })
  }

  const design = await canvaGetDesign(designId)

  return {
    id: design.id,
    title: design.title,
    thumbnail: design.thumbnail || null,
    urls: design.urls,
    created_at: design.created_at,
    updated_at: design.updated_at,
    page_count: design.page_count || 1,
  }
})
