/**
 * Pure state and approval rules for WhatsApp creation requests.
 * Callers must construct `identity` from the server's verified profile/link;
 * this module deliberately has no account or WhatsApp lookup of its own.
 */

export type CreationKind = 'encarte' | 'video' | 'cartaz' | 'studio'
export type ProductDivision = null | 'single' | 'pages' | 'department'

export interface VerifiedWhatsAppIdentity {
  /** UUID of the profile resolved by the server from a verified sender link. */
  accountId: string
  /** Normalized sender from the verified provider identity. */
  normalizedSender: string
}

export interface CreationFormat {
  id: string
  width: number
  height: number
}

export interface CreationProduct {
  id: string
  name: string
  brand: string
  variant: string
  weight: string
  /** Keep the commercial price exactly as supplied; never parse/reformat it here. */
  price: string
  department?: string
  condition?: string
}

export interface ProductImage {
  itemId: string
  key: string
  hash: string
  approvedRevision: number | null
}

export interface HeaderSelection {
  id: string
  revision: number
  theme: string
  formats: string[]
  nativeThemeId?: string
}

export interface InstitutionalText {
  title: string
  message: string
  callToAction: string
}

export interface CreationPreview {
  artifactId: string
  revision: number
  formatIds: string[]
}

export interface PreviewApproval {
  artifactId: string
  revision: number
  formatId: string
}

export interface MissingThemeTicket {
  status: 'pending'
  /** Only set when a real appointment exists; this module never guesses an ETA. */
  scheduledEta?: string
}

/** Quantidade/direção da duplicação da foto do produto no card (mesmo contrato do editor rápido). */
export interface FlyerImageFillCustomization {
  /** 1 a 4 cópias; ausente mantém a regra automática do WhatsApp. */
  count?: number
  direction?: 'auto' | 'horizontal' | 'vertical'
}

/**
 * Personalização do encarte pedida pelo cliente. Só guarda valores absolutos já validados
 * no servidor (nunca a frase do cliente): escalas são multiplicadores sobre o tamanho do
 * modelo (1 = original) e o resultado é limitado de novo na hora de aplicar no canvas.
 */
export interface FlyerCustomization {
  logoScale?: number
  /** Selo decorativo do cabeçalho do modelo (não é o selo +18 do card). */
  sealScale?: number
  nameScale?: number
  labelScale?: number
  /** Selo +18 (bebida alcoólica) do card. */
  badgeScale?: number
  /** Etiqueta de preço de todos os produtos. */
  labelTemplateId?: string
  /** Etiqueta de produtos específicos (ID do produto -> ID da etiqueta). */
  itemLabelTemplateIds?: Record<string, string>
  imageFill?: FlyerImageFillCustomization
  itemImageFill?: Record<string, FlyerImageFillCustomization>
  palette?: { highlightCardColor?: string; highlightProdNameColor?: string; cardColor?: string; prodNameColor?: string }
  validityDateFormat?: 'numeric' | 'long'
  /** Valores só deste pedido; o cadastro da loja só muda com confirmação explícita. */
  business?: { whatsapp?: string; address?: string; instagram?: string }
}

export const FLYER_CUSTOMIZATION_LIMITS = {
  nameScale: [0.5, 2.5], labelScale: [0.6, 1.6], badgeScale: [0.6, 1.6], logoScale: [0.6, 1.8], sealScale: [0.6, 1.8]
} as const satisfies Record<string, readonly [number, number]>

const HEX_COLOR = /^#[0-9a-f]{6}$/i
const IMAGE_FILL_DIRECTIONS = ['auto', 'horizontal', 'vertical']

/**
 * Normaliza uma personalização vinda do estado salvo ou do servidor: descarta campos
 * desconhecidos e valores fora dos limites. Retorna undefined quando nada sobra.
 */
