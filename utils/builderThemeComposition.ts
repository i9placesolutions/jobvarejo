import type {
  BuilderThemeBusinessField,
  BuilderThemeComposition,
  BuilderThemeElement,
  BuilderThemeElementKind,
  BuilderThemeElementStyle,
} from '~/types/builder'

export interface BuilderThemeFieldDefinition {
  field: BuilderThemeBusinessField
  label: string
  sample: string
  width: number
  height: number
  fontSize: number
}

export const BUILDER_THEME_FIELD_DEFINITIONS: readonly BuilderThemeFieldDefinition[] = [
  { field: 'logo', label: 'Logo da loja', sample: 'LOGO', width: 18, height: 12, fontSize: 2.2 },
  { field: 'company_name', label: 'Nome da loja', sample: 'NOME DA LOJA', width: 44, height: 6, fontSize: 3.4 },
  { field: 'slogan', label: 'Slogan', sample: 'Seu slogan aqui', width: 42, height: 5, fontSize: 2.2 },
  { field: 'title', label: 'Título do encarte', sample: 'OFERTAS DA SEMANA', width: 58, height: 6, fontSize: 3.2 },
  { field: 'promo_phrase', label: 'Frase promocional', sample: 'Preços especiais para você', width: 58, height: 5, fontSize: 2.2 },
  { field: 'validity', label: 'Validade', sample: 'Válido de 01/04 a 07/04', width: 56, height: 4, fontSize: 1.8 },
  { field: 'whatsapp', label: 'WhatsApp', sample: '(11) 99999-9999', width: 40, height: 4, fontSize: 2 },
  { field: 'phone', label: 'Telefone', sample: '(11) 3333-4444', width: 38, height: 4, fontSize: 2 },
  { field: 'address', label: 'Endereço', sample: 'Rua da loja, 100', width: 48, height: 5, fontSize: 1.8 },
  { field: 'hours', label: 'Horário', sample: 'Seg a sáb, 8h às 20h', width: 44, height: 4, fontSize: 1.8 },
  { field: 'instagram', label: 'Instagram', sample: '@sualoja', width: 34, height: 4, fontSize: 1.8 },
  { field: 'facebook', label: 'Facebook', sample: 'Sua Loja', width: 34, height: 4, fontSize: 1.8 },
  { field: 'website', label: 'Site', sample: 'www.sualoja.com.br', width: 42, height: 4, fontSize: 1.8 },
  { field: 'payments', label: 'Cartões e pagamentos', sample: 'PIX  VISA  MASTERCARD', width: 48, height: 6, fontSize: 1.6 },
  { field: 'payment_notes', label: 'Observação de pagamento', sample: 'Consulte condições de pagamento', width: 52, height: 4, fontSize: 1.6 },
  { field: 'disclaimer', label: 'Avisos legais', sample: 'Ofertas enquanto durarem os estoques', width: 78, height: 4, fontSize: 1.4 },
]

const DEFAULT_BACKGROUND = '#ffffff'
const DEFAULT_PRIMARY = '#111827'
const DEFAULT_ACCENT = '#f59e0b'

