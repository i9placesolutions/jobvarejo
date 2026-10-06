import { createHash } from 'node:crypto'
import { assertFlyerGallerySourceKey } from '~/scripts/lib/flyer-gallery-source-policy.mjs'
import { prepareNeutralFlyerCanvas, removeFlyerAccountContacts } from '../../utils/flyerGalleryPreview'
import { extractStorageKeyFromRef } from '../../utils/storageRef'
import videoCatalogManifest from '../../shared/video-studio/catalog-assets.json'
import { resolveVideoCatalogAsset, type VideoCatalogManifest } from './video-studio/catalog-assets'
import { getS3Client } from './s3'
import { drawCatalogPreviewIsolated } from './catalog-preview-pool'

export type CatalogPreviewKind = 'flyer' | 'label'

type RenderCatalogPreviewOptions = {
  canvasJson: any
  width: number
  height: number
  sourceOwnerId: string | null
  kind: CatalogPreviewKind
  personalize?: boolean
  /** Only true for a DB-loaded canvas on an authorized admin library template. */
  trustedTemplateAssets?: boolean
}

const MAX_CANVAS_JSON_BYTES = 12 * 1024 * 1024
const MAX_SOURCE_IMAGE_BYTES = 8 * 1024 * 1024
const MAX_TOTAL_SOURCE_IMAGE_BYTES = 32 * 1024 * 1024
const MAX_SOURCE_IMAGES = 64
const MAX_FABRIC_NODES = 3000
const MAX_FABRIC_DEPTH = 32
const MAX_IMAGE_PIXELS = 24_000_000
const MAX_TOTAL_SOURCE_PIXELS = 48_000_000
const MAX_PAGE_DIMENSION = 8000
const MAX_S3_SOURCE_READ_MS = 12_000
const MAX_SOURCE_PREPARATION_MS = 30_000
const MAX_ALLOWED_IMAGE_FORMATS = new Set(['png', 'jpeg', 'webp', 'avif', 'gif'])
const RENDERER_POLICY = 'catalog-preview-v1'
const typedVideoCatalogManifest = videoCatalogManifest as VideoCatalogManifest

let activeTasks = 0
const queuedTasks: Array<{ start: () => void }> = []
const taskPromises = new Map<string, Promise<unknown>>()
const MAX_QUEUED_TASKS = 24
const MAX_SINGLEFLIGHT_TASKS = 128
// Uma prévia por vez fazia a galeria esperar em fila; 2 equilibra tempo e memória.
// CATALOG_PREVIEW_CONCURRENCY permite ajustar por ambiente (1 a 4).
const MAX_ACTIVE_TASKS = Math.min(4, Math.max(1, Math.trunc(Number(process.env.CATALOG_PREVIEW_CONCURRENCY) || 2)))
// PNG 1×1 transparente: ocupa o lugar de uma imagem que não pôde ser carregada.
const TRANSPARENT_PIXEL_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

const pumpQueue = (): void => {
  while (activeTasks < MAX_ACTIVE_TASKS && queuedTasks.length) {
    const next = queuedTasks.shift()
    next?.start()
  }
}

/** Shares and bounds all catalog work, including source reads and S3 writes. */
export const runCatalogPreviewTask = <T>(cacheKey: string, task: () => Promise<T>): Promise<T> => {
  const key = String(cacheKey || '').trim()
  if (!key || key.length > 500) return Promise.reject(new Error('Chave de prévia inválida.'))
  const existing = taskPromises.get(key)
  if (existing) return existing as Promise<T>
  if (queuedTasks.length >= MAX_QUEUED_TASKS || taskPromises.size >= MAX_SINGLEFLIGHT_TASKS) {
    return Promise.reject(new Error('A fila de prévias do catálogo está cheia.'))
  }

  const promise = new Promise<T>((resolveTask, rejectTask) => {
    const start = () => {
      activeTasks += 1
      void Promise.resolve().then(task).then(resolveTask, rejectTask).finally(() => {
        activeTasks = Math.max(0, activeTasks - 1)
        taskPromises.delete(key)
        pumpQueue()
      })
    }
    queuedTasks.push({ start })
    pumpQueue()
  })
  taskPromises.set(key, promise)
  return promise
}