export function normalizeFlyerCustomization(value: unknown): FlyerCustomization | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const source = value as Record<string, any>
  const out: FlyerCustomization = {}
  for (const key of ['logoScale', 'sealScale', 'nameScale', 'labelScale', 'badgeScale'] as const) {
    const number = Number(source[key])
    const [min, max] = FLYER_CUSTOMIZATION_LIMITS[key]
    if (source[key] !== undefined && Number.isFinite(number) && number > 0) out[key] = Math.round(Math.min(max, Math.max(min, number)) * 1000) / 1000
  }
  const id = (item: unknown) => typeof item === 'string' && item.trim() && item.length <= 200 ? item.trim() : undefined
  const labelTemplateId = id(source.labelTemplateId)
  if (labelTemplateId) out.labelTemplateId = labelTemplateId
  const fill = (item: any): FlyerImageFillCustomization | undefined => {
    if (!item || typeof item !== 'object') return undefined
    const count = Number(item.count)
    const result: FlyerImageFillCustomization = {}
    if (Number.isInteger(count) && count >= 1 && count <= 4) result.count = count
    if (IMAGE_FILL_DIRECTIONS.includes(item.direction)) result.direction = item.direction
    return Object.keys(result).length ? result : undefined
  }
  const itemMap = <T>(map: unknown, convert: (item: unknown) => T | undefined): Record<string, T> | undefined => {
    if (!map || typeof map !== 'object' || Array.isArray(map)) return undefined
    const entries = Object.entries(map as Record<string, unknown>).slice(0, 200)
      .flatMap(([key, item]) => { const converted = convert(item); return key.length <= 100 && converted !== undefined ? [[key, converted] as [string, T]] : [] })
    return entries.length ? Object.fromEntries(entries) : undefined
  }
  const itemLabels = itemMap(source.itemLabelTemplateIds, id)
  if (itemLabels) out.itemLabelTemplateIds = itemLabels
  const imageFill = fill(source.imageFill)
  if (imageFill) out.imageFill = imageFill
  const itemImageFill = itemMap(source.itemImageFill, fill)
  if (itemImageFill) out.itemImageFill = itemImageFill
  if (source.palette && typeof source.palette === 'object') {
    const palette: NonNullable<FlyerCustomization['palette']> = {}
    for (const key of ['highlightCardColor', 'highlightProdNameColor', 'cardColor', 'prodNameColor'] as const) {
      if (typeof source.palette[key] === 'string' && HEX_COLOR.test(source.palette[key])) palette[key] = source.palette[key].toLowerCase()
    }
    if (Object.keys(palette).length) out.palette = palette
  }
  if (source.validityDateFormat === 'numeric' || source.validityDateFormat === 'long') out.validityDateFormat = source.validityDateFormat
  if (source.business && typeof source.business === 'object') {
    const business: NonNullable<FlyerCustomization['business']> = {}
    const whatsapp = typeof source.business.whatsapp === 'string' ? source.business.whatsapp.trim() : ''
    const address = typeof source.business.address === 'string' ? source.business.address.trim() : ''
    if (/^[+\d\s().-]{8,30}$/.test(whatsapp) && whatsapp.replace(/\D/g, '').length >= 10 && whatsapp.replace(/\D/g, '').length <= 13) business.whatsapp = whatsapp
    if (address && address.length <= 300) business.address = address
    const instagram = typeof source.business.instagram === 'string' ? source.business.instagram.trim() : ''
    if (/^@?[a-z0-9._]{1,30}$/i.test(instagram)) business.instagram = instagram.startsWith('@') ? instagram : `@${instagram}`
    if (Object.keys(business).length) out.business = business
  }
  return Object.keys(out).length ? out : undefined
}

/** Junta duas personalizações; o que vem em `next` vence, mapas por item são mesclados. */
export function mergeFlyerCustomization(current: FlyerCustomization | undefined, next: FlyerCustomization | undefined): FlyerCustomization | undefined {
  if (!next) return current
  const merged: FlyerCustomization = { ...(current || {}), ...next }
  if (current?.itemLabelTemplateIds || next.itemLabelTemplateIds) merged.itemLabelTemplateIds = { ...(current?.itemLabelTemplateIds || {}), ...(next.itemLabelTemplateIds || {}) }
  if (current?.itemImageFill || next.itemImageFill) merged.itemImageFill = { ...(current?.itemImageFill || {}), ...(next.itemImageFill || {}) }
  if (current?.palette || next.palette) merged.palette = { ...(current?.palette || {}), ...(next.palette || {}) }
  if (current?.business || next.business) merged.business = { ...(current?.business || {}), ...(next.business || {}) }
  // Etiqueta para todos substitui as escolhas por item feitas antes.
  if (next.labelTemplateId && !next.itemLabelTemplateIds) delete merged.itemLabelTemplateIds
  if (next.imageFill && !next.itemImageFill) delete merged.itemImageFill
  return normalizeFlyerCustomization(merged)
}

