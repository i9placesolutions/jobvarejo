import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import sharp from 'sharp'
import { createError } from 'h3'
import type { CreationKind } from '~/shared/whatsapp-creation'
import type { ResolvedWhatsAppAccount } from './access'
import type { CreationHeader } from './catalog'
import { hydrateFlyerBusinessFields, renderCreationHeaderPreview } from './render'
import { getS3Client } from '../s3'
import { videoBucket } from '../video-studio/service'
import { isPublicStorageKey, isStorageKeyAllowedForUser, isValidStoragePath } from '../storage-scope'
import { extractStorageKeyFromRef } from '~/utils/storageRef'
import { bindAccountLogoToFlyerCanvas } from '~/utils/accountFlyerTemplatePreview'
import { restoreCanvasStickerOutlines } from '~/utils/editorStickerOutline'

const MAX_THUMBNAIL_BYTES = 8 * 1024 * 1024
const MAX_CANVAS_BYTES = 32 * 1024 * 1024
const HEADER_WIDTH = 800
// Incrementar quando a renderização do cabeçalho mudar, para invalidar o cache.
const HEADER_CACHE_VERSION = 1
let headerFontsReady = false

export function flyerHeaderCropHeight(canvas: { objects?: any[] }, pageHeight: number, imageHeight: number): number {
  const boundaries = (canvas.objects || [])
    .filter(object => object?.name === 'product-section-surface' && object.originY === 'top')
    .map(object => Number(object.top))
    .filter(top => Number.isFinite(top) && top > 0 && top < pageHeight)
  const boundary = Math.min(...boundaries)
  if (!Number.isFinite(boundary) || !Number.isFinite(pageHeight) || pageHeight <= 0 || !Number.isFinite(imageHeight) || imageHeight <= 0) {
    throw createError({ statusCode: 422, statusMessage: 'O modelo não informa onde termina o cabeçalho.' })
  }
  return Math.max(1, Math.min(imageHeight, Math.round(boundary * imageHeight / pageHeight)))
}

export function flyerHeaderLogoBox(canvas: { objects?: any[] }, pageHeight: number, imageWidth: number, imageHeight: number): { left: number; top: number; width: number; height: number } {
  const slot = (canvas.objects || []).find(object =>
    object && (object.quickLogoSlot === true || object.businessProfileField === 'logo') &&
    Number(object.top) >= 0 && Number(object.top) < pageHeight)
  if (!slot) throw createError({ statusCode: 422, statusMessage: 'O cabeçalho não possui espaço para a logo do cliente.' })
  const scale = imageHeight / pageHeight
  const width = Number(slot.width) * Number(slot.scaleX || 1) * scale
  const height = Number(slot.height) * Number(slot.scaleY || 1) * scale
  const rawLeft = (Number(slot.left) - (slot.originX === 'center' ? Number(slot.width) * Number(slot.scaleX || 1) / 2 : 0)) * scale
  const rawTop = (Number(slot.top) - (slot.originY === 'center' ? Number(slot.height) * Number(slot.scaleY || 1) / 2 : 0)) * scale
  const left = Math.max(0, Math.floor(rawLeft - 8))
  const top = Math.max(0, Math.floor(rawTop - 8))
  const right = Math.min(imageWidth, Math.ceil(rawLeft + width + 8))
  const bottom = Math.min(imageHeight, Math.ceil(rawTop + height + 8))
  if (![left, top, right, bottom].every(Number.isFinite) || right <= left || bottom <= top) {
    throw createError({ statusCode: 422, statusMessage: 'O espaço da logo do cabeçalho está inválido.' })
  }
  return { left, top, width: right - left, height: bottom - top }
}

async function sourceBytes(key: string, maximum: number): Promise<Buffer> {
  const response = await getS3Client().send(new GetObjectCommand({ Bucket: videoBucket(), Key: key }))
  if (Number(response.ContentLength) > maximum) throw createError({ statusCode: 422, statusMessage: 'A prévia do modelo excede o limite.' })
  const bytes = Buffer.from(await response.Body!.transformToByteArray())
  if (bytes.length > maximum) throw createError({ statusCode: 422, statusMessage: 'A prévia do modelo excede o limite.' })
  return bytes
}

