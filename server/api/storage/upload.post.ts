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
  const body = await readRawBody(event, false)
  if (!body || (Buffer.isBuffer(body) && body.length === 0)) {
    throw createError({ statusCode: 400, statusMessage: 'Empty body' })
  }

  const config = useRuntimeConfig()
  const endpoint = String(config.wasabiEndpoint || process.env.WASABI_ENDPOINT || process.env.NUXT_WASABI_ENDPOINT || '').trim()
  const region = String(config.wasabiRegion || process.env.WASABI_REGION || process.env.NUXT_WASABI_REGION || 'us-east-1').trim() || 'us-east-1'
  const bucket = String(config.wasabiBucket || process.env.WASABI_BUCKET || process.env.NUXT_WASABI_BUCKET || '').trim()
  const accessKey = String(config.wasabiAccessKey || process.env.WASABI_ACCESS_KEY || process.env.NUXT_WASABI_ACCESS_KEY || '').trim()
  const secretKey = String(config.wasabiSecretKey || process.env.WASABI_SECRET_KEY || process.env.NUXT_WASABI_SECRET_KEY || '').trim()

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

  const s3Client = new S3Client({
    endpoint: `https://${endpoint}`,
    region,
    credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
    forcePathStyle: true
  })

  const bodyBuffer = Buffer.isBuffer(body) ? body : Buffer.from(body as any)

  await s3Client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: bodyBuffer,
    ContentType: contentType
  }))

  return { key, size: bodyBuffer.length }
})