export interface CreationOrder {
  readonly id: string
  readonly accountId: string
  readonly sender: string
  readonly revision: number
  readonly kind: CreationKind
  readonly theme: string | null
  readonly themeTicket: MissingThemeTicket | null
  readonly formats: readonly CreationFormat[]
  readonly division: ProductDivision
  /** Quantidade de encartes/páginas pedida pelo cliente ("divide em 2"); só vale com division='pages'. */
  readonly pageCount?: number | null
  readonly products: readonly CreationProduct[]
  readonly validity: string
  readonly conditions: string
  readonly institutionalText: InstitutionalText | null
  readonly images: readonly ProductImage[]
  readonly header: HeaderSelection | null
  readonly dataApprovedRevision: number | null
  readonly script: string | null
  readonly scriptApprovedRevision: number | null
  readonly previews: readonly CreationPreview[]
  readonly previewApprovals: readonly PreviewApproval[]
  /** Ajustes visuais do encarte pedidos pelo cliente (tamanhos, etiqueta, cores, contato). */
  readonly customization?: FlyerCustomization
}

export interface CreateOrderInput {
  id: string
  identity: VerifiedWhatsAppIdentity
  kind: CreationKind
  theme: string | null
  formats: CreationFormat[]
  division?: ProductDivision
  pageCount?: number | null
  products?: CreationProduct[]
  validity?: string
  conditions?: string
  institutionalText?: InstitutionalText | null
  themeTicket?: MissingThemeTicket | null
  customization?: FlyerCustomization | null
}

export type EditableOrderFields = Pick<
  CreationOrder,
  'kind' | 'theme' | 'formats' | 'division' | 'pageCount' | 'products' | 'validity' | 'conditions' | 'institutionalText' | 'header' | 'script' | 'customization'
>
export type OrderPatch = Partial<EditableOrderFields> & Record<string, unknown>
type MutableOrder = { -readonly [Key in keyof CreationOrder]: CreationOrder[Key] }

export interface CreationStateError extends Error {
  code: string
  details?: Record<string, unknown>
}

function fail(code: string, message: string, details?: Record<string, unknown>): never {
  const error = new Error(message) as CreationStateError
  error.name = 'CreationStateError'
  error.code = code
  error.details = details
  throw error
}

function clone<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => clone(item)) as T
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)])) as T
  }
  return value
}

function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value as Record<string, unknown>)) freeze(child)
  }
  return value
}

function immutable<T extends CreationOrder>(order: T): T {
  return freeze(order)
}

function assertUuid(value: string, field: string): void {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    fail('INVALID_UUID', `${field} precisa ser um UUID válido.`, { field })
  }
}

function assertFormats(formats: readonly CreationFormat[]): void {
  if (formats.length === 0) fail('FORMATS_REQUIRED', 'Selecione ao menos um formato.')
  const ids = new Set<string>()
  for (const format of formats) {
    if (!format.id.trim() || !Number.isFinite(format.width) || format.width <= 0 || !Number.isFinite(format.height) || format.height <= 0) {
      fail('INVALID_FORMAT', 'Formato precisa ter ID e dimensões válidas.', { formatId: format.id })
    }
    if (ids.has(format.id)) fail('DUPLICATE_FORMAT', 'Os formatos precisam ter IDs distintos.', { formatId: format.id })
    ids.add(format.id)
  }
}

/** Maior quantidade de partes aceita num pedido; cada parte vira uma página do mesmo projeto. */
export const MAX_PAGE_COUNT = 20

function assertPageCount(pageCount: number | null | undefined, division: ProductDivision): void {
  if (pageCount === undefined || pageCount === null) return
  if (!Number.isSafeInteger(pageCount) || pageCount < 2 || pageCount > MAX_PAGE_COUNT) {
    fail('INVALID_PAGE_COUNT', `A divisão precisa ter entre 2 e ${MAX_PAGE_COUNT} partes.`, { pageCount })
  }
  if (division !== 'pages') fail('PAGE_COUNT_REQUIRES_PAGES', 'Dividir em partes exige a divisão por páginas.', { pageCount })
}

