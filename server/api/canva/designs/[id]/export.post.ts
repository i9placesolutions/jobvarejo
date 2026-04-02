// Exportar design do Canva em formato especificado
// Suporta exportar apenas paginas especificas via body.pages (array de numeros)

export default defineEventHandler(async (event) => {
  const designId = getRouterParam(event, 'id')
  const body = await readBody(event)
  const format = body.format || 'png'
  const pages = body.pages as number[] | undefined // ex: [1, 3] = so paginas 1 e 3

  if (!designId) {
    throw createError({ statusCode: 400, message: 'ID do design e obrigatorio' })
  }

  // Montar opcoes de export incluindo paginas especificas
  const exportOptions: Record<string, any> = { type: format }
  if (pages && Array.isArray(pages) && pages.length > 0) {
    exportOptions.pages = pages
  }

  // Iniciar export
  const exportResponse = await canvaExportDesign(designId, exportOptions)
  const jobId = exportResponse.job.id

  // Polling ate o export terminar (max 60s)
  const maxAttempts = 30
  const delayMs = 2000
  let attempt = 0

  while (attempt < maxAttempts) {
    const jobStatus = await canvaGetExportJob(jobId)

    if (jobStatus.job.status === 'completed' || jobStatus.job.status === 'success') {
      return {
        download_url: jobStatus.job.urls?.[0] || null,
        urls: jobStatus.job.urls || [],
        pages_exported: pages || 'all',
      }
    }

    if (jobStatus.job.status === 'failed') {
      throw createError({
        statusCode: 500,
        message: 'Exportacao falhou no Canva',
      })
    }

    await new Promise(resolve => setTimeout(resolve, delayMs))
    attempt++
  }

  throw createError({
    statusCode: 504,
    message: 'Timeout aguardando exportacao do Canva',
  })
})
