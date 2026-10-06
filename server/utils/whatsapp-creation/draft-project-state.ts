import { createHash } from 'node:crypto'
import type { ConversationState } from './conversation'

/**
 * Estado do projeto "em andamento" que o pedido do WhatsApp mantém no painel.
 * Regras puras (sem banco nem storage) para que a conversa, o repositório e o
 * job de sincronização decidam a mesma coisa sobre quando gravar de novo.
 */
export interface DraftProjectState {
  /** Assinatura do conteúdo atual do pedido que deveria estar no painel. */
  signature?: string
  /** Há conteúdo novo esperando ser gravado no projeto do painel. */
  pending?: boolean
  /** Última assinatura gravada com sucesso no projeto. */
  syncedSignature?: string
  /** Assinatura abandonada após falhas repetidas (não tenta de novo sem mudança). */
  failedSignature?: string
  attempts?: number
  projectId?: string
  version?: number
  syncedAt?: string
}

const stableValue = (value: unknown): unknown => Array.isArray(value)
  ? value.map(stableValue)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value as Record<string, unknown>).sort().map(key => [key, stableValue((value as Record<string, unknown>)[key])]))
    : value

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(stableValue(value))).digest('hex')

/**
 * Conteúdo relevante para o projeto do painel. `null` quando ainda não há o que
 * gravar (sem cabeçalho escolhido, outro tipo de material ou fase de geração/entrega,
 * que já grava o projeto final).
 */
export function draftProjectSignature(state: ConversationState): string | null {
  if (state.draft.kind !== 'encarte' || !state.header || !state.draft.formats.length) return null
  const order = state.order
  if (order) {
    // Com pedido montado, só fases de conferência: em "collecting" o pedido está
    // incompleto e um rascunho só com o cabeçalho apagaria os produtos já gravados.
    if (!['data', 'images'].includes(state.phase) || !order.header) return null
    return hash({
      stage: 'order',
      header: { id: order.header.id, revision: order.header.revision },
      theme: order.theme,
      formats: order.formats.map(format => format.id),
      division: order.division,
      validity: order.validity,
      conditions: order.conditions,
      products: order.products.map(product => ({
        id: product.id, name: product.name, brand: product.brand, variant: product.variant, weight: product.weight,
        price: product.price, department: product.department || '', condition: product.condition || ''
      })),
      images: order.products.map(product => {
        const candidate = state.candidates.find(item => item.itemId === product.id)
        return candidate ? { key: candidate.key, hash: candidate.hash } : null
      })
    })
  }
  // Cabeçalho escolhido antes dos produtos: só o modelo com dados da loja (sem render pesado).
  if (state.phase !== 'collecting') return null
  return hash({
    stage: 'header',
    header: { id: state.header.id, revision: state.header.revision },
    theme: state.draft.theme || '',
    formats: [...state.draft.formats],
    validity: state.draft.validity || '',
    conditions: state.draft.conditions || ''
  })
}

const syncFields = (value?: DraftProjectState): DraftProjectState => value
  ? Object.fromEntries(Object.entries({
    syncedSignature: value.syncedSignature, failedSignature: value.failedSignature, projectId: value.projectId,
    version: value.version, syncedAt: value.syncedAt
  }).filter(([, field]) => field !== undefined))
  : {}

/**
 * Junta o estado gravado pelo job (projeto, versão, última sincronização) com o
 * estado novo da conversa e marca se há algo novo para gravar. Evita que a
 * mensagem processada em paralelo apague o registro de um projeto já gravado.
 */
export function reconcileDraftProjectState(next: ConversationState, stored?: DraftProjectState): ConversationState {
  const current = next.draftProject
  const syncedAt = (value?: DraftProjectState) => Date.parse(value?.syncedAt || '') || 0
  // O job grava direto no banco; vale o registro com a sincronização mais recente.
  const latest = syncedAt(current) > syncedAt(stored) ? current : stored || current
  const signature = draftProjectSignature(next)
  if (!signature && !latest) return next
  const synced = syncFields(latest)
  const changed = signature !== current?.signature
  const pending = Boolean(signature && signature !== synced.syncedSignature && signature !== synced.failedSignature)
  next.draftProject = {
    ...synced,
    ...(signature ? { signature } : {}),
    pending,
    attempts: changed ? 0 : current?.attempts || 0
  }
  return next
}