async function registerHeaderFonts(): Promise<void> {
  if (headerFontsReady) return
  const { registerFont } = await import('canvas')
  const variants = [
    ['Regular', '400', 'normal'], ['SemiBold', '600', 'normal'],
    ['Bold', '700', 'normal'], ['ExtraBold', '800', 'normal']
  ] as const
  for (const [variant, weight, style] of variants) {
    const relative = `art-studio/fonts/Barlow-${variant}.ttf`
    const path = [resolve('public', relative), resolve('.output/public', relative)].find(existsSync)
    if (path) registerFont(path, { family: 'Barlow', weight, style })
  }
  headerFontsReady = true
}

const DECODED_IMAGE_REF = '__headerDecodedImage'
const PLACEHOLDER_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

/**
 * O Fabric no Node carrega data URLs pelo jsdom, que leva ~1,7s por imagem de
 * alguns MB e bloqueia o event loop; o node-canvas decodifica o mesmo buffer em
 * ~20ms. As imagens raster são decodificadas antes e entram no lugar de um placeholder.
 */
async function decodeRasterImages(objects: any[]): Promise<Map<string, unknown>> {
  const { loadImage } = await import('canvas')
  const decoded = new Map<string, unknown>()
  const pending: Promise<void>[] = []
  const visit = (items: any[]): void => {
    for (const object of items || []) {
      const match = object?.type === 'Image' && typeof object.src === 'string'
        ? object.src.match(/^data:image\/(?:png|jpeg|gif);base64,(.+)$/) : null
      if (match) {
        const ref = String(pending.length)
        pending.push(loadImage(Buffer.from(match[1]!, 'base64')).then(element => {
          decoded.set(ref, element)
          object.src = PLACEHOLDER_PNG
          object[DECODED_IMAGE_REF] = ref
        }).catch(() => {
          // Mantém a data URL original; o Fabric ainda consegue carregá-la pelo caminho lento.
        }))
      }
      if (Array.isArray(object?.objects)) visit(object.objects)
    }
  }
  visit(objects)
  await Promise.all(pending)
  return decoded
}

function attachDecodedImages(objects: any[], decoded: Map<string, unknown>): void {
  for (const object of objects || []) {
    const element = object?.[DECODED_IMAGE_REF] !== undefined ? decoded.get(object[DECODED_IMAGE_REF]) : undefined
    if (element) object.setElement(element, { width: object.width, height: object.height })
    if (typeof object?.getObjects === 'function') attachDecodedImages(object.getObjects(), decoded)
  }
}

