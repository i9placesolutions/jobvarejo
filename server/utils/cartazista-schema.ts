import { z } from 'zod'
import { CARTAZISTA_MODEL_KEYS, CARTAZISTA_FORMATS, CARTAZISTA_THEMES } from '~/types/cartazista'

const product = z.object({
  id: z.string().min(1).max(120),
  name: z.string().trim().min(1).max(180),
  price: z.number().finite().min(0).max(1_000_000),
  oldPrice: z.number().finite().min(0).max(1_000_000).optional(),
  secondPrice: z.number().finite().min(0).max(1_000_000).optional(),
  wholesalePrice: z.number().finite().min(0).max(1_000_000).optional(),
  packQuantity: z.number().int().min(1).max(999).optional(),
  packPrice: z.number().finite().min(0).max(1_000_000).optional(),
  unit: z.string().trim().max(20).optional(),
  nearExpiry: z.boolean().optional()
})

const settings = z.object({
  validity: z.string().max(120),
  limitPerCustomer: z.string().max(120),
  highlightNearExpiry: z.boolean(),
  nearExpiryLabel: z.string().max(120),
  showLogo: z.boolean(),
  orientation: z.enum(['portrait', 'landscape'])
})

const composition = z.object({
  version: z.literal(1),
  width: z.number().int().min(180).max(4096),
  height: z.number().int().min(180).max(4096),
  background: z.string().regex(/^#[\da-fA-F]{6}$/),
  layers: z.array(z.record(z.string(), z.any())).max(80)
})

export const cartazistaDocumentSchema = z.object({
  version: z.literal(1),
  name: z.string().trim().min(1).max(150),
  modelId: z.enum(CARTAZISTA_MODEL_KEYS),
  formatId: z.enum(CARTAZISTA_FORMATS.map((format) => format.id) as [string, ...string[]]),
  themeId: z.enum(CARTAZISTA_THEMES.map((theme) => theme.id) as [string, ...string[]]),
  settings,
  products: z.array(product).min(1).max(500),
  activeProductId: z.string().min(1).max(120),
  composition
})

export const cartazistaDesignSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(150),
  state: cartazistaDocumentSchema,
  revision: z.number().int().positive().optional()
})

export const parseCartazistaInput = <T>(schema: z.ZodType<T>, data: unknown): T => {
  const parsed = schema.safeParse(data)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Dados do cartaz inválidos. Revise os campos.',
      data: parsed.error.flatten()
    })
  }
  return parsed.data
}