/**
 * Tamanho de cada página ao dividir `count` produtos em `parts` partes equilibradas,
 * na ordem da lista. Se uma parte não couber em `capacity`, aumenta as partes até caber
 * (mesma regra do renderizador), sem nunca criar página vazia.
 */
export function splitPageSizes(count: number, parts: number, capacity: number): number[] {
  if (count <= 0) return []
  const safeCapacity = Math.max(1, Math.floor(capacity))
  const total = Math.min(count, Math.max(1, Math.floor(parts), Math.ceil(count / safeCapacity)))
  const base = Math.floor(count / total)
  const extra = count % total
  return Array.from({ length: total }, (_, index) => base + (index < extra ? 1 : 0))
}

function validateProducts(products: readonly CreationProduct[]): void {
  const ids = new Set<string>()
  for (const product of products) {
    if (!product.id.trim() || ids.has(product.id)) fail('INVALID_PRODUCT_ID', 'Cada produto precisa ter um ID estável e distinto.', { itemId: product.id })
    ids.add(product.id)
    // Hortifruti and other bulk items may have no brand, variant or package.
    // Keep those fields empty instead of inventing commercial details.
    for (const field of ['name', 'brand', 'variant', 'weight', 'price'] as const) {
      if (typeof product[field] !== 'string' || ((field === 'name' || field === 'price') && !product[field].trim())) {
        fail('MISSING_PRODUCT_FIELD', `O campo ${field} do produto precisa ser confirmado.`, { itemId: product.id, field })
      }
    }
  }
}

function assertAccount(order: CreationOrder, accountId: string): void {
  if (order.accountId !== accountId) {
    fail('ACCOUNT_MISMATCH', 'O pedido pertence a outra conta.', { orderId: order.id })
  }
}

function assertDataComplete(order: CreationOrder): void {
  validateProducts(order.products)
  if (order.products.length === 0 && order.kind !== 'studio') {
    fail('PRODUCTS_REQUIRED', 'Este tipo de material precisa de ao menos um produto confirmado.')
  }
  if (order.kind === 'studio' && order.products.length === 0) {
    const copy = order.institutionalText
    if (!copy || !copy.title.trim() || !copy.message.trim() || !copy.callToAction.trim()) {
      fail('INSTITUTIONAL_TEXT_REQUIRED', 'Confirme título, mensagem e chamada da arte institucional.')
    }
  }
}

export function createOrder(input: CreateOrderInput): CreationOrder {
  assertUuid(input.id, 'id')
  assertUuid(input.identity.accountId, 'accountId')
  if (!/^\+[1-9]\d{1,14}$/.test(input.identity.normalizedSender)) {
    fail('SENDER_REQUIRED', 'A identidade verificada precisa conter remetente normalizado em formato E.164.')
  }
  if (!['encarte', 'video', 'cartaz', 'studio'].includes(input.kind)) fail('INVALID_KIND', 'Tipo de material inválido.')
  assertFormats(input.formats)
  assertPageCount(input.pageCount, input.division ?? null)
  const products = clone(input.products ?? [])
  validateProducts(products)
  const theme = input.theme?.trim() || null
  const customization = normalizeFlyerCustomization(input.customization)
  const order: CreationOrder = {
    id: input.id,
    accountId: input.identity.accountId,
    sender: input.identity.normalizedSender,
    revision: 1,
    kind: input.kind,
    theme,
    themeTicket: theme ? null : { status: 'pending', ...(input.themeTicket?.scheduledEta ? { scheduledEta: input.themeTicket.scheduledEta } : {}) },
    formats: clone(input.formats),
    division: input.division ?? null,
    ...(input.pageCount ? { pageCount: input.pageCount } : {}),
    products,
    validity: input.validity ?? '',
    conditions: input.conditions ?? '',
    institutionalText: clone(input.institutionalText ?? null),
    images: products.map((product) => ({ itemId: product.id, key: '', hash: '', approvedRevision: null })),
    header: null,
    dataApprovedRevision: null,
    script: null,
    scriptApprovedRevision: null,
    previews: [],
    previewApprovals: [],
    ...(customization ? { customization } : {})
  }
  return immutable(order)
}

