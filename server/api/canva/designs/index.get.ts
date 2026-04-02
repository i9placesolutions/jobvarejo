// Listar designs do Canva do usuario

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const searchQuery = (query.query as string) || ''
  const sortBy = (query.sort_by as string) || 'modified_descending'
  const continuationToken = (query.continuation as string) || undefined

  const response = await canvaListDesigns({
    query: searchQuery || undefined,
    continuation: continuationToken,
    sort_by: sortBy,
  })

  // Mapear para formato do frontend
  const designs = (response.items || []).map(item => ({
    id: item.id,
    title: item.title,
    thumbnail: item.thumbnail || null,
    urls: item.urls,
    created_at: item.created_at,
    updated_at: item.updated_at,
    page_count: item.page_count || 1,
  }))

  return {
    designs,
    continuation: response.continuation || null,
  }
})
