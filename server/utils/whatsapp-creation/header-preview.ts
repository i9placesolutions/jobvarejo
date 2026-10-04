import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import sharp from 'sharp'
import { createError } from 'h3'
import type { CreationKind } from '~/shared/whatsapp-creation'
import type { ResolvedWhatsAppAccount } from './access'
import type { CreationHeader } from './catalog'
import { renderCreationHeaderPreview } from './render'
import { getS3Client } from '../s3'
import { videoBucket } from '../video-studio/service'
import { isStorageKeyAllowedForUser, isValidStoragePath } from '../storage-scope'
import { extractStorageKeyFromRef } from '~/utils/storageRef'

const MAX_THUMBNAIL_BYTES = 8 * 1024 * 1024
const MAX_CANVAS_BYTES = 32 * 1024 * 1024

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

async function renderFlyerHeaderPreview(header: CreationHeader, account: ResolvedWhatsAppAccount): Promise<Buffer> {
  const { sourceOwnerId, sourceThumbnailKey, sourceCanvasKey, sourcePageHeight } = header
  const prefix = `projects/${sourceOwnerId}/${header.id}/`
  if (!sourceOwnerId || !sourceThumbnailKey || !sourceCanvasKey || !sourcePageHeight ||
    !isValidStoragePath(sourceThumbnailKey) || !isValidStoragePath(sourceCanvasKey) ||
    !sourceThumbnailKey.startsWith(prefix) || !sourceCanvasKey.startsWith(prefix)) {
    throw createError({ statusCode: 422, statusMessage: 'O cabeçalho do modelo não possui uma prévia autorizada.' })
  }
  const [thumbnail, compressed] = await Promise.all([
    sourceBytes(sourceThumbnailKey, MAX_THUMBNAIL_BYTES),
    sourceBytes(sourceCanvasKey, MAX_CANVAS_BYTES)
  ])
  let canvas: { objects?: any[] }
  try { canvas = JSON.parse(gunzipSync(compressed, { maxOutputLength: MAX_CANVAS_BYTES }).toString('utf8')) }
  catch { throw createError({ statusCode: 422, statusMessage: 'O canvas do cabeçalho está inválido.' }) }
  const metadata = await sharp(thumbnail).metadata()
  if (!metadata.width || !metadata.height) throw createError({ statusCode: 422, statusMessage: 'A imagem do cabeçalho está inválida.' })
  const height = flyerHeaderCropHeight(canvas, sourcePageHeight, metadata.height)
  const logoBox = flyerHeaderLogoBox(canvas, sourcePageHeight, metadata.width, metadata.height)
  if (logoBox.top + logoBox.height > height) throw createError({ statusCode: 422, statusMessage: 'A logo do modelo ultrapassa o cabeçalho.' })
  const config = useRuntimeConfig()
  const logoKey = extractStorageKeyFromRef(account.businessProfile.logo, { bucket: config.wasabiBucket, endpoint: config.wasabiEndpoint })
  if (!logoKey || !isValidStoragePath(logoKey) || !isStorageKeyAllowedForUser(logoKey, account.user.id)) {
    throw createError({ statusCode: 422, statusMessage: 'Cadastre uma logo válida no perfil comercial para escolher o cabeçalho.' })
  }
  const logo = await sourceBytes(logoKey, MAX_THUMBNAIL_BYTES)
  const logoPng = await sharp(logo).resize(Math.max(1, logoBox.width - 28), Math.max(1, logoBox.height - 28), {
    fit: 'contain', withoutEnlargement: true
  }).png().toBuffer()
  const logoMetadata = await sharp(logoPng).metadata()
  const cover = Buffer.from(`<svg width="${logoBox.width}" height="${logoBox.height}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" rx="12" fill="white"/></svg>`)
  return sharp(thumbnail).extract({ left: 0, top: 0, width: metadata.width, height }).composite([
    { input: cover, left: logoBox.left, top: logoBox.top },
    { input: logoPng, left: logoBox.left + Math.floor((logoBox.width - logoMetadata.width!) / 2), top: logoBox.top + Math.floor((logoBox.height - logoMetadata.height!) / 2) }
  ]).png().toBuffer()
}

/** Reusable preview in this customer's namespace; no project/job/paid call. */
export async function prepareCreationHeader(header: CreationHeader, kind: CreationKind, account: ResolvedWhatsAppAccount): Promise<CreationHeader> {
  if (kind !== 'encarte' && (header.headerKey || header.previewUrl)) return header
  const png = kind === 'encarte'
    ? await renderFlyerHeaderPreview(header, account)
    : await renderCreationHeaderPreview(header, kind, account.user, account.businessProfile)
  const hash = createHash('sha256').update(png).digest('hex')
  const key = `whatsapp-creation/${account.user.id}/headers/${hash}.png`
  await getS3Client().send(new PutObjectCommand({ Bucket: videoBucket(), Key: key, Body: png, ContentType: 'image/png' }))
  return { ...header, headerKey: key }
}
