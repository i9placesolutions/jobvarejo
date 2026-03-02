import { createHash, randomBytes } from 'node:crypto'
import type {
  BuilderAllowedField,
  BuilderConfig,
  BuilderOptionItem,
  BuilderProductInput,
  BuilderTemplateConfig,
  BuilderTemplateOption
} from '~/types/builder'

export const BUILDER_DEFAULT_ALLOWED_FIELDS: BuilderAllowedField[] = [
  'name',
  'brand',
  'priceUnit',
  'pricePack',
  'priceSpecialUnit',
  'priceSpecial',
  'specialCondition',
  'imageUrl',
  'packageLabel',
  'packQuantity',
  'packUnit'
]

export const BUILDER_DEFAULT_MAX_PRODUCTS = 120
const BUILDER_TOKEN_BYTES = 32

const normalizeText = (value: unknown, maxLen = 180): string => {
  const text = String(value ?? '').trim()
  if (!text) return ''
  return text.length > maxLen ? text.slice(0, maxLen) : text
}

const toBoolean = (value: unknown, fallback: boolean): boolean => {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true' || normalized === '1') return true
    if (normalized === 'false' || normalized === '0') return false
  }
  return fallback
}

const toPositiveInt = (value: unknown, fallback: number, min = 1, max = 500): number => {
  const n = Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

const normalizeOptionIds = (value: unknown): string[] => {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => normalizeText(item, 120))
    .filter(Boolean)
    .filter((item, index, arr) => arr.indexOf(item) === index)
}

const normalizeTemplates = (value: unknown): BuilderTemplateConfig[] => {
  if (!Array.isArray(value)) return []
  const output: BuilderTemplateConfig[] = []

  value.forEach((raw, index) => {
    const item = raw && typeof raw === 'object' ? (raw as Record<string, any>) : null
    if (!item) return
    const id = normalizeText(item.id || `template-${index + 1}`, 80)
    const name = normalizeText(item.name || id || `Template ${index + 1}`, 120)
    const pageId = normalizeText(item.pageId, 120)
    const zoneId = normalizeText(item.zoneId, 120)
    if (!id || !pageId || !zoneId) return

    output.push({
      id,
      name: name || id,
      pageId,
      zoneId,
      labelTemplateIds: normalizeOptionIds(item.labelTemplateIds),
      themeIds: normalizeOptionIds(item.themeIds)
    })
  })

  return output
}

const normalizeAllowedFields = (value: unknown): BuilderAllowedField[] => {
  if (!Array.isArray(value)) return [...BUILDER_DEFAULT_ALLOWED_FIELDS]
  const allowed = new Set(BUILDER_DEFAULT_ALLOWED_FIELDS)
  const normalized = value
    .map((item) => String(item || '').trim())
    .filter((item): item is BuilderAllowedField => allowed.has(item as BuilderAllowedField))
  return normalized.length > 0 ? Array.from(new Set(normalized)) : [...BUILDER_DEFAULT_ALLOWED_FIELDS]
}

export const normalizeBuilderConfig = (raw: unknown): BuilderConfig => {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, any>) : {}
  return {
    enabled: toBoolean(source.enabled, false),
    templates: normalizeTemplates(source.templates),
    allowedFields: normalizeAllowedFields(source.allowedFields),
    maxProductsPerSubmit: toPositiveInt(source.maxProductsPerSubmit, BUILDER_DEFAULT_MAX_PRODUCTS, 1, 500),
    multiTemplateMode: toBoolean(source.multiTemplateMode, true)
  }
}