export function updateOrder(order: CreationOrder, accountId: string, patch: OrderPatch): CreationOrder {
  assertAccount(order, accountId)
  const forbidden = ['accountId', 'ownerId', 'sender', 'id', 'revision'].filter((key) => key in patch)
  if (forbidden.length) fail('IMMUTABLE_ORDER_FIELD', 'Identidade e propriedade do pedido não podem ser alteradas.', { fields: forbidden })
  const allowed = new Set(['kind', 'theme', 'formats', 'division', 'pageCount', 'products', 'validity', 'conditions', 'institutionalText', 'header', 'script', 'customization'])
  const unknown = Object.keys(patch).filter((key) => !allowed.has(key))
  if (unknown.length) fail('UNKNOWN_ORDER_FIELD', 'O pedido contém campos que não podem ser editados.', { fields: unknown })
  const next = { ...clone(order), ...clone(patch), revision: order.revision + 1 } as MutableOrder
  if (next.kind !== 'encarte' && next.kind !== 'video' && next.kind !== 'cartaz' && next.kind !== 'studio') fail('INVALID_KIND', 'Tipo de material inválido.')
  assertFormats(next.formats)
  assertPageCount(next.pageCount, next.division)
  validateProducts(next.products)
  if (next.kind === 'studio' && next.products.length === 0) assertDataComplete(next)
  next.theme = next.theme?.trim() || null
  const customization = normalizeFlyerCustomization(next.customization)
  if (customization) next.customization = customization
  else delete next.customization
  next.themeTicket = next.theme
    ? null
    : clone(patch.theme !== undefined && patch.theme !== order.theme ? { status: 'pending' as const } : order.themeTicket ?? { status: 'pending' as const })
  if (next.products.map((item) => item.id).join('\0') !== order.products.map((item) => item.id).join('\0')) {
    next.images = next.products.map((product) => order.images.find((image) => image.itemId === product.id) ?? { itemId: product.id, key: '', hash: '', approvedRevision: null })
  }
  next.dataApprovedRevision = null
  next.scriptApprovedRevision = null
  next.previews = []
  next.previewApprovals = []
  next.images = next.images.map((image) => ({ ...image, approvedRevision: null }))
  return immutable(next)
}

/**
 * Guarda a personalização antes da geração (conferência de dados/fotos) sem invalidar
 * aprovações: ela só muda o visual, nunca os dados que o cliente conferiu.
 */
export function withCustomization(order: CreationOrder, accountId: string, customization: FlyerCustomization | undefined): CreationOrder {
  assertAccount(order, accountId)
  const next = clone(order) as MutableOrder
  const normalized = normalizeFlyerCustomization(customization)
  if (normalized) next.customization = normalized
  else delete next.customization
  return immutable(next)
}

export function approveData(order: CreationOrder, accountId: string): CreationOrder {
  assertAccount(order, accountId)
  assertDataComplete(order)
  return immutable({ ...clone(order), dataApprovedRevision: order.revision })
}

/** Install a whole review set once; suggesting a photo never approves it. */
export function setImageCandidates(
  order: CreationOrder,
  accountId: string,
  candidates: Array<{ itemId: string; key: string; hash: string }>
): CreationOrder {
  assertAccount(order, accountId)
  const ids = new Set<string>()
  for (const candidate of candidates) {
    if (ids.has(candidate.itemId) || !order.products.some(product => product.id === candidate.itemId)) {
      fail('UNKNOWN_PRODUCT', 'Cada candidato precisa identificar um produto distinto do pedido.')
    }
    if (!candidate.key.trim() || !candidate.hash.trim()) fail('IMAGE_CANDIDATE_REQUIRED', 'A imagem precisa ter chave e hash.')
    ids.add(candidate.itemId)
  }
  const changed = candidates.some(candidate => {
    const current = order.images.find(image => image.itemId === candidate.itemId)
    return current?.key !== candidate.key || current?.hash !== candidate.hash
  })
  if (!changed) return order
  const next = updateOrder(order, accountId, {})
  return immutable({
    ...clone(next),
    images: next.images.map(image => {
      const candidate = candidates.find(item => item.itemId === image.itemId)
      return { ...(candidate || image), approvedRevision: null }
    })
  })
}

