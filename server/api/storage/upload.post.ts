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
 * Aceita:
 *   - raw body binário (caminho principal para canvas)
 *   - multipart/form-data com campo "file" (compatibilidade)
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

  // Ler body: preferir raw para evitar custo do parser multipart em uploads de canvas.
  let bodyBuffer: Buffer | null = null
  let bodySource: 'raw' | 'multipart' | 'unknown' = 'unknown'

  const reqContentType = String(getHeader(event, 'content-type') || '').toLowerCase()
  const readStartedAt = Date.now()

  if (!reqContentType.includes('multipart/form-data')) {
    try {
      const rawBody = (await readRawBody(event, false)) ?? null
      if (rawBody) {
        bodyBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody as any)
        bodySource = 'raw'
      }
    } catch (readErr: any) {
      console.warn('⚠️ raw body read failed, trying multipart:', readErr?.message)
    }
  }

  if (!bodyBuffer) {
    try {
      const files = await readMultipartFormData(event)
      if (files && files.length > 0 && files[0]?.data) {
        bodyBuffer = Buffer.from(files[0].data)
        bodySource = 'multipart'
      }
    } catch (multipartErr: any) {
      console.error('❌ Erro ao ler body do upload:', multipartErr?.message)
      throw createError({ statusCode: 400, statusMessage: `Failed to read request body: ${multipartErr?.message || 'unknown'}` })
    }
  }

  if (!bodyBuffer || bodyBuffer.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Empty body' })
  }

  const startMs = Date.now()
  console.log(`📤 Upload: key=${key.substring(0, 80)} size=${bodyBuffer.length} bytes contentType=${contentType} body=${bodySource} readMs=${Date.now() - readStartedAt}`)

  const config = useRuntimeConfig()
  const bucket = String(config.wasabiBucket || process.env.WASABI_BUCKET || process.env.NUXT_WASABI_BUCKET || '').trim()
  if (!bucket) {
    throw createError({ statusCode: 500, statusMessage: 'WASABI_BUCKET not configured' })
  }
  const sendPutObject = async () => {
    const s3Client = getS3Client()
    await s3Client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: bodyBuffer,
      ContentType: contentType
    }))
  }

  try {
    await sendPutObject()
  } catch (s3Err: any) {
    let finalError = s3Err
    let recoveredAfterReset = false
    const firstErrMessage = String(s3Err?.message || 'unknown S3 error')
    const shouldResetClient =
      !Number(s3Err?.$metadata?.httpStatusCode || 0) ||
      /timeout|socket|econn|reset|network/i.test(firstErrMessage)
    if (shouldResetClient) {
      resetS3Client()
      try {
        await sendPutObject()
        recoveredAfterReset = true
      } catch (retryErr: any) {
        finalError = retryErr
      }
    }
    if (recoveredAfterReset) {
      const elapsedMs = Date.now() - startMs
      console.warn(`⚠️ Wasabi upload recuperado apos reset do client (${elapsedMs}ms): ${key.substring(0, 80)}`)
      console.log(`✅ Upload OK: key=${key.substring(0, 80)} size=${bodyBuffer.length} elapsed=${elapsedMs}ms`)
      return { key, size: bodyBuffer.length }
    }
    const elapsedMs = Date.now() - startMs
    const errName = finalError?.name || finalError?.constructor?.name || 'Unknown'
    const errMessage = String(finalError?.message || 'unknown S3 error')
    console.error(`❌ Wasabi S3 PutObject failed after ${elapsedMs}ms:`, {
      name: errName,
      message: errMessage,
      code: finalError?.Code || finalError?.$metadata?.httpStatusCode || '',
      statusCode: finalError?.$metadata?.httpStatusCode,
      requestId: finalError?.$metadata?.requestId,
      attempts: finalError?.$metadata?.attempts,
      resetClient: shouldResetClient,
    })
    throw createError({
      statusCode: 502,
      statusMessage: `Wasabi upload failed (${errName}): ${errMessage}`
    })
  }

  const elapsedMs = Date.now() - startMs
  console.log(`✅ Upload OK: key=${key.substring(0, 80)} size=${bodyBuffer.length} elapsed=${elapsedMs}ms`)
  return { key, size: bodyBuffer.length }
})