export const sanitizeBuilderProduct = (
  product: BuilderProductInput,
  allowedFields: BuilderAllowedField[]
): BuilderProductInput => {
  const safe: BuilderProductInput = {}
  const allowed = new Set(allowedFields)

  const setIfAllowed = (field: BuilderAllowedField, value: unknown, type: 'string' | 'number') => {
    if (!allowed.has(field)) return
    if (type === 'number') {
      if (value == null || value === '') {
        ;(safe as any)[field] = null
        return
      }
      const n = Number(value)
      ;(safe as any)[field] = Number.isFinite(n) ? n : null
      return
    }
    ;(safe as any)[field] = value == null ? null : normalizeText(value, field === 'imageUrl' ? 4000 : 240)
  }

  setIfAllowed('name', product?.name, 'string')
  setIfAllowed('brand', product?.brand, 'string')
  setIfAllowed('priceUnit', product?.priceUnit, 'string')
  setIfAllowed('pricePack', product?.pricePack, 'string')
  setIfAllowed('priceSpecialUnit', product?.priceSpecialUnit, 'string')
  setIfAllowed('priceSpecial', product?.priceSpecial, 'string')
  setIfAllowed('specialCondition', product?.specialCondition, 'string')
  setIfAllowed('imageUrl', product?.imageUrl, 'string')
  setIfAllowed('packageLabel', product?.packageLabel, 'string')
  setIfAllowed('packQuantity', product?.packQuantity, 'number')
  setIfAllowed('packUnit', product?.packUnit, 'string')
  safe.id = normalizeText(product?.id, 120) || undefined

  return safe
}

export const formatBuilderPrice = (raw: unknown): string => {
  if (raw == null || raw === '') return ''
  const source = String(raw).replace(/R\$\s*/gi, '').trim()
  if (!source) return ''
  const normalized = source.replace(/\./g, '').replace(',', '.')
  const n = Number.parseFloat(normalized)
  if (!Number.isFinite(n)) return source
  return n.toFixed(2).replace('.', ',')
}

export const splitBuilderPrice = (raw: unknown): { integer: string; decimal: string } => {
  const full = formatBuilderPrice(raw)
  if (!full) return { integer: '', decimal: '' }
  const [integer, decimal] = full.split(',')
  return { integer: integer || '', decimal: decimal || '00' }
}

export const resolvePrimaryPrice = (product: BuilderProductInput): string => {
  return (
    formatBuilderPrice(product?.priceSpecialUnit) ||
    formatBuilderPrice(product?.priceSpecial) ||
    formatBuilderPrice(product?.priceUnit) ||
    formatBuilderPrice(product?.pricePack) ||
    ''
  )
}

export const buildBuilderOptionItems = (
  ids: string[],
  nameMap: Map<string, string>
): BuilderOptionItem[] => {
  return ids.map((id) => ({
    id,
    name: nameMap.get(id) || id
  }))
}

export const buildBuilderTemplateOptions = (
  templates: BuilderTemplateConfig[],
  labelTemplateNameMap: Map<string, string>
): BuilderTemplateOption[] => {
  return templates.map((template) => ({
    id: template.id,
    name: template.name,
    pageId: template.pageId,
    zoneId: template.zoneId,
    labelTemplateOptions: buildBuilderOptionItems(template.labelTemplateIds, labelTemplateNameMap),
    themeOptions: buildBuilderOptionItems(template.themeIds, new Map<string, string>())
  }))
}

export const hashBuilderToken = (token: string): string =>
  createHash('sha256').update(String(token || '')).digest('hex')

export const createBuilderToken = (): string => randomBytes(BUILDER_TOKEN_BYTES).toString('base64url')

export const isBuilderFeatureEnabled = (): boolean => {
  const config = useRuntimeConfig()
  const fromRuntime = String((config as any)?.builderV2Enabled || '').trim().toLowerCase()
  if (fromRuntime) return fromRuntime === 'true' || fromRuntime === '1'
  const fromEnv = String(process.env.BUILDER_V2_ENABLED || '').trim().toLowerCase()
  if (!fromEnv) return true
  return fromEnv === 'true' || fromEnv === '1'
}

export const extractBuilderToken = (event: any, bodyToken?: unknown): string => {
  const fromBody = normalizeText(bodyToken, 512)
  if (fromBody) return fromBody
  const fromHeader = normalizeText(getHeader(event, 'x-builder-token'), 512)
  if (fromHeader) return fromHeader
  const authHeader = normalizeText(getHeader(event, 'authorization'), 768)
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    const token = normalizeText(authHeader.slice(7), 512)
    if (token) return token
  }
  const query = getQuery(event)
  return normalizeText((query as any)?.token, 512)
}
