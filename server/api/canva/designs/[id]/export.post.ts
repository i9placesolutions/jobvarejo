// Exportar design do Canva em formato especificado

export default defineEventHandler(async (event) => {
  const designId = getRouterParam(event, 'id')
  const body = await readBody(event)
  const format = body.format || 'png'

  if (!designId) {
    throw createError({ statusCode: 400, message: 'ID do design e obrigatorio' })
  }

  // Iniciar export
  const exportResponse = await canvaExportDesign(designId, { type: format })
  const jobId = exportResponse.job.id

  // Polling ate o export terminar (max 30s)
  const maxAttempts = 15
  const delayMs = 2000
  let attempt = 0

  while (attempt < maxAttempts) {
    const jobStatus = await canvaGetExportJob(jobId)

    if (jobStatus.job.status === 'completed' || jobStatus.job.status === 'success') {
      return {
        download_url: jobStatus.job.urls?.[0] || null,
        urls: jobStatus.job.urls || [],
      }
    }

    if (jobStatus.job.status === 'failed') {
      throw createError({
        statusCode: 500,
        message: 'Exportacao falhou no Canva',
      })
    }

    // Aguardar antes da proxima tentativa
    await new Promise(resolve => setTimeout(resolve, delayMs))
    attempt++
  }

  throw createError({
    statusCode: 504,
    message: 'Timeout aguardando exportacao do Canva',
  })
})
