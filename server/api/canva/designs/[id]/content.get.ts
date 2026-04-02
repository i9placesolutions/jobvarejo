// Obter conteudo de texto de um design do Canva

export default defineEventHandler(async (event) => {
  const designId = getRouterParam(event, 'id')

  if (!designId) {
    throw createError({ statusCode: 400, message: 'ID do design e obrigatorio' })
  }

  const response = await canvaGetDesignContent(designId, ['richtexts'])

  return {
    pages: response.pages || [],
  }
})
