// Obter conteudo de texto de um design do Canva

import { canvaGetDesignContent } from '../../../../utils/canva-client'
import { resolveCanvaDesignRoute } from '../../../../utils/canva-design-route'

export default defineEventHandler(async (event) => {
  const { canvaDesignId } = await resolveCanvaDesignRoute(event)

  const response = await canvaGetDesignContent(canvaDesignId, ['richtexts'])

  return {
    pages: response.pages || [],
  }
})
