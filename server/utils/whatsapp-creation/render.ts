import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { gunzipSync, gzipSync } from 'node:zlib'
import { basename, join, resolve, sep } from 'node:path'
import { createError, type H3Event } from 'h3'
import { formatBusinessAddressValues, formatBusinessContactValues, normalizeBusinessEntries, type BusinessProfile } from '~/utils/businessProfile'
import { getDynamicBusinessTextCase, transformDynamicBusinessText } from '~/utils/dynamicBusinessFields'
import { normalizeCreationTheme, type CreationHeader } from './catalog'
import type { AuthenticatedUser } from '../auth'
import {
  assertCanGeneratePaidVoice,
  assertCanRender,
  type CreationOrder,
  type CreationFormat,
  type CreationProduct
} from '~/shared/whatsapp-creation'
import { pgOneOrNull, pgQuery } from '../postgres'
import { getS3Client } from '../s3'
import { videoBucket, videoJson } from '../video-studio/service'
import { loadVideoBrandFromProfile } from '../video-studio/brand'
import { newVideoFromTemplate } from '~/shared/video-studio/templates'
import { VIDEO_FORMATS, VIDEO_THEMES, narrationScripts, videoSpeechSource, type VideoDocument } from '~/shared/video-studio/model'
import { videoDocumentSchema } from '../video-studio/schema'
import videoCatalogManifest from '~/shared/video-studio/catalog-assets.json'
import { resolveVideoCatalogAsset, type VideoCatalogManifest } from '../video-studio/catalog-assets'
import { parseAndStringifyJsonbParam } from '../jsonb'
import { publishProjectChange } from '../project-realtime'
import { isValidStoragePath, isPublicStorageKey, isStorageKeyAllowedForUser } from '../storage-scope'
import { normalizeStoredStorageRef } from '../project-storage-refs'
import { extractStorageKeyFromRef } from '~/utils/storageRef'
import { ownedStorageBytes } from './media'
import { ensureProcessedWhatsAppPhoto, isRawWhatsAppPhoto } from './product-photo'
import { bakeLogoCrops } from './logo-crop'
import { CARTAZISTA_FORMATS, CARTAZISTA_THEMES, type CartazistaModelKey, type CartazistaDocument, type CartazistaProduct } from '~/types/cartazista'
import { createCartazistaDocument, applyCartazistaProduct } from '~/utils/cartazista/composition'
import { hydrateCartazistaBusiness } from '~/utils/cartazista/business-bindings'
import { isCartazistaModelKey } from '~/utils/cartazista/catalog'
import { cloneArt, personalizeArt, resizeArt } from '~/utils/art-studio/composition'
import type { ArtComposition } from '~/types/art-studio'
import { ART_FORMATS } from '~/types/art-studio'
import { artCompositionSchema } from '../art-studio-schema'
import { cartazistaDocumentSchema as cartazistaStateSchema } from '~/utils/cartazista/schema'
import { runArtPython } from '../art-studio-python'
import { readArtImage } from '../art-studio-image'
import { checkArtAssets } from '../art-studio'
import { cartazistaPdfSize } from '~/utils/cartazista/pdf'
import { bindAccountLogoToFlyerCanvas } from '~/utils/accountFlyerTemplatePreview'
import { restoreCanvasStickerOutlines } from '~/utils/editorStickerOutline'
import { isSplitFooterValidity, resolveSplitFooterValidityText, splitFooterValidityText } from '~/utils/splitFooterValidity'
import { createDefaultProductCardConfiguration, normalizeProductCardConfiguration } from '~/utils/product-card-configuration'
import { BUILTIN_DEFAULT_LABEL_TEMPLATE_ID } from '~/utils/labelTemplateHelpers'
import flyerCatalogKeys from '~/shared/whatsapp-creation/flyer-catalog-keys.json'

const execute = promisify(execFile)
const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const MAX_WORKER_BYTES = 20 * 1024 * 1024
let flyerRenders = 0

type CreationArtifact = {
  artifactId: string
  formatId: string
  key: string
  hash: string
  mimeType: string
  projectId: string
  editUrl: string
  previewKey?: string
}

type CreationArtifactResult = {
  artifacts: CreationArtifact[]
  video?: { projectId: string; revision: number; phase: 'voice'; jobId: string }
}

const fail = (statusCode: number, statusMessage: string): never => {
  throw createError({ statusCode, statusMessage })
}

export const headerRevisionChangedError = (statusMessage: string) =>
  createError({ statusCode: 409, statusMessage, data: { code: 'HEADER_REVISION_CHANGED' } })

export const deterministicUuid = (value: string): string => {
  const bytes = createHash('sha256').update(value).digest().subarray(0, 16)
  bytes[6] = (bytes[6]! & 0x0f) | 0x40
  bytes[8] = (bytes[8]! & 0x3f) | 0x80
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export const flyerTemplateRevision = (updatedAt: unknown): number => {
  // PostgreSQL returns a Date object. String(Date) discards milliseconds and
  // incorrectly marks a selected template as stale during generation.
  const value = updatedAt instanceof Date ? updatedAt.getTime() : new Date(String(updatedAt || '')).getTime()
  if (!Number.isSafeInteger(value) || value <= 0) return fail(409, 'A revisão deste modelo não pode ser verificada.')
  return value
}

export const flyerThemeMatchesOrder = (orderTheme: unknown, candidates: unknown[]): boolean => {
  const selected = normalizeCreationTheme(orderTheme)
  return !!selected && candidates.some((candidate) => normalizeCreationTheme(candidate) === selected)
}

export const flyerDivisionSupportsProductCount = (count: number, division: CreationOrder['division'], format: Pick<CreationFormat, 'width' | 'height'>): boolean =>
  !(format.width === 1080 && format.height === 1920 && count > 9) || division === 'pages' || division === 'department'

const sha256 = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex')
const stableValue = (value: any): any => Array.isArray(value)
  ? value.map(stableValue)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]))
    : value
const stableJson = (value: any): string => JSON.stringify(stableValue(value))
const mimeFrom = (contentType: unknown, key: string): string => {
  const type = String(contentType || '').split(';')[0]!.toLowerCase()
  if (['image/png', 'image/jpeg', 'image/webp'].includes(type)) return type
  if (key.toLowerCase().endsWith('.png')) return 'image/png'
  if (/\.(?:jpe?g)$/i.test(key)) return 'image/jpeg'
  if (key.toLowerCase().endsWith('.webp')) return 'image/webp'
  return fail(422, 'O arquivo de imagem não usa um formato aceito.')
}

const dataUri = (bytes: Buffer, mime: string): string => `data:${mime};base64,${bytes.toString('base64')}`

export const resolveVideoHeaderPreviewAsset = (header: Pick<CreationHeader, 'previewUrl' | 'headerKey'>) => {
  const routePrefix = '/video-studio/'
  if (!header.previewUrl?.startsWith(routePrefix)) return null
  const asset = resolveVideoCatalogAsset(videoCatalogManifest as VideoCatalogManifest, header.previewUrl.slice(routePrefix.length))
  if (!asset || asset.key !== header.headerKey || !['image/png', 'image/jpeg', 'image/webp'].includes(asset.contentType)) return null
  return asset
}

async function s3Bytes(key: string, limit = MAX_IMAGE_BYTES): Promise<{ bytes: Buffer; contentType: string }> {
  const config = useRuntimeConfig()
  const bucket = String(config.wasabiBucket || process.env.WASABI_BUCKET || '').trim()
  if (!bucket) fail(503, 'O armazenamento de arquivos está indisponível.')
  const response = await getS3Client().send(new (await import('@aws-sdk/client-s3')).GetObjectCommand({ Bucket: bucket, Key: key }))
  if ((response.ContentLength || 0) > limit) fail(413, 'O arquivo excede o limite permitido.')
  const bytes = Buffer.from(await response.Body!.transformToByteArray())
  if (!bytes.length || bytes.length > limit) fail(413, 'O arquivo excede o limite permitido.')
  return { bytes, contentType: String(response.ContentType || '') }
}

async function s3Object(key: string, limit = MAX_IMAGE_BYTES): Promise<{ bytes: Buffer; mimeType: string }> {
  const result = await s3Bytes(key, limit)
  return { bytes: result.bytes, mimeType: mimeFrom(result.contentType, key) }
}

export async function approvedProductImages(order: CreationOrder, userId: string, readOwnedBytes: typeof ownedStorageBytes = ownedStorageBytes): Promise<Map<string, { bytes: Buffer; dataUrl: string }>> {
  const output = new Map<string, { bytes: Buffer; dataUrl: string }>()
  for (const product of order.products) {
    const image = order.images.find((candidate) => candidate.itemId === product.id)
    if (!image?.key || !image.hash || image.approvedRevision !== order.revision) return fail(422, `A foto de “${product.name}” não está aprovada nesta revisão.`)
    const key = String(image.key).trim()
    if (!isValidStoragePath(key)) return fail(403, 'A foto aprovada está fora do armazenamento permitido para esta conta.')
    const bytes = await readOwnedBytes(key, userId)
    if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) return fail(413, 'A foto aprovada excede o limite permitido.')
    if (sha256(bytes) !== image.hash.toLowerCase()) return fail(409, `A foto aprovada de “${product.name}” mudou desde a confirmação.`)
    // Foto enviada pelo cliente recebe a mesma remoção de fundo do upload manual.
    const processed = isRawWhatsAppPhoto(key)
      ? await ensureProcessedWhatsAppPhoto({ userId, product, rawKey: key, rawHash: image.hash.toLowerCase(), rawBytes: bytes })
      : null
    if (processed) {
      output.set(product.id, { bytes: processed, dataUrl: dataUri(processed, 'image/webp') })
      continue
    }
    const mimeType = mimeFrom('', key)
    output.set(product.id, { bytes, dataUrl: dataUri(bytes, mimeType) })
  }
  return output
}

