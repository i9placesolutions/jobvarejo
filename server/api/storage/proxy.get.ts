import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { Readable } from 'stream'

/**
 * API Route para servir imagens da Contabo via proxy
 * 
 * Isso evita problemas com URLs presignadas e encoding de caracteres especiais
 * no bucket name (ex: tenant:bucket onde : pode ser codificado como %3A)
 * 
 * Usage: GET /api/storage/proxy?key=uploads/filename.webp
 */

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const key = query.key as string
    const bucketParam = query.bucket as string

    if (!key) {
      throw createError({
        status: 400,
        message: 'Key parameter is required'
      })
    }

    // Configurações da Contabo
    const endpoint = process.env.CONTABO_ENDPOINT || 'eu2.contabostorage.com'
    let defaultRegion = 'eu-2'
    if (endpoint.includes('usc1')) defaultRegion = 'us-east-1'
    else if (endpoint.includes('sin1')) defaultRegion = 'ap-southeast-1'
    else if (endpoint.includes('eu2')) defaultRegion = 'eu-2'

    const config = {
      endpoint,
      // Usar bucket do parâmetro ou o bucket principal
      bucket: bucketParam || process.env.CONTABO_BUCKET,
      accessKey: process.env.CONTABO_ACCESS_KEY,
      secretKey: process.env.CONTABO_SECRET_KEY,
      region: process.env.CONTABO_REGION || defaultRegion
    }

    if (!config.bucket || !config.accessKey || !config.secretKey) {
      throw createError({
        status: 500,
        message: 'Contabo Storage not configured'
      })
    }

    // Criar cliente S3
    const s3Client = new S3Client({
      endpoint: `https://${config.endpoint}`,
      region: config.region,
      credentials: {
        accessKeyId: config.accessKey,
        secretAccessKey: config.secretKey
      },
      forcePathStyle: true
    })

    // Buscar objeto do S3
    const command = new GetObjectCommand({
      Bucket: config.bucket,
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

    // Configurar headers de resposta
    setResponseHeaders(event, {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400', // Cache por 1 dia
      'Access-Control-Allow-Origin': '*'
    })

    if (response.ContentLength) {
      setResponseHeader(event, 'Content-Length', response.ContentLength.toString())
    }

    // Converter ReadableStream do AWS SDK para Buffer
    const stream = response.Body as Readable
    const chunks: Buffer[] = []
    
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk))
    }
    
    return Buffer.concat(chunks)

  } catch (error: any) {
    console.error('❌ Erro no proxy de storage:', error)
    
    if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
      throw createError({
        status: 404,
        message: 'File not found'
      })
    }
    
    throw createError({
      status: error.statusCode || 500,
      message: error.message || 'Failed to fetch file from storage'
    })
  }
})
