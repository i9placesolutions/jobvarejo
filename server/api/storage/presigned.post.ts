import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { requireAuthenticatedUser } from '../../utils/auth'
import { enforceRateLimit } from '../../utils/rate-limit'
import {
  isPublicStorageKey,
  isProjectsKey,
  isStorageKeyAllowedForUser,
  isUserProjectKey,
  isValidStoragePath,
  normalizeStoragePath
} from '../../utils/storage-scope'

/**
 * API Route para gerar presigned URLs para Wasabi Storage
 *
 * Wasabi Cloud Storage é compatível com AWS S3.
 * Usa presigned URLs para evitar expor credenciais no frontend.
 *
 * Estrutura de pastas:
 * - projects/{userId}/{projectId}/page_{pageId}.json → Canvas JSON
 * - projects/{userId}/{projectId}/thumb_{pageId}.png → Thumbnail
 * - imagens/{filename} → Uploads de imagens
 * - logo/{filename} → Logos de marcas
 */

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuthenticatedUser(event)
    enforceRateLimit(event, `storage-presigned:${user.id}`, 360, 60_000)
    const body = await readBody(event)
    const rawOperation = String(body?.operation || 'put').trim().toLowerCase()
    if (rawOperation !== 'put' && rawOperation !== 'get') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid operation'
      })
    }
    const operation = rawOperation as 'put' | 'get'
    const key = normalizeStoragePath(body?.key)
    const contentTypeRaw = String(body?.contentType || '').trim()
    const contentType = contentTypeRaw || undefined

    if (!key) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Key is required'
      })
    }
    if (!isValidStoragePath(key)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid key format'
      })
    }
    if (isProjectsKey(key) && !isUserProjectKey(key, user.id)) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden key scope'
      })
    }
    if (!isStorageKeyAllowedForUser(key, user.id)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid key prefix'
      })
    }
    if (contentType && operation === 'put') {
      const invalidContentType =
        contentType.length > 120 ||
        /[\u0000-\u001F\u007F]/.test(contentType) ||
        !/^[A-Za-z0-9!#$&^_.+-]+\/[A-Za-z0-9!#$&^_.+-]+(?:\s*;.*)?$/.test(contentType)
      if (invalidContentType) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Invalid contentType'
        })
      }
    }

    const config = useRuntimeConfig()
    const endpoint = String(config.wasabiEndpoint || '').trim()
    const region = String(config.wasabiRegion || 'us-east-1').trim() || 'us-east-1'
    const bucket = String(config.wasabiBucket || '').trim()
    const accessKey = String(config.wasabiAccessKey || '').trim()
    const secretKey = String(config.wasabiSecretKey || '').trim()

    const missing: string[] = []
    if (!endpoint) missing.push('WASABI_ENDPOINT')
    if (!bucket) missing.push('WASABI_BUCKET')
    if (!accessKey) missing.push('WASABI_ACCESS_KEY')
    if (!secretKey) missing.push('WASABI_SECRET_KEY')
    if (missing.length > 0) {
      throw createError({
        statusCode: 500,
        statusMessage: `Wasabi Storage configuration missing (${missing.join(', ')})`
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
      // Wasabi usa path style (igual a Contabo)
      // URL gerada: https://s3.wasabisys.com/bucket/key
      forcePathStyle: true
    })

    // Log para debug (sem expor credenciais)
    console.log('🔍 Wasabi S3 Client config:', {
      endpoint: `https://${endpoint}`,
      bucket: bucket,
      region: region,
      hasCredentials: !!(accessKey && secretKey),
      operation: operation,
      key: key.substring(0, 50) + (key.length > 50 ? '...' : '')
    })

    let command

    if (operation === 'put') {
      const shouldBePublic = isPublicStorageKey(key)
      command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: contentType || 'application/octet-stream',
        ...(shouldBePublic ? { ACL: 'public-read' } : {})
      })
    } else {
      command = new GetObjectCommand({
        Bucket: bucket,
        Key: key
      })
    }

    // Gerar presigned URL válida por 1 hora
    const url = await getSignedUrl(s3Client, command, {
      expiresIn: 3600
    })

    console.log('✅ Presigned URL gerada com sucesso')

    return {
      url,
      bucket: bucket,
      region: region,
      endpoint: endpoint
    }

  } catch (error: any) {
    console.error('❌ Erro ao gerar presigned URL da Wasabi:', error)
    console.error('   Detalhes:', {
      message: error?.message,
      code: error?.code
    })

    // Mensagem mais amigável para o frontend
    let userMessage = 'Failed to generate presigned URL'
    if (error.message?.includes('not configured') || error.message?.includes('missing')) {
      userMessage = 'Wasabi Storage não está configurado. Verifique as variáveis de ambiente no servidor.'
    } else if (error.code === 'InvalidAccessKeyId' || error.code === 'SignatureDoesNotMatch') {
      userMessage = 'Credenciais da Wasabi inválidas. Verifique WASABI_ACCESS_KEY e WASABI_SECRET_KEY.'
    } else if (error.code === 'NoSuchBucket') {
      userMessage = 'Bucket configurado não existe na Wasabi.'
    } else {
      userMessage = error.message || 'Erro desconhecido ao conectar com Wasabi Storage'
    }

    throw createError({
      statusCode: 500,
      statusMessage: userMessage
    })
  }
})
