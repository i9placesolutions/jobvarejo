import { createHash } from 'node:crypto'
import { createError, type H3Event } from 'h3'
import { pgQuery, pgTx } from '../postgres'
import { resolveWhatsAppAccount } from './access'
import { assertCreationAccess, queueCreationSend } from './repository'
import { generateCreationArtifact } from './render'
import { ownedStorageBytes } from './media'
import { listCreationHeaders } from './catalog'
import { prepareCreationHeader } from './header-preview'
import { advanceConversation, type ConversationArtifact, type ConversationState, type ConversationSend } from './conversation'
import { assertCanRender, registerPreview, updateOrder } from '~/shared/whatsapp-creation'

const failure = (code: number, text: string): never => { throw createError({ statusCode: code, statusMessage: text }) }
const loadOrder = async (id: string): Promise<any> => {
  const row = (await pgQuery(`SELECT o.*,c.sender_phone,c.current_order_id FROM public.whatsapp_creation_orders o
    JOIN public.whatsapp_creation_conversations c ON c.id=o.conversation_id AND c.owner_id=o.owner_id WHERE o.id=$1`, [id])).rows[0]
  if (!row) return failure(404, 'Pedido não encontrado.')
  return row
}

async function accountFor(row: any) {
  if (!row) return failure(404, 'Pedido não encontrado.')
  const account = await resolveWhatsAppAccount(row.sender_phone)
  if (!account.ok || account.user.id !== row.owner_id) return failure(403, 'O vínculo da conta mudou.')
  assertCreationAccess(account.user, row.kind)
  const state = row.state as ConversationState
  if (!state.order || state.order.accountId !== row.owner_id || state.order.id !== row.id) return failure(409, 'Identidade do pedido inconsistente.')
  assertCanRender(state.order, row.owner_id)
  return { account, state }
}

async function nativeJob(event: H3Event, row: any, projectId: string, revision: number, kind: 'render') {
  const { account } = await accountFor(row)
  const project = (await pgQuery('SELECT id,revision FROM public.video_studio_projects WHERE id=$1 AND user_id=$2', [projectId, row.owner_id])).rows[0]
  if (!project || Number(project.revision) !== revision) return failure(409, 'O vídeo foi alterado. Revise esta versão antes de gerar.')
  const previous = event.context.authenticatedUser
  if (previous && previous.id !== row.owner_id) return failure(403, 'Conta interna inválida.')
  try {
    event.context.authenticatedUser = account.user
    return await event.$fetch('/api/videos/jobs', { method: 'POST', body: { projectId, revision, kind } }) as any
  } finally {
    if (previous) event.context.authenticatedUser = previous
    else delete event.context.authenticatedUser
  }
}

/** Commit only artifacts of the locked order/revision; late jobs cannot overwrite an edited draft. */
async function saveGeneration(row: any, state: ConversationState, artifacts: ConversationArtifact[], native?: ConversationState['runtime']) {
  return pgTx(async client => {
    const current = (await client.query('SELECT state FROM public.whatsapp_creation_orders WHERE id=$1 AND owner_id=$2 FOR UPDATE', [row.id, row.owner_id])).rows[0]?.state as ConversationState | undefined
    if (!current || current.phase !== 'rendering' || current.runtime?.token !== state.runtime?.token || current.order?.revision !== state.order?.revision) return { ok: true, stale: true }
    const send: ConversationSend[] = []
    if (native) current.runtime = native
    if (artifacts.length) {
      current.artifacts = artifacts.map(artifact => ({ ...artifact, editUrl: new URL(artifact.editUrl, 'https://jobvarejo.com.br').toString() }))
      for (const artifact of artifacts) current.order = registerPreview(current.order!, row.owner_id, { artifactId: artifact.artifactId, revision: current.order!.revision, formatIds: [artifact.formatId] })
      current.phase = 'preview'; current.runtime = undefined
      for (const [index, artifact] of artifacts.entries()) send.push({ type: artifact.mimeType === 'video/mp4' ? 'video' : 'image', key: artifact.previewKey || artifact.key, text: `Prévia ${index + 1} — ${artifact.formatId}, revisão ${current.order!.revision}. Confira todos os textos, preços e fotos.`, purpose: 'preview' })
      send.push({ type: 'text', text: `Para liberar os arquivos finais, responda APROVAR ${current.order!.revision}. Pode informar os números das prévias para aprovar só algumas. Correções geram uma nova revisão.` })
    }
    await client.query('UPDATE public.whatsapp_creation_orders SET state=$3::jsonb,status=$4,updated_at=now() WHERE id=$1 AND owner_id=$2', [row.id, row.owner_id, JSON.stringify(current), current.phase === 'preview' ? 'awaiting_preview' : 'rendering'])
    await queueCreationSend(client, row.conversation_id, row.owner_id, row.id, current, send, `preview:${row.id}:${current.order!.revision}`)
    return { ok: true, pending: !artifacts.length, count: artifacts.length }
  })
}