const makeId = (prefix: string): string => {
  try {
    if (typeof globalThis.crypto?.randomUUID === 'function') {
      return `${prefix}-${globalThis.crypto.randomUUID()}`
    }
  } catch {
    // Fallback para ambientes sem randomUUID.
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}

const fieldDefinition = (field: BuilderThemeBusinessField) =>
  BUILDER_THEME_FIELD_DEFINITIONS.find(item => item.field === field)

const createElement = (
  kind: BuilderThemeElementKind,
  partial: Partial<BuilderThemeElement>,
): BuilderThemeElement => ({
  id: makeId('theme-element'),
  kind,
  x: 0,
  y: 0,
  width: 20,
  height: 8,
  zIndex: 2,
  visible: true,
  style: {},
  ...partial,
})

/** Composicao inicial editavel, com cabecalho, zona de produtos e rodape. */
export const createDefaultBuilderThemeComposition = (): BuilderThemeComposition => ({
  version: 1,
  background: {
    color: DEFAULT_BACKGROUND,
    image: '',
    fit: 'cover',
    opacity: 1,
  },
  elements: [
    createElement('shape', {
      x: 0, y: 0, width: 100, height: 18, zIndex: 1,
      style: { backgroundColor: DEFAULT_PRIMARY, opacity: 1 },
    }),
    createElement('business_field', {
      field: 'logo', x: 5, y: 3, width: 18, height: 11, zIndex: 3,
      style: { color: '#ffffff', fontSize: 2.2, objectFit: 'contain', textAlign: 'center' },
    }),
    createElement('business_field', {
      field: 'company_name', x: 26, y: 3.2, width: 68, height: 5, zIndex: 3,
      style: { color: '#ffffff', fontSize: 3.5, fontWeight: 800, textAlign: 'left' },
    }),
    createElement('business_field', {
      field: 'title', x: 26, y: 9, width: 68, height: 4.8, zIndex: 3,
      style: { color: DEFAULT_ACCENT, fontSize: 2.8, fontWeight: 800, textAlign: 'left' },
    }),
    createElement('business_field', {
      field: 'validity', x: 26, y: 14, width: 68, height: 2.8, zIndex: 3,
      style: { color: '#ffffff', fontSize: 1.55, fontWeight: 500, textAlign: 'left' },
    }),
    createElement('product_zone', {
      x: 4, y: 21, width: 92, height: 67, zIndex: 2,
      style: {
        backgroundColor: '#ffffff', borderColor: '#e5e7eb', borderWidth: 1,
        borderRadius: 8, padding: 0.8, opacity: 0.98,
      },
    }),
    createElement('shape', {
      x: 0, y: 90, width: 100, height: 10, zIndex: 1,
      style: { backgroundColor: DEFAULT_PRIMARY, opacity: 1 },
    }),
    createElement('business_field', {
      field: 'whatsapp', x: 5, y: 92.1, width: 42, height: 3.4, zIndex: 3,
      style: { color: '#ffffff', fontSize: 1.8, fontWeight: 700, textAlign: 'left' },
    }),
    createElement('business_field', {
      field: 'address', x: 51, y: 92.1, width: 44, height: 3.4, zIndex: 3,
      style: { color: '#ffffff', fontSize: 1.55, fontWeight: 500, textAlign: 'right' },
    }),
  ],
})

const asRecord = (value: unknown): Record<string, any> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, any>
}

const asFiniteNumber = (value: unknown, fallback: number): number => {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))

const normalizeStyle = (value: unknown): BuilderThemeElementStyle => {
  const raw = asRecord(value)
  const style: BuilderThemeElementStyle = {}
  if (typeof raw.backgroundColor === 'string') style.backgroundColor = raw.backgroundColor
  if (typeof raw.color === 'string') style.color = raw.color
  if (typeof raw.borderColor === 'string') style.borderColor = raw.borderColor
  if (raw.borderWidth != null) style.borderWidth = clamp(asFiniteNumber(raw.borderWidth, 0), 0, 20)
  if (raw.borderRadius != null) style.borderRadius = clamp(asFiniteNumber(raw.borderRadius, 0), 0, 100)
  if (raw.fontSize != null) style.fontSize = clamp(asFiniteNumber(raw.fontSize, 2), 0.4, 20)
  if (typeof raw.fontWeight === 'number' || typeof raw.fontWeight === 'string') style.fontWeight = raw.fontWeight
  if (typeof raw.fontFamily === 'string') style.fontFamily = raw.fontFamily
  if (raw.textAlign === 'left' || raw.textAlign === 'center' || raw.textAlign === 'right') style.textAlign = raw.textAlign
  if (raw.objectFit === 'contain' || raw.objectFit === 'cover' || raw.objectFit === 'fill') style.objectFit = raw.objectFit
  if (raw.opacity != null) style.opacity = clamp(asFiniteNumber(raw.opacity, 1), 0, 1)
  if (raw.padding != null) style.padding = clamp(asFiniteNumber(raw.padding, 0), 0, 20)
  if (typeof raw.boxShadow === 'string') style.boxShadow = raw.boxShadow
  return style
}

