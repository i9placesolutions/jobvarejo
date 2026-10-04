import { createHash, randomUUID } from 'node:crypto'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { createError } from 'h3'
import sharp from 'sharp'
import type { CreationProduct } from '../../../shared/whatsapp-creation'
import { getS3Client } from '../s3'
import { videoBucket } from '../video-studio/service'
import { ownedStorageBytes } from './media'

const MAX_PRODUCTS = 120
const BOARD_PRODUCT_LIMIT = 12
const MAX_IMAGE_BYTES = 12 * 1024 * 1024
const MAX_INPUT_PIXELS = 24_000_000
const BOARD_WIDTH = 1600
const HEADER_HEIGHT = 150
const CARD_WIDTH = 490
const CARD_HEIGHT = 410
const CARD_GAP = 24
const BOARD_MARGIN = 38
const CARD_COLUMNS = 3

export interface ProductReviewCandidate {
  itemId: string
  key: string
  hash: string
}

export interface CreateProductReviewBoardsInput {
  accountId: string
  orderId: string
  revision: number
  validity: string
  products: CreationProduct[]
  candidates: ProductReviewCandidate[]
}

const invalidInput = (): never => {
  throw createError({ statusCode: 400, statusMessage: 'Dados da revisão de produtos inválidos.' })
}

const escapeXml = (value: string): string => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&apos;')

const isPlainText = (value: unknown, maxLength: number): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= maxLength && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)
const isUuid = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)

const wrapText = (value: string, lineLength: number, maxLines: number): string[] => {
  const words = value.trim().split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    if (word.length > lineLength) {
      if (line) lines.push(line)
      line = word.slice(0, lineLength)
      if (lines.length === maxLines) break
      continue
    }
    if (line && `${line} ${word}`.length > lineLength) {
      lines.push(line)
      line = word
      if (lines.length === maxLines) break
    } else {
      line = line ? `${line} ${word}` : word
    }
  }
  if (lines.length < maxLines && line) lines.push(line)
  if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) {
    const last = lines.length - 1
    lines[last] = `${lines[last]!.slice(0, Math.max(0, lineLength - 1))}…`
  }
  return lines
}

const validateInput = (input: CreateProductReviewBoardsInput): void => {
  if (!input || typeof input !== 'object' ||
    !isUuid(input.accountId) || !isUuid(input.orderId) ||
    !Number.isSafeInteger(input.revision) || input.revision < 1 || input.revision > 1_000_000 ||
    !isPlainText(input.validity, 240) || !Array.isArray(input.products) ||
    input.products.length < 1 || input.products.length > MAX_PRODUCTS || !Array.isArray(input.candidates) ||
    input.candidates.length > input.products.length) invalidInput()

  const productIds = new Set<string>()
  for (const product of input.products) {
    if (!product || !isPlainText(product.id, 100) || productIds.has(product.id) ||
      !isPlainText(product.name, 176) || !isPlainText(product.price, 80)) invalidInput()
    productIds.add(product.id)
  }

  const candidateIds = new Set<string>()
  for (const candidate of input.candidates) {
    if (!candidate || !isPlainText(candidate.itemId, 100) || !productIds.has(candidate.itemId) ||
      candidateIds.has(candidate.itemId) || !isPlainText(candidate.key, 1024) ||
      candidate.key.startsWith('/') || candidate.key.split('/').some(part => part === '..') ||
      !isPlainText(candidate.hash, 256)) invalidInput()
    candidateIds.add(candidate.itemId)
  }
}