async function failGeneration(row: any, state: ConversationState) {
  await pgTx(async client => {
    const current = (await client.query('SELECT state FROM public.whatsapp_creation_orders WHERE id=$1 AND owner_id=$2 FOR UPDATE', [row.id, row.owner_id])).rows[0]?.state as ConversationState | undefined
    if (!current || current.runtime?.token !== state.runtime?.token || current.phase !== 'rendering') return
    current.phase = 'collecting'; current.runtime = undefined; current.artifacts = []
    if (current.order) current.order = updateOrder(current.order, row.owner_id, {})
    await client.query("UPDATE public.whatsapp_creation_orders SET state=$3::jsonb,status='failed',revision=$4,updated_at=now() WHERE id=$1 AND owner_id=$2", [row.id, row.owner_id, JSON.stringify(current), current.order!.revision])
    const message = state.draft.kind === 'video'
      ? 'Não consegui montar o vídeo. Seu pedido está salvo e a locução paga não será repetida automaticamente. Revise o pedido ou peça atendimento.'
      : 'Não consegui montar a prévia. Seu pedido e as fotos estão salvos. Responda “tentar novamente” para receber uma nova conferência.'
    await queueCreationSend(client, row.conversation_id, row.owner_id, row.id, current, [{ type: 'text', text: message }], `generation-error:${row.id}:${state.order!.revision}`)
  })
}

export async function generateWhatsAppOrder(id: string, token: string, kind: string, event: H3Event) {
  const row = await loadOrder(id), { account, state } = await accountFor(row)
  if (row.kind !== kind || state.phase !== 'rendering' || state.runtime?.token !== token) return failure(409, 'Solicitação de geração inválida ou já concluída.')
  if (state.runtime.native) return { ok: true, pending: true }
  if (state.runtime.started) return { ok: true, pending: true }
  if (Date.parse(state.runtime.until) < Date.now()) return failure(409, 'A geração precisa ser retomada pelo atendimento.')
  const start = new Date().toISOString()
  const claimed = await pgQuery(`UPDATE public.whatsapp_creation_orders SET state=jsonb_set(state,'{runtime,started}',to_jsonb($3::text)),updated_at=now()
    WHERE id=$1 AND owner_id=$2 AND state->'runtime'->>'token'=$4 AND state->'runtime'->>'started' IS NULL RETURNING id`, [id, row.owner_id, start, token])
  if (!claimed.rows[0]) return { ok: true, pending: true }
  state.runtime.started = start
  try {
    const output = await generateCreationArtifact(state.order!, account.user, account.businessProfile, event)
    return saveGeneration(row, state, output.artifacts, output.video ? { ...state.runtime, native: output.video } : undefined)
  } catch (error: any) {
    console.error('[whatsapp-creation:generation-failed]', JSON.stringify({ kind, statusCode: Number(error?.statusCode || 500), reason: String(error?.statusMessage || error?.name || 'unknown').slice(0, 200) }))
    await failGeneration(row, state)
    throw error
  }
}

