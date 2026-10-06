import { z } from 'zod'
import {
  FLYER_CUSTOMIZATION_LIMITS, mergeFlyerCustomization,
  type CreationProduct, type FlyerCustomization, type FlyerImageFillCustomization
} from '~/shared/whatsapp-creation'
import { isAlcoholicProduct } from '~/utils/product-card-configuration'
import { parseLiteralValidityPeriod } from './validity-period'

/**
 * Regras puras dos ajustes do encarte pedidos pelo WhatsApp. A IA só PROPÕE `edits`;
 * aqui o servidor confere a evidência na mensagem, limita os valores e produz a
 * personalização absoluta. Nada neste arquivo acessa banco, storage ou rede.
 */

export const FLYER_EDIT_TARGETS = ['logo', 'seal', 'product_names', 'price_label', 'alcohol_badge', 'highlight_color', 'card_color', 'validity_format', 'whatsapp', 'address', 'product_images'] as const
export const FLYER_EDIT_OPERATIONS = ['increase', 'decrease', 'set', 'choose', 'hide', 'show'] as const
export type FlyerEditTarget = typeof FLYER_EDIT_TARGETS[number]
export type FlyerEditAmount = 'little' | 'normal' | 'lot'

export const flyerEditSchema = z.object({
  target: z.enum(FLYER_EDIT_TARGETS),
  operation: z.enum(FLYER_EDIT_OPERATIONS),
  scope: z.enum(['all', 'items', 'unclear']).optional(),
  itemNumbers: z.array(z.number().int().positive()).max(100).optional(),
  amount: z.enum(['little', 'normal', 'lot']).optional(),
  value: z.string().max(300).optional(),
  choice: z.number().int().positive().optional(),
  persist: z.enum(['order', 'account']).optional(),
  // A IA às vezes omite; sem evidência o alvo precisa aparecer na própria mensagem.
  evidence: z.string().max(300).default('')
}).strict()
export type FlyerEdit = z.infer<typeof flyerEditSchema>

/** Fator de cada pedido relativo (“um pouco”, “maior”, “bem maior”). */
export const FLYER_EDIT_FACTORS: Record<FlyerEditAmount, number> = { little: 1.1, normal: 1.2, lot: 1.35 }

const SCALE_TARGETS = {
  logo: { key: 'logoScale', label: 'a logo' },
  seal: { key: 'sealScale', label: 'o selo do modelo' },
  product_names: { key: 'nameScale', label: 'o nome dos produtos' },
  price_label: { key: 'labelScale', label: 'a etiqueta de preço' },
  alcohol_badge: { key: 'badgeScale', label: 'o selo +18' }
} as const satisfies Record<string, { key: keyof typeof FLYER_CUSTOMIZATION_LIMITS; label: string }>

const normalize = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ').trim()
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const round = (value: number) => Math.round(value * 1000) / 1000

/** Cores faladas em pt-BR; a IA copia a palavra e o servidor escolhe o hexadecimal. */
const COLOR_NAMES: ReadonlyArray<[string, string]> = [
  ['vermelho escuro', '#991b1b'], ['vermelho claro', '#f87171'], ['vermelho', '#dc2626'],
  ['amarelo claro', '#fef08a'], ['amarelo escuro', '#ca8a04'], ['amarelo', '#ffd400'],
  ['verde escuro', '#166534'], ['verde claro', '#86efac'], ['verde limao', '#a3e635'], ['verde', '#16a34a'],
  ['azul escuro', '#1e3a8a'], ['azul claro', '#38bdf8'], ['azul marinho', '#1e3a8a'], ['azul', '#1d4ed8'],
  ['laranja escuro', '#c2410c'], ['laranja', '#f97316'], ['roxo', '#7e22ce'], ['lilas', '#c4b5fd'], ['violeta', '#7c3aed'],
  ['rosa', '#ec4899'], ['vinho', '#7f1d1d'], ['marrom', '#7c4a1e'], ['dourado', '#d4a017'], ['bege', '#f5e6c8'],
  ['preto', '#111111'], ['branco', '#ffffff'], ['cinza claro', '#d1d5db'], ['cinza escuro', '#4b5563'], ['cinza', '#9ca3af']
]