/** Uses the same Fabric logo binding and sticker renderer as the editor preview. */
async function renderHeaderCanvas(canvas: any, sourceOwnerId: string, account: ResolvedWhatsAppAccount, logo: Buffer, height: number): Promise<Buffer> {
  const config = useRuntimeConfig()
  const originalMetadata = await sharp(logo, { limitInputPixels: 16_000_000 }).metadata()
  if (!originalMetadata.format) throw createError({ statusCode: 422, statusMessage: 'A logo do perfil está inválida.' })
  const usableLogo = ['png', 'jpeg', 'webp'].includes(originalMetadata.format) ? logo : await sharp(logo, { limitInputPixels: 16_000_000 }).png().toBuffer()
  const logoMetadata = await sharp(usableLogo, { limitInputPixels: 16_000_000 }).metadata()
  if (!logoMetadata.width || !logoMetadata.height) throw createError({ statusCode: 422, statusMessage: 'A logo do perfil está inválida.' })
  const trimmed = logoMetadata.hasAlpha
    ? await sharp(usableLogo, { limitInputPixels: 16_000_000 }).trim({ background: '#00000000', threshold: 10 }).png().toBuffer({ resolveWithObject: true })
    : null
  const logoMime = logoMetadata.format === 'jpeg' ? 'image/jpeg' : logoMetadata.format === 'webp' ? 'image/webp' : 'image/png'
  const logoDataUrl = `data:${logoMime};base64,${usableLogo.toString('base64')}`
  const validity = (canvas.objects || []).find((object: any) => object?.name === 'header-validity')?.text || ''
  hydrateFlyerBusinessFields(canvas, account.businessProfile, logoDataUrl, { validity, conditions: '' })
  const prepared = bindAccountLogoToFlyerCanvas(canvas, {
    logoSrc: logoDataUrl,
    logoSize: trimmed ? {
      width: trimmed.info.width, height: trimmed.info.height,
      cropX: Math.max(0, -Number(trimmed.info.trimOffsetLeft || 0)),
      cropY: Math.max(0, -Number(trimmed.info.trimOffsetTop || 0))
    } : { width: logoMetadata.width, height: logoMetadata.height },
    logoPreference: account.businessProfile.logoPreference
  })
  const pageWidth = Number(prepared.width || 1080)
  const scale = HEADER_WIDTH / pageWidth
  // Canvas objects below the product boundary cannot contribute to the header.
  prepared.objects = (prepared.objects || []).filter((object: any) =>
    object?.isFrame === true || /frame/i.test(String(object?.name || '')) ||
    Number(object?.top || 0) - Number(object?.height || 0) * Number(object?.scaleY || 1) / (object?.originY === 'center' ? 2 : 1) < height / scale)
  const images: any[] = []
  const visit = (objects: any[]): void => {
    for (const object of objects || []) {
      if (object?.type === 'Image' && object.src && !String(object.src).startsWith('data:')) images.push(object)
      if (Array.isArray(object?.objects)) visit(object.objects)
      if (object?.clipPath) delete object.clipPath
      if (object?._frameClipOwner) delete object._frameClipOwner
    }
  }
  visit(prepared.objects)
  if (images.length > 12) throw createError({ statusCode: 422, statusMessage: 'O cabeçalho possui imagens demais para a prévia.' })
  await Promise.all(images.map(async object => {
    const key = extractStorageKeyFromRef(object.src, { bucket: config.wasabiBucket, endpoint: config.wasabiEndpoint })
    if (!key || !isValidStoragePath(key) || !(key.startsWith(`projects/${sourceOwnerId}/`) || key.startsWith('templates/') || isPublicStorageKey(key))) {
      throw createError({ statusCode: 403, statusMessage: 'O cabeçalho usa uma imagem fora do catálogo autorizado.' })
    }
    const bytes = await sourceBytes(key, MAX_THUMBNAIL_BYTES)
    const metadata = await sharp(bytes, { limitInputPixels: 24_000_000 }).metadata()
    if (!metadata.format || !metadata.width || !metadata.height) throw createError({ statusCode: 422, statusMessage: 'Uma imagem do cabeçalho está inválida.' })
    const supported = ['png', 'jpeg', 'gif', 'svg'].includes(metadata.format)
    const encoded = supported ? bytes : await sharp(bytes).png().toBuffer()
    const mime = metadata.format === 'svg' ? 'image/svg+xml' : supported ? `image/${metadata.format}` : 'image/png'
    object.src = `data:${mime};base64,${encoded.toString('base64')}`
  }))
  const decoded = await decodeRasterImages(prepared.objects)
  await registerHeaderFonts()
  const { StaticCanvas, getEnv } = await import('fabric/node')
  const document = getEnv().document as unknown as Document
  const output = new StaticCanvas(document.createElement('canvas'), {
    width: HEADER_WIDTH, height, backgroundColor: '#ffffff', renderOnAddRemove: false, enableRetinaScaling: false
  })
  try {
    await output.loadFromJSON(prepared)
    attachDecodedImages(output.getObjects(), decoded)
    output.setDimensions({ width: HEADER_WIDTH, height })
    output.viewportTransform = [scale, 0, 0, scale, 0, 0]
    restoreCanvasStickerOutlines(output, () => document.createElement('canvas') as HTMLCanvasElement)
    output.renderAll()
    return Buffer.from(output.toDataURL({ format: 'png', multiplier: 1 }).split(',')[1]!, 'base64')
  } finally {
    await output.dispose()
  }
}

