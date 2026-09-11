import { z } from 'zod'
import { ART_FONTS } from '~/types/art-studio'
const color = z.string().regex(/^#[\da-fA-F]{6}$/)
const finite = z.number().finite()
const layer = z.object({
  id: z.string().min(1).max(100),
  name: z.string().max(100),
  kind: z.enum(['text', 'image', 'shape', 'icon']),
  x: finite.min(-8192).max(8192),
  y: finite.min(-8192).max(8192),
  width: finite.min(1).max(8192),
  height: finite.min(1).max(8192),
  rotation: finite.min(-360).max(360),
  opacity: finite.min(0).max(1),
  visible: z.boolean(),
  locked: z.boolean(),
  fill: color,
  text: z.string().max(2000).optional(),
  fontFamily: z.enum(ART_FONTS).optional(),
  fontScaleX: finite.min(.4).max(2).optional(),
  lineHeight: finite.min(.7).max(2.5).optional(),
  fontSize: finite.min(6).max(1000).optional(),
  fontWeight: z
    .union([z.literal(400), z.literal(600), z.literal(700), z.literal(800)])
    .optional(),
  align: z.enum(['left', 'center', 'right']).optional(),
  src: z
    .string()
    .regex(
      /^(|\/api\/art-studio\/brand-logo|\/api\/art-studio\/assets\/[0-9a-f-]{36})$/
    )
    .optional(),
  fit: z.enum(['cover', 'contain']).optional(),
  cropX: finite.min(0).max(1).optional(),
  cropY: finite.min(0).max(1).optional(),
  shape: z.enum(['rect', 'ellipse', 'path']).optional(),
  blur: finite.min(0).max(150).optional(),
  cornerRadius: finite.min(0).max(500).optional(),
  pathData: z.string().max(4000).regex(/^[MLCZ0-9.,\s-]+$/).optional(),
  gradient: z.object({type:z.enum(['linear','radial']),from:color,to:color,startOpacity:finite.min(0).max(1),endOpacity:finite.min(0).max(1),angle:finite.min(-360).max(360)}).optional(),
  icon: z.enum(['heart', 'star', 'bolt', 'check', 'flower']).optional(),
  autoTrim: z.boolean().optional(),
  logoBackdrop: z.enum(['none', 'square', 'round', 'oval']).optional(),
  logoPadding: finite.min(0).max(80).optional(),
  logoOutline: z.boolean().optional(),
  logoOutlineColor: color.optional(),
  logoOutlineWidth: finite.min(1).max(40).optional(),
  binding: z
    .enum(['', 'companyName', 'logo', 'phone', 'address', 'instagram', 'date'])
    .optional()
})
const baseCompositionSchema = z.object({
  version: z.literal(1),
  width: z.number().int().min(320).max(4096),
  height: z.number().int().min(320).max(4096),
  background: color,
  layers: z.array(layer).max(150)
})
export const artCompositionSchema = baseCompositionSchema
  .extend({ alternates: z.array(baseCompositionSchema).max(7).optional() })
  .superRefine((value, ctx) => {
    for (const page of [value, ...(value.alternates || [])])
      if (new Set(page.layers.map((l) => l.id)).size !== page.layers.length)
        ctx.addIssue({ code: 'custom', message: 'IDs de camadas duplicados.' })
    const sizes = [value, ...(value.alternates || [])].map(
      (p) => `${p.width}x${p.height}`
    )
    if (new Set(sizes).size !== sizes.length)
      ctx.addIssue({ code: 'custom', message: 'Formatos duplicados.' })
  })
export const artDesignSchema = z.object({
  name: z.string().trim().min(1).max(150),
  composition: artCompositionSchema,
  revision: z.number().int().positive().optional(),
  template_id: z.string().max(100).nullable().optional(),
  id: z.string().uuid().optional()
})
export const artTemplateSchema = z.object({
  name: z.string().trim().min(1).max(150),
  category: z.string().trim().min(1).max(80),
  collection: z.string().trim().max(80),
  tags: z.array(z.string().trim().min(1).max(60)).max(20),
  composition: artCompositionSchema,
  published: z.boolean(),
  revision: z.number().int().positive().optional()
})
export const parseArtInput = <T>(schema: z.ZodType<T>, data: unknown): T => {
  const parsed = schema.safeParse(data)
  if (!parsed.success)
    throw createError({
      statusCode: 400,
      statusMessage: 'Dados da arte inválidos. Revise os campos.',
      data: parsed.error.flatten()
    })
  return parsed.data
}