const VALID_KINDS: BuilderThemeElementKind[] = ['shape', 'text', 'image', 'business_field', 'product_zone']
const VALID_FIELDS: BuilderThemeBusinessField[] = BUILDER_THEME_FIELD_DEFINITIONS.map(item => item.field)

const normalizeElement = (value: unknown, index: number): BuilderThemeElement | null => {
  const raw = asRecord(value)
  const kind = VALID_KINDS.includes(raw.kind) ? raw.kind as BuilderThemeElementKind : null
  if (!kind) return null

  const definition = raw.field && VALID_FIELDS.includes(raw.field) ? fieldDefinition(raw.field) : undefined
  const x = clamp(asFiniteNumber(raw.x, 0), 0, 99)
  const y = clamp(asFiniteNumber(raw.y, 0), 0, 99)
  return {
    id: typeof raw.id === 'string' && raw.id.trim() ? raw.id : `theme-element-${index + 1}`,
    kind,
    ...(definition ? { field: definition.field } : {}),
    ...(typeof raw.content === 'string' ? { content: raw.content.slice(0, 1000) } : {}),
    x,
    y,
    width: clamp(asFiniteNumber(raw.width, definition?.width || 20), 1, 100 - x),
    height: clamp(asFiniteNumber(raw.height, definition?.height || 8), 1, 100 - y),
    rotation: clamp(asFiniteNumber(raw.rotation, 0), -180, 180),
    zIndex: Math.round(clamp(asFiniteNumber(raw.zIndex, index + 1), 0, 1000)),
    locked: raw.locked === true,
    visible: raw.visible !== false,
    style: normalizeStyle(raw.style),
  }
}

/** Normaliza JSON vindo do banco sem quebrar temas legados ou dados incompletos. */
export const normalizeBuilderThemeComposition = (value: unknown): BuilderThemeComposition => {
  const raw = asRecord(value)
  const backgroundRaw = asRecord(raw.background)
  const elements = Array.isArray(raw.elements)
    ? raw.elements.map(normalizeElement).filter((item): item is BuilderThemeElement => !!item)
    : []

  return {
    version: 1,
    background: {
      color: typeof backgroundRaw.color === 'string' && backgroundRaw.color.trim() ? backgroundRaw.color : DEFAULT_BACKGROUND,
      ...(typeof backgroundRaw.image === 'string' ? { image: backgroundRaw.image } : { image: '' }),
      fit: backgroundRaw.fit === 'contain' || backgroundRaw.fit === 'stretch' ? backgroundRaw.fit : 'cover',
      opacity: clamp(asFiniteNumber(backgroundRaw.opacity, 1), 0, 1),
    },
    elements,
  }
}

export const ensureBuilderThemeComposition = (value: unknown): BuilderThemeComposition => {
  const normalized = normalizeBuilderThemeComposition(value)
  return normalized.elements.length ? normalized : createDefaultBuilderThemeComposition()
}

export const hasBuilderThemeComposition = (value: unknown): boolean => {
  const normalized = normalizeBuilderThemeComposition(value)
  return normalized.elements.some(element => element.kind === 'product_zone' && element.visible !== false)
}

export const builderThemeElementLabel = (element: Pick<BuilderThemeElement, 'kind' | 'field'>): string => {
  if (element.kind === 'product_zone') return 'Zona de produtos'
  if (element.kind === 'shape') return 'Elemento decorativo'
  if (element.kind === 'text') return 'Texto livre'
  if (element.kind === 'image') return 'Imagem'
  return fieldDefinition(element.field || 'company_name')?.label || 'Informação da loja'
}

export const createBuilderThemeElementId = (prefix = 'theme-element'): string => makeId(prefix)
