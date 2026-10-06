import { pgQuery, pgTx } from '../postgres'
import { resolveWhatsAppAccount } from './access'
import { assertCreationAccess, queueCreationSend } from './repository'
import { FLYER_RENDER_PREEMPTED, isFlyerRendererBusy, saveDraftFlyerProject } from './render'
import { CREATION_FORMATS, type ConversationState, type ConversationSend } from './conversation'
import { draftProjectSignature, type DraftProjectState } from './draft-project-state'
import { createOrder, updateOrder, type CreationFormat, type CreationOrder } from '~/shared/whatsapp-creation'

/** Tentativas por conteúdo antes de desistir (sem nova mudança não tenta outra vez). */
const MAX_DRAFT_ATTEMPTS = 3

export const DRAFT_PROJECT_NOTICE = 'Esse encarte já fica salvo na sua conta do Job Varejo. Se preferir, dá para continuar a edição pelo painel.'
export const DRAFT_FORK_NOTICE = 'Vi que você mexeu nesse encarte pelo painel. Para não apagar suas alterações, salvei a atualização do WhatsApp como um novo encarte na sua conta.'

/**
 * Pedido usado no rascunho. Com cabeçalho escolhido e sem pedido montado,
 * cria um pedido sintético só com o modelo (revisão 0: nunca vence um pedido real).
 */
export function draftOrderFor(state: ConversationState, orderId: string, ownerId: string, senderPhone: string): CreationOrder | null {
  if (state.order) return state.order.header ? state.order : null
  if (!state.header || state.draft.kind !== 'encarte') return null
  const formats = [...new Set(state.draft.formats)].map(id => CREATION_FORMATS.find(format => format.id === id))
  if (!formats.length || formats.some(format => !format)) return null
  const validity = state.draft.validity === 'sem validade' ? '' : state.draft.validity || ''
  const base = createOrder({ id: orderId, identity: { accountId: ownerId, normalizedSender: '+' + String(senderPhone).replace(/^\+/, '') },
    kind: 'encarte', theme: state.draft.theme || state.header.theme, formats: formats as CreationFormat[], division: null, products: [],
    validity, conditions: state.draft.conditions || '' })
  const withHeader = updateOrder(base, ownerId, { header: { id: state.header.id, revision: state.header.revision, theme: state.draft.theme || state.header.theme,
    formats: state.header.formats, ...(state.header.nativeThemeId ? { nativeThemeId: state.header.nativeThemeId } : {}) } })
  return { ...withHeader, revision: 0 }
}

type SyncOutcome = 'synced' | 'cleared' | 'busy' | 'failed' | 'skipped'

async function commitDraftState(row: any, signature: string | null, patch: (draft: DraftProjectState) => DraftProjectState, send: ConversationSend[] = [], correlation = '') {
  return pgTx(async client => {
    const conversation = (await client.query('SELECT current_order_id FROM public.whatsapp_creation_conversations WHERE id=$1 AND owner_id=$2 FOR UPDATE', [row.conversation_id, row.owner_id])).rows[0]
    if (!conversation || conversation.current_order_id !== row.id) return false
    const current = (await client.query('SELECT state FROM public.whatsapp_creation_orders WHERE id=$1 AND owner_id=$2 FOR UPDATE', [row.id, row.owner_id])).rows[0]?.state as ConversationState | undefined
    if (!current) return false
    const next = patch({ ...(current.draftProject || {}) })
    // Se a conversa mudou durante o render, o conteúdo novo continua pendente.
    const currentSignature = draftProjectSignature(current)
    next.signature = currentSignature || undefined
    next.pending = Boolean(currentSignature && currentSignature !== next.syncedSignature && currentSignature !== next.failedSignature)
    if (currentSignature !== signature) next.attempts = 0
    current.draftProject = next
    // Sem mexer em updated_at: ele marca a última mensagem e controla a espera entre gravações.
    await client.query("UPDATE public.whatsapp_creation_orders SET state=jsonb_set(state,'{draftProject}',$3::jsonb) WHERE id=$1 AND owner_id=$2", [row.id, row.owner_id, JSON.stringify(next)])
    // Avisos ficam fora de recentTurns para não mudar a pergunta pendente da conversa.
    if (send.length) await queueCreationSend(client, row.conversation_id, row.owner_id, row.id, current, send, correlation)
    return true
  })
}

