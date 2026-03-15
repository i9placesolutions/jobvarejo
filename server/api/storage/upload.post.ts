import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { requireAuthenticatedUser } from '../../utils/auth'
import { enforceRateLimit } from '../../utils/rate-limit'
import {
  isProjectsKey,
  isStorageKeyAllowedForUser,
  isUserProjectKey,
  isValidStoragePath,
  normalizeStoragePath
} from '../../utils/storage-scope'

/**
 * API Route para upload direto na Wasabi via servidor (evita CORS).
 *
 * Aceita:
 *   - multipart/form-data com campo "file" (preferido, mais compatível)
 *   - raw body binário (fallback)
 *
 * Query params: key, contentType
 * Aceita até ~12 MB de payload (canvas JSON comprimido).
 */

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event)
  await enforceRateLimit(event, `storage-upload:${user.id}`, 120, 60_000)

  const query = getQuery(event)
  const key = normalizeStoragePath(String(query.key || '').trim())
  const contentType = String(query.contentType || 'application/octet-stream').trim()

  if (!key) {
    throw createError({ statusCode: 400, statusMessage: 'Key is required' })
  }
  if (!isValidStoragePath(key)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid key format' })
  }
  if (isProjectsKey(key) && !isUserProjectKey(key, user.id)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden key scope' })
  }
  if (!isStorageKeyAllowedForUser(key, user.id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid key prefix' })
  }

  // Ler body: tentar multipart primeiro (mais compatível), fallback para raw
  let bodyBuffer: Buffer | null = null

  const reqContentType = String(getHeader(event, 'content-type') || '').toLowerCase()

  if (reqContentType.includes('multipart/form-data')) {
    try {
      const files = await readMultipartFormData(event)
      if (files && files.length > 0 && files[0]?.data) {
        bodyBuffer = Buffer.from(files[0].data)
      }
    } catch (multipartErr: any) {
      console.warn('⚠️ multipart read failed, trying raw body:', multipartErr?.message)
    }
  }

  if (!bodyBuffer) {
    try {
      const rawBody = (await readRawBody(event, false)) ?? null
      if (rawBody) {
        bodyBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody as any)
      }
    } catch (readErr: any) {
      console.error('❌ Erro ao ler body do upload:', readErr?.message)
      throw createError({ statusCode: 400, statusMessage: `Failed to read request body: ${readErr?.message || 'unknown'}` })
    }
  }

  if (!bodyBuffer || bodyBuffer.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Empty body' })
  }

  const startMs = Date.now()
  console.log(`📤 Upload: key=${key.substring(0, 80)} size=${bodyBuffer.length} bytes contentType=${contentType}`)

  // Criar S3 client por request (evita problemas de conexão stale no singleton)
  const config = useRuntimeConfig()
  const endpoint = String(config.wasabiEndpoint || process.env.WASABI_ENDPOINT || process.env.NUXT_WASABI_ENDPOINT || '').trim()
  const region = String(config.wasabiRegion || process.env.WASABI_REGION || process.env.NUXT_WASABI_REGION || 'us-east-1').trim() || 'us-east-1'
  const bucket = String(config.wasabiBucket || process.env.WASABI_BUCKET || process.env.NUXT_WASABI_BUCKET || '').trim()
  const accessKey = String(config.wasabiAccessKey || process.env.WASABI_ACCESS_KEY || process.env.NUXT_WASABI_ACCESS_KEY || '').trim()
  const secretKey = String(config.wasabiSecretKey || process.env.WASABI_SECRET_KEY || process.env.NUXT_WASABI_SECRET_KEY || '').trim()

  if (!endpoint || !bucket || !accessKey || !secretKey) {
    throw createError({ statusCode: 500, statusMessage: 'WASABI_BUCKET not configured' })
  }

  const s3Client = new S3Client({
    endpoint: `https://${endpoint}`,
    region,
    credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
    forcePathStyle: true,
    maxAttempts: 2,
  })

  try {
    await s3Client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: bodyBuffer,
      ContentType: contentType
    }))
  } catch (s3Err: any) {
    const elapsedMs = Date.now() - startMs
    const errName = s3Err?.name || s3Err?.constructor?.name || 'Unknown'
    console.error(`❌ Wasabi S3 PutObject failed after ${elapsedMs}ms:`, {
      name: errName,
      message: s3Err?.message,
      code: s3Err?.Code || s3Err?.$metadata?.httpStatusCode || '',
      statusCode: s3Err?.$metadata?.httpStatusCode,
      requestId: s3Err?.$metadata?.requestId,
      attempts: s3Err?.$metadata?.attempts,
    })
    throw createError({
      statusCode: 502,
      statusMessage: `Wasabi upload failed (${errName}): ${s3Err?.message || 'unknown S3 error'}`
    })
  } finally {
    s3Client.destroy()
  }

  const elapsedMs = Date.now() - startMs
  console.log(`✅ Upload OK: key=${key.substring(0, 80)} size=${bodyBuffer.length} elapsed=${elapsedMs}ms`)
  return { key, size: bodyBuffer.length }
})