/** Converte “vermelho”/“#ff0000” em hexadecimal. Hexadecimal só vale se estiver na mensagem. */
export function resolveColorValue(value: string | undefined, text: string): string | undefined {
  const raw = String(value || '').trim()
  if (!raw) return undefined
  const hex = raw.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i)
  if (hex && raw.startsWith('#')) {
    const digits = hex[1]!.length === 3 ? hex[1]!.split('').map(char => char + char).join('') : hex[1]!
    const color = `#${digits.toLowerCase()}`
    const message = text.toLowerCase()
    return message.includes(raw.toLowerCase()) || message.includes(color) ? color : undefined
  }
  // Artigo só sai quando é palavra solta: “a azul” → “azul”, mas “azul”/“amarelo” ficam intactos.
  const name = normalize(raw).replace(/^(?:cor\s+)?(?:(?:o|a|de|do|da|para|pra)\s+)?/, '').replace(/^cor\s+/, '').trim()
  const found = COLOR_NAMES.find(([label]) => label === name)
  if (!found) return undefined
  // A cor dita precisa aparecer na mensagem; evita a IA inventar uma cor.
  return normalize(text).includes(found[0]) ? found[1] : undefined
}

/** Cor do texto com bom contraste sobre o fundo (mesma regra de luminância dos modelos). */
export function contrastingTextColor(background: string): string {
  const rgb = /^#([0-9a-f]{6})$/i.exec(background)?.[1]
  if (!rgb) return '#111111'
  const luminance = .299 * parseInt(rgb.slice(0, 2), 16) + .587 * parseInt(rgb.slice(2, 4), 16) + .114 * parseInt(rgb.slice(4, 6), 16)
  return luminance > 150 ? '#111111' : '#ffffff'
}

const COMBINATIONS: Record<FlyerEditTarget, ReadonlyArray<FlyerEdit['operation']>> = {
  logo: ['increase', 'decrease'], seal: ['increase', 'decrease'], product_names: ['increase', 'decrease'],
  price_label: ['increase', 'decrease', 'choose'], alcohol_badge: ['increase', 'decrease'],
  highlight_color: ['set'], card_color: ['set'], validity_format: ['set'],
  whatsapp: ['set'], address: ['set'], product_images: ['set']
}

/**
 * Só aceita `edits` com evidência literal na mensagem (mesmo padrão da aprovação semântica)
 * e combinação de alvo/operação conhecida. O resto é descartado em silêncio.
 */
// Palavras que mostram, na própria mensagem, de qual parte do encarte a pessoa está falando.
const TARGET_WORDS: Record<FlyerEdit['target'], RegExp> = {
  logo: /\blogo|logomarca|marca da loja\b/,
  seal: /\bselo/,
  product_names: /\bnome/,
  price_label: /\betiqueta|preco|precos|valor/,
  alcohol_badge: /\bselo|18|bebida|alcool/,
  highlight_color: /\bdestaque|cor/,
  card_color: /\bcard|cor|fundo/,
  validity_format: /\bdata|validade|extenso|numeric/,
  whatsapp: /\bwhats|zap|telefone|celular|contato/,
  address: /\bendereco|rua|avenida|bairro/,
  product_images: /\bfoto|imagem|imagens/
}
export function validFlyerEdits(edits: readonly FlyerEdit[] | undefined, text: string): FlyerEdit[] {
  if (!edits?.length) return []
  const message = normalize(text)
  const seen = new Set<string>()
  const output: FlyerEdit[] = []
  for (const edit of edits.slice(0, 6)) {
    const evidence = normalize(edit.evidence || '')
    if (evidence.length >= 2 ? !message.includes(evidence) : !TARGET_WORDS[edit.target].test(message)) continue
    if (!COMBINATIONS[edit.target].includes(edit.operation)) continue
    const key = `${edit.target}:${edit.operation}:${(edit.itemNumbers || []).join(',')}`
    if (seen.has(key)) continue
    seen.add(key)
    output.push(edit)
  }
  return output
}

