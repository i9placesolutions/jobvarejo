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
}

export interface CreateOrderInput {
  id: string
  identity: VerifiedWhatsAppIdentity
  kind: CreationKind
  theme: string | null
  formats: CreationFormat[]
  division?: ProductDivision
  products?: CreationProduct[]
  validity?: string
  conditions?: string
  institutionalText?: InstitutionalText | null
  themeTicket?: MissingThemeTicket | null
}

export type EditableOrderFields = Pick<
  CreationOrder,
  'kind' | 'theme' | 'formats' | 'division' | 'products' | 'validity' | 'conditions' | 'institutionalText' | 'header' | 'script'
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
  const products = clone(input.products ?? [])
  validateProducts(products)
  const theme = input.theme?.trim() || null
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
    previewApprovals: []
  }
  return immutable(order)
}

export function updateOrder(order: CreationOrder, accountId: string, patch: OrderPatch): CreationOrder {
  assertAccount(order, accountId)
  const forbidden = ['accountId', 'ownerId', 'sender', 'id', 'revision'].filter((key) => key in patch)
  if (forbidden.length) fail('IMMUTABLE_ORDER_FIELD', 'Identidade e propriedade do pedido não podem ser alteradas.', { fields: forbidden })
  const allowed = new Set(['kind', 'theme', 'formats', 'division', 'products', 'validity', 'conditions', 'institutionalText', 'header', 'script'])
  const unknown = Object.keys(patch).filter((key) => !allowed.has(key))
  if (unknown.length) fail('UNKNOWN_ORDER_FIELD', 'O pedido contém campos que não podem ser editados.', { fields: unknown })
  const next = { ...clone(order), ...clone(patch), revision: order.revision + 1 } as MutableOrder
  if (next.kind !== 'encarte' && next.kind !== 'video' && next.kind !== 'cartaz' && next.kind !== 'studio') fail('INVALID_KIND', 'Tipo de material inválido.')
  assertFormats(next.formats)
  validateProducts(next.products)
  if (next.kind === 'studio' && next.products.length === 0) assertDataComplete(next)
  next.theme = next.theme?.trim() || null
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