/** A rejected photo cannot be re-approved from the previous candidate set. */
export function rejectImageCandidates(order: CreationOrder, accountId: string, itemIds: string[]): CreationOrder {
  assertAccount(order, accountId)
  if (!itemIds.length || itemIds.some(id => !order.products.some(product => product.id === id))) {
    fail('UNKNOWN_PRODUCT', 'Informe os produtos cujas fotos precisam ser substituídas.')
  }
  const next = updateOrder(order, accountId, {})
  return immutable({ ...clone(next), images: next.images.map(image => itemIds.includes(image.itemId)
    ? { itemId: image.itemId, key: '', hash: '', approvedRevision: null } : image) })
}

export function approveImage(
  order: CreationOrder,
  accountId: string,
  candidate: { itemId: string; key: string; hash: string }
): CreationOrder {
  assertAccount(order, accountId)
  if (!order.products.some((product) => product.id === candidate.itemId)) fail('UNKNOWN_PRODUCT', 'A imagem precisa pertencer a um produto do pedido.', { itemId: candidate.itemId })
  if (!candidate.key.trim() || !candidate.hash.trim()) fail('IMAGE_CANDIDATE_REQUIRED', 'A imagem precisa ter chave e hash.')
  const current = order.images.find((image) => image.itemId === candidate.itemId)
  const changed = current?.key !== candidate.key || current?.hash !== candidate.hash
  const revision = order.revision + (changed ? 1 : 0)
  const images = order.images.map((image) => image.itemId === candidate.itemId
    ? { itemId: candidate.itemId, key: candidate.key, hash: candidate.hash, approvedRevision: revision }
    : { ...image, approvedRevision: changed ? null : image.approvedRevision })
  return immutable({
    ...clone(order), revision,
    images,
    dataApprovedRevision: changed ? null : order.dataApprovedRevision,
    scriptApprovedRevision: changed ? null : order.scriptApprovedRevision,
    previews: changed ? [] : clone(order.previews),
    previewApprovals: changed ? [] : clone(order.previewApprovals)
  })
}

export function approveScript(order: CreationOrder, accountId: string, script: string): CreationOrder {
  assertAccount(order, accountId)
  if (!script.trim()) fail('SCRIPT_REQUIRED', 'O roteiro precisa estar preenchido antes da aprovação.')
  const changed = order.script !== script
  const revision = order.revision + (changed ? 1 : 0)
  return immutable({
    ...clone(order), script, revision, scriptApprovedRevision: revision,
    dataApprovedRevision: changed ? null : order.dataApprovedRevision,
    images: changed ? order.images.map((image) => ({ ...image, approvedRevision: null })) : clone(order.images),
    previews: changed ? [] : clone(order.previews),
    previewApprovals: changed ? [] : clone(order.previewApprovals)
  })
}

export function assertCanGeneratePaidVoice(order: CreationOrder, accountId: string): void {
  assertAccount(order, accountId)
  if (order.kind !== 'video') fail('VOICE_REQUIRES_VIDEO', 'Locução paga só pode ser gerada para pedido de vídeo.')
  if (!order.script || order.scriptApprovedRevision !== order.revision) fail('SCRIPT_NOT_APPROVED', 'Aprove o roteiro desta revisão antes de gerar locução paga.')
}

export function registerPreview(
  order: CreationOrder,
  accountId: string,
  preview: CreationPreview
): CreationOrder {
  assertAccount(order, accountId)
  if (preview.revision !== order.revision) fail('STALE_REVISION', 'A prévia precisa corresponder à revisão atual.', { currentRevision: order.revision })
  if (!preview.artifactId.trim()) fail('ARTIFACT_REQUIRED', 'A prévia precisa ter um ID de artefato.')
  const formatIds = [...new Set(preview.formatIds)]
  if (!formatIds.length || formatIds.length !== preview.formatIds.length || formatIds.some((id) => !order.formats.some((format) => format.id === id))) {
    fail('INVALID_PREVIEW_FORMATS', 'A prévia deve identificar formatos distintos do pedido.')
  }
  const previews = order.previews.filter((item) => item.artifactId !== preview.artifactId)
  previews.push({ ...clone(preview), formatIds })
  return immutable({ ...clone(order), previews, previewApprovals: order.previewApprovals.filter((approval) => approval.artifactId !== preview.artifactId) })
}

