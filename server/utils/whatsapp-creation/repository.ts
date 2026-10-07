import { randomUUID } from 'node:crypto'
import { createError } from 'h3'
import type { PoolClient } from 'pg'
import type { AuthenticatedUser } from '../auth'
import { pgQuery, pgTx } from '../postgres'
import { resolveWhatsAppAccount } from './access'
import { newConversationState, type ConversationState, type ConversationSend } from './conversation'
import { validateProviderEvent, signOwnedArtifact, authenticateCreationProvider } from './media'
import { normalizeBrazilWhatsApp } from '~/utils/whatsapp-auth'
import { assertCanDeliver, updateOrder, type CreationKind } from '~/shared/whatsapp-creation'
import { listCreationHeaders } from './catalog'
import { reconcileDraftProjectState } from './draft-project-state'
import { hasEditorPermission, REGULAR_USER_AREAS, type AccessArea } from '~/shared/access-control'
import { findOwnedAccountProject, isAccountProjectArtifactKey } from './account-projects'

export function assertCreationAccess(user: AuthenticatedUser, kind: string): void {
  const areas: Record<string, AccessArea> = { encarte: 'encartes', video: 'videos', cartaz: 'cartazes', studio: 'artes' }
  const area = areas[kind]
  if (!area) throw createError({ statusCode: 400, statusMessage: 'Tipo de material inválido.' })
  if (user.role === 'super_admin' || user.role === 'admin') return
  if (user.role === 'user' && REGULAR_USER_AREAS.includes(area)) return
  if (user.role === 'editor' && hasEditorPermission(user.editorPermissions, area, 'create')) return
  throw createError({ statusCode: 403, statusMessage: 'Sua conta não tem acesso à criação deste material.' })
}

export async function ingestCreationEvent(body: unknown) {
  const envelope = authenticateCreationProvider(body)
  if (envelope.EventType === 'messages_update') return receiveCreationReceipt(envelope)
  const message: any = validateProviderEvent(body)
  if (!message || message.ignored) return { ok: true, ignored: true }
  const instance = String(process.env.JOBVAREJO_UAZAPI_INSTANCE_ID || '')
  let account: Awaited<ReturnType<typeof resolveWhatsAppAccount>>
  try { account = await resolveWhatsAppAccount(message.phone) } catch (error: any) {
    if (error.statusCode !== 403) throw error
    account = { ok: false, error: 'unlinked_number' }
  }
  return pgTx(async client => {
    const receipt = await client.query('INSERT INTO public.whatsapp_creation_ingress(instance_id,message_id,sender_phone) VALUES($1,$2,$3) ON CONFLICT(instance_id,message_id) DO NOTHING RETURNING id', [instance, message.messageId, message.phone])
    if (!receipt.rows[0]) return { ok: true, duplicate: true }
    if (!account.ok) {
      await client.query("UPDATE public.whatsapp_creation_ingress SET status='pending',reply_text=$2 WHERE id=$1", [receipt.rows[0].id, 'Para criar na sua conta, vincule e confirme este WhatsApp em Job Varejo: https://jobvarejo.com.br/profile. Depois mande seu pedido novamente.'])
      return { ok: true, unlinked: true }
    }
    const owner = account.user.id
    const conversation = (await client.query(`INSERT INTO public.whatsapp_creation_conversations(owner_id,instance_id,sender_phone) VALUES($1,$2,$3)
      ON CONFLICT(instance_id,sender_phone,owner_id) DO UPDATE SET updated_at=now() RETURNING id,current_order_id`, [owner, instance, account.senderPhone])).rows[0]
    if (!conversation.current_order_id) {
      const orderId = randomUUID()
      await client.query("INSERT INTO public.whatsapp_creation_orders(id,conversation_id,owner_id,kind,state,status) VALUES($1,$2,$3,'encarte',$4::jsonb,'collecting')", [orderId, conversation.id, owner, JSON.stringify(newConversationState())])
      await client.query('UPDATE public.whatsapp_creation_conversations SET current_order_id=$2 WHERE id=$1', [conversation.id, orderId])
    }
    await client.query('INSERT INTO public.whatsapp_creation_events(instance_id,message_id,conversation_id,owner_id,payload) VALUES($1,$2,$3,$4,$5::jsonb) ON CONFLICT(instance_id,message_id) DO NOTHING', [instance, message.messageId, conversation.id, owner, JSON.stringify(message)])
    return { ok: true, queued: true }
  })
}

