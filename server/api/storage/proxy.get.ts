import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { Readable } from 'stream'

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
    const query = getQuery(event)
    const rawKey = String(query.key || '').trim()
    const key = decodeURIComponent(rawKey).replace(/^\/+/, '')
    const requestedBucket = String(query.bucket || '').trim()
    const version = typeof query.v === 'string' && query.v.trim() ? query.v.trim() : null

    if (!key) {
      throw createError({
        status: 400,
        message: 'Key parameter is required'
      })
    }

    // Configurações da Wasabi
    const endpoint = process.env.WASABI_ENDPOINT || 's3.wasabisys.com'
    const region = process.env.WASABI_REGION || 'us-east-1'
    const bucket = process.env.WASABI_BUCKET || 'jobvarejo'
    const accessKey = process.env.WASABI_ACCESS_KEY
    const secretKey = process.env.WASABI_SECRET_KEY
    const legacyEndpoint = process.env.CONTABO_ENDPOINT || 'usc1.contabostorage.com'
    const legacyBucket = process.env.CONTABO_BUCKET || ''

    if (!bucket || !accessKey || !secretKey) {
      throw createError({
        status: 500,
        message: 'Wasabi Storage not configured'
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

    const keyCandidates = Array.from(new Set([
      key,
      ...(requestedBucket && key.startsWith(`${requestedBucket}/`) ? [key.slice(requestedBucket.length + 1)] : []),
      ...(bucket && key.startsWith(`${bucket}/`) ? [key.slice(bucket.length + 1)] : [])
    ].filter(Boolean)))

    const bucketCandidates = Array.from(new Set([
      requestedBucket,
      bucket
    ].filter(Boolean)))

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

    const encodeKeyForUrl = (value: string) =>
      value.split('/').map(part => encodeURIComponent(part)).join('/')

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

    // Legacy fallback: if object is not in Wasabi, attempt public fetch from old Contabo bucket.
    if (!sourceBody && looksLikeImage && legacyBucket) {
      const legacyBuckets = Array.from(new Set([requestedBucket, legacyBucket].filter(Boolean)))
      for (const b of legacyBuckets) {
        for (const k of keyCandidates) {
          const legacyUrl = `https://${legacyEndpoint}/${b}/${encodeKeyForUrl(k)}`
          try {
            const legacyResp = await fetch(legacyUrl)
            if (!legacyResp.ok) continue
            const arr = await legacyResp.arrayBuffer()
            const buf = Buffer.from(arr)
            sourceBody = buf
            resolvedContentType = legacyResp.headers.get('content-type') || resolvedContentType
            resolvedLength = Number(legacyResp.headers.get('content-length') || 0) || buf.length
            break
          } catch {
            // keep trying other candidates
          }
        }
        if (sourceBody) break
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
        status: 404,
        message: 'File not found'
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
        status: 404,
        message: 'File not found'
      })
    }

    throw createError({
      status: error.statusCode || 500,
      message: error.message || 'Failed to fetch file from Wasabi storage'
    })
  }
})
