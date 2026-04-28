// Importa paginas de um design Canva para dentro do editor:
// 1. Aciona export PNG (especifico por paginas, se body.pages presente).
// 2. Faz polling do job ate concluir.
// 3. Para cada URL gerada, baixa o PNG, infere width/height com sharp,
//    deduplica por hash e salva no Wasabi sob "imagens/canva-<hash>.png".
// 4. Retorna o conjunto de paginas com chave Wasabi + URL via storage proxy
//    para o cliente montar paginas FREE_DESIGN no projeto atual.

import { HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { createHash } from 'crypto'
import { requireAuthenticatedUser } from '../../../../../utils/auth'
import { enforceRateLimit } from '../../../../../utils/rate-limit'
import { canvaExportDesign, canvaGetExportJob } from '../../../../../utils/canva-client'
import { getS3Client } from '../../../../../utils/s3'

const POLL_INTERVAL_MS = 2000
const MAX_POLL_ATTEMPTS = 45 // ~90s
const MAX_FETCH_BYTES = 25 * 1024 * 1024 // 25MB por pagina

const downloadAsBuffer = async (url: string): Promise<Buffer> => {
  const response = await fetch(url)
  if (!response.ok) {
    throw createError({
      statusCode: 502,
      statusMessage: `Falha ao baixar pagina exportada do Canva (${response.status})`,
    })
  }
  const contentLength = Number(response.headers.get('content-length') || 0)
  if (contentLength > MAX_FETCH_BYTES) {
    throw createError({ statusCode: 413, statusMessage: 'Pagina exportada excede 25MB' })
  }
  const arrayBuf = await response.arrayBuffer()
  if (arrayBuf.byteLength > MAX_FETCH_BYTES) {
    throw createError({ statusCode: 413, statusMessage: 'Pagina exportada excede 25MB' })
  }
  return Buffer.from(arrayBuf)
}

interface ImportedPage {
  index: number
  key: string
  url: string
  width: number
  height: number
}

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event)
  await enforceRateLimit(event, `editor-canva-import:${user.id}`, 20, 60_000)

  const designId = String(getRouterParam(event, 'id') || '').trim()
  if (!designId) {
    throw createError({ statusCode: 400, statusMessage: 'ID do design e obrigatorio' })
  }

  const body = await readBody(event).catch(() => ({})) || {}
  const requestedPages = Array.isArray(body?.pages)
    ? (body.pages as any[])
        .map((p) => Number(p))
        .filter((p) => Number.isInteger(p) && p >= 1)
    : []

  // Aciona export
  const exportOptions: { type: string; pages?: number[] } = { type: 'png' }
  if (requestedPages.length > 0) exportOptions.pages = requestedPages

  const exportResponse = await canvaExportDesign(designId, exportOptions)
  const jobId = exportResponse.job?.id
  if (!jobId) {
    throw createError({ statusCode: 502, statusMessage: 'Resposta inesperada do Canva (job sem id)' })
  }

  // Polling do job
  let urls: string[] = []
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    const job = await canvaGetExportJob(jobId)
    const status = String(job.job?.status || '').toLowerCase()

    if (status === 'completed' || status === 'success') {
      urls = (job.job?.urls || []).filter((u: any) => typeof u === 'string' && u.length > 0)
      break
    }
    if (status === 'failed') {
      throw createError({ statusCode: 502, statusMessage: 'Exportacao do Canva falhou' })
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
  }

  if (urls.length === 0) {
    throw createError({ statusCode: 504, statusMessage: 'Timeout aguardando exportacao do Canva' })
  }

  // Carrega sharp uma vez para todas as paginas
  let sharp: any = null
  try {
    sharp = (await import('sharp')).default
  } catch (err) {
    console.warn('[canva-import] sharp indisponivel, dimensoes serao 0:', err)
  }

  const config = useRuntimeConfig()
  const bucket = config.wasabiBucket || process.env.WASABI_BUCKET || process.env.NUXT_WASABI_BUCKET || 'jobvarejo'
  const s3 = getS3Client()

  // Mapear urls para os indices de pagina solicitados (na mesma ordem retornada pelo Canva).
  const pageIndices = requestedPages.length > 0
    ? requestedPages.slice(0, urls.length)
    : urls.map((_, idx) => idx + 1)

  const importedPages: ImportedPage[] = []

  for (let i = 0; i < urls.length; i++) {
    const remoteUrl = urls[i]
    const pageIndex = Number(pageIndices[i]) || (i + 1)
    if (!remoteUrl) continue

    let buffer: Buffer
    try {
      buffer = await downloadAsBuffer(remoteUrl)
    } catch (err: any) {
      console.warn(`[canva-import] Falha ao baixar pagina ${pageIndex}:`, err?.message || err)
      continue
    }

    let width = 0
    let height = 0
    if (sharp) {
      try {
        const meta = await sharp(buffer).metadata()
        width = Number(meta.width) || 0
        height = Number(meta.height) || 0
      } catch (err) {
        console.warn(`[canva-import] Falha ao ler metadata da pagina ${pageIndex}:`, err)
      }
    }

    const hash = createHash('sha256').update(buffer).digest('hex').slice(0, 16)
    const key = `imagens/canva-${hash}.png`

    // Dedup: se ja existe no bucket, nao reenvia
    let alreadyExists = false
    try {
      await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
      alreadyExists = true
    } catch {
      alreadyExists = false
    }

    if (!alreadyExists) {
      await s3.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: 'image/png',
        ACL: 'public-read',
      }))
    }

    importedPages.push({
      index: pageIndex,
      key,
      url: `/api/storage/p?key=${encodeURIComponent(key)}`,
      width,
      height,
    })
  }

  if (importedPages.length === 0) {
    throw createError({ statusCode: 502, statusMessage: 'Nenhuma pagina importada do Canva' })
  }

  return { pages: importedPages }
})