/** Poll bounded work; the n8n execution never waits for a person or a long render. */
export async function pollWhatsAppJobs(event: H3Event) {
  const rows = (await pgQuery(`SELECT id FROM public.whatsapp_creation_orders WHERE status='rendering' AND
    (state->'runtime'->'native' IS NOT NULL OR updated_at<now()-interval '5 minutes') ORDER BY updated_at LIMIT 3`)).rows
  let completed = 0
  for (const candidate of rows) {
    const row = await loadOrder(candidate.id), state = row.state as ConversationState, native = state.runtime?.native
    if (!native) {
      // Includes a process that stopped before calling generate, or during its
      // claim. Reopen for a new explicit approval, never retry paid voice blindly.
      await failGeneration(row, state)
      continue
    }
    try {
      await accountFor(row)
      const job = (await pgQuery('SELECT * FROM public.video_studio_jobs WHERE id=$1 AND user_id=$2 AND project_id=$3 AND revision=$4', [native.jobId, row.owner_id, native.projectId, native.revision])).rows[0]
      if (!job) return failure(409, 'A geração nativa não pertence ao pedido.')
      if (job.status === 'failed') { await failGeneration(row, state); continue }
      if (job.status !== 'ready') continue
      if (native.phase === 'voice') {
        const render = await nativeJob(event, row, native.projectId, native.revision, 'render')
        await saveGeneration(row, state, [], { ...state.runtime!, native: { ...native, phase: 'render', jobId: render.id } })
        continue
      }
      const project = (await pgQuery('SELECT revision FROM public.video_studio_projects WHERE id=$1 AND user_id=$2', [native.projectId, row.owner_id])).rows[0]
      if (!project || Number(project.revision) !== native.revision) return failure(409, 'O projeto foi alterado após a aprovação.')
      const artifacts: ConversationArtifact[] = []
      for (const format of state.order!.formats) {
        const orientation = format.id === 'stories' ? 'vertical' : 'horizontal'
        const output = job.result?.outputs?.find((item: any) => item.format === orientation)
        if (!output?.assetId) return failure(422, 'O render não contém todos os formatos solicitados.')
        const asset = (await pgQuery("SELECT * FROM public.video_studio_assets WHERE id=$1 AND user_id=$2 AND kind='video'", [output.assetId, row.owner_id])).rows[0]
        if (!asset?.storage_key?.startsWith(`video-studio/${row.owner_id}/assets/`)) return failure(403, 'Arquivo de outra conta.')
        const bytes = await ownedStorageBytes(asset.storage_key, row.owner_id)
        artifacts.push({ artifactId: asset.id, formatId: format.id, key: asset.storage_key, hash: createHash('sha256').update(bytes).digest('hex'), mimeType: 'video/mp4', projectId: native.projectId, editUrl: `https://jobvarejo.com.br/videos?project=${native.projectId}` })
      }
      await saveGeneration(row, state, artifacts); completed++
    } catch { await failGeneration(row, state) }
  }
  return { ok: true, checked: rows.length, completed }
}

export async function followUpWhatsAppThemes() {
  // Lock only the local transaction. No promise that an unavailable theme has already been created.
  return pgTx(async client => {
    const ticket = (await client.query(`SELECT t.*,o.state,c.sender_phone,c.current_order_id FROM public.whatsapp_creation_theme_requests t
      JOIN public.whatsapp_creation_orders o ON o.id=t.order_id AND o.owner_id=t.owner_id
      JOIN public.whatsapp_creation_conversations c ON c.id=t.conversation_id AND c.owner_id=t.owner_id
      WHERE t.status='scheduled' AND t.scheduled_eta<=now() AND (c.lease_until IS NULL OR c.lease_until<now()) ORDER BY t.scheduled_eta FOR UPDATE OF t,c,o SKIP LOCKED LIMIT 1`)).rows[0]
    if (!ticket) return { ok: true, checked: 0 }
    const account = await resolveWhatsAppAccount(ticket.sender_phone), state = ticket.state as ConversationState
    if (!account.ok || account.user.id !== ticket.owner_id || ticket.current_order_id !== ticket.order_id || state.phase !== 'theme_pending') {
      await client.query("UPDATE public.whatsapp_creation_theme_requests SET status='cancelled',updated_at=now() WHERE id=$1", [ticket.id]); return { ok: true, checked: 1 }
    }
    const catalog = await listCreationHeaders(ticket.owner_id, state.draft.kind!, ticket.theme, state.draft.formats, 0)
    if (!catalog.headers.length) {
      await queueCreationSend(client, ticket.conversation_id, ticket.owner_id, ticket.order_id, state, [{ type: 'text', text: `${account.user.user_metadata.name || 'Cliente'}, o cabeçalho do tema ${ticket.theme} ainda precisa ser preparado. Podemos seguir com outro tema disponível; a sua solicitação continua registrada.` }], `theme:${ticket.id}:unavailable`)
      await client.query("UPDATE public.whatsapp_creation_theme_requests SET status='pending',updated_at=now() WHERE id=$1", [ticket.id])
    } else {
      const next = await advanceConversation({ state, proposal: { action: 'update' }, text: '', accountId: ticket.owner_id, sender: ticket.sender_phone, orderId: ticket.order_id, name: account.user.user_metadata.name || 'Cliente',
        prepareHeader: (header, kind) => prepareCreationHeader(header, kind, account) })
      await client.query('UPDATE public.whatsapp_creation_orders SET state=$3::jsonb,updated_at=now() WHERE id=$1 AND owner_id=$2', [ticket.order_id, ticket.owner_id, JSON.stringify(next.state)])
      await queueCreationSend(client, ticket.conversation_id, ticket.owner_id, ticket.order_id, next.state, next.send, `theme:${ticket.id}:available`)
      await client.query("UPDATE public.whatsapp_creation_theme_requests SET status='ready',updated_at=now() WHERE id=$1", [ticket.id])
    }
    return { ok: true, checked: 1 }
  })
}
