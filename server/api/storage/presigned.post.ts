import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

/**
 * API Route para gerar presigned URLs para Contabo Storage
 *
 * Contabo Object Storage é compatível com AWS S3.
 * Usa presigned URLs para evitar expor credenciais no frontend.
 */

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { key, contentType, operation = 'put' } = body

    if (!key) {
      throw createError({
        status: 400,
        message: 'Key is required'
      })
    }

    // Configurações da Contabo (variáveis de ambiente)
    const config = {
      endpoint: process.env.CONTABO_ENDPOINT || 'eu2.contabostorage.com',
      bucket: process.env.CONTABO_BUCKET,
      accessKey: process.env.CONTABO_ACCESS_KEY,
      secretKey: process.env.CONTABO_SECRET_KEY,
      region: process.env.CONTABO_REGION || 'eu-2'
    }

    if (!config.bucket || !config.accessKey || !config.secretKey) {
      throw createError({
        status: 500,
        message: 'Contabo Storage not configured. Check environment variables.'
      })
    }

    // Criar cliente S3 para Contabo
    const s3Client = new S3Client({
      endpoint: `https://${config.endpoint}`,
      region: config.region,
      credentials: {
        accessKeyId: config.accessKey,
        secretAccessKey: config.secretKey
      },
      // Importante: Contabo usa path style, não virtual host
      // URL gerada: https://endpoint/bucket/key
      forcePathStyle: true
    })

    let command

    if (operation === 'put') {
      command = new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        ContentType: contentType || 'application/octet-stream'
      })
    } else {
      command = new GetObjectCommand({
        Bucket: config.bucket,
        Key: key
      })
    }

    // Gerar presigned URL válida por 1 hora
    const url = await getSignedUrl(s3Client, command, {
      expiresIn: 3600
    })

    return {
      url,
      bucket: config.bucket,
      region: config.region
    }

  } catch (error: any) {
    console.error('Error generating presigned URL:', error)
    throw createError({
      status: 500,
      message: error.message || 'Failed to generate presigned URL'
    })
  }
})