async function profileLogo(profile: BusinessProfile, userId: string): Promise<{ bytes: Buffer; dataUrl: string; mimeType: string } | null> {
  const config = useRuntimeConfig()
  const key = extractStorageKeyFromRef(profile.logo, { bucket: config.wasabiBucket, endpoint: config.wasabiEndpoint })
  if (!key) return null
  if (!isValidStoragePath(key) || !isStorageKeyAllowedForUser(key, userId)) fail(403, 'A logo do perfil está fora do armazenamento permitido para esta conta.')
  const result = await s3Object(key)
  return { bytes: result.bytes, dataUrl: dataUri(result.bytes, result.mimeType), mimeType: result.mimeType }
}

async function putArtifact(userId: string, order: CreationOrder, projectId: string, formatId: string, bytes: Buffer, mimeType: string, suffix: string): Promise<CreationArtifact> {
  const artifactId = deterministicUuid(`${order.accountId}:${order.id}:${order.revision}:${projectId}:${formatId}:${suffix}`)
  const key = `whatsapp-creation/${userId}/${order.id}/r${order.revision}/${artifactId}.${suffix}`
  await getS3Client().send(new (await import('@aws-sdk/client-s3')).PutObjectCommand({
    Bucket: videoBucket(), Key: key, Body: bytes, ContentType: mimeType, CacheControl: 'private, no-store',
    Metadata: { orderid: order.id, revision: String(order.revision), artifactid: artifactId }
  }))
  return { artifactId, formatId, key, hash: sha256(bytes), mimeType, projectId, editUrl: '' }
}

async function saveArtDesign(userId: string, id: string, name: string, composition: ArtComposition, templateId: string): Promise<void> {
  const json = parseAndStringifyJsonbParam(composition, 'composition')
  const inserted = await pgOneOrNull<any>(
    `insert into public.art_studio_designs(id,owner_id,name,composition,template_id)
     values($1,$2,$3,$4::jsonb,$5) on conflict(id) do nothing returning id`,
    [id, userId, name.slice(0, 150), json, templateId]
  )
  if (inserted) return
  const existing = await pgOneOrNull<any>('select id,owner_id,composition from public.art_studio_designs where id=$1', [id])
  if (existing?.owner_id !== userId || stableJson(existing.composition) !== stableJson(JSON.parse(json))) fail(409, 'O artefato desta revisão já existe com outro conteúdo.')
}

async function saveCartazistaDesign(userId: string, id: string, name: string, state: CartazistaDocument): Promise<void> {
  const json = parseAndStringifyJsonbParam(state, 'state')
  const inserted = await pgOneOrNull<any>(
    `insert into public.cartazista_designs(id,owner_id,name,state)
     values($1,$2,$3,$4::jsonb) on conflict(id) do nothing returning id`,
    [id, userId, name.slice(0, 150), json]
  )
  if (inserted) return
  const existing = await pgOneOrNull<any>('select id,owner_id,state from public.cartazista_designs where id=$1', [id])
  if (existing?.owner_id !== userId || stableJson(existing.state) !== stableJson(JSON.parse(json))) fail(409, 'O cartaz desta revisão já existe com outro conteúdo.')
}

