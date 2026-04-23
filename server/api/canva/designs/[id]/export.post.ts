// Exportar design do Canva em formato especificado
// Suporta exportar apenas paginas especificas via body.pages (array de numeros)

import { canvaExportDesign, canvaGetExportJob } from '../../../../utils/canva-client'
import { resolveCanvaDesignRoute } from '../../../../utils/canva-design-route'

export default defineEventHandler(async (event) => {
  const { canvaDesignId } = await resolveCanvaDesignRoute(event)
  const body = await readBody(event)
  const format = body.format || 'png'
  const pages = body.pages as number[] | undefined // ex: [1, 3] = so paginas 1 e 3

  // Montar opcoes de export incluindo paginas especificas
  const exportOptions: { type: string; pages?: number[]; [key: string]: any } = { type: String(format) }
  if (pages && Array.isArray(pages) && pages.length > 0) {
    exportOptions.pages = pages
  }

  // Iniciar export
  const exportResponse = await canvaExportDesign(canvaDesignId, exportOptions)
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
