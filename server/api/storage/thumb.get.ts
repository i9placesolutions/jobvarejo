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

const DEFAULT_WIDTH = 400

/**
 * Thumbnail proxy com upscaling via Sharp (Lanczos3 + unsharp masking).
 * Melhora a qualidade de thumbnails de baixa resolução.
 *
 * Usage: GET /api/storage/thumb?key=projects/.../thumb_xxx.png&w=400
 */
export default defineEventHandler(async (event) => {
  try {
    const requesterIp =
      getRequestIP(event, { xForwardedFor: true }) ||
      event.node.req.socket?.remoteAddress ||
      'unknown'
    await enforceRateLimit(event, `storage-thumb:${String(requesterIp)}`, 600, 60_000)

    const query = getQuery(event)
    const rawKey = String(query.key || '').trim()
    const targetWidth = Math.min(Math.max(Number(query.w || DEFAULT_WIDTH) || DEFAULT_WIDTH, 64), 1200)

    let decodedKey = rawKey
    try {
      decodedKey = decodeURIComponent(rawKey)
    } catch {
      throw createError({ statusCode: 400, statusMessage: 'Invalid key encoding' })
    }
    const key = normalizeStoragePath(decodedKey)

    if (!key) throw createError({ statusCode: 400, statusMessage: 'Key parameter is required' })
    if (!isValidStoragePath(key)) throw createError({ statusCode: 400, statusMessage: 'Invalid key format' })

    // Auth for project keys
    if (isProjectsKey(key)) {
      const user = await requireAuthenticatedUser(event)
      const ownerId = getProjectOwnerIdFromKey(key)
      if (!ownerId || ownerId !== user.id) {
        throw createError({ statusCode: 403, statusMessage: 'Forbidden key scope' })
      }
    }

    const endpoint = process.env.WASABI_ENDPOINT || 's3.wasabisys.com'
    const region = process.env.WASABI_REGION || 'us-east-1'
    const bucket = process.env.WASABI_BUCKET || 'jobvarejo'
    const accessKey = process.env.WASABI_ACCESS_KEY
    const secretKey = process.env.WASABI_SECRET_KEY

    if (!bucket || !accessKey || !secretKey) {
      throw createError({ statusCode: 500, statusMessage: 'Storage not configured' })
    }

    const s3Client = new S3Client({
      endpoint: `https://${endpoint}`,
      region,
      credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
      forcePathStyle: true
    })

    // Fetch from Wasabi
    let sourceBody: Buffer | null = null
    const keyCandidates = Array.from(new Set([
      key,
      ...(bucket && key.startsWith(`${bucket}/`) ? [key.slice(bucket.length + 1)] : [])
    ].filter(Boolean)))

    for (const keyCandidate of keyCandidates) {
      try {
        const response = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: keyCandidate }))
        if (response?.Body) {
          const stream = response.Body as Readable
          const chunks: Buffer[] = []
          for await (const chunk of stream) chunks.push(Buffer.from(chunk))
          sourceBody = Buffer.concat(chunks)
          break
        }
      } catch (err: any) {
        if (err?.name === 'NoSuchKey' || err?.$metadata?.httpStatusCode === 404) continue
        throw err
      }
    }

    if (!sourceBody) {
      setResponseHeaders(event, {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=60',
        'Access-Control-Allow-Origin': '*'
      })
      return TRANSPARENT_PIXEL_PNG
    }

    // Try Sharp upscaling
    let outputBuffer = sourceBody
    let outputContentType = 'image/jpeg'
    try {
      const sharp = (await import('sharp')).default
      outputBuffer = await sharp(sourceBody)
        .resize(targetWidth, null, {
          kernel: 'lanczos3',
          withoutEnlargement: false
        })
        .sharpen({ sigma: 0.6, m1: 1.0, m2: 0.5 })
        .jpeg({ quality: 88, mozjpeg: true })
        .toBuffer()
      outputContentType = 'image/jpeg'
    } catch {
      // Sharp not available — return original
      outputContentType = key.endsWith('.png') ? 'image/png' : 'image/jpeg'
      outputBuffer = sourceBody
    }

    setResponseHeaders(event, {
      'Content-Type': outputContentType,
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
      'Access-Control-Allow-Origin': '*',
      'Content-Length': outputBuffer.length
    })
    return outputBuffer

  } catch (error: any) {
    const statusCode = Number(error?.statusCode || 500) || 500
    throw createError({
      statusCode,
      statusMessage: error?.statusMessage || error?.message || 'Failed to process thumbnail'
    })
  }
})
