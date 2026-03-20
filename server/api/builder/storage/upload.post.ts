import { PutObjectCommand } from '@aws-sdk/client-s3'
import { requireBuilderTenant } from '../../../utils/builder-auth'
import { enforceRateLimit } from '../../../utils/rate-limit'
import { getS3Client, resetS3Client } from '../../../utils/s3'
import {
  isBuilderKey,
  isBuilderTenantKey,
  isValidStoragePath,
  normalizeStoragePath
} from '../../../utils/storage-scope'

/**
 * Upload de arquivos do builder (logo, produtos, snapshots).
 * Aceita raw body ou multipart/form-data.
 * Todas as keys devem começar com builder/{tenantId}/
 */
export default defineEventHandler(async (event) => {
  const tenant = await requireBuilderTenant(event)
  await enforceRateLimit(event, `builder-upload:${tenant.id}`, 60, 60_000)

  const query = getQuery(event)
  const key = normalizeStoragePath(String(query.key || '').trim())
  const contentType = String(query.contentType || 'application/octet-stream').trim()

  if (!key) {
    throw createError({ statusCode: 400, statusMessage: 'Key is required' })
  }
  if (!isValidStoragePath(key)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid key format' })
  }
  if (!isBuilderKey(key)) {
    throw createError({ statusCode: 400, statusMessage: 'Key must start with builder/' })
  }
  if (!isBuilderTenantKey(key, tenant.id)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden key scope' })
  }

  // Read body
  let bodyBuffer: Buffer | null = null
  const reqContentType = String(getHeader(event, 'content-type') || '').toLowerCase()

  if (!reqContentType.includes('multipart/form-data')) {
    try {
      const rawBody = (await readRawBody(event, false)) ?? null
      if (rawBody) {
        bodyBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody as any)
      }
    } catch {
      // fallback to multipart
    }
  }

  if (!bodyBuffer) {
    try {
      const files = await readMultipartFormData(event)
      if (files && files.length > 0 && files[0]?.data) {
        bodyBuffer = Buffer.from(files[0].data)
      }
    } catch (err: any) {
      throw createError({ statusCode: 400, statusMessage: `Failed to read body: ${err?.message || 'unknown'}` })
    }
  }

  if (!bodyBuffer || bodyBuffer.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Empty body' })
  }

  // Max 5MB for builder uploads
  if (bodyBuffer.length > 5 * 1024 * 1024) {
    throw createError({ statusCode: 413, statusMessage: 'File too large (max 5MB)' })
  }

  const config = useRuntimeConfig()
  const bucket = String(config.wasabiBucket || process.env.WASABI_BUCKET || process.env.NUXT_WASABI_BUCKET || '').trim()
  if (!bucket) {
    throw createError({ statusCode: 500, statusMessage: 'WASABI_BUCKET not configured' })
  }

  const UPLOAD_TIMEOUT_MS = 60_000

  const sendPutObject = async (attempt: number) => {
    const s3Client = getS3Client()
    const abortController = new AbortController()
    const timeoutId = setTimeout(() => abortController.abort(), UPLOAD_TIMEOUT_MS)
    try {
      await s3Client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: bodyBuffer,
        ContentType: contentType
      }), { abortSignal: abortController.signal })
    } finally {
      clearTimeout(timeoutId)
    }
  }

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      await sendPutObject(attempt)
      break
    } catch (s3Err: any) {
      const errMessage = String(s3Err?.message || '')
      const isNetworkError = /timeout|socket|econn|reset|network/i.test(errMessage) || s3Err?.name === 'AbortError'
      if (isNetworkError) resetS3Client()
      if (attempt < 2 && isNetworkError) continue
      throw createError({
        statusCode: 502,
        statusMessage: `Upload failed: ${s3Err?.name || 'Unknown'}: ${errMessage}`
      })
    }
  }

  return { key, size: bodyBuffer.length }
})
