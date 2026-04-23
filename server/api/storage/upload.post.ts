import { PutObjectCommand } from '@aws-sdk/client-s3'
import { requireAuthenticatedUser } from '../../utils/auth'
import { enforceRateLimit } from '../../utils/rate-limit'
import { getS3Client, resetS3Client } from '../../utils/s3'
import {
  isBuilderKey,
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

// Limite hard de payload para proteger memoria do Nitro.
// Encartes com muitos frames (~10) e imagens de produto embed chegam a
// ~40 MB comprimidos. 60 MB cobre esses casos sem abrir margem para abuso.
// Acima disso o cliente precisaria usar multipart upload real (S3 MPU).
const MAX_UPLOAD_BYTES = 60 * 1024 * 1024

export default defineEventHandler(async (event) => {
  const routeStartMs = Date.now()
  console.log(`📥 [upload.post] Request START`)

  const user = await requireAuthenticatedUser(event)
  const authMs = Date.now() - routeStartMs
  console.log(`📥 [upload.post] Auth done: ${authMs}ms`)

  await enforceRateLimit(event, `storage-upload:${user.id}`, 120, 60_000)
  const rateLimitMs = Date.now() - routeStartMs - authMs
  console.log(`📥 [upload.post] Rate limit done: ${rateLimitMs}ms`)

  const query = getQuery(event)
  const key = normalizeStoragePath(String(query.key || '').trim())
  const contentType = String(query.contentType || 'application/octet-stream').trim()

  if (!key) {
    throw createError({ statusCode: 400, statusMessage: 'Key is required' })
  }
  if (!isValidStoragePath(key)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid key format' })
  }
  if (isBuilderKey(key)) {
    throw createError({ statusCode: 400, statusMessage: 'Builder keys must use /api/builder/storage/upload' })
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
  console.log(`📥 [upload.post] Reading body, contentType=${reqContentType.substring(0, 50)}`)

  // Rejeita cedo se Content-Length anunciado exceder o limite, antes de bufferizar.
  const declaredLength = Number(getHeader(event, 'content-length') || 0)
  if (Number.isFinite(declaredLength) && declaredLength > MAX_UPLOAD_BYTES) {
    throw createError({
      statusCode: 413,
      statusMessage: `Payload too large (${declaredLength} bytes, max ${MAX_UPLOAD_BYTES})`
    })
  }

  if (!reqContentType.includes('multipart/form-data')) {
    try {
      const rawBodyStart = Date.now()
      const rawBody = (await readRawBody(event, false)) ?? null
      const rawBodyMs = Date.now() - rawBodyStart
      console.log(`📥 [upload.post] readRawBody took ${rawBodyMs}ms`)
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
      const multipartStart = Date.now()
      const files = await readMultipartFormData(event)
      const multipartMs = Date.now() - multipartStart
      console.log(`📥 [upload.post] readMultipartFormData took ${multipartMs}ms`)
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

  // Defesa em profundidade: mesmo sem Content-Length (chunked), rejeita payloads
  // que excedam o limite depois de bufferizados.
  if (bodyBuffer.length > MAX_UPLOAD_BYTES) {
    throw createError({
      statusCode: 413,
      statusMessage: `Payload too large (${bodyBuffer.length} bytes, max ${MAX_UPLOAD_BYTES})`
    })
  }

  const startMs = Date.now()
  const readTotalMs = Date.now() - readStartedAt
  const sizeKB = (bodyBuffer.length / 1024).toFixed(1)
  console.log(`📤 Upload START: key=${key.substring(0, 80)} size=${sizeKB}KB body=${bodySource} readTotalMs=${readTotalMs}`)

  const config = useRuntimeConfig()
  const bucket = String(config.wasabiBucket || process.env.WASABI_BUCKET || process.env.NUXT_WASABI_BUCKET || '').trim()
  if (!bucket) {
    throw createError({ statusCode: 500, statusMessage: 'WASABI_BUCKET not configured' })
  }

  const UPLOAD_TIMEOUT_MS = 90_000 // 90s — Wasabi é mais lenta que AWS S3
  const isProjectJson = isProjectsKey(key) && key.endsWith('.json')
  const isProjectThumbnail = isProjectsKey(key) && /\/thumb_[^/]+\.png$/i.test(key)
  const cacheControl = isProjectJson
    ? 'no-store'
    : (isProjectThumbnail ? 'public, max-age=31536000, immutable' : undefined)

  const sendPutObject = async (attempt: number) => {
    const s3Client = getS3Client()
    const abortController = new AbortController()

    const timeoutId = setTimeout(() => {
      console.warn(`⏰ [upload.post] S3 timeout after ${UPLOAD_TIMEOUT_MS}ms (attempt ${attempt})`)
      abortController.abort()
    }, UPLOAD_TIMEOUT_MS)

    const s3StartMs = Date.now()
    console.log(`📤 [upload.post] Calling S3 PutObject (attempt ${attempt})...`)
    try {
      await s3Client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: bodyBuffer,
        ContentType: contentType,
        ...(cacheControl ? { CacheControl: cacheControl } : {})
      }), {
        abortSignal: abortController.signal
      })
      const s3Elapsed = Date.now() - s3StartMs
      console.log(`📤 [upload.post] S3 PutObject DONE in ${s3Elapsed}ms (attempt ${attempt})`)
    } finally {
      clearTimeout(timeoutId)
    }
  }

  // Tenta até 2x: se a primeira falhar por rede (stale socket), reseta o client e tenta de novo.
  const MAX_ATTEMPTS = 2
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await sendPutObject(attempt)
      break // sucesso
    } catch (s3Err: any) {
      const elapsedMs = Date.now() - startMs
      const errName = s3Err?.name || s3Err?.constructor?.name || 'Unknown'
      const errMessage = String(s3Err?.message || 'unknown S3 error')
      const isNetworkError =
        !Number(s3Err?.$metadata?.httpStatusCode || 0) ||
        /timeout|socket|econn|reset|network/i.test(errMessage) ||
        errName === 'AbortError'

      if (isNetworkError) {
        resetS3Client()
      }

      if (attempt < MAX_ATTEMPTS && isNetworkError) {
        console.warn(`⚠️ [upload.post] Attempt ${attempt} failed (${errName}: ${errMessage}), retrying with fresh client...`)
        continue
      }

      console.error(`❌ Wasabi S3 PutObject failed after ${elapsedMs}ms:`, {
        name: errName,
        message: errMessage,
        code: s3Err?.Code || s3Err?.$metadata?.httpStatusCode || '',
        statusCode: s3Err?.$metadata?.httpStatusCode,
        requestId: s3Err?.$metadata?.requestId,
        resetClient: isNetworkError,
        attempt,
        elapsedMs
      })
      throw createError({
        statusCode: 502,
        statusMessage: `Wasabi upload failed (${errName}): ${errMessage}`
      })
    }
  }

  const elapsedMs = Date.now() - startMs
  const totalMs = Date.now() - routeStartMs
  console.log(`✅ Upload OK: key=${key.substring(0, 80)} size=${bodyBuffer.length} s3Elapsed=${elapsedMs}ms totalRouteMs=${totalMs}ms`)
  return { key, size: bodyBuffer.length }
})
