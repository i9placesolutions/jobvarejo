import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { Readable } from 'stream'
import { requireAuthenticatedUser } from '../../utils/auth'
import { enforceRateLimit } from '../../utils/rate-limit'
import {
  getProjectOwnerIdFromKey,
  isProjectsKey,
  isValidStoragePath,
  normalizeStoragePath
} from '../../utils/storage-scope'

const TRANSPARENT_PIXEL_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
const TRANSPARENT_PIXEL_PNG = Buffer.from(TRANSPARENT_PIXEL_PNG_BASE64, 'base64')

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
    const requesterIp =
      getRequestIP(event, { xForwardedFor: true }) ||
      event.node.req.socket?.remoteAddress ||
      'unknown'
    enforceRateLimit(event, `storage-proxy:${String(requesterIp)}`, 1800, 60_000)

    const query = getQuery(event)
    const rawKey = String(query.key || '').trim()
    let decodedKey = rawKey
    try {
      decodedKey = decodeURIComponent(rawKey)
    } catch {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid key encoding'
      })
    }
    const key = normalizeStoragePath(decodedKey)
    const requestedBucket = String(query.bucket || '').trim()
    const version = typeof query.v === 'string' && query.v.trim() ? query.v.trim() : null
    if (requestedBucket.length > 120) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid bucket parameter length'
      })
    }
    if (version && version.length > 120) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid version parameter length'
      })
    }

    if (!key) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Key parameter is required'
      })
    }
    if (!isValidStoragePath(key)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid key format'
      })
    }

    // Configurações da Wasabi
    const endpoint = process.env.WASABI_ENDPOINT || 's3.wasabisys.com'
    const region = process.env.WASABI_REGION || 'us-east-1'
    const bucket = process.env.WASABI_BUCKET || 'jobvarejo'
    const accessKey = process.env.WASABI_ACCESS_KEY
    const secretKey = process.env.WASABI_SECRET_KEY
    const isAllowedRequestedBucket =
      !requestedBucket || requestedBucket === bucket
    if (!isAllowedRequestedBucket) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid bucket parameter'
      })
    }

    if (!bucket || !accessKey || !secretKey) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Wasabi Storage not configured'
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

    const baseKeyCandidates = Array.from(new Set([
      key,
      ...(requestedBucket && key.startsWith(`${requestedBucket}/`) ? [key.slice(requestedBucket.length + 1)] : []),
      ...(bucket && key.startsWith(`${bucket}/`) ? [key.slice(bucket.length + 1)] : [])
    ].filter(Boolean)))

    const hasPathPrefix = (candidate: string) => String(candidate || '').includes('/')
    const legacyPrefixCandidates = baseKeyCandidates.flatMap((candidate) => {
      if (!candidate || hasPathPrefix(candidate)) return []
      return [`imagens/${candidate}`, `uploads/${candidate}`, `logo/${candidate}`]
    })

    const keyCandidates = Array.from(new Set([
      ...baseKeyCandidates,
      ...legacyPrefixCandidates
    ].filter(Boolean)))

    const bucketCandidates = Array.from(new Set([
      requestedBucket,
      bucket
    ].filter(Boolean)))

    const hasProjectsKeyTarget = keyCandidates.some((candidate) => isProjectsKey(String(candidate)))
    const requestTargetsJson = keyCandidates.some((candidate) => String(candidate).toLowerCase().endsWith('.json'))
    if (requestTargetsJson || hasProjectsKeyTarget) {
      const user = await requireAuthenticatedUser(event)
      const ownerId = keyCandidates
        .map((candidate) => getProjectOwnerIdFromKey(String(candidate)))
        .find(Boolean)
      if (hasProjectsKeyTarget && (!ownerId || ownerId !== user.id)) {
        throw createError({
          statusCode: 403,
          statusMessage: 'Forbidden key scope'
        })
      }
    }

    const fetchFromWasabi = async () => {
      let lastNotFoundError: any = null
      for (const bucketCandidate of bucketCandidates) {
        for (const keyCandidate of keyCandidates) {
          try {
            const response = await s3Client.send(new GetObjectCommand({
              Bucket: bucketCandidate,
              Key: keyCandidate
            }))
            if (response?.Body) {
              return { response, bucket: bucketCandidate, key: keyCandidate }
            }
          } catch (err: any) {
            if (err?.name === 'NoSuchKey' || err?.$metadata?.httpStatusCode === 404) {
              lastNotFoundError = err
              continue
            }
            throw err
          }
        }
      }
      if (lastNotFoundError) throw lastNotFoundError
      return null
    }

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

    const ext = key.split('.').pop()?.toLowerCase()
    const looksLikeImage =
      ['webp', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'avif'].includes(String(ext || '').toLowerCase()) ||
      key.startsWith('imagens/') ||
      key.startsWith('uploads/') ||
      String(getHeader(event, 'accept') || '').includes('image/')

    let sourceBody: Buffer | null = null
    let resolvedContentType = contentTypes[ext || ''] || 'application/octet-stream'
    let resolvedLength: number | null = null

    try {
      const wasabiObject = await fetchFromWasabi()
      if (wasabiObject?.response?.Body) {
        const stream = wasabiObject.response.Body as Readable
        const chunks: Buffer[] = []
        for await (const chunk of stream) {
          chunks.push(Buffer.from(chunk))
        }
        sourceBody = Buffer.concat(chunks)
        resolvedContentType = wasabiObject.response.ContentType || resolvedContentType
        resolvedLength = Number(wasabiObject.response.ContentLength || 0) || sourceBody.length
      }
    } catch (err: any) {
      if (!(err?.name === 'NoSuchKey' || err?.$metadata?.httpStatusCode === 404)) {
        throw err
      }
    }

    if (!sourceBody) {
      // Missing images should not crash canvas loading. Return a transparent pixel
      // and keep 404 behavior for non-image assets (e.g. JSON payloads).
      if (looksLikeImage) {
        setResponseHeaders(event, {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=60, must-revalidate',
          'Access-Control-Allow-Origin': '*',
          'X-Storage-Miss': '1'
        })
        setResponseHeader(event, 'Content-Length', TRANSPARENT_PIXEL_PNG.length)
        return TRANSPARENT_PIXEL_PNG
      }

      throw createError({
        statusCode: 404,
        statusMessage: 'File not found'
      })
    }
    const contentType = resolvedContentType

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

    if (resolvedLength && resolvedLength > 0) {
      setResponseHeader(event, 'Content-Length', resolvedLength)
    }
    return sourceBody

  } catch (error: any) {
    console.error('❌ Erro no proxy de storage Wasabi:', error)

    if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
      throw createError({
        statusCode: 404,
        statusMessage: 'File not found'
      })
    }
    const statusCode = Number(error?.statusCode || 500) || 500

    throw createError({
      statusCode,
      statusMessage: error?.statusMessage || error?.message || 'Failed to fetch file from Wasabi storage'
    })
  }
})
