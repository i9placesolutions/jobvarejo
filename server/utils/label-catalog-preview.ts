import { createHash } from 'node:crypto'
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { getCatalogPreviewRendererPolicy, renderCatalogPreview, runCatalogPreviewTask } from './catalog-preview-renderer'
import { pgOneOrNull } from './postgres'
import { getS3Client } from './s3'

const LABEL_PREVIEW_WIDTH = 320
const LABEL_PREVIEW_HEIGHT = 160
const LABEL_PREVIEW_POLICY = 'native-label-webp-v1'
const LABEL_PREVIEW_CROPPED_POLICY = 'native-label-cropped-webp-v1'
const SIGNED_URL_TTL_SECONDS = 600
const HEAD_CACHE_MAX_ENTRIES = 256
const HEAD_CACHE_TTL_MS = 30_000

type LabelSource = {
  [key: string]: any
  id: string
  public_id: string
  user_id: string | null
  kind: string
  group: any
}

type HeadCacheEntry = { revision: string; expiresAt: number }
const headCache = new Map<string, HeadCacheEntry>()
const headChecksInFlight = new Map<string, Promise<boolean>>()

const bucketName = (): string => {
  const config = useRuntimeConfig()
  return String(config.wasabiBucket || process.env.WASABI_BUCKET || process.env.NUXT_WASABI_BUCKET || 'jobvarejo')
}

export const getAuthorizedLabelPreviewSource = async (
  requesterId: string,
  templateId: string
): Promise<LabelSource | null> => {
  try {
    return await pgOneOrNull<LabelSource>(
      `select id,
              coalesce(template_key, id) as public_id,
              user_id,
              kind,
              "group"
       from public.label_templates
       where coalesce(template_key, id) = $2
         and (user_id = $1 or user_id is null)
       order by case when user_id = $1 then 0 else 1 end, updated_at desc
       limit 1`,
      [requesterId, templateId]
    )
  } catch (error: any) {
    const missingScope = String(error?.code || '') === '42703' &&
      String(error?.message || '').toLowerCase().includes('template_key')
    if (!missingScope) throw error

    const legacy = await pgOneOrNull<any>(
      `select id, id as public_id, user_id, kind, "group"
       from public.label_templates
       where id = $2
         and (user_id = $1 or user_id is null)
       order by case when user_id = $1 then 0 else 1 end, updated_at desc
       limit 1`,
      [requesterId, templateId]
    )
    return legacy ? { ...legacy, public_id: String(legacy.public_id || legacy.id) } as LabelSource : null
  }
}

export const getLabelPreviewRevision = (source: LabelSource, cropAlpha = false): string => createHash('sha256')
  .update(JSON.stringify({
    policy: cropAlpha ? LABEL_PREVIEW_CROPPED_POLICY : LABEL_PREVIEW_POLICY,
    rendererPolicy: getCatalogPreviewRendererPolicy(),
    id: source.public_id,
    sourceOwnerId: source.user_id,
    kind: source.kind,
    width: LABEL_PREVIEW_WIDTH,
    height: LABEL_PREVIEW_HEIGHT,
    group: source.group
  }))
  .digest('hex')

const safePathId = (id: string): string => /^[A-Za-z0-9_-]{1,160}$/.test(id)
  ? id
  : createHash('sha256').update(id).digest('hex')

const getLabelPreviewObjectKey = (requesterId: string, templateId: string, revision: string): string =>
  `projects/${requesterId}/catalog-previews/labels/${safePathId(templateId)}/${revision}.webp`

export const getLabelPreviewMetadataUrl = (templateId: string, revision: string): string =>
  `/api/label-templates/${encodeURIComponent(templateId)}/preview?revision=${encodeURIComponent(revision)}`

const readHeadCache = (cacheKey: string, revision: string): boolean => {
  const entry = headCache.get(cacheKey)
  if (!entry || entry.expiresAt <= Date.now() || entry.revision !== revision) {
    headCache.delete(cacheKey)
    return false
  }
  headCache.delete(cacheKey)
  headCache.set(cacheKey, entry)
  return true
}

const writeHeadCache = (cacheKey: string, revision: string): void => {
  headCache.delete(cacheKey)
  while (headCache.size >= HEAD_CACHE_MAX_ENTRIES) {
    const oldest = headCache.keys().next().value
    if (oldest === undefined) break
    headCache.delete(oldest)
  }
  headCache.set(cacheKey, { revision, expiresAt: Date.now() + HEAD_CACHE_TTL_MS })
}

const isObjectNotFound = (error: any): boolean =>
  Number(error?.$metadata?.httpStatusCode || error?.statusCode || 0) === 404 ||
  ['NotFound', 'NoSuchKey', 'NoSuchObject'].includes(String(error?.name || error?.Code || ''))

