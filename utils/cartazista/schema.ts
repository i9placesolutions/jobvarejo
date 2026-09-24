import { z } from 'zod'
import { CARTAZISTA_MODEL_KEYS, CARTAZISTA_FORMATS, CARTAZISTA_THEMES } from '~/types/cartazista'

const headerAsset = z.string().max(2048).regex(/^(?:\/video-studio\/templates\/[a-zA-Z0-9/_\-.]+|\/api\/storage\/p\?key=[a-zA-Z0-9%/_\-.]+)$/)

const product = z.object({
  id: z.string().min(1).max(120),
  name: z.string().trim().min(1).max(180),
  price: z.number().finite().min(0).max(1_000_000),
  oldPrice: z.number().finite().min(0).max(1_000_000).optional(),
  secondPrice: z.number().finite().min(0).max(1_000_000).optional(),
  wholesalePrice: z.number().finite().min(0).max(1_000_000).optional(),
  packQuantity: z.number().int().min(1).max(999).optional(),
  payQuantity: z.number().int().min(1).max(999).optional(),
  copies: z.number().int().min(1).max(100).optional(),
  packPrice: z.number().finite().min(0).max(1_000_000).optional(),
  unit: z.string().trim().max(20).optional(),
  nearExpiry: z.boolean().optional()
})

const settings = z.object({
  freeDesign:z.boolean().optional(),
  typography:z.enum(['retail-hand','brush','marker','handwritten','original']).optional(),
  title: z.string().max(80).optional(),
  showCurrency: z.boolean().optional(),
  showEach: z.boolean().optional(),
  foldGuide: z.boolean().optional(),
  removeBackground: z.boolean().optional(),
  header: z.object({
    retailFinish: z.object({ decoration: headerAsset.optional(), labelFill: z.string().regex(/^#[0-9a-fA-F]{6}$/), labelInk: z.string().regex(/^#[0-9a-fA-F]{6}$/), labelEdge: z.string().regex(/^#[0-9a-fA-F]{6}$/) }).optional(),
    tagline: z.string().max(100).optional(),
    priceCornerRadius: z.number().min(0).max(0.15).optional(),
    mascot: headerAsset.optional(),
    layout: z.enum(['suina-ouro','suina-rustica','thematic-seal']).optional(),
    accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    secondary: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    id: z.string().uuid(),
    name: z.string().max(180),
    background: z.union([z.literal(''), headerAsset]),
    seal: headerAsset,
    color: z.string().regex(/^#[\da-fA-F]{6}$/)
  }).optional(),
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
  layers: z.array(z.object({
    id:z.string().min(1).max(120),name:z.string().max(180),kind:z.enum(['text','image','shape','icon']),
    x:z.number().finite().min(-10000).max(10000),y:z.number().finite().min(-10000).max(10000),
    width:z.number().finite().positive().max(10000),height:z.number().finite().positive().max(10000),
    rotation:z.number().finite().min(-10000).max(10000),opacity:z.number().min(0).max(1),visible:z.boolean(),locked:z.boolean(),
    fill:z.string().regex(/^(?:#[\da-fA-F]{3,8}|transparent|none)$/),text:z.string().max(5000).optional(),fontSize:z.number().positive().max(4000).optional(),
    fontFamily:z.string().max(100).regex(/^[\p{L}\p{N} -]+$/u).optional(),fontWeight:z.number().min(100).max(1000).optional(),
    richPrice:z.boolean().optional(),
    fontScaleX:z.number().positive().max(10).optional(),lineHeight:z.number().positive().max(10).optional(),
    align:z.enum(['left','center','right']).optional(),shape:z.enum(['rect','ellipse','path']).optional(),
    pathData:z.string().max(30000).optional(),src:z.string().max(1_400_000).regex(/^(?:|\/(?!\/)[^\s]*|data:image\/(?:png|jpeg|webp);base64,[a-zA-Z0-9+/=]+)$/).optional(),
    fit:z.enum(['cover','contain']).optional(),binding:z.string().max(40).optional(),autoTrim:z.boolean().optional(),cornerRadius:z.number().min(0).max(4000).optional(),
    cartazistaHidden:z.boolean().optional()
  })).max(80)
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
