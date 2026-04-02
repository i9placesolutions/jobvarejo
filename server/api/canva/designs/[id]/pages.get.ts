// Obter paginas de um design do Canva (com thumbnails)

export default defineEventHandler(async (event) => {
  const designId = getRouterParam(event, 'id')
  const query = getQuery(event)
  const page = Number(query.page) || 1
  const limit = Number(query.limit) || 20

  if (!designId) {
    throw createError({ statusCode: 400, message: 'ID do design e obrigatorio' })
  }

  const response = await canvaGetDesignPages(designId, {
    offset: page,
    limit,
  })

  return {
    pages: response.items.map(item => ({
      index: item.index,
      thumbnail: item.thumbnail?.url || null,
    })),
  }
})
