import { randomUUID } from 'node:crypto'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import sharp from 'sharp'
import type { CreationProduct } from '~/shared/whatsapp-creation'
import { isProductLabelTemplateCompatible } from '~/utils/productLabelCompatibility'
import { pgQuery } from '../postgres'
import { getS3Client } from '../s3'
import { videoBucket } from '../video-studio/service'

/**
 * Etiquetas que o cliente pode escolher pelo WhatsApp: da conta e do catálogo, só as
 * compatíveis com o preço dos produtos (simples x multi-preço), numeradas na imagem.
 */
export interface LabelTemplateRow { id: string; name: string; group: unknown; preview_data_url?: string | null }
export interface LabelOptionsResult { options: Array<{ id: string; name: string }>; imageKey?: string }
export interface LabelOptionsDeps {
  loadTemplates?: (accountId: string) => Promise<LabelTemplateRow[]>
  storeImage?: (key: string, png: Buffer) => Promise<void>
  /** Tempo máximo da montagem; passou disso, a lista segue em texto. */
  budgetMs?: number
}

export const MAX_LABEL_OPTIONS = 8
const CELL_WIDTH = 380
const CELL_HEIGHT = 250
const COLUMNS = 4
const MAX_PREVIEW_BYTES = 2 * 1024 * 1024
const DEFAULT_BUDGET_MS = 15_000

/** Etiquetas compatíveis com todos os produtos alvo; se nenhuma serve para todos, as que servem para algum. */
export function pickCompatibleLabels(rows: readonly LabelTemplateRow[], products: readonly Pick<CreationProduct, 'id'>[], limit = MAX_LABEL_OPTIONS): LabelTemplateRow[] {
  const seen = new Set<string>()
  const unique = rows.filter(row => {
    const id = String(row?.id || '').trim()
    if (!id || seen.has(id) || !row.group) return false
    seen.add(id)
    return true
  })
  const targets = products.length ? products : [{ id: '' } as Pick<CreationProduct, 'id'>]
  const all = unique.filter(row => targets.every(product => isProductLabelTemplateCompatible(product, row)))
  const chosen = all.length ? all : unique.filter(row => targets.some(product => isProductLabelTemplateCompatible(product, row)))
  // Etiquetas com prévia primeiro: o cliente escolhe olhando a imagem.
  return [...chosen.filter(row => row.preview_data_url), ...chosen.filter(row => !row.preview_data_url)].slice(0, limit)
}

const escapeXml = (value: string): string => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')

const decodePreview = (value: unknown): Buffer | null => {
  const match = typeof value === 'string' ? value.match(/^data:image\/(?:png|jpeg|webp);base64,([a-zA-Z0-9+/=]+)$/) : null
  if (!match) return null
  const bytes = Buffer.from(match[1]!, 'base64')
  return bytes.length > 0 && bytes.length <= MAX_PREVIEW_BYTES ? bytes : null
}

/** Imagem única com as etiquetas numeradas (1 a 8), sem depender de pré-renderização externa. */
export async function renderLabelOptionsBoard(rows: readonly LabelTemplateRow[]): Promise<Buffer> {
  const columns = Math.min(COLUMNS, Math.max(1, rows.length))
  const lines = Math.ceil(rows.length / columns)
  const width = columns * CELL_WIDTH, height = lines * CELL_HEIGHT
  const fragments = [`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`, '<rect width="100%" height="100%" fill="#f3f5f7"/>']
  const composites: sharp.OverlayOptions[] = []
  for (const [index, row] of rows.entries()) {
    const x = (index % columns) * CELL_WIDTH, y = Math.floor(index / columns) * CELL_HEIGHT
    fragments.push(`<rect x="${x + 10}" y="${y + 10}" width="${CELL_WIDTH - 20}" height="${CELL_HEIGHT - 20}" rx="16" fill="#ffffff" stroke="#d0d5dd" stroke-width="2"/>`)
    fragments.push(`<circle cx="${x + 40}" cy="${y + 40}" r="22" fill="#175cd3"/><text x="${x + 40}" y="${y + 48}" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" font-weight="700" fill="#ffffff">${index + 1}</text>`)
    fragments.push(`<text x="${x + CELL_WIDTH / 2}" y="${y + CELL_HEIGHT - 26}" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" fill="#344054">${escapeXml(String(row.name || '').slice(0, 34))}</text>`)
    const bytes = decodePreview(row.preview_data_url)
    if (!bytes) continue
    try {
      const image = await sharp(bytes, { limitInputPixels: 16_000_000 }).resize(CELL_WIDTH - 90, CELL_HEIGHT - 100, { fit: 'inside', withoutEnlargement: true }).png().toBuffer({ resolveWithObject: true })
      composites.push({ input: image.data, left: x + Math.floor((CELL_WIDTH - image.info.width) / 2), top: y + 62 + Math.floor((CELL_HEIGHT - 100 - image.info.height) / 2) })
    } catch {
      // Prévia ilegível: a célula fica só com o número e o nome.
    }
  }
  fragments.push('</svg>')
  return sharp(Buffer.from(fragments.join(''))).composite(composites).png({ compressionLevel: 9 }).toBuffer()
}

async function loadLabelTemplates(accountId: string): Promise<LabelTemplateRow[]> {
  const { rows } = await pgQuery<LabelTemplateRow>(
    `select distinct on (coalesce(template_key,id))
       coalesce(template_key,id) as id, name, "group", preview_data_url
     from public.label_templates
     where user_id=$1 or user_id is null
     order by coalesce(template_key,id), case when user_id=$1 then 0 else 1 end, updated_at desc
     limit 120`,
    [accountId]
  )
  return rows
}

async function storeBoard(key: string, png: Buffer): Promise<void> {
  const bucket = videoBucket()
  if (!bucket) throw new Error('Armazenamento indisponível.')
  await getS3Client().send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: png, ContentType: 'image/png' }))
}

/**
 * Opções numeradas de etiqueta para o cliente escolher. A imagem é montada dentro do orçamento
 * de tempo; se estourar ou falhar, devolve só a lista (a conversa envia em texto).
 */
export async function buildLabelOptions(
  input: { accountId: string; orderId: string; products: readonly CreationProduct[]; itemIds: string[] },
  deps: LabelOptionsDeps = {}
): Promise<LabelOptionsResult | null> {
  const targets = input.itemIds.length ? input.products.filter(product => input.itemIds.includes(product.id)) : input.products
  const rows = pickCompatibleLabels(await (deps.loadTemplates || loadLabelTemplates)(input.accountId), targets)
  if (!rows.length) return null
  const options = rows.map(row => ({ id: String(row.id), name: String(row.name || 'Etiqueta') }))
  const withPreview = rows.some(row => row.preview_data_url)
  if (!withPreview) return { options }
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const key = `whatsapp-creation/${input.accountId}/${input.orderId}/labels-${randomUUID()}.png`
    const montage = (async () => {
      await (deps.storeImage || storeBoard)(key, await renderLabelOptionsBoard(rows))
      return key
    })()
    const imageKey = await Promise.race([
      montage,
      new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), deps.budgetMs ?? DEFAULT_BUDGET_MS) })
    ])
    return imageKey ? { options, imageKey } : { options }
  } catch {
    return { options }
  } finally {
    if (timer) clearTimeout(timer)
  }
}