export function approvePreview(
  order: CreationOrder,
  accountId: string,
  approval: PreviewApproval
): CreationOrder {
  assertAccount(order, accountId)
  if (approval.revision !== order.revision) fail('STALE_REVISION', 'A aprovação precisa corresponder à revisão atual.')
  const preview = order.previews.find((item) => item.artifactId === approval.artifactId && item.revision === approval.revision)
  if (!preview || !preview.formatIds.includes(approval.formatId)) fail('PREVIEW_FORMAT_MISMATCH', 'O artefato não contém esse formato para a revisão aprovada.')
  const approvals = order.previewApprovals.filter((item) => !(item.artifactId === approval.artifactId && item.formatId === approval.formatId))
  approvals.push(clone(approval))
  return immutable({ ...clone(order), previewApprovals: approvals })
}

export function assertCanRender(
  order: CreationOrder,
  accountId: string,
  options: { formatIds?: string[]; productIds?: string[] } = {}
): void {
  assertAccount(order, accountId)
  if (!order.theme) fail('THEME_PENDING', 'O pedido aguarda a escolha de um tema.', { ticket: order.themeTicket })
  if (!order.header || order.header.theme !== order.theme || order.header.formats.length === 0) fail('HEADER_REQUIRED', 'Escolha um cabeçalho compatível com o tema e formato.')
  const formatIds = options.formatIds ?? order.formats.map((format) => format.id)
  if (!formatIds.length || formatIds.some((id) => !order.formats.some((format) => format.id === id) || !order.header!.formats.includes(id))) {
    fail('HEADER_FORMAT_MISMATCH', 'O cabeçalho precisa ser compatível com todos os formatos solicitados.')
  }
  if (order.dataApprovedRevision !== order.revision) fail('DATA_NOT_APPROVED', 'Os dados precisam ser aprovados nesta revisão.')
  if (order.products.length && order.division === null) fail('DIVISION_REQUIRED', 'Escolha como dividir os produtos antes de renderizar.')
  if (order.pageCount && (order.division !== 'pages' || order.pageCount > order.products.length)) {
    fail('INVALID_PAGE_COUNT', 'Cada parte do encarte precisa ter ao menos um produto.', { pageCount: order.pageCount, count: order.products.length })
  }
  const productIds = options.productIds ?? order.products.map((product) => product.id)
  if (order.kind === 'video' && order.products.length > 6 && order.division !== 'pages') {
    fail('VIDEO_DIVISION_REQUIRED', 'Pedidos de vídeo com mais de seis produtos precisam ser divididos em páginas.')
  }
  if (order.kind === 'video' && productIds.length > 6) fail('VIDEO_PRODUCT_LIMIT', 'Cada vídeo pode conter no máximo seis produtos.', { count: productIds.length, limit: 6 })
  if (productIds.some((id) => !order.products.some((product) => product.id === id))) fail('UNKNOWN_PRODUCT', 'A renderização contém produto fora do pedido.')
  const missingImages = productIds.filter((id) => {
    const image = order.images.find((item) => item.itemId === id)
    return !image?.key || !image.hash || image.approvedRevision !== order.revision
  })
  if (missingImages.length) fail('IMAGES_NOT_APPROVED', 'Todas as fotos usadas precisam estar presentes e aprovadas nesta revisão.', { itemIds: missingImages })
}

export function assertCanDeliver(
  order: CreationOrder,
  accountId: string,
  artifactId: string,
  formatIds: string[]
): void {
  assertAccount(order, accountId)
  if (!formatIds.length) fail('FORMATS_REQUIRED', 'Informe os formatos que serão entregues.')
  const preview = order.previews.find((item) => item.artifactId === artifactId && item.revision === order.revision)
  if (!preview) fail('PREVIEW_NOT_FOUND', 'A entrega precisa usar uma prévia da revisão atual.')
  for (const formatId of formatIds) {
    if (!preview.formatIds.includes(formatId) || !order.previewApprovals.some((approval) =>
      approval.artifactId === artifactId && approval.revision === order.revision && approval.formatId === formatId
    )) {
      fail('PREVIEW_NOT_APPROVED', 'Cada formato precisa de aprovação explícita da prévia atual.', { artifactId, formatId })
    }
  }
}
