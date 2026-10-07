import { z } from 'zod'

export const WORK_FORMATS = {
  stories: { label: 'Story', width: 1080, height: 1920 },
  feed: { label: 'Feed', width: 1080, height: 1350 },
  square: { label: 'Quadrado', width: 1080, height: 1080 },
  tv: { label: 'TV', width: 1920, height: 1080 },
  print: { label: 'A4', width: 2480, height: 3508 }
} as const
export const formatSchema = z.enum(['stories', 'feed', 'square', 'tv', 'print'])
export const colorSchema = z.string().regex(/^#[\da-f]{6}$/i)
export const keySchema = z.string().min(1).max(1024).refine(value =>
  !value.startsWith('/') && !/[\\?#\u0000-\u001f]/.test(value) && !/(^|\/)\.{1,2}(\/|$)/.test(value), 'Referência de arquivo inválida')
export const workProductSchema = z.object({
  id: z.string().uuid(), name: z.string().trim().min(1).max(180),
  price: z.string().regex(/^\d{1,6}[,.]\d{2}$/, 'Informe o preço com duas casas decimais'),
  imageKey: keySchema.optional(), unit: z.string().trim().max(20).default('')
}).strict()
export const workRequestSchema = z.object({
  name: z.string().trim().min(1).max(110), theme: z.string().trim().min(1).max(120),
  brief: z.string().trim().max(6000).default(''), validity: z.string().trim().max(200),
  conditions: z.string().trim().max(400).default(''),
  palette: z.array(colorSchema).min(2).max(5), formats: z.array(formatSchema).min(1).max(5),
  sealKey: keySchema.optional(),
  productsPerPage: z.number().int().min(1).max(16).optional(),
  products: z.array(workProductSchema).min(1).max(100),
  sourceProjectId: z.string().uuid().optional()
}).strict().superRefine((value, ctx) => {
  if (new Set(value.products.map(p => p.id)).size !== value.products.length)
    ctx.addIssue({ code: 'custom', message: 'Produtos com identificadores repetidos' })
  if (new Set(value.formats).size !== value.formats.length)
    ctx.addIssue({ code: 'custom', message: 'Formatos repetidos' })
  const minimumPages = value.formats.reduce((sum, format) => sum + Math.ceil(value.products.length /
    Math.min(format === 'stories' ? 9 : 16, value.productsPerPage || 16)), 0)
  if (minimumPages > 30)
    ctx.addIssue({ code: 'custom', message: 'Essa seleção exige mais de 30 páginas. Reduza os formatos ou divida os produtos em outros pedidos.' })
})
export type WorkRequest = z.infer<typeof workRequestSchema>
export type WorkProduct = z.infer<typeof workProductSchema>
export type WorkFormat = z.infer<typeof formatSchema>
export const workElementRoleSchema = z.enum(['seal', 'background', 'decoration', 'reference'])
export const workElementMetadataSchema = z.object({
  name: z.string().trim().min(1).max(120), theme: z.string().trim().min(1).max(120),
  role: workElementRoleSchema, palette: z.array(colorSchema).min(2).max(5),
  formats: z.array(formatSchema).min(1).max(5)
}).strict()
export type WorkElementMetadata = z.infer<typeof workElementMetadataSchema>
export const boxSchema = z.object({ x: z.number().finite().nonnegative(), y: z.number().finite().nonnegative(),
  width: z.number().finite().positive(), height: z.number().finite().positive() })
export const textStyleSchema = z.object({ fontSize: z.number().min(16).max(240),
  fontFamily: z.enum(['Barlow', 'Barlow Condensed', 'Anton', 'Oswald']).default('Barlow'),
  color: colorSchema, align: z.enum(['left', 'center', 'right']).default('left'),
  bold: z.boolean().default(true) })
export const decorationSchema = z.object({ box: boxSchema,
  kind: z.enum(['rect', 'ellipse', 'polygon', 'image']), color: colorSchema.optional(), assetKey: keySchema.optional(),
  radius: z.number().min(0).max(100).default(0),
  opacity: z.number().min(0.1).max(1).optional(),
  stroke: colorSchema.optional(), strokeWidth: z.number().min(0).max(12).optional(),
  points: z.array(z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).strict()).min(3).max(24).optional(),
  gradient: z.object({ colors: z.array(colorSchema).min(2).max(4), direction: z.enum(['horizontal', 'vertical']) }).strict().optional()
}).strict()
// Coordenadas locais em pixels. A IA desenha o card; os valores comerciais
// continuam vinculados ao produto confirmado e nunca vêm do layout.
export const productDesignSchema = z.object({
  surface: z.object({ color: colorSchema, radius: z.number().min(0).max(100).default(0) }).strict().optional(),
  image: boxSchema,
  name: z.object({ box: boxSchema, style: textStyleSchema }).strict(),
  price: z.object({ box: boxSchema, style: textStyleSchema,
    decimalScale: z.number().min(0.35).max(0.75).default(0.55),
    currencyScale: z.number().min(0.16).max(0.4).default(0.25),
    background: colorSchema.optional(), radius: z.number().min(0).max(100).default(16)
  }).strict(),
  decorations: z.array(decorationSchema).max(12).default([])
}).strict()
export type WorkProductDesign = z.infer<typeof productDesignSchema>
export type WorkDecoration = z.infer<typeof decorationSchema>
export const layoutSchema = z.object({ pages: z.array(z.object({
  format: formatSchema, background: colorSchema,
  decorations: z.array(decorationSchema).max(40).default([]),
  heading: z.object({ text: z.string().trim().min(1).max(150), box: boxSchema, style: textStyleSchema }).strict().optional(),
  // Valores comerciais são resolvidos pelo servidor. O agente não pode mudar preços/endereço.
  fields: z.array(z.object({ binding: z.string().min(1).max(160), box: boxSchema, style: textStyleSchema }).strict()).max(40),
  slots: z.array(z.object({ productId: z.string().uuid(), box: boxSchema,
    design: productDesignSchema.optional() }).strict()).min(1).max(16),
  cardStyle: z.object({ background: colorSchema, nameColor: colorSchema,
    priceBackground: colorSchema, priceColor: colorSchema }).strict()
}).strict()).min(1).max(30) }).strict()
export type WorkLayout = z.infer<typeof layoutSchema>
export type WorkJobStatus = 'pending' | 'processing' | 'draft' | 'completed' | 'failed' | 'cancelled'
export type WorkJob = { id: string; owner_id: string; revision: number; status: WorkJobStatus;
  request: WorkRequest; business: unknown; source_revision: string | null; source_snapshot: unknown;
  lease_token?: string | null; lease_until?: string | null; result: WorkResult | null;
  draft_layout: WorkLayout | null; error: string | null; created_at: string; updated_at: string }
export type WorkResult = { projectId: string; quickCompatible: false; pages: Array<{
  id: string; format: WorkFormat; previewKey: string; canvasKey: string; productIds: string[] }> }

/** Colar lista é determinístico e não chama API de IA. Linhas ambíguas são rejeitadas. */
export function parseWorkProductList(text: string, id: () => string): WorkProduct[] {
  return text.split(/\r?\n/).filter(line => line.trim()).map((line, index) => {
    const match = line.trim().match(/^(.+?)\s*(?:[–—;]|\s-\s)\s*(?:R\$\s*)?(\d{1,6}[,.]\d{2})\s*$/)
    if (!match) throw new Error(`Linha ${index + 1}: use PRODUTO – 48,99.`)
    return workProductSchema.parse({ id: id(), name: match[1]!.trim(), price: match[2]!.replace('.', ',') })
  })
}