/** Produtos citados pelo nome inteiro na mensagem (na ordem da lista). */
export function referencedProducts<T extends { id: string; name: string }>(text: string, products: readonly T[]): T[] {
  const message = normalize(text)
  return products.filter(product => {
    const name = normalize(product.name)
    return name.length > 1 && new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(name)}(?:$|[^a-z0-9])`).test(message)
  })
}

export type FlyerEditAsk =
  | { kind: 'label'; scope: 'all' | 'items' | 'unclear'; itemIds: string[]; choice?: number }
  | { kind: 'seal'; operation: 'increase' | 'decrease'; amount: FlyerEditAmount }
  | { kind: 'business_scope'; field: 'whatsapp' | 'address'; value: string; persistRequested: boolean }
  | { kind: 'business_value'; field: 'whatsapp' | 'address' }
  | { kind: 'items'; target: FlyerEditTarget }
  | { kind: 'validity_dates' }
  | { kind: 'color_value'; target: 'highlight_color' | 'card_color' }

export interface FlyerEditContext {
  text: string
  /** Personalização atual do pedido/rascunho. */
  customization?: FlyerCustomization
  products: ReadonlyArray<Pick<CreationProduct, 'id' | 'name'> & Partial<CreationProduct>>
  validity?: string
  /** Contato do cadastro da loja, para não pedir confirmação do que já é igual. */
  profile?: { whatsapp?: string; address?: string }
  today?: Date
}

export interface FlyerEditResolution {
  /** Personalização já mesclada com a atual (pronta para gravar). */
  customization: FlyerCustomization | undefined
  changes: string[]
  notices: string[]
  asks: FlyerEditAsk[]
  unsupported: string[]
  changed: boolean
}

const digits = (value: string) => value.replace(/\D/g, '')

/** WhatsApp aceita 10 a 13 dígitos e precisa estar na mensagem (nada de número inventado). */
export function resolveWhatsappValue(value: string | undefined, text: string): string | undefined {
  const raw = String(value || '').trim()
  const only = digits(raw)
  if (!/^[+\d\s().-]{8,30}$/.test(raw) || only.length < 10 || only.length > 13) return undefined
  return digits(text).includes(only) ? raw : undefined
}

/** Endereço até 300 caracteres e copiado literalmente da mensagem. */
export function resolveAddressValue(value: string | undefined, text: string): string | undefined {
  const raw = String(value || '').replace(/\s+/g, ' ').trim()
  if (raw.length < 5 || raw.length > 300) return undefined
  // A IA às vezes devolve o próprio pedido (“muda o endereço”) como valor: isso não é endereço.
  const command = normalize(raw).replace(/\b(?:muda|mude|mudar|troca|troque|trocar|altera|altere|alterar|coloca|coloque|atualiza|atualize|o|a|novo|nova|meu|minha|endereco|enderecos|da|de|do|loja)\b/g, '').trim()
  if (command.length < 4) return undefined
  return normalize(text).includes(normalize(raw)) ? raw : undefined
}

const FORMAT_WORDS: Array<[RegExp, 'numeric' | 'long']> = [
  [/\b(?:extenso|por extenso|long|longo|escrit[oa]|nome do mes|com o nome)\b/, 'long'],
  [/\b(?:numeric[oa]?|numero|numeros|barra|barras|dd mm|curto|curta)\b/, 'numeric']
]

function resolveImageFill(value: string | undefined): FlyerImageFillCustomization | undefined {
  const text = normalize(String(value || ''))
  if (!text) return undefined
  const result: FlyerImageFillCustomization = {}
  const words: Record<string, number> = { uma: 1, um: 1, duas: 2, dois: 2, tres: 3, quatro: 4 }
  const count = text.match(/\b([1-4])\b/)?.[1] || text.match(/\b(uma|um|duas|dois|tres|quatro)\b/)?.[1]
  if (count) result.count = /^\d$/.test(count) ? Number(count) : words[count]
  if (/\bhorizontal|lado a lado|lateral\b/.test(text)) result.direction = 'horizontal'
  else if (/\bvertical|empilhad[oa]|uma em cima\b/.test(text)) result.direction = 'vertical'
  return Object.keys(result).length ? result : undefined
}

/**
 * Transforma `edits` já validados em personalização absoluta. Pedidos que dependem de
 * resposta do cliente (etiqueta, escopo, valor ausente) voltam em `asks`; o chamador
 * pergunta uma coisa por vez e retoma depois.
 */
export function resolveFlyerEdits(edits: readonly FlyerEdit[], context: FlyerEditContext): FlyerEditResolution {
  const current = context.customization
  let patch: FlyerCustomization = {}
  const changes: string[] = [], notices: string[] = [], asks: FlyerEditAsk[] = [], unsupported: string[] = []
  const hasAlcohol = context.products.some(product => isAlcoholicProduct(product))
  const message = normalize(context.text)
  const nextState = () => mergeFlyerCustomization(current, patch) || {}
  // Produtos do pedido por número (1 a N) ou citados pelo nome; sem nenhum, o escopo fica sem resolver.
  const itemsOf = (edit: FlyerEdit, whenOmitted: 'all' | 'unclear'): { scope: 'all' | 'items' | 'unclear'; ids: string[] } => {
    const numbers = [...new Set(edit.itemNumbers || [])].filter(number => number >= 1 && number <= context.products.length)
    const named = referencedProducts(context.text, context.products).map(item => item.id)
    const ids = [...new Set([...numbers.map(number => context.products[number - 1]!.id), ...named])]
    const scope = edit.scope === 'all' ? 'all' : ids.length ? 'items' : edit.scope === undefined ? whenOmitted : 'unclear'
    return { scope, ids: scope === 'items' ? ids : [] }
  }
  for (const edit of edits) {
    if (edit.target in SCALE_TARGETS && (edit.operation === 'increase' || edit.operation === 'decrease')) {
      const target = edit.target as keyof typeof SCALE_TARGETS
      // “Selo” sem contexto é o selo do modelo; havendo produto alcoólico, pergunta qual deles.
      if (target === 'seal' && hasAlcohol && !/\b(?:18|alcool|bebida|maior de idade|cerveja|vinho)\b/.test(message) && !/\b(?:modelo|cabecalho|decorativ|topo|da arte)\b/.test(message)) {
        asks.push({ kind: 'seal', operation: edit.operation, amount: edit.amount || 'normal' })
        continue
      }
      if (target === 'alcohol_badge' && !hasAlcohol) {
        notices.push('Nenhum produto desta lista usa o selo +18, então não há o que ajustar nele.')
        continue
      }
      const { key, label } = SCALE_TARGETS[target]
      const [min, max] = FLYER_CUSTOMIZATION_LIMITS[key]
      const factor = FLYER_EDIT_FACTORS[edit.amount || 'normal']
      const before = nextState()[key] ?? 1
      const wanted = edit.operation === 'increase' ? before * factor : before / factor
      const after = round(Math.min(max, Math.max(min, wanted)))
      if (after === round(before)) {
        notices.push(edit.operation === 'increase'
          ? `${capitalize(label)} já está no máximo que cabe no modelo.`
          : `${capitalize(label)} já está no menor tamanho que mantém a leitura.`)
        continue
      }
      patch = { ...patch, [key]: after }
      const percent = Math.round(Math.abs(after / before - 1) * 100)
      const limited = after !== round(wanted)
      changes.push(`${label} ${edit.operation === 'increase' ? 'maior' : 'menor'} (${edit.operation === 'increase' ? '+' : '-'}${percent}%${limited ? ', no limite do modelo' : ''})`)
      continue
    }
    if (edit.target === 'price_label' && edit.operation === 'choose') {
      const items = itemsOf(edit, 'unclear')
      asks.push({ kind: 'label', scope: items.scope, itemIds: items.ids, ...(edit.choice ? { choice: edit.choice } : {}) })
      continue
    }
    if (edit.target === 'highlight_color' || edit.target === 'card_color') {
      const color = resolveColorValue(edit.value, context.text)
      if (!color) { asks.push({ kind: 'color_value', target: edit.target }); continue }
      const text = contrastingTextColor(color)
      patch = { ...patch, palette: edit.target === 'highlight_color'
        ? { ...(patch.palette || {}), highlightCardColor: color, highlightProdNameColor: text }
        : { ...(patch.palette || {}), cardColor: color, prodNameColor: text } }
      changes.push(edit.target === 'highlight_color' ? `cor dos cards em destaque (${colorLabel(color)})` : `cor de todos os cards (${colorLabel(color)})`)
      continue
    }
    if (edit.target === 'validity_format') {
      const wanted = normalize(edit.value || context.text)
      const format = FORMAT_WORDS.find(([pattern]) => pattern.test(wanted))?.[1]
      if (!format) { unsupported.push('Qual formato da data: por extenso (6 de outubro) ou numérico (06/10)?'); continue }
      if (format === 'long' && !validityParses(context.validity, context.today)) { asks.push({ kind: 'validity_dates' }); continue }
      patch = { ...patch, validityDateFormat: format }
      changes.push(`data da validade ${format === 'long' ? 'por extenso' : 'numérica'}`)
      continue
    }
    if (edit.target === 'whatsapp' || edit.target === 'address') {
      const field = edit.target
      const value = field === 'whatsapp' ? resolveWhatsappValue(edit.value, context.text) : resolveAddressValue(edit.value, context.text)
      if (!value) { asks.push({ kind: 'business_value', field }); continue }
      const stored = context.profile?.[field] || ''
      const same = field === 'whatsapp' ? digits(stored) === digits(value) : normalize(stored) === normalize(value)
      if (same) { notices.push(field === 'whatsapp' ? 'Esse WhatsApp já é o do cadastro da loja.' : 'Esse endereço já é o do cadastro da loja.'); continue }
      const sameOrder = field === 'whatsapp'
        ? digits(current?.business?.whatsapp || '') === digits(value) : normalize(current?.business?.address || '') === normalize(value)
      if (sameOrder) { notices.push(field === 'whatsapp' ? 'Esse WhatsApp já está no encarte.' : 'Esse endereço já está no encarte.'); continue }
      const onlyHere = edit.persist === 'order' && /\b(?:so|apenas|somente)\b.{0,20}\b(?:neste|nesse|deste|desse|esse|este|encarte|pedido)\b/.test(message)
      if (onlyHere) {
        patch = { ...patch, business: { ...(patch.business || {}), [field]: value } }
        changes.push(field === 'whatsapp' ? `WhatsApp ${value} só neste encarte` : 'endereço só neste encarte')
        continue
      }
      asks.push({ kind: 'business_scope', field, value, persistRequested: edit.persist === 'account' })
      continue
    }
    if (edit.target === 'product_images') {
      const fill = resolveImageFill(edit.value)
      if (!fill) { unsupported.push('Quantas fotos de cada produto você quer no card: 1, 2, 3 ou 4?'); continue }
      const items = itemsOf(edit, 'all')
      if (items.scope === 'unclear') { asks.push({ kind: 'items', target: 'product_images' }); continue }
      if (items.scope === 'items') {
        patch = { ...patch, itemImageFill: { ...(patch.itemImageFill || {}), ...Object.fromEntries(items.ids.map(id => [id, fill])) } }
        changes.push(`${fillLabel(fill)} em ${items.ids.length === 1 ? 'um produto' : `${items.ids.length} produtos`}`)
      } else {
        patch = { ...patch, imageFill: fill }
        changes.push(`${fillLabel(fill)} em todos os produtos`)
      }
      continue
    }
    unsupported.push('Esse ajuste eu ainda não consigo fazer pelo WhatsApp; pelo painel de edição dá para fazer.')
  }
  const merged = mergeFlyerCustomization(current, patch)
  const same = JSON.stringify(merged || {}) === JSON.stringify(current || {})
  return { customization: merged, changes, notices, asks, unsupported, changed: !same }
}

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1)
const fillLabel = (fill: FlyerImageFillCustomization) =>
  `${fill.count ? `${fill.count} ${fill.count === 1 ? 'foto' : 'fotos'} por card` : 'fotos'}${fill.direction === 'horizontal' ? ' lado a lado' : fill.direction === 'vertical' ? ' empilhadas' : ''}`
const colorLabel = (hex: string) => COLOR_NAMES.find(([, value]) => value === hex)?.[0] || hex

/** “Por extenso” só é possível quando a validade informada vira datas. */
function validityParses(validity: string | undefined, today?: Date): boolean {
  const period = validity ? parseLiteralValidityPeriod(validity, today) : null
  return Boolean(period && 'startDate' in period)
}

/** Texto curto das mudanças aplicadas, para a resposta ao cliente. */
export function describeFlyerChanges(resolution: Pick<FlyerEditResolution, 'changes' | 'notices'>): string {
  const done = resolution.changes.length
    ? `Pronto: ${resolution.changes.length > 1 ? `${resolution.changes.slice(0, -1).join(', ')} e ${resolution.changes[resolution.changes.length - 1]}` : resolution.changes[0]}.`
    : ''
  return [done, ...resolution.notices].filter(Boolean).join(' ')
}