async function templateImageBytes(src: string, userId: string, templateOwnerId: string): Promise<{ bytes: Buffer; mimeType: string }> {
  if (src.startsWith('data:image/')) {
    const match = src.match(/^data:(image\/(?:png|jpeg|webp));base64,([a-zA-Z0-9+/=]+)$/)
    if (!match) return fail(422, 'O modelo contém uma imagem embutida inválida.')
    return { bytes: Buffer.from(match[2]!, 'base64'), mimeType: match[1]! }
  }
  if (src === '/api/art-studio/brand-logo') {
    const row = await pgOneOrNull<any>('select business_profile from public.profiles where id=$1', [userId])
    const profile = await profileLogo((await import('~/utils/businessProfile')).normalizeBusinessProfile(row?.business_profile), userId)
    if (!profile) return fail(422, 'Cadastre a logo da loja no perfil comercial.')
    return { bytes: profile.bytes, mimeType: profile.mimeType }
  }
  const artAsset = src.match(/^\/api\/art-studio\/assets\/([0-9a-f-]{36})$/i)
  if (artAsset) {
    const row = await pgOneOrNull<any>('select owner_id,storage_key,shared from public.art_studio_assets where id=$1 and (owner_id=$2 or shared=true)', [artAsset[1], templateOwnerId])
    if (!row?.storage_key) fail(403, 'O modelo contém uma imagem sem permissão de leitura.')
    const key = String(row.storage_key)
    if (!isPublishedArtAssetStorageKey(key, row, templateOwnerId)) fail(403, 'A imagem do modelo está fora do escopo autorizado.')
    return s3Object(key)
  }
  const storageUrl = src.match(/^\/api\/storage\/p\?key=([^&]+)$/)
  if (storageUrl) {
    const key = decodeURIComponent(storageUrl[1]!)
    if (key.startsWith('art-studio/')) {
      const row = await pgOneOrNull<any>('select owner_id,storage_key,shared from public.art_studio_assets where storage_key=$1 and (owner_id=$2 or shared=true)', [key, templateOwnerId])
      if (!row || !isPublishedArtAssetStorageKey(key, row, templateOwnerId)) return fail(403, 'A imagem do modelo está fora do escopo autorizado.')
      return s3Object(key)
    }
    if (!isValidStoragePath(key) || !(isStorageKeyAllowedForUser(key, userId) || key.startsWith(`projects/${templateOwnerId}/`) || key.startsWith('templates/') || isPublicStorageKey(key))) fail(403, 'A imagem do modelo está fora do escopo autorizado.')
    return s3Object(key)
  }
  if (src.startsWith('/video-studio/templates/')) {
    const pathPart = src.slice(1)
    if (pathPart.split('/').includes('..')) fail(422, 'Caminho de imagem do modelo inválido.')
    const roots = [resolve(process.cwd(), 'public'), resolve(process.cwd(), '.output/public')]
    const target = roots.map((root) => resolve(root, pathPart.replace(/^public\//, ''))).find((candidate) => roots.some((root) => candidate.startsWith(root + sep)) && existsSync(candidate))
    if (!target) return fail(422, 'O asset estático do modelo não está disponível no servidor.')
    const bytes = await readFile(target)
    if (bytes.length > MAX_IMAGE_BYTES) fail(413, 'Imagem do modelo excede 10 MB.')
    return { bytes, mimeType: mimeFrom('', target) }
  }
  return fail(403, 'O modelo referencia uma imagem fora do catálogo autorizado.')
}

export function isPublishedArtAssetStorageKey(key: string, row: { owner_id: unknown; storage_key: unknown; shared?: unknown }, templateOwnerId: string): boolean {
  const ownerId = String(row.owner_id || '')
  return isValidStoragePath(key) && String(row.storage_key || '') === key &&
    (ownerId === templateOwnerId || row.shared === true) && key.startsWith(`art-studio/${ownerId}/`)
}

export function fillHeaderPreviewPlaceholders(source: ArtComposition, hasLogo = false): ArtComposition {
  const result = cloneArt(source)
  for (const layer of result.layers) {
    const field = compact(String((layer as any).binding || layer.id || layer.name))
    if (layer.kind === 'text') {
      if (['productname', 'offername', 'name'].includes(field)) layer.text = 'Seu produto'
      if (['productbrand', 'brand', 'productvariant', 'variant', 'productweight', 'weight', 'productcondition', 'condition', 'conditions'].includes(field)) layer.text = ''
      if (/(?:price|preco|currency|moeda)/i.test(`${field} ${layer.id} ${layer.name}`)) { layer.text = ''; layer.visible = false }
      if (['title', 'titulo', 'calltoaction', 'cta', 'chamada'].includes(field)) layer.text = 'Sua chamada'
    }
    if (layer.kind === 'image' && ['productimage', 'offerimage'].includes(field)) { layer.src = ''; layer.visible = false }
    if (!hasLogo && layer.kind === 'image' && (field === 'logo' || /logo/i.test(`${layer.id} ${layer.name}`))) {
      layer.kind = 'text'
      layer.src = undefined
      layer.text = 'Sua logo'
      layer.visible = true
      layer.fill = layer.fill || '#555555'
      layer.fontFamily = 'Barlow'
      layer.fontSize = Math.max(14, Math.min(32, layer.height * .22))
      layer.fontWeight = 700
      layer.align = 'center'
    }
  }
  return result
}

const artImageOwnerMap = (composition: ArtComposition, ownerId: string): Map<string, string> => new Map(
  [composition, ...(composition.alternates || [])].flatMap(page => page.layers
    .filter(layer => layer.kind === 'image' && !!layer.src)
    .map(layer => [layer.src!, ownerId] as [string, string]))
)

const hideCartazPreviewPrice = (composition: ArtComposition): ArtComposition => {
  const result = cloneArt(composition)
  for (const layer of result.layers) {
    if (layer.kind === 'text' && /(?:price|preco|currency|unit|old|secondary)/i.test(`${layer.id} ${layer.name}`)) {
      layer.text = ''
      layer.visible = false
    }
  }
  return result
}

export async function renderCreationHeaderPreview(
  header: CreationHeader,
  kind: CreationOrder['kind'],
  user: AuthenticatedUser,
  profile: BusinessProfile
): Promise<Buffer> {
  if (kind === 'video') {
    const asset = resolveVideoHeaderPreviewAsset(header)
    if (!asset) return fail(422, 'Este tema não tem uma capa de vídeo publicada para prévia.')
    const image = await s3Bytes(asset.key, MAX_IMAGE_BYTES)
    if (image.bytes.length !== asset.bytes || sha256(image.bytes) !== asset.sha256 || mimeFrom(image.contentType, asset.key) !== asset.contentType) {
      return fail(422, 'A capa publicada do vídeo não confere com o catálogo.')
    }
    return (await import('sharp')).default(image.bytes).png().toBuffer()
  }
  if (kind === 'encarte') return fail(422, 'A prévia do encarte já é fornecida pelo cabeçalho publicado.')
  if (kind === 'cartaz') {
    const selectedThemeId = String(header.nativeThemeId || header.theme)
    const theme = CARTAZISTA_THEMES.find(item => item.id === selectedThemeId)
    if (!theme) return fail(422, 'O cabeçalho não aponta para um tema nativo do Cartazista.')
    const format = header.formats.map(id => CARTAZISTA_FORMATS.find(item => item.id === id)).find(Boolean)
    if (!format) return fail(422, 'O cabeçalho não possui formato publicado no Cartazista.')
    let modelKey = header.id
    let templateOwnerId = user.id
    let templateComposition: ArtComposition | null = null
    const dbTemplate = await pgOneOrNull<any>(
      'select id,owner_id,model_key,name,composition,published,revision,updated_at from public.cartazista_templates where (id::text=$1 or model_key=$1) and published=true order by updated_at desc limit 1',
      [header.id]
    )
    if (dbTemplate) {
      modelKey = String(dbTemplate.model_key)
      templateOwnerId = String(dbTemplate.owner_id)
      templateComposition = dbTemplate.composition || null
      const selectedAt = (header as any).sourceUpdatedAt
      const liveAtRevision = flyerTemplateRevision(dbTemplate.updated_at)
      if (selectedAt
        ? flyerTemplateRevision(selectedAt) !== liveAtRevision
        : header.revision !== Number(dbTemplate.revision) && header.revision !== liveAtRevision) {
        throw headerRevisionChangedError('O modelo de cartaz mudou depois da escolha do cabeçalho.')
      }
    } else if (!isCartazistaModelKey(modelKey) || header.revision !== 1) {
      return fail(409, 'O modelo de cartaz não está mais publicado com esta revisão.')
    }
    if (!isCartazistaModelKey(modelKey)) return fail(422, 'O modelo publicado não é compatível com o Cartazista.')
    const logoSrc = profile.logo ? '/api/art-studio/brand-logo' : ''
    const state = createCartazistaDocument({ modelId: modelKey as CartazistaModelKey, formatId: format.id as CartazistaDocument['formatId'], themeId: theme.id, logoSrc })
    state.name = `${header.name} · prévia`
    const product: CartazistaProduct = { id: 'header-preview-product', name: 'Seu produto', price: 0, unit: 'un' }
    state.products = [product]
    state.activeProductId = product.id
    state.settings.showLogo = !!profile.logo
    if (templateComposition) state.composition = JSON.parse(JSON.stringify(templateComposition)) as ArtComposition
    state.composition = applyCartazistaProduct(state.composition, state.modelId, product, state.settings, state.themeId)
    state.composition = hydrateCartazistaBusiness(state.composition, profile, logoSrc, !!profile.logo)
    state.composition = fillHeaderPreviewPlaceholders(hideCartazPreviewPrice(state.composition), !!profile.logo)
    const sourceOwners = artImageOwnerMap(state.composition, templateOwnerId)
    return renderComposition(state.composition, user.id, sourceOwners, profile, new Map())
  }

  const template = await pgOneOrNull<any>(
    'select id,owner_id,name,composition,published,revision from public.art_studio_templates where id=$1 and published=true',
    [header.id]
  )
  if (!template) return fail(409, 'O modelo do Estúdio não está mais publicado.')
  if (Number(template.revision) !== header.revision) throw headerRevisionChangedError('O modelo do Estúdio mudou depois da escolha do cabeçalho.')
  const sourceOwnerId = String(template.owner_id)
  const composition = personalizeArt(cloneArt(template.composition as ArtComposition), {
    companyName: profile.companyName, logo: profile.logo ? '/api/art-studio/brand-logo' : '',
    phone: profile.phone || profile.whatsapp, address: profile.address, instagram: profile.instagram
  })
  const format = header.formats.map(id => ART_FORMATS.find(item => item.id === id)).find(Boolean)
  if (!format) return fail(422, 'O cabeçalho não possui formato publicado no Estúdio de Artes.')
  const selected = fillHeaderPreviewPlaceholders(resizeArt(composition, format.width, format.height), !!profile.logo)
  const sourceOwners = artImageOwnerMap(selected, sourceOwnerId)
  return renderComposition(selected, user.id, sourceOwners, profile, new Map())
}

async function cloneTemplateImagesToOwner(composition: ArtComposition, order: CreationOrder, userId: string, sourceOwnerId: string): Promise<ArtComposition> {
  const result = cloneArt(composition)
  for (const page of [result, ...(result.alternates || [])]) {
    for (const layer of page.layers) {
      if (layer.kind !== 'image' || !layer.src || layer.src === '/api/art-studio/brand-logo') continue
      if (!layer.src.startsWith('/api/art-studio/assets/') && !layer.src.startsWith('/api/storage/p?key=')) continue
      const image = await templateImageBytes(layer.src, userId, sourceOwnerId)
      const png = await (await import('sharp')).default(image.bytes).png().toBuffer()
      const id = deterministicUuid(`${userId}:${order.id}:${order.revision}:template-asset:${layer.src}:${sha256(png)}`)
      const key = `art-studio/${userId}/${id}.png`
      const existing = await pgOneOrNull<any>('select id,owner_id,storage_key from public.art_studio_assets where id=$1', [id])
      if (existing && (existing.owner_id !== userId || existing.storage_key !== key)) fail(409, 'Asset do modelo conflita com um arquivo salvo da conta.')
      if (!existing) {
        await getS3Client().send(new (await import('@aws-sdk/client-s3')).PutObjectCommand({ Bucket: videoBucket(), Key: key, Body: png, ContentType: 'image/png' }))
        await pgQuery('insert into public.art_studio_assets(id,owner_id,storage_key) values($1,$2,$3) on conflict(id) do nothing', [id, userId, key])
      }
      layer.src = `/api/art-studio/assets/${id}`
    }
  }
  return result
}

async function cartazistaPdf(png: Buffer, formatId: string, landscape: boolean): Promise<Buffer> {
  const { PDFDocument } = await import('pdf-lib')
  const pdf = await PDFDocument.create()
  pdf.setCreator('JobVarejo · Cartazista')
  const [width, height] = cartazistaPdfSize(formatId as any, landscape)
  const image = await pdf.embedPng(png)
  pdf.addPage([width, height]).drawImage(image, { x: 0, y: 0, width, height })
  return Buffer.from(await pdf.save())
}

async function renderComposition(composition: ArtComposition, ownerId: string, sourceIds: Map<string, string>, profile: BusinessProfile, approvedAssets: Map<string, { bytes: Buffer; dataUrl: string }>): Promise<Buffer> {
  const assets: Record<string, string> = {}
  const all = [composition, ...(composition.alternates || [])]
  const sources = [...new Set(all.flatMap((page) => page.layers.filter((layer) => layer.visible && layer.kind === 'image' && layer.src).map((layer) => layer.src!)))]
  for (const src of sources) {
    const product = [...approvedAssets.values()].find((image) => image.dataUrl === src)
    if (product) { assets[src] = product.bytes.toString('base64'); continue }
    const templateOwnerId = sourceIds.get(src) || ownerId
    const image = await templateImageBytes(src, ownerId, templateOwnerId)
    assets[src] = image.bytes.toString('base64')
  }
  const rendered = await runArtPython({ mode: 'render', compositions: all, assets })
    if (!rendered.files?.length) return fail(502, 'O renderizador não retornou a arte.')
  if (rendered.files.length !== 1) fail(502, 'O renderizador retornou uma quantidade inesperada de arquivos.')
  return rendered.files[0]!.buffer
}

const compact = (value: string): string => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '')

export const assertFlyerProfileBindings = (canvas: any, profile: BusinessProfile, logoAvailable: boolean, validity = ''): void => {
  const objects: any[] = []
  const visit = (nodes: any[]): void => {
    for (const object of nodes || []) {
      if (!object || typeof object !== 'object') continue
      objects.push(object)
      if (Array.isArray(object.objects)) visit(object.objects)
    }
  }
  visit(canvas?.objects)
  if (!logoAvailable) fail(422, 'Cadastre a logo da empresa no perfil antes de criar esta arte.')
  const hasLogo = objects.some((object) => {
    const field = compact(String(object.businessProfileField || ''))
    const name = compact(String(object.name || ''))
    return object.quickLogoSlot === true || field === 'logo' || /^(?:header|footer|account|business)(?:dynamic)?logo/.test(name)
  })
  if (!hasLogo) fail(422, 'Este modelo não tem um espaço editável para a logo da empresa. Escolha outro cabeçalho.')

  const fields = new Set(objects.map((object) => compact(String(object.businessProfileField || ''))).filter(Boolean))
  const names = objects.map((object) => compact(String(object.name || '')))
  const phone = profile.whatsapp || profile.phone
  if (String(phone || '').trim()) {
    const aliases = ['whatsapp', 'phone']
    if (!aliases.some((alias) => fields.has(alias) || names.some((name) => name === alias || name.endsWith(`dynamic${alias}`)))) {
      fail(422, 'Este modelo não tem um campo para mostrar o telefone ou WhatsApp da empresa. Escolha outro cabeçalho.')
    }
  }
  if (validity.trim() && !fields.has('validity') && !names.some((name) => name === 'headervalidity' || name.endsWith('dynamicvalidity'))) {
    fail(422, 'Este modelo não tem um campo para mostrar a validade confirmada do pedido. Escolha outro cabeçalho.')
  }
}

function fillInstitutionalCopy(source: ArtComposition, order: CreationOrder): ArtComposition {
  const copy = order.institutionalText
  if (!copy) return fail(422, 'A arte institucional precisa de texto confirmado.')
  const result = cloneArt(source)
  const fields: Array<[string[], string, string]> = [
    [['title', 'titulo'], copy.title, 'título'],
    [['message', 'mensagem'], copy.message, 'mensagem'],
    [['calltoaction', 'cta', 'chamada'], copy.callToAction, 'chamada']
  ]
  for (const [aliases, text, label] of fields) {
    const layer = result.layers.find((item) => aliases.includes(compact(item.id)) || aliases.includes(compact(item.name)) || aliases.includes(compact(String((item as any).binding || ''))))
    if (!layer || layer.kind !== 'text') return fail(422, `O modelo publicado não tem uma camada editável de ${label}.`)
    layer.text = text
  }
  return result
}

async function renderStudio(order: CreationOrder, user: AuthenticatedUser, profile: BusinessProfile, formats: CreationFormat[], images: Map<string, { bytes: Buffer; dataUrl: string }>): Promise<CreationArtifactResult> {
  const template = await pgOneOrNull<any>(
    'select id,owner_id,name,composition,published,revision from public.art_studio_templates where id=$1 and published=true',
    [order.header!.id]
  )
  if (!template || Number(template.revision) !== order.header!.revision) fail(409, 'O modelo do Estúdio mudou depois da escolha do cliente.')
  const composition = cloneArt(template.composition as ArtComposition)
  const identityValues = {
    companyName: profile.companyName,
    logo: profile.logo ? '/api/art-studio/brand-logo' : '',
    phone: profile.phone || profile.whatsapp,
    address: profile.address,
    instagram: profile.instagram,
    date: order.validity
  }
  let personalized = personalizeArt(composition, identityValues)
  personalized = await cloneTemplateImagesToOwner(personalized, order, user.id, String(template.owner_id))
  const outputs: CreationArtifact[] = []
  for (const format of formats) {
    const products: Array<CreationProduct | null> = order.products.length ? [...order.products] : [null]
    for (const product of products) {
      let selected = resizeArt(personalized, format.width, format.height)
      if (product) {
        const image = images.get(product.id)
        if (!image) return fail(422, `A foto de “${product.name}” não está disponível para a arte.`)
        const artImageId = await cloneApprovedImageToArtAsset(user.id, order, product.id, image.bytes)
        selected = fillArtProductFields(selected, order, product, `/api/art-studio/assets/${artImageId}`)
      } else selected = fillInstitutionalCopy(selected, order)
      selected = fillConditionsAndValidity(selected, order)
      const designId = deterministicUuid(`${user.id}:${order.id}:${order.revision}:studio:${format.id}:${product?.id || 'institutional'}`)
      const validated = artCompositionSchema.parse(selected)
      await checkArtAssets(validated, user.id)
      await saveArtDesign(user.id, designId, product?.name || order.institutionalText?.title || template.name, validated, String(template.id))
      const png = await renderComposition(validated, user.id, new Map(), profile, images)
      const artifact = await putArtifact(user.id, order, designId, format.id, png, 'image/png', `${product?.id || 'institutional'}.png`)
      artifact.editUrl = `/art-studio/editor/${designId}`
      outputs.push(artifact)
    }
  }
  return { artifacts: outputs }
}

function fillConditionsAndValidity(source: ArtComposition, order: CreationOrder): ArtComposition {
  const result = cloneArt(source)
  let validitySlot = false, conditionsSlot = false
  for (const layer of result.layers) {
    if (layer.kind !== 'text') continue
    const field = compact(String((layer as any).binding || layer.id || layer.name))
    if (['validity', 'validade', 'date', 'data'].includes(field) && order.validity) { layer.text = order.validity; validitySlot = true }
    if (['condition', 'conditions', 'condicao', 'condicoes', 'offercondition'].includes(field) && order.conditions) { layer.text = order.conditions; conditionsSlot = true }
  }
  if (order.validity && !validitySlot) return fail(422, 'O modelo publicado não tem um campo editável para a validade confirmada.')
  if (order.conditions && !conditionsSlot && !order.products.some((product) => product.condition)) return fail(422, 'O modelo publicado não tem um campo editável para as condições confirmadas.')
  return result
}

function fillArtProductFields(source: ArtComposition, order: CreationOrder, product: CreationProduct, imageSrc: string): ArtComposition {
  const result = cloneArt(source)
  const aliases: Record<string, string> = {
    productname: product.name,
    offername: product.name,
    productbrand: product.brand,
    productvariant: product.variant,
    productweight: product.weight,
    productprice: product.price,
    offerprice: product.price,
    productcondition: product.condition || order.conditions
  }
  let nameSlot = false, priceSlot = false, imageSlot = false
  let conditionSlot = false
  for (const layer of result.layers) {
    const key = compact(String((layer as any).binding || layer.id || layer.name))
    if (layer.kind === 'text' && key in aliases) {
      layer.text = aliases[key]!
      if (key === 'productname' || key === 'offername') nameSlot = true
      if (key === 'productprice' || key === 'offerprice') priceSlot = true
    }
    if (layer.kind === 'image' && ['productimage', 'offerimage'].includes(key)) {
      layer.src = imageSrc
      layer.visible = true
      imageSlot = true
    }
    if (layer.kind === 'text' && key === 'productcondition' && aliases.productcondition) conditionSlot = true
  }
  if (!nameSlot || !priceSlot || !imageSlot) fail(422, 'O modelo publicado não possui camadas editáveis para nome, preço e imagem do produto.')
  if (aliases.productcondition && !conditionSlot) return fail(422, 'O modelo publicado não tem um campo editável para as condições confirmadas.')
  return result
}

async function cloneApprovedImageToArtAsset(userId: string, order: CreationOrder, itemId: string, bytes: Buffer): Promise<string> {
  const png = await (await import('sharp')).default(bytes, { limitInputPixels: 24_000_000 }).png().toBuffer()
  const id = deterministicUuid(`${userId}:${order.id}:${order.revision}:approved-art-image:${itemId}:${sha256(png)}`)
  const key = `art-studio/${userId}/${id}.png`
  const existing = await pgOneOrNull<any>('select id,owner_id,storage_key from public.art_studio_assets where id=$1', [id])
  if (existing && (existing.owner_id !== userId || existing.storage_key !== key)) fail(409, 'A imagem aprovada conflita com um asset salvo da conta.')
  if (!existing) {
    await getS3Client().send(new (await import('@aws-sdk/client-s3')).PutObjectCommand({ Bucket: videoBucket(), Key: key, Body: png, ContentType: 'image/png' }))
    await pgQuery('insert into public.art_studio_assets(id,owner_id,storage_key) values($1,$2,$3) on conflict(id) do nothing', [id, userId, key])
  }
  return id
}

function parseLiteralPrice(value: string): number {
  const match = value.trim().match(/^(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*|\d+)(?:,(\d{1,2}))?$/)
  if (!match) return fail(422, 'O preço do cartaz precisa estar em formato numérico comercial confirmado.')
  const amount = Number(`${match[1]!.replace(/\./g, '')}.${(match[2] || '00').padEnd(2, '0')}`)
  if (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000) fail(422, 'O preço está fora do limite do Cartazista.')
  return amount
}

function cartazUnit(product: CreationProduct): string {
  const match = product.weight.match(/(?:^|\s)(kg|g|ml|l|un|pct|cx|fardo)(?:$|\s)/i)
  return match?.[1]?.toLowerCase() || product.weight
}

async function renderCartazista(order: CreationOrder, user: AuthenticatedUser, profile: BusinessProfile, formats: CreationFormat[], images: Map<string, { bytes: Buffer; dataUrl: string }>): Promise<CreationArtifactResult> {
  const templateId = order.header!.id
  const selectedNativeThemeId = String((order.header as any).nativeThemeId || order.theme || '')
  let modelKey = templateId
  let templateRevision = 1
  let templateUpdatedAt: unknown = null
  let templateComposition: ArtComposition | null = null
  const dbTemplate = await pgOneOrNull<any>(
    'select id,owner_id,model_key,name,composition,published,revision,updated_at from public.cartazista_templates where (id::text=$1 or model_key=$1) and published=true order by updated_at desc limit 1',
    [templateId]
  )
  if (dbTemplate) {
    modelKey = String(dbTemplate.model_key)
    templateRevision = Number(dbTemplate.revision)
    templateUpdatedAt = dbTemplate.updated_at
    templateComposition = dbTemplate.composition || null
  } else if (!isCartazistaModelKey(templateId)) fail(404, 'O modelo de cartaz não está publicado.')
  const selectedSourceUpdatedAt = (order.header as any).sourceUpdatedAt
  const liveSourceRevision = templateUpdatedAt ? flyerTemplateRevision(templateUpdatedAt) : null
  const sourceRevisionMatches = selectedSourceUpdatedAt
    ? Boolean(templateUpdatedAt && Date.parse(String(selectedSourceUpdatedAt)) === Date.parse(String(templateUpdatedAt)))
    : order.header!.revision === templateRevision || order.header!.revision === liveSourceRevision
  if (!sourceRevisionMatches) fail(409, 'O modelo de cartaz mudou depois da escolha do cliente.')
  if (!dbTemplate && order.header!.revision !== templateRevision) fail(409, 'O modelo de cartaz mudou depois da escolha do cliente.')
  if (!isCartazistaModelKey(modelKey)) fail(422, 'O modelo publicado não é compatível com o Cartazista.')
  const theme = CARTAZISTA_THEMES.find((item) => item.id === selectedNativeThemeId)
  if (!theme) return fail(422, 'O tema escolhido não está disponível no Cartazista.')
  const outputs: CreationArtifact[] = []
  const logoSrc = profile.logo ? '/api/art-studio/brand-logo' : ''
  const sourceOwner = new Map<string, string>()
  for (const format of formats) {
    const nativeFormat = CARTAZISTA_FORMATS.find((candidate) => candidate.id === format.id)
    if (!nativeFormat || nativeFormat.width !== format.width || nativeFormat.height !== format.height) return fail(422, 'O formato solicitado não corresponde a um tamanho físico publicado no Cartazista.')
    for (const item of order.products) {
      const product: CartazistaProduct = {
        id: item.id,
        name: [item.name, item.brand, item.variant, item.weight].filter(Boolean).join(' '),
        price: parseLiteralPrice(item.price),
        unit: cartazUnit(item),
        nearExpiry: false
      }
      const state = createCartazistaDocument({ modelId: modelKey as CartazistaModelKey, formatId: nativeFormat.id as CartazistaDocument['formatId'], themeId: theme.id, logoSrc })
      state.name = `${item.name} · ${nativeFormat.label}`
      state.products = [product]
      state.activeProductId = product.id
      state.settings.validity = order.validity
      state.settings.limitPerCustomer = ''
      state.settings.showLogo = !!profile.logo
      if (templateComposition) state.composition = await cloneTemplateImagesToOwner(templateComposition, order, user.id, String(dbTemplate.owner_id))
      state.composition = applyCartazistaProduct(state.composition, state.modelId, product, state.settings, state.themeId)
      state.composition = hydrateCartazistaBusiness(state.composition, profile, logoSrc, !!profile.logo)
      const conditionText = item.condition || order.conditions
      if (conditionText) {
        const conditionLayer = state.composition.layers.find((layer: any) => layer.id === 'cartaz-limit')
        if (!conditionLayer || conditionLayer.kind !== 'text') return fail(422, 'O modelo de cartaz não tem uma camada de texto para as condições confirmadas.')
        conditionLayer.text = conditionText
        conditionLayer.visible = true
      }
      const designId = deterministicUuid(`${user.id}:${order.id}:${order.revision}:cartaz:${format.id}:${item.id}`)
      const validated = cartazistaStateSchema.parse(state) as CartazistaDocument
      await saveCartazistaDesign(user.id, designId, state.name, validated)
      const png = await renderComposition(validated.composition as unknown as ArtComposition, user.id, sourceOwner, profile, images)
      const imageArtifact = await putArtifact(user.id, order, designId, format.id, png, 'image/png', `${item.id}.png`)
      imageArtifact.editUrl = `/cartazista/editor/${designId}`
      outputs.push(imageArtifact)
      const pdf = await cartazistaPdf(png, format.id, format.width > format.height)
      const pdfArtifact = await putArtifact(user.id, order, designId, format.id, Buffer.from(pdf), 'application/pdf', `${item.id}.pdf`)
      pdfArtifact.previewKey = imageArtifact.key
      pdfArtifact.editUrl = `/cartazista/editor/${designId}`
      outputs.push(pdfArtifact)
    }
  }
  return { artifacts: outputs }
}

async function getTemplateCanvasPage(project: any, format: CreationFormat, formatId: string, userId: string): Promise<{ page: any; canvas: any }> {
  const source = Array.isArray(project.canvas_data) ? project.canvas_data : project.canvas_data?.pages
  if (!Array.isArray(source)) fail(422, 'O modelo selecionado não possui páginas.')
  const page = source.find((candidate: any) => String(candidate.templateFormatId || '') === formatId) || source.find((candidate: any) => Number(candidate.width) === format.width && Number(candidate.height) === format.height)
  if (!page || Number(page.width) !== format.width || Number(page.height) !== format.height) fail(422, `O cabeçalho não possui uma página no formato ${formatId}.`)
  let canvas = page.canvasData
  if (!canvas && page.canvasDataPath) {
    const key = String(normalizeStoredStorageRef(page.canvasDataPath) || '')
    const ownerId = String(project.user_id)
    if (!isValidStoragePath(key) || !key.startsWith(`projects/${ownerId}/`)) fail(403, 'O canvas do cabeçalho está fora do projeto de origem autorizado.')
    const result = await s3Bytes(key, 32 * 1024 * 1024)
    try { canvas = JSON.parse(gunzipSync(result.bytes).toString('utf8')) } catch { fail(422, 'O canvas do cabeçalho salvo está inválido.') }
  }
  if (!canvas || !Array.isArray(canvas.objects)) fail(422, 'A página do cabeçalho ainda não possui canvas salvo.')
  canvas.width = Number(canvas.width || page.width)
  canvas.height = Number(canvas.height || page.height)
  return { page, canvas }
}

export function resolvePublishedFlyerCatalogKey(src: string): string | null {
  if (!src.startsWith('/api/storage/p?')) return null
  const key = new URL(src, 'http://local').searchParams.get('key')
  return key && (flyerCatalogKeys as string[]).includes(key) ? key : null
}

export async function readFlyerPaymentIcon(src: string): Promise<Buffer | null> {
  // Somente arquivos nativos do catálogo de bandeiras; não aceita caminhos arbitrários.
  if (!/^\/cartoes\/cartao-[0-9]+\.png$/.test(src)) return null
  const roots = [resolve(process.cwd(), 'public'), resolve(process.cwd(), '.output/public')]
  const file = roots.map(root => resolve(root, src.slice(1))).find(existsSync)
  if (!file) return fail(422, 'Uma bandeira de pagamento do modelo não está disponível no servidor.')
  const bytes = await readFile(file)
  if (bytes.length > MAX_IMAGE_BYTES) return fail(413, 'A bandeira de pagamento excede o tamanho permitido.')
  return bytes
}

async function embedFlyerAssets(canvas: any, userId: string, templateOwnerId: string, logo: { bytes: Buffer; dataUrl: string } | null, profile: BusinessProfile, order: CreationOrder): Promise<any> {
  hydrateFlyerBusinessFields(canvas, profile, logo?.dataUrl || '', order)
  const visit = async (objects: any[]): Promise<void> => {
    for (const object of objects) {
      if (!object || typeof object !== 'object') continue
      if (String(object.type || '').toLowerCase() === 'image' && object.src && !String(object.src).startsWith('data:image/')) {
        const catalogKey = resolvePublishedFlyerCatalogKey(String(object.src))
        if (catalogKey) {
          const image = await s3Object(catalogKey)
          object.src = dataUri(image.bytes, image.mimeType)
          continue
        }
        const paymentIcon = await readFlyerPaymentIcon(String(object.src))
        if (paymentIcon) { object.src = dataUri(paymentIcon, 'image/png'); continue }
        const config = useRuntimeConfig()
        const key = extractStorageKeyFromRef(object.src, { bucket: config.wasabiBucket, endpoint: config.wasabiEndpoint })
        if (!key || !isValidStoragePath(key) || !(key.startsWith(`projects/${templateOwnerId}/`) || key.startsWith('templates/') || isPublicStorageKey(key))) return fail(403, 'O cabeçalho contém uma imagem fora do catálogo autorizado.')
        const image = await s3Object(key)
        object.src = dataUri(image.bytes, image.mimeType)
      }
      if (Array.isArray(object.objects)) await visit(object.objects)
    }
  }
  await visit(canvas.objects)
  let logoSize: { width: number; height: number; cropX?: number; cropY?: number } | null = null
  if (logo) {
    const sharp = (await import('sharp')).default
    const metadata = await sharp(logo.bytes, { limitInputPixels: 16_000_000 }).metadata()
    if (!metadata.width || !metadata.height) fail(422, 'A logo do perfil está inválida.')
    if (metadata.hasAlpha) {
      const trimmed = await sharp(logo.bytes, { limitInputPixels: 16_000_000 }).trim({ background: '#00000000', threshold: 10 }).png().toBuffer({ resolveWithObject: true })
      logoSize = { width: trimmed.info.width, height: trimmed.info.height,
        cropX: Math.max(0, -Number(trimmed.info.trimOffsetLeft || 0)), cropY: Math.max(0, -Number(trimmed.info.trimOffsetTop || 0)) }
    } else logoSize = { width: metadata.width, height: metadata.height }
  }
  return bindAccountLogoToFlyerCanvas(canvas, { logoSrc: logo?.dataUrl || '', logoSize, logoPreference: profile.logoPreference })
}

export const applyFlyerAccountLabelTemplates = (canvas: any, templates: Array<{ id: string; name: string; group: any }>): any => {
  const catalog = new Map(templates.map(template => [String(template.id), template]))
  const zones: any[] = []
  const visit = (objects: any[]): void => {
    for (const object of objects || []) {
      if (object?.isProductZone === true || object?.isGridZone === true) zones.push(object)
      if (Array.isArray(object?.objects)) visit(object.objects)
    }
  }
  visit(canvas?.objects)
  const existing = Array.isArray(canvas?.__labelTemplates) ? canvas.__labelTemplates : []
  canvas.__labelTemplates = [
    ...existing.filter((template: any) => !catalog.has(String(template?.id || ''))),
    ...templates
  ]
  for (const zone of zones) {
    const styles = zone._zoneGlobalStyles && typeof zone._zoneGlobalStyles === 'object' ? zone._zoneGlobalStyles : {}
    const selectedId = String(styles.splashTemplateId || zone._zoneTemplateSnapshotId || '').trim()
    if (!selectedId && catalog.has(BUILTIN_DEFAULT_LABEL_TEMPLATE_ID)) {
      zone._zoneGlobalStyles = { ...styles, splashTemplateId: BUILTIN_DEFAULT_LABEL_TEMPLATE_ID }
    }
  }
  return canvas
}

const loadFlyerAccountLabelTemplates = async (canvas: any, userId: string): Promise<any> => {
  const ids = new Set<string>([BUILTIN_DEFAULT_LABEL_TEMPLATE_ID])
  const visit = (objects: any[]): void => {
    for (const object of objects || []) {
      if (object?.isProductZone === true || object?.isGridZone === true) {
        const selectedId = String(object?._zoneGlobalStyles?.splashTemplateId || object?._zoneTemplateSnapshotId || '').trim()
        if (selectedId) ids.add(selectedId)
      }
      if (Array.isArray(object?.objects)) visit(object.objects)
    }
  }
  visit(canvas?.objects)
  const { rows } = await pgQuery<{ id: string; name: string; group: any }>(
    `select distinct on (coalesce(template_key,id))
       coalesce(template_key,id) as id,name,"group"
     from public.label_templates
     where (user_id=$1 or user_id is null)
       and coalesce(template_key,id)=any($2::text[])
     order by coalesce(template_key,id),case when user_id=$1 then 0 else 1 end,updated_at desc`,
    [userId, [...ids]]
  )
  return applyFlyerAccountLabelTemplates(canvas, rows)
}

const VALIDITY_MONTHS = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

/**
 * Converte a validade escrita pelo cliente ("06 e 07 de outubro", "06/10 a 07/10",
 * "05/10/2026", "sem validade") no mesmo estado de datas do Editor Rápido.
 * Texto ambíguo retorna null e continua literal.
 */
export function parseLiteralValidityPeriod(literal: string, today = new Date()): { startDate: string; endDate: string; mode: 'single_day' | 'date_range' } | { mode: 'while_stocks' } | null {
  const text = literal.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
    .replace(/^(?:ofertas?\s+validas?\s*)?(?:(?:de|do|no|nos|dia|dias|valid[ao]s?)\s+)*/, '').replace(/[.!]$/, '').trim()
  if (!text) return null
  if (/^(?:sem validade|enquanto durarem os estoques)$/.test(text)) return { mode: 'while_stocks' }
  const sp = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(today)
  const [currentYear, currentMonth, currentDay] = sp.split('-').map(Number) as [number, number, number]
  const toIso = (day: number, month: number, year?: number): string | null => {
    let resolvedYear = year === undefined ? currentYear : year < 100 ? 2000 + year : year
    // Sem ano informado, uma data muito no passado se refere ao próximo ano (ex.: em dezembro, "05/01").
    if (year === undefined && Date.UTC(resolvedYear, month - 1, day) < Date.UTC(currentYear, currentMonth - 1, currentDay) - 60 * 86_400_000) resolvedYear++
    const date = new Date(Date.UTC(resolvedYear, month - 1, day))
    if (date.getUTCFullYear() !== resolvedYear || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
    return date.toISOString().slice(0, 10)
  }
  const period = (start: string | null, end: string | null) => {
    if (!start || !end || end < start) return null
    return start === end ? { startDate: start, endDate: end, mode: 'single_day' as const } : { startDate: start, endDate: end, mode: 'date_range' as const }
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
  if (iso) { const date = toIso(Number(iso[3]), Number(iso[2]), Number(iso[1])); return period(date, date) }
  const connector = '\\s*(?:a|ate|e|-|–)\\s*'
  const numeric = '(\\d{1,2})[/.](\\d{1,2})(?:[/.](\\d{2}|\\d{4}))?'
  const numericRange = new RegExp(`^${numeric}(?:${connector}${numeric})?$`).exec(text)
  if (numericRange) {
    const endYear = numericRange[6] ? Number(numericRange[6]) : undefined
    const start = toIso(Number(numericRange[1]), Number(numericRange[2]), numericRange[3] ? Number(numericRange[3]) : endYear)
    const end = numericRange[4] ? toIso(Number(numericRange[4]), Number(numericRange[5]), endYear) : start
    return period(start, end)
  }
  const month = `(${VALIDITY_MONTHS.join('|')})`
  const textual = new RegExp(`^(\\d{1,2})(?:\\s+de\\s+${month}(?:\\s+de\\s+(\\d{4}))?)?(?:${connector}(\\d{1,2}))?\\s+de\\s+${month}(?:\\s+de\\s+(\\d{4}))?$`).exec(text)
  if (textual) {
    const endMonth = VALIDITY_MONTHS.indexOf(textual[5]!) + 1
    const endYear = textual[6] ? Number(textual[6]) : undefined
    const startMonth = textual[2] ? VALIDITY_MONTHS.indexOf(textual[2]) + 1 : endMonth
    // Um único dia ("6 de outubro") ou intervalo ("06 e 07 de outubro", "30 de setembro a 2 de outubro").
    if (!textual[4] && textual[2]) return null
    const start = toIso(Number(textual[1]), startMonth, textual[3] ? Number(textual[3]) : endYear)
    const end = textual[4] ? toIso(Number(textual[4]), endMonth, endYear) : start
    return period(start, end)
  }
  return null
}

export function hydrateFlyerBusinessFields(canvas: any, profile: BusinessProfile, logoDataUrl: string, order?: Pick<CreationOrder, 'validity' | 'conditions'>): any {
  const literalValidity = String(order?.validity || '').trim()
  const validityPeriod = literalValidity ? parseLiteralValidityPeriod(literalValidity) : null
  const values: Record<string, string> = {
    companyname: profile.companyName, name: profile.companyName, phone: profile.phone || profile.whatsapp,
    whatsapp: profile.whatsapp, address: profile.address, instagram: profile.instagram,
    facebook: profile.facebook, website: profile.website, slogan: profile.slogan,
    hours: profile.hours, paymentnotes: profile.paymentNotes,
    validity: literalValidity, validitydate: literalValidity, condition: order?.conditions || '', conditions: order?.conditions || ''
  }
  const visit = (objects: any[]): void => {
    for (const object of objects || []) {
      if (!object || typeof object !== 'object') continue
      const field = compact(String(object.businessProfileField || ''))
      const name = compact(String(object.name || ''))
      const logo = object.quickLogoSlot === true || field === 'logo' || /^(?:header|footer|account|business)(?:dynamic)?logo/.test(name)
      if (logo) {
        if (String(object.type || '').toLowerCase() === 'image') { object.src = logoDataUrl; object.visible = !!logoDataUrl }
        else if (!logoDataUrl && object.quickLogoBackdrop) object.visible = false
      } else {
      const semanticField = field || (name === 'headervalidity' ? 'validity' : '')
      const matchedField = semanticField in values ? semanticField : Object.keys(values).find((candidate) => name === candidate || name.endsWith(`dynamic${candidate}`))
        if (matchedField && typeof object.text === 'string') {
          if (matchedField === 'validity' && validityPeriod && isSplitFooterValidity(object)) {
            const dates = 'startDate' in validityPeriod ? validityPeriod : { startDate: '', endDate: '' }
            const state = { startDate: dates.startDate, endDate: dates.endDate, mode: validityPeriod.mode,
              whileStocks: object.quickValidityWhileStocks !== false, dateFormat: object.quickValidityDateFormat || 'numeric' }
            object.text = resolveSplitFooterValidityText(object, objects, state)
            if (dates.startDate) {
              object.quickValidityStartDate = dates.startDate
              object.quickValidityEndDate = dates.endDate
            }
            object.quickValidityMode = validityPeriod.mode
            object.visible = !!object.text
            const copy = splitFooterValidityText({ ...state, layout: object.quickValidityLayout, copyStyle: object.quickValidityCopyStyle })
            for (const sibling of objects) {
              if (sibling.parentFrameId !== object.parentFrameId) continue
              if (sibling.name === 'validity-heading' || sibling.name === 'stock-validity') {
                sibling.text = sibling.name === 'validity-heading' ? copy.heading : copy.stock
                sibling.visible = !!sibling.text
              }
            }
          } else {
            let value = values[matchedField] || ''
            if (matchedField === 'whatsapp' || matchedField === 'address') {
              const contact = matchedField === 'whatsapp'
              const entries = normalizeBusinessEntries(
                contact ? profile.whatsappNumbers : profile.addresses,
                contact ? profile.whatsapp : profile.address,
                matchedField,
                contact ? 80 : 300
              )
              const selected = object.businessProfileEntryIndex === 0 ? entries.slice(0, 1) : entries
              value = contact ? formatBusinessContactValues(selected) : formatBusinessAddressValues(selected)
            }
            const textCase = getDynamicBusinessTextCase(object)
            object.text = transformDynamicBusinessText(value, textCase)
            object.__rawText = value
            object.__textCase = textCase
            object.dynamicTextCase = textCase
            if (!value) object.visible = false
          }
        }
      }
      if (Array.isArray(object.objects)) visit(object.objects)
    }
  }
  visit(canvas?.objects)
  return canvas
}

const INLINE_IMAGE_RE = /^data:(image\/(?:png|jpeg|webp|gif|svg\+xml));base64,([a-zA-Z0-9+/=]+)$/

/**
 * O editor descarta data URLs grandes ao salvar (vira um pixel transparente). Por isso
 * as imagens embutidas pelo render vão para a pasta do projeto do cliente e o canvas
 * passa a referenciá-las pelo storage, como um projeto criado no próprio editor.
 */
export async function externalizeInlineCanvasImages(canvas: any, userId: string, projectId: string): Promise<void> {
  const uploaded = new Map<string, string>()
  const { PutObjectCommand } = await import('@aws-sdk/client-s3')
  const persist = async (src: string): Promise<string | null> => {
    const match = src.length > 2048 ? src.match(INLINE_IMAGE_RE) : null
    if (!match) return null
    const bytes = Buffer.from(match[2]!, 'base64')
    const hash = sha256(bytes)
    const cached = uploaded.get(hash)
    if (cached) return cached
    const extension = match[1] === 'image/jpeg' ? 'jpg' : match[1] === 'image/svg+xml' ? 'svg' : match[1]!.slice(6)
    const key = `projects/${userId}/${projectId}/assets/${hash.slice(0, 32)}.${extension}`
    await getS3Client().send(new PutObjectCommand({ Bucket: videoBucket(), Key: key, Body: bytes, ContentType: match[1] }))
    const ref = `/api/storage/p?key=${encodeURIComponent(key)}`
    uploaded.set(hash, ref)
    return ref
  }
  const visit = async (node: any): Promise<void> => {
    if (!node || typeof node !== 'object') return
    if (typeof node.src === 'string') {
      const ref = await persist(node.src)
      if (ref) { node.src = ref; if (typeof node.__originalSrc === 'string' && node.__originalSrc.startsWith('data:')) node.__originalSrc = ref }
    }
    for (const child of Array.isArray(node.objects) ? node.objects : []) await visit(child)
    if (node.clipPath) await visit(node.clipPath)
  }
  for (const object of canvas?.objects || []) await visit(object)
  for (const key of ['backgroundImage', 'overlayImage']) if (canvas?.[key]) await visit(canvas[key])
}

async function renderFlyer(order: CreationOrder, user: AuthenticatedUser, profile: BusinessProfile, formats: CreationFormat[], images: Map<string, { bytes: Buffer; dataUrl: string }>): Promise<CreationArtifactResult> {
  const cardConfigRow = await pgOneOrNull<{ configuration: unknown }>(
    'select configuration from public.product_card_configurations where user_id=$1 limit 1', [user.id]
  )
  const cardLayout = normalizeProductCardConfiguration(cardConfigRow?.configuration ?? createDefaultProductCardConfiguration())
  const projectTemplate = await pgOneOrNull<any>(
    `select id,user_id,name,canvas_data,template_config,updated_at,is_template
       from public.projects project
      where project.id=$1 and project.is_template=true
        and (project.user_id=$2 or exists(select 1 from public.profiles owner where owner.id=project.user_id and owner.role in ('super_admin','admin')))
      limit 1`,
    [order.header!.id, user.id]
  )
  if (!projectTemplate) fail(404, 'O modelo de encarte não está disponível para esta conta.')
  if (flyerTemplateRevision(projectTemplate.updated_at) !== order.header!.revision) throw headerRevisionChangedError('O cabeçalho do encarte mudou depois da escolha do cliente.')

  const sourceOwnerId = String(projectTemplate.user_id)
  const logo = await profileLogo(profile, user.id)
  const payloadPages: Array<{ format: CreationFormat; page: any; productIds: string[]; department: string | null }> = []
  const productsById = new Map(order.products.map((product) => [product.id, product]))
  for (const format of formats) {
    const { page, canvas } = await getTemplateCanvasPage(projectTemplate, format, format.id, user.id)
    assertFlyerProfileBindings(canvas, profile, !!logo, order.validity)
    const templateConfig = projectTemplate.template_config || {}
    const themeCandidates = [page.templateThemeId, page.templateThemeName, templateConfig.category,
      templateConfig.subcategory, templateConfig.theme, templateConfig.themeName].filter((candidate) => String(candidate || '').trim())
    if (themeCandidates.length && !flyerThemeMatchesOrder(order.theme, themeCandidates)) fail(422, `O modelo não é compatível com o tema ${order.theme}.`)
    const preparedCanvas = await loadFlyerAccountLabelTemplates(
      await embedFlyerAssets(canvas, user.id, sourceOwnerId, logo, profile, order), user.id
    )
    const items = order.products.map((product) => {
      const image = images.get(product.id)
      if (!image) return fail(422, `A foto de “${product.name}” não está disponível.`)
      return { ...product, imageDataUrl: image.dataUrl, condition: product.condition || order.conditions, validity: order.validity }
    })
    if (!flyerDivisionSupportsProductCount(items.length, order.division, format)) fail(422, 'Story com mais de nove produtos precisa ser dividido em páginas.')
    const pages = await renderEditableFlyerCanvas({ canvas: preparedCanvas, products: items, division: order.division, ...(order.pageCount ? { pageCount: order.pageCount } : {}), formatId: format.id, cardLayout })
    for (const result of pages) payloadPages.push({ format, page: result, productIds: result.productIds, department: result.department || null })
  }
  const projectId = deterministicUuid(`${user.id}:${order.id}:${order.revision}:encarte`)
  const savedPages: any[] = []
  const artifacts: CreationArtifact[] = []
  for (let index = 0; index < payloadPages.length; index++) {
    const output = payloadPages[index]!
    const pageId = deterministicUuid(`${projectId}:page:${output.format.id}:${index}`)
    const pageKey = `projects/${user.id}/${projectId}/page_${pageId}.json`
    const now = Date.now()
    await externalizeInlineCanvasImages(output.page.canvas, user.id, projectId)
    const canvasBuffer = Buffer.from(JSON.stringify(output.page.canvas), 'utf8')
    await getS3Client().send(new (await import('@aws-sdk/client-s3')).PutObjectCommand({
      Bucket: videoBucket(), Key: pageKey, Body: gzipSync(canvasBuffer), ContentType: 'application/octet-stream', CacheControl: 'no-store'
    }))
    savedPages.push({
      id: pageId,
      name: output.department ? `${output.department} · ${output.format.id}` : `Página ${index + 1} · ${output.format.id}`,
      width: output.format.width,
      height: output.format.height,
      type: 'RETAIL_OFFER',
      templateModelId: String(output.page.canvas.templateModelId || projectTemplate.template_config?.defaultModelId || projectTemplate.id),
      templateModelName: String(projectTemplate.name),
      templateFormatId: output.format.id,
      templateFormatLabel: output.format.id,
      templateThemeId: order.theme,
      canvasDataPath: pageKey,
      canvasSavedAt: now,
      whatsappCreation: { orderId: order.id, revision: order.revision, productIds: output.productIds }
    })
    const png = Buffer.from(output.page.png)
    const artifact = await putArtifact(user.id, order, projectId, output.format.id, png, 'image/png', `page-${index + 1}.png`)
    artifact.editUrl = `/editor/${projectId}`
    artifacts.push(artifact)
  }
  const canvasData = { pages: savedPages, activePageIndex: 0 }
  const json = parseAndStringifyJsonbParam(canvasData, 'canvas_data')
  const firstPreview = artifacts[0]?.key || null
  const stablePages = savedPages.map(({ canvasSavedAt: _savedAt, ...page }) => page)
  const projectMetadata = { whatsappCreation: { orderId: order.id, revision: order.revision, templateId: projectTemplate.id, contentHash: sha256(Buffer.from(stableJson(stablePages))) } }
  const projectMetadataJson = parseAndStringifyJsonbParam(projectMetadata, 'template_config')
  const inserted = await pgOneOrNull<any>(
    `insert into public.projects(id,name,canvas_data,preview_url,user_id,updated_at,folder_id,last_viewed,is_template,template_config)
     values($1,$2,$3::jsonb,$4,$5,now(),null,now(),false,$6::jsonb)
     on conflict(id) do nothing returning id`,
    [projectId, `WhatsApp · ${order.theme}`.slice(0,120), json, firstPreview, user.id,
      projectMetadataJson]
  )
  if (!inserted) {
    const existing = await pgOneOrNull<any>('select id,user_id,template_config from public.projects where id=$1', [projectId])
    if (existing?.user_id !== user.id || stableJson(existing.template_config) !== stableJson(JSON.parse(projectMetadataJson))) fail(409, 'O projeto desta revisão já existe com outro conteúdo ou pertence a outra conta.')
  } else {
    try { await publishProjectChange({ projectId, userId: user.id, action: 'created', updatedAt: new Date().toISOString() }) } catch (error) { console.warn('[whatsapp-creation] project realtime publication failed', error) }
  }
  return { artifacts }
}

export async function applyFlyerLogoStickers(png: Buffer, canvas: any): Promise<Buffer> {
  const stickers = (objects: any[]): any[] => (objects || []).flatMap(object => {
    if (String(object?.type || '').toLowerCase() === 'image' && object.quickLogoSource && object.__stickerOutlineEnabled) return [object]
    if (Array.isArray(object?.objects)) {
      const children = stickers(object.objects)
      if (children.length) return [{ ...object, objects: children }]
    }
    return []
  })
  const logos = stickers(canvas.objects)
  if (!logos.length) return png
  const width = Number(canvas.width), height = Number(canvas.height)
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) fail(422, 'Dimensões inválidas para o contorno da logo.')
  const { StaticCanvas, getEnv } = await import('fabric/node')
  const document = getEnv().document as unknown as Document
  const overlay = new StaticCanvas(document.createElement('canvas'), {
    width, height, renderOnAddRemove: false, enableRetinaScaling: false
  })
  try {
    await overlay.loadFromJSON({ version: canvas.version, objects: logos })
    bakeLogoCrops(overlay.getObjects(), () => document.createElement('canvas') as HTMLCanvasElement)
    restoreCanvasStickerOutlines(overlay, () => document.createElement('canvas') as HTMLCanvasElement)
    overlay.renderAll()
    const stickerPng = Buffer.from(overlay.toDataURL({ format: 'png', multiplier: 1 }).split(',')[1]!, 'base64')
    const sharp = (await import('sharp')).default
    return sharp(png).composite([{ input: stickerPng, left: 0, top: 0 }]).png().toBuffer()
  } finally {
    await overlay.dispose()
  }
}

export async function renderEditableFlyerCanvas(input: { canvas: any; products: Array<CreationProduct & { imageDataUrl: string }>; division: CreationOrder['division']; pageCount?: number; formatId: string; cardLayout?: ReturnType<typeof createDefaultProductCardConfiguration> }): Promise<Array<{ png: Buffer; canvas: any; productIds: string[]; department: string | null }>> {
  if (flyerRenders >= 1) fail(503, 'O renderizador de encartes está ocupado. Tente novamente em instantes.')
  flyerRenders++
  let dir: string | undefined
  try {
    dir = await mkdtemp(join((await import('node:os')).tmpdir(), 'whatsapp-creation-'))
    const worker = resolve(process.cwd(), 'workers/whatsapp-creation/render.py')
    const inputFile = join(dir, 'input.json')
    await writeFile(inputFile, JSON.stringify(input), { mode: 0o600 })
    const python = process.env.PRODUCT_IMAGE_PYTHON || process.env.WHATSAPP_CREATION_PYTHON || 'python3'
    const result = await execute(python, [worker, '--input', inputFile, '--output-dir', dir], { timeout: 90_000, maxBuffer: MAX_WORKER_BYTES, env: { PATH: process.env.PATH, LANG: 'en_US.UTF-8', PYTHONIOENCODING: 'utf-8', PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH,
      PYTHONPATH: process.env.PYTHONPATH, WHATSAPP_CREATION_CHROMIUM_EXECUTABLE: process.env.WHATSAPP_CREATION_CHROMIUM_EXECUTABLE } })
    const manifest = JSON.parse(result.stdout)
    if (!Array.isArray(manifest.pages) || !manifest.pages.length || manifest.pages.length > 100) fail(502, 'O renderizador não retornou páginas válidas.')
    const pages: Array<{ png: Buffer; canvas: any; productIds: string[]; department: string | null }> = []
    for (const page of manifest.pages) {
      if (!/^page-\d+\.png$/.test(page.name) || !/^page-\d+\.json$/.test(page.canvas)) fail(502, 'O renderizador retornou caminhos inválidos.')
      const canvas = JSON.parse(await readFile(join(dir!, page.canvas), 'utf8'))
      canvas.width = Number(canvas.width || input.canvas.width)
      canvas.height = Number(canvas.height || input.canvas.height)
      const png = await applyFlyerLogoStickers(await readFile(join(dir!, page.name)), canvas)
      pages.push({ png, canvas, productIds: page.productIds, department: page.department || null })
    }
    return pages
  } catch (error: any) {
    if (error?.statusCode) throw error
    console.error('[whatsapp-creation:flyer-render]', String(error?.stderr || error?.message || 'worker failed').slice(0, 500))
    throw createError({ statusCode: error?.killed ? 504 : 422, statusMessage: error?.killed ? 'A prévia do encarte excedeu o tempo limite.' : 'Não foi possível montar a prévia editável do encarte.' })
  } finally {
    flyerRenders--
    if (dir) await rm(dir, { recursive: true, force: true })
  }
}

async function stableVideoAsset(user: AuthenticatedUser, order: CreationOrder, product: CreationProduct, bytes: Buffer): Promise<string> {
  const png = await (await import('sharp')).default(bytes, { limitInputPixels: 24_000_000 }).png().toBuffer()
  const imageHash = sha256(png)
  const id = deterministicUuid(`${user.id}:${order.id}:${order.revision}:video-image:${product.id}:${imageHash}`)
  const key = `video-studio/${user.id}/assets/${id}.png`
  const existing = await pgOneOrNull<any>('select id,user_id,storage_key,metadata from public.video_studio_assets where id=$1', [id])
  if (existing && (existing.user_id !== user.id || existing.storage_key !== key || existing.metadata?.sha256 !== imageHash)) fail(409, 'A imagem de vídeo desta revisão conflita com um asset salvo.')
  if (!existing) {
    await getS3Client().send(new (await import('@aws-sdk/client-s3')).PutObjectCommand({ Bucket: videoBucket(), Key: key, Body: png, ContentType: 'image/png' }))
    await pgQuery('insert into public.video_studio_assets(id,user_id,kind,name,storage_key,content_type,bytes,metadata) values($1,$2,$3,$4,$5,$6,$7,$8::jsonb) on conflict(id) do nothing',
      [id, user.id, 'image', product.name.slice(0,160), key, 'image/png', png.length, videoJson({ whatsappOrderId: order.id, revision: order.revision, itemId: product.id, sha256: imageHash })])
  }
  return id
}

async function renderVideo(order: CreationOrder, user: AuthenticatedUser, profile: BusinessProfile, formats: CreationFormat[], images: Map<string, { bytes: Buffer; dataUrl: string }>, event: H3Event): Promise<CreationArtifactResult> {
  if (order.products.length > 6) fail(422, 'Um vídeo pode conter no máximo seis produtos. Divida o pedido em vídeos separados.')
  assertCanRender(order, user.id, { formatIds: formats.map((format) => format.id), productIds: order.products.map((product) => product.id) })
  if (!order.script || order.scriptApprovedRevision !== order.revision) fail(422, 'O roteiro precisa ser aprovado nesta revisão antes da locução paga.')
  assertCanGeneratePaidVoice(order, user.id)
  const themeId = order.header!.id as VideoDocument['theme']
  if (!VIDEO_THEMES.some((theme) => theme.id === themeId)) fail(422, 'O tema selecionado não é um modelo de vídeo publicado.')
  const resultFormats = formats.map((format) => {
    const found = Object.entries(VIDEO_FORMATS).find(([, dimensions]) => dimensions.width === format.width && dimensions.height === format.height)
    if (!found) return fail(422, `O vídeo não suporta o formato ${format.id} nas dimensões solicitadas.`)
    return found[0] as keyof typeof VIDEO_FORMATS
  })
  if (new Set(resultFormats).size !== resultFormats.length) fail(422, 'O renderizador de vídeo não oferece dois formatos com a mesma orientação.')
  const document = newVideoFromTemplate(themeId)
  document.title = `${profile.companyName || 'Ofertas'} · ${order.theme}`.slice(0,100)
  document.campaign = order.theme || document.campaign
  document.formats = resultFormats
  document.brand = (await loadVideoBrandFromProfile(user.id, user.id)).brand as VideoDocument['brand']
  document.validity = order.validity
  document.offers = []
  for (const product of order.products) {
    const image = images.get(product.id)
    if (!image) return fail(422, `A foto de “${product.name}” não está disponível para o vídeo.`)
    document.offers.push({ id: deterministicUuid(`${order.id}:${product.id}`), name: [product.name, product.brand, product.variant, product.weight].filter(Boolean).join(' '), price: product.price, unit: cartazUnit(product), condition: product.condition || order.conditions, image: await stableVideoAsset(user, order, product, image.bytes) })
  }
  const approvedScript = order.script
  if (!approvedScript || order.scriptApprovedRevision !== order.revision) return fail(422, 'O roteiro aprovado não corresponde às cenas deste vídeo.')
  const scripts = narrationScripts(document, approvedScript)
  if (!scripts) return fail(422, 'O roteiro aprovado não corresponde às cenas deste vídeo.')
  document.scripts = scripts
  document.narrationText = approvedScript
  document.voice.enabled = true
  const scriptSource = videoSpeechSource(document)
  const parsed = videoDocumentSchema.safeParse(document)
  if (!parsed.success) fail(422, `O vídeo não passou pela validação do módulo: ${parsed.error.issues[0]?.message || 'documento inválido'}`)
  const projectId = deterministicUuid(`${user.id}:${order.id}:${order.revision}:video:${resultFormats.join(',')}`)
  const saved = await pgOneOrNull<any>(
    `insert into public.video_studio_projects(id,user_id,title,document,script_source,revision)
     values($1,$2,$3,$4::jsonb,$5,1) on conflict(id) do nothing returning id,revision`,
    [projectId, user.id, document.title, videoJson(parsed.data), scriptSource]
  )
  if (!saved) {
    const existing = await pgOneOrNull<any>('select id,user_id,document,script_source,revision from public.video_studio_projects where id=$1', [projectId])
    if (existing?.user_id !== user.id || stableJson(existing.document) !== stableJson(parsed.data) || existing.script_source !== scriptSource) fail(409, 'O vídeo desta revisão já existe com outro conteúdo.')
  }
  const priorAuthenticated = (event.context as any).authenticatedUser
  if (priorAuthenticated && priorAuthenticated.id !== user.id) fail(403, 'A identidade interna do pedido não corresponde à conta proprietária.')
  const projectRevision = Number(saved?.revision || 1)
  const existingVoiceJob = await pgOneOrNull<any>(
    `select id,status,revision from public.video_studio_jobs
      where user_id=$1 and project_id=$2 and revision=$3 and kind='voice'
      order by created_at desc limit 1`,
    [user.id, projectId, projectRevision]
  )
  if (existingVoiceJob) {
    if (['queued', 'running', 'ready'].includes(String(existingVoiceJob.status))) {
      return { artifacts: [], video: { projectId, revision: projectRevision, phase: 'voice', jobId: String(existingVoiceJob.id) } }
    }
    return fail(409, 'A locução desta revisão falhou; ela não será cobrada novamente automaticamente. Revise o pedido para iniciar outra tentativa.')
  }
  const internalFetch = (event as H3Event & { $fetch?: typeof $fetch }).$fetch
  if (typeof internalFetch !== 'function') fail(503, 'O serviço interno de jobs de vídeo não está disponível nesta execução.')
  try {
    ;(event.context as any).authenticatedUser = user
    const job = await internalFetch('/api/videos/jobs', { method: 'POST', body: { projectId, revision: projectRevision, kind: 'voice' } }) as any
    return { artifacts: [], video: { projectId, revision: projectRevision, phase: 'voice', jobId: String(job.id) } }
  } finally {
    if (priorAuthenticated) (event.context as any).authenticatedUser = priorAuthenticated
    else delete (event.context as any).authenticatedUser
  }
}

export async function generateCreationArtifact(order: CreationOrder, user: AuthenticatedUser, profile: BusinessProfile, event: H3Event): Promise<CreationArtifactResult> {
  if (order.accountId !== user.id) fail(403, 'O pedido pertence a outra conta.')
  const formats = [...order.formats] as CreationFormat[]
  if (order.kind === 'video') {
    // The video engine emits one MP4 per supported orientation and caps each video at six offers.
    if (order.products.length > 6) fail(422, 'Um vídeo pode conter no máximo seis produtos. Divida o pedido em vídeos separados.')
    assertCanRender(order, user.id, { formatIds: formats.map((format) => format.id), productIds: order.products.map((product) => product.id) })
    const images = await approvedProductImages(order, user.id)
    return renderVideo(order, user, profile, formats, images, event)
  }
  assertCanRender(order, user.id)
  const images = order.products.length ? await approvedProductImages(order, user.id) : new Map<string, { bytes: Buffer; dataUrl: string }>()
  if (order.kind === 'encarte') return renderFlyer(order, user, profile, formats, images)
  if (order.kind === 'cartaz') return renderCartazista(order, user, profile, formats, images)
  return renderStudio(order, user, profile, formats, images)
}
