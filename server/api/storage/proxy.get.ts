import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { Readable } from 'stream'

/**
 * API Route para servir imagens da Wasabi via proxy
 *
 * Isso evita problemas com CORS e permite cache correto
 *
 * Usage: GET /api/storage/proxy?key=imagens/filename.webp
 * Usage: GET /api/storage/proxy?key=logo/filename.png
 * Usage: GET /api/storage/proxy?key=projects/{userId}/{projectId}/page_{pageId}.json
 */

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const key = query.key as string
    const version = typeof query.v === 'string' && query.v.trim() ? query.v.trim() : null

    if (!key) {
      throw createError({
        status: 400,
        message: 'Key parameter is required'
      })
    }

    // Configurações da Wasabi
    const endpoint = process.env.WASABI_ENDPOINT || 's3.wasabisys.com'
    const region = process.env.WASABI_REGION || 'us-east-1'
    const bucket = process.env.WASABI_BUCKET || 'jobvarejo'
    const accessKey = process.env.WASABI_ACCESS_KEY
    const secretKey = process.env.WASABI_SECRET_KEY

    if (!bucket || !accessKey || !secretKey) {
      throw createError({
        status: 500,
        message: 'Wasabi Storage not configured'
      })
    }

    // Criar cliente S3 para Wasabi
    const s3Client = new S3Client({
      endpoint: `https://${endpoint}`,
      region: region,
      credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey
      },
      forcePathStyle: true
    })

    // Buscar objeto do S3
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key
    })

    const response = await s3Client.send(command)

    if (!response.Body) {
      throw createError({
        status: 404,
        message: 'File not found'
      })
    }

    // Determinar Content-Type baseado na extensão
    const ext = key.split('.').pop()?.toLowerCase()
    const contentTypes: Record<string, string> = {
      'webp': 'image/webp',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'svg': 'image/svg+xml',
      'json': 'application/json',
      'pdf': 'application/pdf'
    }
    const contentType = response.ContentType || contentTypes[ext || ''] || 'application/octet-stream'

    const isJson = (ext || '').toLowerCase() === 'json'
    const cacheControl = isJson
      ? 'no-store'
      : (version ? 'public, max-age=31536000, immutable' : 'public, max-age=60, must-revalidate')

    // Configurar headers de resposta
    setResponseHeaders(event, {
      'Content-Type': contentType,
      'Cache-Control': cacheControl,
      'Access-Control-Allow-Origin': '*'
    })

    if (response.ContentLength) {
      setResponseHeader(event, 'Content-Length', response.ContentLength)
    }

    // Converter ReadableStream do AWS SDK para Buffer
    const stream = response.Body as Readable
    const chunks: Buffer[] = []

    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk))
    }

    return Buffer.concat(chunks)

  } catch (error: any) {
    console.error('❌ Erro no proxy de storage Wasabi:', error)

    if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
      throw createError({
        status: 404,
        message: 'File not found'
      })
    }

    throw createError({
      status: error.statusCode || 500,
      message: error.message || 'Failed to fetch file from Wasabi storage'
    })
  }
})