export async function syncDraftProject(orderId: string): Promise<SyncOutcome> {
  const row = (await pgQuery(`SELECT o.*,c.sender_phone,c.current_order_id FROM public.whatsapp_creation_orders o
    JOIN public.whatsapp_creation_conversations c ON c.id=o.conversation_id AND c.owner_id=o.owner_id WHERE o.id=$1`, [orderId])).rows[0]
  if (!row || row.current_order_id !== row.id) return 'skipped'
  const state = row.state as ConversationState
  const signature = draftProjectSignature(state)
  const draft = state.draftProject || {}
  if (!signature || signature === draft.syncedSignature || signature === draft.failedSignature) {
    await commitDraftState(row, signature, value => value)
    return 'cleared'
  }
  if (isFlyerRendererBusy()) return 'busy'
  try {
    const account = await resolveWhatsAppAccount(row.sender_phone)
    if (!account.ok || account.user.id !== row.owner_id) throw new Error('account_mismatch')
    assertCreationAccess(account.user, 'encarte')
    const order = draftOrderFor(state, row.id, row.owner_id, row.sender_phone)
    if (!order || order.accountId !== row.owner_id) throw new Error('order_unavailable')
    const saved = await saveDraftFlyerProject(order, state.candidates, account.user, account.businessProfile)
    const send: ConversationSend[] = []
    let correlation = ''
    if (!saved.stale && saved.forked) {
      send.push({ type: 'text', text: DRAFT_FORK_NOTICE })
      correlation = `draft-fork:${row.id}:${saved.version}`
    } else if (!saved.stale && order.products.length) {
      // Uma única vez por conversa (chave de idempotência), sem link e longe das imagens.
      send.push({ type: 'text', text: DRAFT_PROJECT_NOTICE })
      correlation = `draft-notice:${row.conversation_id}`
    }
    await commitDraftState(row, signature, value => ({
      ...value, syncedSignature: signature, failedSignature: undefined, attempts: 0,
      ...(saved.stale ? {} : { projectId: saved.projectId, version: saved.version }), syncedAt: new Date().toISOString()
    }), send, correlation)
    return 'synced'
  } catch (error: any) {
    if (Number(error?.statusCode) === 503 || error?.data?.code === FLYER_RENDER_PREEMPTED) return 'busy'
    const attempts = Number(draft.signature === signature ? draft.attempts || 0 : 0) + 1
    console.warn('[whatsapp-creation:draft-project] falha ao gravar rascunho', JSON.stringify({ orderId, attempts,
      statusCode: Number(error?.statusCode || 0), reason: String(error?.statusMessage || error?.message || 'unknown').slice(0, 200) }))
    await commitDraftState(row, signature, value => ({
      ...value, attempts, ...(attempts >= MAX_DRAFT_ATTEMPTS ? { failedSignature: signature } : {})
    }))
    return 'failed'
  }
}

/**
 * Grava no painel os encartes em andamento com conteúdo novo. Espera a conversa
 * ficar parada alguns segundos (agrupa várias mensagens num único render) e
 * processa um por vez, pois o render editável usa o Chromium.
 */
export async function syncWhatsAppDraftProjects(limit = 1) {
  const rows = (await pgQuery(`SELECT o.id FROM public.whatsapp_creation_orders o
    JOIN public.whatsapp_creation_conversations c ON c.id=o.conversation_id AND c.owner_id=o.owner_id AND c.current_order_id=o.id
    WHERE o.kind='encarte' AND o.state->'draftProject'->>'pending'='true' AND o.updated_at<now()-interval '20 seconds'
      AND (c.lease_until IS NULL OR c.lease_until<now())
    ORDER BY o.updated_at LIMIT $1`, [limit])).rows
  const outcomes: SyncOutcome[] = []
  for (const row of rows) {
    const outcome = await syncDraftProject(String(row.id))
    outcomes.push(outcome)
    if (outcome === 'busy') break
  }
  return { checked: rows.length, synced: outcomes.filter(outcome => outcome === 'synced').length }
}
