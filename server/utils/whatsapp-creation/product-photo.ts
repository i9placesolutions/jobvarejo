import { createHash } from 'node:crypto'
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import type { CreationProduct } from '~/shared/whatsapp-creation'
import { getS3Client, getPublicUrl } from '../s3'
import { processImageWithOptions } from '../image-processor'
import { trimRasterImageBuffer } from '../image-trim'
import { saveProductImageCache } from '../product-image-cache'
import { buildProductIdentityKey, upsertProductImageRegistry } from '../product-image-registry'
import { normalizeSearchTerm } from '../product-image-matching'
import { videoBucket } from '../video-studio/service'
import { ownedStorageBytes } from './media'

// Mesma versão de processamento do upload manual (server/api/upload-product-image.post.ts).
const PROCESS_VERSION = 'birefnet-v2'
const INBOUND_KEY = /^whatsapp-creation\/[0-9a-f-]{36}\/inbound\/[0-9a-f-]{36}\.(?:jpe?g|png|webp)$/i

/** Só as fotos enviadas pelo cliente chegam cruas; as do catálogo já foram processadas. */
export const isRawWhatsAppPhoto = (key: string): boolean => INBOUND_KEY.test(String(key || '').trim())

const productTerm = (product: CreationProduct): string =>
  [product.name, product.brand, product.variant, product.weight].filter(value => String(value || '').trim()).join(' ')

/**
 * Nome no padrão do upload manual. O hash da foto original substitui o hash do
 * conteúdo final para que a mesma foto do mesmo produto sempre caia na mesma chave.
 */
export function processedPhotoKey(product: CreationProduct, rawHash: string): string {
  const normalizedTerm = normalizeSearchTerm(productTerm(product))
  const safeName = (normalizedTerm || product.name.toLowerCase())
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50)
  const nameHash = createHash('sha256').update(normalizedTerm || product.name).digest('hex').substring(0, 12)
  return `imagens/manual-${safeName}-${nameHash}-${PROCESS_VERSION}-${rawHash.substring(0, 16)}-bg.webp`
}

const inFlight = new Map<string, Promise<Buffer | null>>()
// Recortes recusados não são refeitos a cada geração enquanto o processo estiver vivo.
const refused = new Set<string>()

/**
 * Remove o fundo da foto enviada pelo WhatsApp com o mesmo pipeline do upload manual
 * e salva no Wasabi com o nome do produto, registrando no banco de imagens da conta.
 * Retorna null quando o recorte foi recusado; nesse caso a foto original continua valendo.
 */
export async function ensureProcessedWhatsAppPhoto(input: { userId: string; product: CreationProduct; rawKey: string; rawHash: string; rawBytes?: Buffer }): Promise<Buffer | null> {
  if (!isRawWhatsAppPhoto(input.rawKey)) return null
  const key = processedPhotoKey(input.product, input.rawHash)
  if (refused.has(key)) return null
  const running = inFlight.get(key)
  if (running) return running
  const job = (async (): Promise<Buffer | null> => {
    const s3 = getS3Client()
    const bucket = videoBucket()
    // A chave é derivada do produto e da foto original; se já existe, foi gravada por este fluxo.
    const existing = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
      .then(response => response.Body?.transformToByteArray(), () => undefined)
    if (existing?.length) return Buffer.from(existing)

    const raw = input.rawBytes || await ownedStorageBytes(input.rawKey, input.userId)
    let processed: Buffer
    try {
      processed = await processImageWithOptions(raw, { outputFormat: 'webp', forceBgRemoval: true, strict: true })
    } catch (error: any) {
      refused.add(key)
      console.warn('[whatsapp-creation:photo] remoção de fundo recusada', { product: input.product.name, reason: String(error?.message || error).slice(0, 200) })
      return null
    }
    const sharp = (await import('sharp')).default
    processed = await sharp(await trimRasterImageBuffer(processed))
      .rotate()
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 88, effort: 4, alphaQuality: 100 })
      .toBuffer()
    await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: processed, ContentType: 'image/webp', ACL: 'public-read' }))

    const term = productTerm(input.product)
    const normalizedTerm = normalizeSearchTerm(term)
    await Promise.allSettled([
      saveProductImageCache({
        searchTerm: normalizedTerm,
        productName: input.product.name,
        brand: input.product.brand || undefined,
        flavor: input.product.variant || undefined,
        weight: input.product.weight || undefined,
        imageUrl: getPublicUrl(key),
        s3Key: key,
        source: 'manual',
        userId: input.userId
      }),
      upsertProductImageRegistry({
        identityKey: buildProductIdentityKey({
          normalizedTerm,
          brand: input.product.brand || undefined,
          flavor: input.product.variant || undefined,
          weight: input.product.weight || undefined
        }),
        canonicalName: input.product.name,
        brand: input.product.brand || undefined,
        flavor: input.product.variant || undefined,
        weight: input.product.weight || undefined,
        s3Key: key,
        source: 'manual',
        validationLevel: 'manual-upload',
        validatedBy: input.userId,
        status: 'approved'
      })
    ])
    return processed
  })()
  inFlight.set(key, job)
  try {
    return await job
  } finally {
    if (inFlight.get(key) === job) inFlight.delete(key)
  }
}