const hasPersistedPreview = async (bucket: string, key: string, revision: string): Promise<boolean> => {
  const cacheKey = `${bucket}:${key}`
  if (readHeadCache(cacheKey, revision)) return true
  const existing = headChecksInFlight.get(cacheKey)
  if (existing) return existing

  const check = (async () => {
    try {
      const head = await getS3Client().send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
      if (head.Metadata?.revision !== revision || Number(head.ContentLength || 0) <= 0) {
        throw createError({ statusCode: 502, statusMessage: 'A prévia persistida não passou na validação.' })
      }
      writeHeadCache(cacheKey, revision)
      return true
    } catch (error: any) {
      if (isObjectNotFound(error)) return false
      throw error
    }
  })()
  // If the bounded map is full, the check still runs but is not retained.
  const canTrack = headChecksInFlight.size < HEAD_CACHE_MAX_ENTRIES
  if (canTrack) headChecksInFlight.set(cacheKey, check)
  try {
    return await check
  } finally {
    if (canTrack && headChecksInFlight.get(cacheKey) === check) headChecksInFlight.delete(cacheKey)
  }
}

const createSignedPreviewUrl = (bucket: string, key: string): Promise<string> => getSignedUrl(
  getS3Client(),
  new GetObjectCommand({ Bucket: bucket, Key: key }),
  { expiresIn: SIGNED_URL_TTL_SECONDS }
)

export type LabelPreviewResult = { url: string; revision: string }

/** Gera sob demanda e persiste em S3 privado; a URL assinada só é emitida após autorização. */
export const ensureLabelCatalogPreview = async (
  requesterId: string,
  templateId: string,
  cropAlpha = false
): Promise<LabelPreviewResult> => {
  const source = await getAuthorizedLabelPreviewSource(requesterId, templateId)
  if (!source) throw createError({ statusCode: 404, statusMessage: 'Etiqueta não encontrada.' })

  const revision = getLabelPreviewRevision(source, cropAlpha)
  const bucket = bucketName()
  const key = getLabelPreviewObjectKey(requesterId, source.public_id, revision)
  const objectCacheKey = `${bucket}:${key}`

  // Ready objects bypass the renderer queue entirely. The queue has one native
  // canvas worker, so cache hits must not wait behind unrelated cache misses.
  if (await hasPersistedPreview(bucket, key, revision)) {
    const current = await getAuthorizedLabelPreviewSource(requesterId, templateId)
    if (!current) throw createError({ statusCode: 404, statusMessage: 'Etiqueta não encontrada.' })
    if (getLabelPreviewRevision(current, cropAlpha) !== revision) {
      throw createError({ statusCode: 409, statusMessage: 'A etiqueta foi alterada durante a prévia. Tente novamente.' })
    }
    return { url: await createSignedPreviewUrl(bucket, key), revision }
  }

  return runCatalogPreviewTask(`label:${objectCacheKey}`, async () => {
    // Revalidate ownership and the canonical source after waiting for the queue.
    const current = await getAuthorizedLabelPreviewSource(requesterId, templateId)
    if (!current) throw createError({ statusCode: 404, statusMessage: 'Etiqueta não encontrada.' })
    const currentRevision = getLabelPreviewRevision(current, cropAlpha)
    if (currentRevision !== revision) {
      throw createError({ statusCode: 409, statusMessage: 'A etiqueta foi alterada durante a geração da prévia. Tente novamente.' })
    }

    const s3 = getS3Client()
    if (await hasPersistedPreview(bucket, key, revision)) {
      return { url: await createSignedPreviewUrl(bucket, key), revision }
    }

    const renderedBytes = await renderCatalogPreview({
      canvasJson: current.group,
      width: LABEL_PREVIEW_WIDTH,
      height: LABEL_PREVIEW_HEIGHT,
      sourceOwnerId: current.user_id,
      kind: 'label'
    })
    if (!Buffer.isBuffer(renderedBytes) || renderedBytes.length === 0) {
      throw createError({ statusCode: 422, statusMessage: 'Não foi possível renderizar a prévia da etiqueta.' })
    }
    const bytes = cropAlpha
      ? await (await import('sharp')).default(renderedBytes).trim({ threshold: 8 }).webp().toBuffer()
      : renderedBytes
    const sha256 = createHash('sha256').update(bytes).digest('hex')
    await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: bytes,
      ContentType: 'image/webp',
      ContentMD5: createHash('md5').update(bytes).digest('base64'),
      Metadata: { revision, sha256 }
    }))

    const readback = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
    if (
      Number(readback.ContentLength || 0) !== bytes.length ||
      readback.Metadata?.revision !== revision ||
      readback.Metadata?.sha256 !== sha256
    ) {
      throw createError({ statusCode: 502, statusMessage: 'A prévia não foi confirmada no armazenamento.' })
    }
    writeHeadCache(objectCacheKey, revision)

    return {
      url: await createSignedPreviewUrl(bucket, key),
      revision
    }
  })
}