export async function receiveCreationReceipt(envelope: Record<string, any>) {
  const receipt = envelope.event || {}, ids = receipt.MessageIDs
  const receiptState = String(envelope.state || receipt.Type || '').toLowerCase()
  if (envelope.type !== 'ReadReceipt' || receipt.IsGroup || receipt.IsFromMe !== true || !['delivered', 'read', 'played'].includes(receiptState) || !Array.isArray(ids)) return { ok: true, ignored: true }
  const phone = normalizeBrazilWhatsApp(String(receipt.chatid || receipt.Chat || '').replace(/@s\.whatsapp\.net$/, ''))
  if (!phone) return { ok: true, ignored: true }
  const messageIds = ids.filter((id: unknown) => typeof id === 'string' && id.length <= 200).slice(0, 100)
  return pgTx(async client => {
    for (const id of messageIds) await client.query('INSERT INTO public.whatsapp_creation_receipts(instance_id,sender_phone,message_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [process.env.JOBVAREJO_UAZAPI_INSTANCE_ID, phone, id])
    const changed = await client.query(`UPDATE public.whatsapp_creation_outbox b SET status='delivered',updated_at=now()
      FROM public.whatsapp_creation_conversations c WHERE b.conversation_id=c.id AND b.owner_id=c.owner_id
      AND c.instance_id=$1 AND c.sender_phone=$2 AND b.provider_message_id=ANY($3::text[]) AND b.status IN ('accepted','uncertain') RETURNING b.order_id,b.owner_id`, [process.env.JOBVAREJO_UAZAPI_INSTANCE_ID, phone, messageIds])
    for (const item of changed.rows) {
      if (!item.order_id) continue
      await client.query(`UPDATE public.whatsapp_creation_orders o SET status='delivered',state=jsonb_set(state,'{phase}','"delivered"'::jsonb),updated_at=now()
        WHERE o.id=$1 AND o.owner_id=$2 AND o.status='approved' AND EXISTS(SELECT 1 FROM public.whatsapp_creation_outbox b WHERE b.order_id=o.id AND b.owner_id=o.owner_id AND b.payload->>'purpose'='final')
        AND NOT EXISTS(SELECT 1 FROM public.whatsapp_creation_outbox b WHERE b.order_id=o.id AND b.owner_id=o.owner_id AND b.payload->>'purpose'='final' AND b.status<>'delivered')`, [item.order_id, item.owner_id])
    }
    return { ok: true, receipts: changed.rowCount }
  })
}

export async function claimCreationMessage() {
  return pgTx(async client => {
    const conversation = (await client.query(`SELECT c.* FROM public.whatsapp_creation_conversations c
      WHERE (c.lease_until IS NULL OR c.lease_until<now()) AND EXISTS(SELECT 1 FROM public.whatsapp_creation_events e WHERE e.conversation_id=c.id AND e.attempts<3 AND (e.status='pending' OR e.status='processing' AND e.lease_until<now()))
      ORDER BY c.updated_at FOR UPDATE OF c SKIP LOCKED LIMIT 1`)).rows[0]
    if (!conversation) return { ok: true, claimed: false as const }
    const event = (await client.query(`SELECT * FROM public.whatsapp_creation_events WHERE conversation_id=$1 AND attempts<3 AND (status='pending' OR status='processing' AND lease_until<now()) ORDER BY created_at,id FOR UPDATE SKIP LOCKED LIMIT 1`, [conversation.id])).rows[0]
    if (!event) return { ok: true, claimed: false as const }
    const token = randomUUID()
    await client.query("UPDATE public.whatsapp_creation_conversations SET lease_token=$2,lease_until=now()+interval '5 minutes' WHERE id=$1", [conversation.id, token])
    await client.query("UPDATE public.whatsapp_creation_events SET status='processing',lease_token=$2,lease_until=now()+interval '5 minutes',attempts=attempts+1,updated_at=now() WHERE id=$1", [event.id, token])
    const order = (await client.query('SELECT * FROM public.whatsapp_creation_orders WHERE id=$1 AND owner_id=$2', [conversation.current_order_id, conversation.owner_id])).rows[0]
    return { ok: true, claimed: true as const, eventId: event.id, leaseToken: token, phone: conversation.sender_phone, conversationId: conversation.id, ownerId: conversation.owner_id, orderId: order.id, state: order.state as ConversationState, message: event.payload }
  })
}

export async function loadLeasedMessage(eventId: string, token: string, client?: PoolClient) {
  const query = client ? client.query.bind(client) : pgQuery
  const row: any = (await query(`SELECT e.id event_id,e.payload,e.conversation_id,e.owner_id,c.sender_phone,c.current_order_id,o.state
    FROM public.whatsapp_creation_events e JOIN public.whatsapp_creation_conversations c ON c.id=e.conversation_id AND c.owner_id=e.owner_id
    JOIN public.whatsapp_creation_orders o ON o.id=c.current_order_id AND o.owner_id=c.owner_id
    WHERE e.id=$1 AND e.lease_token=$2 AND c.lease_token=$2 AND e.status='processing' AND e.lease_until>now() AND c.lease_until>now()`, [eventId, token])).rows[0]
  if (!row) throw createError({ statusCode: 409, statusMessage: 'Esta mensagem já foi processada ou precisa ser retomada.' })
  const account = await resolveWhatsAppAccount(row.sender_phone)
  if (!account.ok || account.user.id !== row.owner_id) throw createError({ statusCode: 403, statusMessage: 'O vínculo da conta mudou. Vincule o WhatsApp novamente.' })
  return { ...row, account, state: row.state as ConversationState }
}

/**
 * Entrega de encarte já salvo na conta: só arquivos gerados para o projeto
 * escolhido nesta conversa, dentro da pasta exclusiva do dono.
 */
export function assertAccountProjectSend(state: ConversationState, ownerId: string, item: Pick<ConversationSend, 'type' | 'key' | 'accountProjectId'>): void {
  const projectId = item.accountProjectId
  if (!projectId || state.accountProject?.projectId !== projectId || !['image', 'document'].includes(item.type) ||
    !item.key || !isAccountProjectArtifactKey(item.key, ownerId, projectId) || !/\.png$/.test(item.key) || item.key.includes('..')) {
    throw createError({ statusCode: 409, statusMessage: 'Encarte da conta sem escolha válida.' })
  }
}

export async function queueCreationSend(client: PoolClient, conversationId: string, ownerId: string, orderId: string, state: ConversationState, send: ConversationSend[], correlation: string) {
  for (const [index, item] of send.entries()) {
    if (item.purpose === 'final') {
      if (!state.order || !item.artifactId || !item.formatId) throw createError({ statusCode: 409, statusMessage: 'Arquivo sem aprovação.' })
      assertCanDeliver(state.order, ownerId, item.artifactId, [item.formatId])
    }
    if (item.purpose === 'account_project') assertAccountProjectSend(state, ownerId, item)
    await client.query(`INSERT INTO public.whatsapp_creation_outbox(conversation_id,owner_id,order_id,idempotency_key,type,payload)
      VALUES($1,$2,$3,$4,$5,$6::jsonb) ON CONFLICT(idempotency_key) DO NOTHING`, [conversationId, ownerId, orderId, `${correlation}:${index}`, item.type, JSON.stringify({ ...item, revision: state.order?.revision, sendIndex: index })])
  }
}

/** Preserve completed orders; a new request always gets a new immutable owner/order identity. */
export async function beginCreationOrder(eventId: string, token: string, kind?: ConversationState['draft']['kind'], options: { cancelCurrent?: boolean } = {}) {
  return pgTx(async client => {
    let context = await loadLeasedMessage(eventId, token, client)
    const lock = await client.query('SELECT id FROM public.whatsapp_creation_conversations WHERE id=$1 AND owner_id=$2 FOR UPDATE', [context.conversation_id, context.owner_id])
    if (!lock.rows[0]) throw createError({ statusCode: 409, statusMessage: 'A conversa mudou; tente novamente.' })
    // The lease and current order can change while another worker is finishing
    // remote work. Re-read both only after serializing on the conversation row.
    context = await loadLeasedMessage(eventId, token, client)
    if (context.state.startedByEventId === eventId) return context
    const terminal = ['approved', 'delivered', 'cancelled'].includes(context.state.phase)
    if (!terminal && !options.cancelCurrent) return context
    const id = randomUUID()
    const state = newConversationState()
    state.startedByEventId = eventId
    // O último encarte da conta escolhido continua disponível para os próximos pedidos.
    const remembered = context.state.accountProject
    if (remembered?.projectId) state.accountProject = { projectId: remembered.projectId, ...(remembered.projectName ? { projectName: remembered.projectName } : {}) }
    if (!options.cancelCurrent && kind && context.state.draft.additionalKinds?.includes(kind)) state.draft = { ...structuredClone(context.state.draft), kind, formats: kind === context.state.draft.kind ? [...context.state.draft.formats] : [], script: undefined, additionalKinds: context.state.draft.additionalKinds.filter((value: CreationKind) => value !== kind) }
    if (!terminal && options.cancelCurrent) {
      const cancelled = structuredClone(context.state)
      if (cancelled.order) cancelled.order = updateOrder(cancelled.order, context.owner_id, {})
      cancelled.phase = 'cancelled'; cancelled.runtime = undefined; cancelled.pendingUploaded = undefined; cancelled.pendingCorrectionItemId = undefined
      cancelled.candidates = []; cancelled.artifacts = []; cancelled.reviewPresentedRevision = undefined; cancelled.previewPresentedRevision = undefined
      await client.query(`UPDATE public.whatsapp_creation_orders SET state=$3::jsonb,revision=$4,status='cancelled',updated_at=now()
        WHERE id=$1 AND owner_id=$2 AND status NOT IN ('delivered','cancelled')`, [context.current_order_id, context.owner_id, JSON.stringify(cancelled), Math.max(1, cancelled.order?.revision || 1)])
      await client.query(`UPDATE public.whatsapp_creation_outbox SET status='failed',error='order_cancelled_before_send',updated_at=now()
        WHERE order_id=$1 AND owner_id=$2 AND status='pending'`, [context.current_order_id, context.owner_id])
      await client.query(`UPDATE public.whatsapp_creation_theme_requests SET status='cancelled',updated_at=now()
        WHERE order_id=$1 AND owner_id=$2 AND status IN ('pending','scheduled')`, [context.current_order_id, context.owner_id])
    }
    await client.query("INSERT INTO public.whatsapp_creation_orders(id,conversation_id,owner_id,kind,state) VALUES($1,$2,$3,$4,$5::jsonb)", [id, context.conversation_id, context.owner_id, kind || 'encarte', JSON.stringify(state)])
    const changed = await client.query('UPDATE public.whatsapp_creation_conversations SET current_order_id=$2 WHERE id=$1 AND owner_id=$3 AND current_order_id=$4 RETURNING id', [context.conversation_id, id, context.owner_id, context.current_order_id])
    if (!changed.rows[0]) throw createError({ statusCode: 409, statusMessage: 'O pedido atual mudou; nada foi substituído.' })
    return loadLeasedMessage(eventId, token, client)
  })
}

export async function persistConversationResult(eventId: string, token: string, state: ConversationState, send: ConversationSend[], finish: boolean, missingTheme = false) {
  return pgTx(async client => {
    const context = await loadLeasedMessage(eventId, token, client)
    // Serialize the compare/write after any remote catalogue or storage work.
    await client.query('SELECT id FROM public.whatsapp_creation_conversations WHERE id=$1 FOR UPDATE', [context.conversation_id])
    const current = await loadLeasedMessage(eventId, token, client)
    if (current.current_order_id !== context.current_order_id) throw createError({ statusCode: 409, statusMessage: 'O pedido mudou enquanto a mensagem era processada.' })
    // Mantém o projeto do painel já gravado pelo job e marca se o conteúdo novo precisa ir para lá.
    reconcileDraftProjectState(state, current.state?.draftProject)
    const phase = ({ images: 'awaiting_images', script: 'awaiting_script', preview: 'awaiting_preview', header: 'collecting', theme_pending: 'collecting', data: 'collecting', approved: 'approved' } as Record<string, string>)[state.phase] || state.phase
    await client.query('UPDATE public.whatsapp_creation_orders SET kind=$3,state=$4::jsonb,revision=$5,status=$6,updated_at=now() WHERE id=$1 AND owner_id=$2', [context.current_order_id, context.owner_id, state.draft.kind || 'encarte', JSON.stringify(state), Math.max(1, state.order?.revision || 1), phase])
    if (state.phase === 'cancelled') {
      await client.query(`UPDATE public.whatsapp_creation_outbox SET status='failed',error='order_cancelled_before_send',updated_at=now()
        WHERE order_id=$1 AND owner_id=$2 AND status='pending'`, [context.current_order_id, context.owner_id])
      await client.query(`UPDATE public.whatsapp_creation_theme_requests SET status='cancelled',updated_at=now()
        WHERE order_id=$1 AND owner_id=$2 AND status IN ('pending','scheduled')`, [context.current_order_id, context.owner_id])
    }
    await queueCreationSend(client, context.conversation_id, context.owner_id, context.current_order_id, state, send, `event:${eventId}:${state.turns}`)
    // A different theme/format cannot inherit the previous theme's reminder.
    await client.query(`UPDATE public.whatsapp_creation_theme_requests SET status='cancelled',updated_at=now()
      WHERE order_id=$1 AND owner_id=$2 AND status IN ('pending','scheduled')
      AND ($3::boolean OR theme IS DISTINCT FROM $4::text OR formats IS DISTINCT FROM $5::jsonb)`,
      [context.current_order_id, context.owner_id, state.phase !== 'theme_pending', state.draft.theme || '', JSON.stringify(state.draft.formats)])
    if (missingTheme) {
      await client.query(`INSERT INTO public.whatsapp_creation_theme_requests(conversation_id,owner_id,order_id,theme,formats,status,scheduled_eta)
        SELECT $1,$2,$3,$4,$5::jsonb,'scheduled',now()+interval '4 hours' WHERE NOT EXISTS(SELECT 1 FROM public.whatsapp_creation_theme_requests WHERE order_id=$3 AND status IN ('pending','scheduled'))`, [context.conversation_id, context.owner_id, context.current_order_id, state.draft.theme, JSON.stringify(state.draft.formats)])
    }
    if (finish) {
      await client.query("UPDATE public.whatsapp_creation_events SET status='done',lease_token=NULL,lease_until=NULL,updated_at=now() WHERE id=$1 AND lease_token=$2", [eventId, token])
      await client.query('UPDATE public.whatsapp_creation_conversations SET lease_token=NULL,lease_until=NULL,revision=revision+1,updated_at=now() WHERE id=$1 AND lease_token=$2', [context.conversation_id, token])
    }
    return { orderId: context.current_order_id }
  })
}

export async function claimCreationOutbound() {
  const claim = await pgTx(async client => {
    // A timed-out send is uncertain. Never automatically repeat a possible paid/provider send.
    await client.query("UPDATE public.whatsapp_creation_outbox SET status='uncertain',error='provider_ack_unknown' WHERE status='sending' AND lease_until<now()")
    await client.query("UPDATE public.whatsapp_creation_ingress SET status='uncertain' WHERE status='sending' AND lease_until<now()")
    const guidance = (await client.query("SELECT * FROM public.whatsapp_creation_ingress WHERE status='pending' ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1")).rows[0]
    if (guidance) {
      const token = randomUUID(); await client.query("UPDATE public.whatsapp_creation_ingress SET status='sending',lease_token=$2,lease_until=now()+interval '2 minutes' WHERE id=$1", [guidance.id, token])
      return { claimed: true, ingress: true, id: guidance.id, token, send: { endpoint: '/send/text', body: { number: guidance.sender_phone.replace(/^\+/, ''), text: guidance.reply_text, track_source: 'jobvarejo', track_id: guidance.id } } }
    }
    const row = (await client.query(`SELECT b.*,c.sender_phone,o.state FROM public.whatsapp_creation_outbox b
      JOIN public.whatsapp_creation_conversations c ON c.id=b.conversation_id AND c.owner_id=b.owner_id
      LEFT JOIN public.whatsapp_creation_orders o ON o.id=b.order_id AND o.owner_id=b.owner_id
      WHERE b.status='pending' AND b.next_attempt_at<=now() AND NOT EXISTS(SELECT 1 FROM public.whatsapp_creation_outbox earlier WHERE earlier.conversation_id=b.conversation_id AND earlier.status IN ('pending','sending') AND (earlier.created_at,COALESCE((earlier.payload->>'sendIndex')::integer,0),earlier.id)<(b.created_at,COALESCE((b.payload->>'sendIndex')::integer,0),b.id))
      ORDER BY b.created_at,COALESCE((b.payload->>'sendIndex')::integer,0),b.id FOR UPDATE OF b SKIP LOCKED LIMIT 1`)).rows[0]
    if (!row) return { claimed: false }
    const account = await resolveWhatsAppAccount(row.sender_phone)
    if (!account.ok || account.user.id !== row.owner_id) {
      await client.query("UPDATE public.whatsapp_creation_outbox SET status='failed',error='account_link_changed' WHERE id=$1", [row.id]); return { claimed: false }
    }
    const payload = row.payload as ConversationSend
    const sendKind = payload?.scope === 'account_project' || payload?.purpose === 'account_project' ? 'encarte' : (row.state as ConversationState).draft.kind || ''
    try { if (row.order_id) assertCreationAccess(account.user, sendKind) } catch {
      await client.query("UPDATE public.whatsapp_creation_outbox SET status='failed',error='account_permission_changed' WHERE id=$1", [row.id]); return { claimed: false }
    }
    const item = row.payload as ConversationSend & { revision?: number }, state = row.state as ConversationState
    if (item.purpose === 'final') {
      if (!state.order || state.order.revision !== item.revision || !item.artifactId || !item.formatId) {
        await client.query("UPDATE public.whatsapp_creation_outbox SET status='failed',error='stale_approval' WHERE id=$1", [row.id]); return { claimed: false }
      }
      assertCanDeliver(state.order, row.owner_id, item.artifactId, [item.formatId])
    }
    if (item.purpose === 'account_project') {
      // Revalida a escolha e o dono do projeto no momento do envio.
      let valid = false
      try { assertAccountProjectSend(state, row.owner_id, item); valid = Boolean(await findOwnedAccountProject(row.owner_id, item.accountProjectId!)) } catch { valid = false }
      if (!valid) { await client.query("UPDATE public.whatsapp_creation_outbox SET status='failed',error='account_project_unavailable' WHERE id=$1", [row.id]); return { claimed: false } }
    }
    const token = randomUUID(); await client.query("UPDATE public.whatsapp_creation_outbox SET status='sending',lease_token=$2,lease_until=now()+interval '2 minutes',attempts=attempts+1,updated_at=now() WHERE id=$1", [row.id, token])
    return { claimed: true, ingress: false, id: row.id, token, row, item }
  })
  if (!claim.claimed || claim.ingress) return { ok: true, ...claim }
  const { row, item } = claim
  if (!row || !item) return { ok: true, claimed: false }
  const state = row.state as ConversationState
  let file: string | undefined
  if (item.key) {
    let authorized: ReadonlySet<string> | undefined
    if (item.purpose === 'review' && state.draft.kind && state.draft.theme) {
      // Only authorize the exact asset belonging to a template offered in this conversation:
      // o arquivo do cabeçalho ou a miniatura salva do próprio modelo, pelo tema dito ou pelo tema do catálogo.
      const selected = [...state.choices, ...(state.header ? [state.header] : [])].find(h => h.headerKey === item.key)
      if (selected) {
        for (const theme of [...new Set([state.draft.theme, state.draft.catalogTheme].filter((value): value is string => Boolean(value)))]) {
          const current = await listCreationHeaders(row.owner_id, state.draft.kind, theme, state.draft.formats, 0, undefined, 500)
          if (current.headers.some(h => h.id === selected.id && h.revision === selected.revision && (h.headerKey === item.key || h.listPreviewKey === item.key))) {
            authorized = new Set([item.key]); break
          }
        }
      }
    }
    file = await signOwnedArtifact(item.key, row.owner_id, authorized)
  }
  else if (item.url) {
    // Catalogue URLs must stay on the application; no caller-selected external URLs.
    const url = new URL(item.url, 'https://jobvarejo.com.br')
    if (url.origin !== 'https://jobvarejo.com.br') throw createError({ statusCode: 403, statusMessage: 'Prévia fora do catálogo.' })
    file = url.toString()
  }
  return { ok: true, claimed: true, id: claim.id, token: claim.token, ingress: false,
    send: { endpoint: item.type === 'text' ? '/send/text' : '/send/media', body: {
      number: row.sender_phone.replace(/^\+/, ''), text: item.text, ...(item.type !== 'text' ? { type: item.type, file, docName: item.type === 'document' ? `${item.purpose === 'account_project' ? 'encarte' : state.draft.kind || 'JobVarejo'}-${item.formatId || 'arquivo'}.${String(item.key).endsWith('.pdf') ? 'pdf' : 'png'}` : undefined } : {}), track_source: 'jobvarejo', track_id: row.id
    } }
  }
}

export async function acknowledgeCreationOutbound(id: string, token: string, ingress: boolean, provider: any, uncertain = false) {
  const messageId = String(provider?.messageid || provider?.id || provider?.message?.id || provider?.key?.id || '')
  const table = ingress ? 'whatsapp_creation_ingress' : 'whatsapp_creation_outbox'
  return pgTx(async client => {
    const row = (await client.query(ingress ? 'SELECT * FROM public.whatsapp_creation_ingress WHERE id=$1 AND lease_token=$2 FOR UPDATE' : 'SELECT b.*,c.instance_id,c.sender_phone FROM public.whatsapp_creation_outbox b JOIN public.whatsapp_creation_conversations c ON c.id=b.conversation_id AND c.owner_id=b.owner_id WHERE b.id=$1 AND b.lease_token=$2 FOR UPDATE OF b', [id, token])).rows[0]
    if (!row || row.status !== 'sending') throw createError({ statusCode: 409, statusMessage: 'Envio já registrado ou precisa ser reconciliado.' })
    const receipt = messageId && (await client.query('SELECT message_id FROM public.whatsapp_creation_receipts WHERE instance_id=$1 AND sender_phone=$2 AND message_id=$3', [row.instance_id, row.sender_phone, messageId])).rows[0]
    const status = receipt ? 'delivered' : uncertain || !messageId ? 'uncertain' : 'accepted'
    await client.query(`UPDATE public.${table} SET status=$3,provider_message_id=$4,lease_token=NULL,lease_until=NULL WHERE id=$1 AND lease_token=$2`, [id, token, status, messageId || null])
    if (status === 'delivered' && !ingress && row.order_id) await client.query(`UPDATE public.whatsapp_creation_orders o SET status='delivered',state=jsonb_set(state,'{phase}','"delivered"'::jsonb),updated_at=now()
      WHERE o.id=$1 AND o.owner_id=$2 AND o.status='approved' AND NOT EXISTS(SELECT 1 FROM public.whatsapp_creation_outbox b WHERE b.order_id=o.id AND b.owner_id=o.owner_id AND b.payload->>'purpose'='final' AND b.status<>'delivered')`, [row.order_id, row.owner_id])
    return { ok: true, status, providerMessageId: messageId || null }
  })
}