export const resolveCatalogStorageKey = (source: string, sourceOwnerId: string | null, kind: CatalogPreviewKind, trustedTemplateAssets = false): string => {
  const raw = String(source || '').trim()
  const config = useRuntimeConfig()
  let candidate: string | null = null

  if (/^(?:imagens|uploads|logo|projects|templates|video-studio\/catalog)\//.test(raw)) {
    candidate = raw
  } else if (raw.startsWith('/')) {
    let local: URL
    try { local = new URL(raw, 'http://local') } catch { throw new Error('Referência de imagem inválida.') }
    if (local.origin !== 'http://local') throw new Error('Origem externa não permitida.')
    if (!['/api/storage', '/api/storage/', '/api/storage/p', '/api/storage/proxy', '/p', '/proxy', '/projects'].includes(local.pathname)) {
      throw new Error('Origem externa não permitida.')
    }
    candidate = extractStorageKeyFromRef(raw, { bucket: String(config.wasabiBucket || ''), endpoint: String(config.wasabiEndpoint || '') })
      || local.searchParams.get('key')
  } else if (/^https?:\/\//i.test(raw)) {
    let parsed: URL
    try { parsed = new URL(raw) } catch { throw new Error('Referência de imagem inválida.') }
    const endpoint = String(config.wasabiEndpoint || '').replace(/^https?:\/\//i, '').replace(/\/$/, '').toLowerCase()
    const hostname = parsed.hostname.toLowerCase()
    const trustedHost = hostname === endpoint || hostname.endsWith(`.${endpoint}`)
    if (parsed.protocol !== 'https:' || !trustedHost || parsed.username || parsed.password || (parsed.port && parsed.port !== '443')) {
      throw new Error('Origem externa não permitida.')
    }
    candidate = extractStorageKeyFromRef(raw, { bucket: String(config.wasabiBucket || ''), endpoint })
  } else if (!raw.includes('://')) {
    // Legacy UUID-prefixed owner keys are accepted by the same exact owner policy below.
    candidate = raw
  }

  if (!candidate) throw new Error('Referência de imagem inválida.')
  const normalized = candidate.replace(/^\/+/, '')
  if (normalized.startsWith('video-studio/catalog/')) {
    const manifestKey = Object.entries(typedVideoCatalogManifest.assets).find(([, asset]) => asset.key === normalized)?.[0]
    const asset = manifestKey ? resolveVideoCatalogAsset(typedVideoCatalogManifest, manifestKey) : null
    if (!asset || asset.key !== normalized || !asset.contentType.startsWith('image/')) {
      throw createError({ statusCode: 403, statusMessage: 'A fonte da prévia está fora do escopo permitido.' })
    }
    return normalized
  }
  if (trustedTemplateAssets && normalized.startsWith('templates/')) return normalized
  try {
    return assertFlyerGallerySourceKey(normalized, sourceOwnerId || '')
  } catch {
    throw createError({ statusCode: 403, statusMessage: 'A fonte da prévia está fora do escopo permitido.' })
  }
}

const readStorageImage = async (key: string, reserveBytes?: (count: number) => void, deadlineAt?: number): Promise<Buffer> => {
  const config = useRuntimeConfig()
  const bucket = String(config.wasabiBucket || '').trim()
  if (!bucket) throw new Error('Wasabi Storage configuration missing (WASABI_BUCKET).')
  const controller = new AbortController()
  const remainingMs = deadlineAt ? deadlineAt - Date.now() : MAX_S3_SOURCE_READ_MS
  if (remainingMs <= 0) throw new Error('A preparação das imagens da prévia excedeu o prazo permitido.')
  const timeout = setTimeout(() => controller.abort(), Math.min(MAX_S3_SOURCE_READ_MS, remainingMs))
  try {
    const response = await getS3Client().send(
      new (await import('@aws-sdk/client-s3')).GetObjectCommand({ Bucket: bucket, Key: key }),
      { abortSignal: controller.signal }
    )
    const contentLength = Number(response.ContentLength || 0)
    if (!response.Body || contentLength > MAX_SOURCE_IMAGE_BYTES) {
      throw new Error('Imagem de origem excede o limite permitido.')
    }
    if (contentLength > 0) reserveBytes?.(contentLength)
    const bytes = Buffer.from(await response.Body.transformToByteArray())
    if (!bytes.length || bytes.length > MAX_SOURCE_IMAGE_BYTES) throw new Error('Imagem de origem excede o limite permitido.')
    if (!contentLength) reserveBytes?.(bytes.length)
    return bytes
  } finally {
    clearTimeout(timeout)
  }
}

const videoAssetForStorageKey = (key: string) => {
  const match = Object.entries(typedVideoCatalogManifest.assets).find(([, asset]) => asset.key === key)
  if (!match) return null
  const [catalogPath, asset] = match
  const resolved = resolveVideoCatalogAsset(typedVideoCatalogManifest, catalogPath)
  if (!resolved || resolved.key !== key || !resolved.contentType.startsWith('image/')) return null
  return resolved
}

const decodeDataImage = (source: string): Buffer => {
  const match = source.match(/^data:image\/(png|jpeg|webp|avif|gif);base64,([a-z\d+/]+=*)$/i)
  if (!match || match[2]!.length > Math.ceil(MAX_SOURCE_IMAGE_BYTES * 4 / 3)) {
    throw new Error('Somente imagens raster data:image dentro do limite são permitidas.')
  }
  const bytes = Buffer.from(match[2]!, 'base64')
  if (!bytes.length || bytes.length > MAX_SOURCE_IMAGE_BYTES) throw new Error('Imagem de origem excede o limite permitido.')
  return bytes
}

export const normalizeCatalogImageSource = async (
  source: string,
  ownerId: string | null,
  kind: CatalogPreviewKind = 'flyer',
  reserveBytes?: (count: number) => void,
  trustedTemplateAssets = false,
  deadlineAt?: number
): Promise<{ dataUrl: string; inputBytes: number; width: number; height: number }> => {
  const { default: sharp } = await import('sharp')
  let input: Buffer
  if (source.startsWith('data:')) {
    input = decodeDataImage(source)
  } else {
    const key = resolveCatalogStorageKey(source, ownerId, kind, trustedTemplateAssets)
    const videoAsset = key.startsWith('video-studio/catalog/') ? videoAssetForStorageKey(key) : null
    if (key.startsWith('video-studio/catalog/') && !videoAsset) {
      throw createError({ statusCode: 403, statusMessage: 'A fonte da prévia está fora do escopo permitido.' })
    }
    input = await readStorageImage(key, reserveBytes, deadlineAt)
    if (videoAsset && (input.length !== videoAsset.bytes || createHash('sha256').update(input).digest('hex') !== videoAsset.sha256)) {
      throw new Error('A fonte de catálogo de vídeo não passou pela validação de integridade.')
    }
  }
  if (source.startsWith('data:')) reserveBytes?.(input.length)
  const image = sharp(input, { limitInputPixels: MAX_IMAGE_PIXELS, animated: false })
  const metadata = await image.metadata()
  if (!metadata.format || !MAX_ALLOWED_IMAGE_FORMATS.has(metadata.format) || !metadata.width || !metadata.height || metadata.width * metadata.height > MAX_IMAGE_PIXELS) {
    throw new Error('Formato ou dimensões da imagem não permitidos para a prévia.')
  }
  // Keep this lossless for canvases that use alpha; level 1 can expand valid
  // source PNGs past the per-image cap even when a normal PNG encoding fits.
  const png = await image.png({ compressionLevel: 6 }).toBuffer()
  if (png.length > MAX_SOURCE_IMAGE_BYTES) throw new Error('Imagem convertida excede o limite permitido.')
  // Bound retained normalized data URLs as well as original source bytes.
  reserveBytes?.(png.length)
  return {
    dataUrl: `data:image/png;base64,${png.toString('base64')}`,
    inputBytes: input.length,
    width: metadata.width,
    height: metadata.height
  }
}

const prepareCanvasImages = async (canvas: any, sourceOwnerId: string | null, kind: CatalogPreviewKind, trustedTemplateAssets: boolean): Promise<void> => {
  const seen = new WeakSet<object>()
  const sources: Array<{ node: any; property: 'src' | 'source'; source: string }> = []
  const preparationDeadlineAt = Date.now() + MAX_SOURCE_PREPARATION_MS
  const pending: Array<{ node: any; depth: number }> = [{ node: canvas, depth: 0 }]
  let objectCount = 0
  while (pending.length) {
    const { node, depth } = pending.pop()!
    if (!node || typeof node !== 'object' || seen.has(node)) continue
    if (depth > MAX_FABRIC_DEPTH || ++objectCount > MAX_FABRIC_NODES) throw new Error('O canvas excede o limite de objetos da prévia.')
    seen.add(node)
    const type = String(node.type || '').toLowerCase()
    if (type === 'image' && typeof node.src === 'string' && node.src.trim()) sources.push({ node, property: 'src', source: node.src.trim() })
    if (type === 'pattern' && node.source != null) {
      if (typeof node.source !== 'string') throw new Error('Fonte de padrão não suportada para a prévia.')
      if (node.source.trim()) sources.push({ node, property: 'source', source: node.source.trim() })
    }
    for (const value of Object.values(node)) {
      if (!value || typeof value !== 'object') continue
      if (Array.isArray(value)) value.forEach(child => pending.push({ node: child, depth: depth + 1 }))
      else pending.push({ node: value, depth: depth + 1 })
    }
  }
  if (sources.length > MAX_SOURCE_IMAGES) throw new Error('O canvas excede o limite de imagens da prévia.')
  let totalBytes = 0
  let totalPixels = 0
  let embeddedBytesEstimate = 0
  const reserveBytes = (count: number) => {
    if (totalBytes + count > MAX_TOTAL_SOURCE_IMAGE_BYTES) throw new Error('O canvas excede o limite total de imagens.')
    totalBytes += count
  }
  const reservePixels = (count: number) => {
    if (totalPixels + count > MAX_TOTAL_SOURCE_PIXELS) throw new Error('O canvas excede o limite total de pixels de origem.')
    totalPixels += count
  }
  const grouped = new Map<string, Array<{ node: any; property: 'src' | 'source'; source: string }>>()
  for (const item of sources) {
    const items = grouped.get(item.source) || []
    items.push(item)
    grouped.set(item.source, items)
  }
  const uniqueSources = [...grouped.entries()]
  for (const [source] of uniqueSources) {
    if (source.startsWith('data:')) embeddedBytesEstimate += Math.floor(source.length * 3 / 4)
  }
  if (embeddedBytesEstimate > MAX_TOTAL_SOURCE_IMAGE_BYTES) throw new Error('O canvas excede o limite total de imagens.')
  const applySource = (items: Array<{ node: any; property: 'src' | 'source'; source: string }>, dataUrl: string) => {
    for (const { node, property } of items) {
      node[property] = dataUrl
      if (property === 'src') {
        node.crossOrigin = 'anonymous'
        delete node.__originalSrc
      }
    }
  }
  // Uma imagem ruim (fora do escopo, lenta, grande demais) não derruba a prévia inteira:
  // ela vira um pixel transparente e o restante do modelo continua sendo desenhado.
  // Nada fora do escopo é baixado: a validação de escopo acontece antes da leitura.
  const skipped: string[] = []
  for (let offset = 0; offset < uniqueSources.length; offset += 2) {
    const batch = uniqueSources.slice(offset, offset + 2)
    if (Date.now() >= preparationDeadlineAt) {
      for (const [, items] of batch) applySource(items, TRANSPARENT_PIXEL_DATA_URL)
      skipped.push(...batch.map(() => 'prazo esgotado'))
      continue
    }
    const settled = await Promise.allSettled(batch.map(async item => ({
      items: item[1],
      result: await normalizeCatalogImageSource(item[0], sourceOwnerId, kind, reserveBytes, trustedTemplateAssets, preparationDeadlineAt)
    })))
    settled.forEach((outcome, index) => {
      const items = batch[index]![1]
      if (outcome.status === 'rejected') {
        applySource(items, TRANSPARENT_PIXEL_DATA_URL)
        skipped.push(String(outcome.reason?.statusMessage || outcome.reason?.message || outcome.reason))
        return
      }
      const { result } = outcome.value
      try {
        reservePixels(result.width * result.height * items.length)
        applySource(items, result.dataUrl)
      } catch (error: any) {
        applySource(items, TRANSPARENT_PIXEL_DATA_URL)
        skipped.push(String(error?.message || error))
      }
    })
  }
  if (skipped.length) {
    console.warn(`[catalog-preview] ${skipped.length} de ${uniqueSources.length} imagem(ns) omitida(s) na prévia: ${[...new Set(skipped)].slice(0, 3).join(' | ')}`)
  }
}

const countJsonBytes = (canvasJson: unknown): number => Buffer.byteLength(JSON.stringify(canvasJson || {}), 'utf8')

/** Renders a neutral, server-only catalog image and returns optimized WebP bytes. */
export const renderCatalogPreview = async (options: RenderCatalogPreviewOptions): Promise<Buffer> => {
  if (!options || !['flyer', 'label'].includes(options.kind)) throw new Error('Tipo de prévia inválido.')
  if (countJsonBytes(options.canvasJson) > MAX_CANVAS_JSON_BYTES) throw new Error('O canvas excede o limite permitido.')
  const width = Math.round(Number(options.width))
  const height = Math.round(Number(options.height))
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1 || width > MAX_PAGE_DIMENSION || height > MAX_PAGE_DIMENSION || width * height > 40_000_000) {
    throw new Error('Dimensões do canvas inválidas para a prévia.')
  }

  const canvasJson = options.kind === 'flyer'
    ? options.personalize
      ? removeFlyerAccountContacts(options.canvasJson)
      : prepareNeutralFlyerCanvas(options.canvasJson)
    : JSON.parse(JSON.stringify(options.canvasJson || {}))
  await prepareCanvasImages(canvasJson, options.sourceOwnerId, options.kind, options.trustedTemplateAssets === true)
  // Desenho nativo (CPU) fora do processo principal: login, páginas e healthcheck seguem respondendo.
  return await drawCatalogPreviewIsolated({ kind: options.kind, canvasJson, width, height })
}

export const getCatalogPreviewRendererPolicy = (): string => RENDERER_POLICY
export const getCatalogPreviewSha256 = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex')