async function renderFlyerHeaderPreview(header: CreationHeader, account: ResolvedWhatsAppAccount): Promise<Buffer> {
  const { sourceOwnerId, sourceThumbnailKey, sourceCanvasKey, sourcePageHeight } = header
  const prefix = `projects/${sourceOwnerId}/${header.id}/`
  if (!sourceOwnerId || !sourceThumbnailKey || !sourceCanvasKey || !sourcePageHeight ||
    !isValidStoragePath(sourceThumbnailKey) || !isValidStoragePath(sourceCanvasKey) ||
    !sourceThumbnailKey.startsWith(prefix) || !sourceCanvasKey.startsWith(prefix)) {
    throw createError({ statusCode: 422, statusMessage: 'O cabeçalho do modelo não possui uma prévia autorizada.' })
  }
  const compressed = await sourceBytes(sourceCanvasKey, MAX_CANVAS_BYTES)
  let canvas: { objects?: any[] }
  try { canvas = JSON.parse(gunzipSync(compressed, { maxOutputLength: MAX_CANVAS_BYTES }).toString('utf8')) }
  catch { throw createError({ statusCode: 422, statusMessage: 'O canvas do cabeçalho está inválido.' }) }
  const pageWidth = Number((canvas as any).width || 1080)
  if (!Number.isFinite(pageWidth) || pageWidth < 320 || pageWidth > 8192) throw createError({ statusCode: 422, statusMessage: 'A largura do cabeçalho está inválida.' })
  const height = flyerHeaderCropHeight(canvas, sourcePageHeight, Math.round(sourcePageHeight * HEADER_WIDTH / pageWidth))
  const logoBox = flyerHeaderLogoBox(canvas, sourcePageHeight, HEADER_WIDTH, Math.round(sourcePageHeight * HEADER_WIDTH / pageWidth))
  if (logoBox.top + logoBox.height > height) throw createError({ statusCode: 422, statusMessage: 'A logo do modelo ultrapassa o cabeçalho.' })
  const config = useRuntimeConfig()
  const logoKey = extractStorageKeyFromRef(account.businessProfile.logo, { bucket: config.wasabiBucket, endpoint: config.wasabiEndpoint })
  if (!logoKey || !isValidStoragePath(logoKey) || !isStorageKeyAllowedForUser(logoKey, account.user.id)) {
    throw createError({ statusCode: 422, statusMessage: 'Cadastre uma logo válida no perfil comercial para escolher o cabeçalho.' })
  }
  const logo = await sourceBytes(logoKey, MAX_THUMBNAIL_BYTES)
  return renderHeaderCanvas(canvas, sourceOwnerId, account, logo, height)
}

/** A logo pode ser substituída no mesmo caminho; o ETag garante que o cache acompanhe o arquivo atual. */
async function flyerHeaderCacheKey(header: CreationHeader, account: ResolvedWhatsAppAccount): Promise<string | undefined> {
  const config = useRuntimeConfig()
  const logoKey = extractStorageKeyFromRef(account.businessProfile.logo, { bucket: config.wasabiBucket, endpoint: config.wasabiEndpoint })
  if (!logoKey || !isValidStoragePath(logoKey) || !isStorageKeyAllowedForUser(logoKey, account.user.id)) return undefined
  const logoTag = await getS3Client().send(new HeadObjectCommand({ Bucket: videoBucket(), Key: logoKey })).then(head => head.ETag, () => undefined)
  if (!logoTag) return undefined
  const hash = createHash('sha256').update(JSON.stringify([
    HEADER_CACHE_VERSION, header.id, header.revision, header.sourceCanvasKey, header.sourcePageHeight, logoTag, account.businessProfile
  ])).digest('hex')
  return `whatsapp-creation/${account.user.id}/headers/cache-${hash}.png`
}

/** Reusable preview in this customer's namespace; no project/job/paid call. */
export async function prepareCreationHeader(header: CreationHeader, kind: CreationKind, account: ResolvedWhatsAppAccount): Promise<CreationHeader> {
  if (kind !== 'encarte' && (header.headerKey || header.previewUrl)) return header
  // A mesma revisão do modelo com o mesmo perfil e a mesma logo gera o mesmo PNG; reaproveita sem renderizar de novo.
  const cacheKey = kind === 'encarte' ? await flyerHeaderCacheKey(header, account) : undefined
  if (cacheKey) {
    const cached = await getS3Client().send(new HeadObjectCommand({ Bucket: videoBucket(), Key: cacheKey })).then(() => true, () => false)
    if (cached) return { ...header, headerKey: cacheKey }
  }
  const png = kind === 'encarte'
    ? await renderFlyerHeaderPreview(header, account)
    : await renderCreationHeaderPreview(header, kind, account.user, account.businessProfile)
  const key = cacheKey || `whatsapp-creation/${account.user.id}/headers/${createHash('sha256').update(png).digest('hex')}.png`
  await getS3Client().send(new PutObjectCommand({ Bucket: videoBucket(), Key: key, Body: png, ContentType: 'image/png' }))
  return { ...header, headerKey: key }
}
