// Obter paginas de um design do Canva (com thumbnails)

import { canvaGetDesignPages } from '../../../../utils/canva-client'
import { resolveCanvaDesignRoute } from '../../../../utils/canva-design-route'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const page = Number(query.page) || 1
  const limit = Number(query.limit) || 20
  const { canvaDesignId } = await resolveCanvaDesignRoute(event, { allowRemoteFallback: true })

  const response = await canvaGetDesignPages(canvaDesignId, {
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