function boardSvg(products: CreationProduct[], startIndex: number, validity: string, photoItemIds: ReadonlySet<string>): { svg: Buffer; imageSlots: Array<{ itemId: string; left: number; top: number; width: number; height: number }> } {
  const columns = products.length <= 4 ? 2 : CARD_COLUMNS
  const width = Math.max(1080, BOARD_MARGIN * 2 + columns * CARD_WIDTH + Math.max(0, columns - 1) * CARD_GAP)
  const rows = Math.ceil(products.length / columns)
  const height = HEADER_HEIGHT + BOARD_MARGIN * 2 + rows * CARD_HEIGHT + Math.max(0, rows - 1) * CARD_GAP
  const fragments = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    '<rect width="100%" height="100%" fill="#f3f5f7"/>',
    '<text x="38" y="57" font-family="Arial, sans-serif" font-size="34" font-weight="700" fill="#15202b">Revisão dos produtos</text>',
    `<text x="38" y="104" font-family="Arial, sans-serif" font-size="22" fill="#344054">Validade: ${escapeXml(validity)}</text>`
  ]
  const imageSlots: Array<{ itemId: string; left: number; top: number; width: number; height: number }> = []

  products.forEach((product, index) => {
    const column = index % columns
    const row = Math.floor(index / columns)
    const x = BOARD_MARGIN + column * (CARD_WIDTH + CARD_GAP)
    const y = HEADER_HEIGHT + BOARD_MARGIN + row * (CARD_HEIGHT + CARD_GAP)
    const image = { left: x + 20, top: y + 62, width: CARD_WIDTH - 40, height: 163 }
    const number = startIndex + index + 1
    const nameLines = wrapText(product.name.trim(), 42, 4)
    const hasPhoto = photoItemIds.has(product.id)

    fragments.push(`<rect x="${x}" y="${y}" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" rx="18" fill="#ffffff" stroke="#d0d5dd" stroke-width="2"/>`)
    fragments.push(`<circle cx="${x + 34}" cy="${y + 34}" r="22" fill="#175cd3"/><text x="${x + 34}" y="${y + 42}" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" font-weight="700" fill="#ffffff">${number}</text>`)
    fragments.push(`<rect x="${image.left}" y="${image.top}" width="${image.width}" height="${image.height}" rx="10" fill="#f2f4f7" stroke="#d0d5dd"${hasPhoto ? '' : ' stroke-dasharray="8 6"'}/>`)
    if (!hasPhoto) fragments.push(`<text x="${x + CARD_WIDTH / 2}" y="${image.top + 112}" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" fill="#667085">Foto não enviada</text>`)
    nameLines.forEach((line, lineIndex) => {
      fragments.push(`<text x="${x + 22}" y="${y + 264 + lineIndex * 23}" font-family="Arial, sans-serif" font-size="19" font-weight="600" fill="#101828">${escapeXml(line)}</text>`)
    })
    fragments.push(`<text x="${x + 22}" y="${y + 382}" font-family="Arial, sans-serif" font-size="28" font-weight="700" fill="#175cd3">${escapeXml(product.price)}</text>`)
    imageSlots.push({ itemId: product.id, ...image })
  })
  fragments.push('</svg>')
  return { svg: Buffer.from(fragments.join('')), imageSlots }
}

/** Generates and stores one or more numbered product review boards for a WhatsApp order. */
export async function createProductReviewBoards(input: CreateProductReviewBoardsInput): Promise<string[]> {
  validateInput(input)
  const candidateByItem = new Map(input.candidates.map(candidate => [candidate.itemId, candidate]))
  const bucket = videoBucket()
  if (!bucket || bucket.length > 255) throw createError({ statusCode: 503, statusMessage: 'Armazenamento indisponível.' })

  const keys: string[] = []
  for (let offset = 0; offset < input.products.length; offset += BOARD_PRODUCT_LIMIT) {
    const products = input.products.slice(offset, offset + BOARD_PRODUCT_LIMIT)
    const { svg, imageSlots } = boardSvg(products, offset, input.validity, new Set(candidateByItem.keys()))
    const composites: sharp.OverlayOptions[] = []
    for (const slot of imageSlots) {
      const candidate = candidateByItem.get(slot.itemId)
      if (!candidate) continue
      const bytes = await ownedStorageBytes(candidate.key, input.accountId)
      if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) {
        throw createError({ statusCode: 422, statusMessage: 'Uma imagem de produto excede o limite permitido.' })
      }
      if (createHash('sha256').update(bytes).digest('hex') !== candidate.hash.toLowerCase()) {
        throw createError({ statusCode: 409, statusMessage: 'Uma foto de produto mudou antes da conferência.' })
      }
      const image = await sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS })
        .rotate()
        .resize(slot.width - 20, slot.height - 20, { fit: 'inside', withoutEnlargement: true })
        .png()
        .toBuffer()
      const metadata = await sharp(image).metadata()
      if (!metadata.width || !metadata.height || metadata.width > slot.width || metadata.height > slot.height) {
        throw createError({ statusCode: 422, statusMessage: 'Uma imagem de produto é inválida.' })
      }
      composites.push({ input: image, left: slot.left + Math.floor((slot.width - metadata.width) / 2), top: slot.top + Math.floor((slot.height - metadata.height) / 2) })
    }

    const png = await sharp(svg, { limitInputPixels: MAX_INPUT_PIXELS })
      .composite(composites)
      .png({ compressionLevel: 9 })
      .toBuffer()
    const key = `whatsapp-creation/${input.accountId}/${input.orderId}/r${input.revision}/review-${randomUUID()}.png`
    await getS3Client().send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: png, ContentType: 'image/png' }))
    keys.push(key)
  }
  return keys
}
