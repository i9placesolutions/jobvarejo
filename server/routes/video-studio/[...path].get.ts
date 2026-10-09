import { GetObjectCommand } from '@aws-sdk/client-s3'
import catalogManifest from '~/shared/video-studio/catalog-assets.json'
import { enforceRateLimit } from '~/server/utils/rate-limit'
import { getS3Client } from '~/server/utils/s3'
import { videoBucket } from '~/server/utils/video-studio/service'
import { catalogPreview, CATALOG_PREVIEW_VERSION } from '~/server/utils/video-studio/catalog-preview'
import {
  matchesVideoCatalogEtag,
  normalizeVideoCatalogPath,
  parseVideoCatalogRange,
  shouldHonorVideoCatalogRange,
  resolveVideoCatalogAsset,
  videoCatalogEtag,
  type VideoCatalogManifest
} from '~/server/utils/video-studio/catalog-assets'

const manifest = catalogManifest as VideoCatalogManifest

export default defineEventHandler(async (event) => {
  const requestedPath = String(getRouterParam(event, 'path') || '')
  const preview = requestedPath.startsWith('preview/')
  const path = normalizeVideoCatalogPath(preview ? requestedPath.slice('preview/'.length) : requestedPath)
  if (!path) throw createError({ statusCode: 404, statusMessage: 'Asset de catálogo não encontrado.' })

  await enforceRateLimit(
    event,
    `video-studio-catalog:${getRequestIP(event) || 'unknown'}`,
    1800,
    60_000
  )

  const asset = resolveVideoCatalogAsset(manifest, path)
  if (!asset) throw createError({ statusCode: 404, statusMessage: 'Asset de catálogo não encontrado.' })

  // A prévia tem URL e ETag próprios; o worker/exportação conserva o original.
  if (preview && /^image\/(png|jpeg|webp)$/.test(asset.contentType) && asset.bytes <= 24 * 1024 * 1024) {
    const etag = `"${asset.sha256}-${CATALOG_PREVIEW_VERSION}"`
    setResponseHeaders(event, { 'Cache-Control': 'public, max-age=3600', 'Content-Type': 'image/webp', ETag: etag })
    if (matchesVideoCatalogEtag(getRequestHeader(event, 'if-none-match'), etag)) {
      setResponseStatus(event, 304)
      return null
    }
    try {
      const bytes = await catalogPreview(asset.sha256, async () => {
        const object = await getS3Client().send(new GetObjectCommand({ Bucket: videoBucket(), Key: asset.key }))
        if (!object.Body) throw new Error('Imagem indisponível.')
        return Buffer.from(await object.Body.transformToByteArray())
      })
      setResponseHeader(event, 'Content-Length', bytes.length)
      return bytes
    } catch {
      // Uma imagem incompatível ou cache ocupado continua disponível no original.
      setResponseHeader(event, 'Cache-Control', 'no-store')
      removeResponseHeader(event, 'ETag')
      return sendRedirect(event, `/video-studio/${path}`, 302)
    }
  }

  const etag = videoCatalogEtag(asset.sha256)
  setResponseHeaders(event, {
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=3600',
    'Content-Type': asset.contentType,
    ETag: etag
  })

  if (matchesVideoCatalogEtag(getRequestHeader(event, 'if-none-match'), etag)) {
    setResponseStatus(event, 304)
    return null
  }

  const rangeHeader = getRequestHeader(event, 'range')
  const range = rangeHeader && shouldHonorVideoCatalogRange(getRequestHeader(event, 'if-range'), etag)
    ? parseVideoCatalogRange(rangeHeader, asset.bytes) : null
  if (range === 'invalid') {
    setResponseStatus(event, 416)
    setResponseHeader(event, 'Content-Range', `bytes */${asset.bytes}`)
    return null
  }

  const command = new GetObjectCommand({
    Bucket: videoBucket(),
    Key: asset.key,
    ...(range ? { Range: `bytes=${range.start}-${range.end}` } : {})
  })

  try {
    const result = await getS3Client().send(command)
    if (!result.Body) throw createError({ statusCode: 404, statusMessage: 'Asset de catálogo não encontrado no Wasabi.' })

    if (range) {
      setResponseStatus(event, 206)
      setResponseHeader(event, 'Content-Range', `bytes ${range.start}-${range.end}/${asset.bytes}`)
      setResponseHeader(event, 'Content-Length', range.end - range.start + 1)
    } else {
      setResponseHeader(event, 'Content-Length', asset.bytes)
    }

    return sendStream(event, result.Body.transformToWebStream())
  } catch (error: any) {
    if (error?.statusCode === 404) throw error
    if (error?.name === 'NoSuchKey' || error?.$metadata?.httpStatusCode === 404) {
      throw createError({ statusCode: 404, statusMessage: 'Asset de catálogo não encontrado no Wasabi.' })
    }
    throw createError({ statusCode: 502, statusMessage: 'Não foi possível carregar o asset do catálogo.' })
  }
})
