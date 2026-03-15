import { PutObjectCommand } from '@aws-sdk/client-s3'
import { requireAuthenticatedUser } from '../../utils/auth'
import { enforceRateLimit } from '../../utils/rate-limit'
import { getS3Client, resetS3Client } from '../../utils/s3'
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
 * O client envia o body comprimido (gzip) e o servidor faz PUT no S3.
 * Aceita até ~6 MB de payload (canvas JSON comprimido).
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

  // Ler body binário do request
  let body: Buffer | string | null = null
  try {
    body = (await readRawBody(event, false)) ?? null
  } catch (readErr: any) {
    console.error('❌ Erro ao ler body do upload:', readErr?.message)
    throw createError({ statusCode: 400, statusMessage: `Failed to read request body: ${readErr?.message || 'unknown'}` })
  }
  if (!body || (Buffer.isBuffer(body) && body.length === 0)) {
    throw createError({ statusCode: 400, statusMessage: 'Empty body' })
  }

  const bodyBuffer = Buffer.isBuffer(body) ? body : Buffer.from(body as any)
  const startMs = Date.now()
  console.log(`📤 Upload: key=${key.substring(0, 80)} size=${bodyBuffer.length} bytes contentType=${contentType}`)

  // Usar o singleton S3 client (com connection/socket timeouts configurados)
  const s3Client = getS3Client()

  const config = useRuntimeConfig()
  const bucket = String(config.wasabiBucket || process.env.WASABI_BUCKET || process.env.NUXT_WASABI_BUCKET || '').trim()
  if (!bucket) {
    throw createError({ statusCode: 500, statusMessage: 'WASABI_BUCKET not configured' })
  }

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
    const errCode = s3Err?.Code || s3Err?.$metadata?.httpStatusCode || ''
    console.error(`❌ Wasabi S3 PutObject failed after ${elapsedMs}ms:`, {
      name: errName,
      message: s3Err?.message,
      code: errCode,
      statusCode: s3Err?.$metadata?.httpStatusCode,
      requestId: s3Err?.$metadata?.requestId,
      attempts: s3Err?.$metadata?.attempts,
    })
    // Resetar singleton para evitar reutilizar conexões HTTP stale
    resetS3Client()
    throw createError({
      statusCode: 502,
      statusMessage: `Wasabi upload failed (${errName}): ${s3Err?.message || 'unknown S3 error'}`
    })
  }

  const elapsedMs = Date.now() - startMs
  console.log(`✅ Upload OK: key=${key.substring(0, 80)} size=${bodyBuffer.length} elapsed=${elapsedMs}ms`)
  return { key, size: bodyBuffer.length }
})
