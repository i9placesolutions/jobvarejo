import { randomUUID } from 'node:crypto'
import { createError, defineEventHandler, getRouterParam, readBody, setHeader } from 'h3'
import { z } from 'zod'
import { authenticateWhatsAppService } from '~/server/utils/whatsapp-creation/access'
import { ingestCreationEvent, claimCreationMessage, loadLeasedMessage, persistConversationResult,
  claimCreationOutbound, acknowledgeCreationOutbound, assertCreationAccess, beginCreationOrder } from '~/server/utils/whatsapp-creation/repository'
import { interpretationRequest, transcriptionRequest, advanceConversation, normalizeConversationIntent, rememberConversationTurns, parseProposal, extractModelJson, effectiveMessageText } from '~/server/utils/whatsapp-creation/conversation'
import { pollWhatsAppJobs, followUpWhatsAppThemes } from '~/server/utils/whatsapp-creation/jobs'
import { listCreationThemeNames } from '~/server/utils/whatsapp-creation/catalog'
import { downloadProviderMedia } from '~/server/utils/whatsapp-creation/media'
import { pgQuery } from '~/server/utils/postgres'
import { cachedCreationHeader, croppedCreationHeaderThumbnail, prepareCreationHeader } from '~/server/utils/whatsapp-creation/header-preview'
import { hasBriefFields, shouldConsultJev, suggestJevRoute } from '~/server/utils/whatsapp-creation/jev'
import { ensureProcessedWhatsAppPhoto, isRawWhatsAppPhoto } from '~/server/utils/whatsapp-creation/product-photo'
import { buildLabelOptions } from '~/server/utils/whatsapp-creation/label-options'
import { updateBusinessContact } from '~/server/utils/whatsapp-creation/business-profile-update'
import { flyerProjectEditedInPanel } from '~/server/utils/whatsapp-creation/render'

// Temas do catálogo para a IA mapear a fala do cliente; se a consulta falhar, segue sem a lista.
const catalogThemesFor = (accountId: string) => listCreationThemeNames(accountId).catch(() => [] as string[])
const leaseSchema = z.object({ eventId: z.string().uuid(), leaseToken: z.string().uuid() })
// Guarda a causa real da falha no evento (sem dados pessoais); o n8n chama `fail` em seguida.
async function applyWithDiagnostics<T>(body: unknown, run: () => Promise<T>): Promise<T> {
  try { return await run() } catch (error: any) {
    const issues = Array.isArray(error?.issues) ? error.issues.slice(0, 4).map((issue: any) => `${(issue.path || []).join('.')}: ${issue.message}`).join(' | ') : ''
    const reason = `${error?.statusCode || error?.name || 'erro'}: ${issues || error?.statusMessage || error?.message || ''}`.replace(/\d{8,}/g, '<num>').slice(0, 300)
    console.error('[whatsapp-creation:apply]', reason)
    const lease = leaseSchema.safeParse(body)
    // Falha ao registrar não pode esconder o erro original.
    if (lease.success) try { await pgQuery('UPDATE public.whatsapp_creation_events SET last_error=$3 WHERE id=$1 AND lease_token=$2', [lease.data.eventId, lease.data.leaseToken, `apply ${reason}`]) } catch { /* segue com o erro original */ }
    throw error
  }
}
export default defineEventHandler(async event => {
  authenticateWhatsAppService(event)
  setHeader(event, 'Cache-Control', 'private, no-store')
  const operation = getRouterParam(event, 'operation')
  const body = await readBody(event)
  if (operation === 'ingest') return ingestCreationEvent(body?.event)
  if (operation === 'claim') {
    const claim = await claimCreationMessage()
    if (!claim.claimed) return claim
    try {
      const context = await loadLeasedMessage(claim.eventId!, claim.leaseToken!)
      let content: unknown
      if (context.payload.type === 'image' || context.payload.type === 'audio') {
        const media = await downloadProviderMedia(context.payload.messageId, context.owner_id)
        content = media.content
        await pgQuery("UPDATE public.whatsapp_creation_events SET payload=jsonb_set(payload,'{uploaded}',$3::jsonb) WHERE id=$1 AND lease_token=$2 AND status='processing'", [claim.eventId, claim.leaseToken, JSON.stringify({ key: media.key, hash: media.hash })])
      }
      return { ok: true, claimed: true, eventId: claim.eventId, leaseToken: claim.leaseToken, isAudio: context.payload.type === 'audio',
        request: context.payload.type === 'audio' ? transcriptionRequest(content) : interpretationRequest(context.state, effectiveMessageText(context.state, context.payload.text || ''), context.account.user.user_metadata.name || context.account.businessProfile.companyName || 'cliente', content, await catalogThemesFor(context.owner_id)) }
    } catch (error) {
      await pgQuery("UPDATE public.whatsapp_creation_events SET status='failed',last_error='prepare_failed',lease_until=NULL WHERE id=$1 AND lease_token=$2", [claim.eventId, claim.leaseToken])
      await pgQuery('UPDATE public.whatsapp_creation_conversations SET lease_token=NULL,lease_until=NULL WHERE lease_token=$1', [claim.leaseToken])
      throw error
    }
  }
  if (operation === 'interpret-audio') {
    const { eventId, leaseToken } = leaseSchema.parse(body), context = await loadLeasedMessage(eventId, leaseToken)
    if (context.payload.type !== 'audio') throw createError({ statusCode: 409, statusMessage: 'Esta mensagem não é um áudio.' })
    let value: any
    try { value = JSON.parse(body.result?.choices?.[0]?.message?.content || '') } catch { throw createError({ statusCode: 422, statusMessage: 'Não consegui transcrever o áudio.' }) }
    const { transcript } = z.object({ transcript: z.string().min(1).max(12000) }).strict().parse(value)
    const usage = body.result?.usage || {}
    const transcriptionUsage = { promptTokens: Math.max(0, Number(usage.prompt_tokens || 0)), completionTokens: Math.max(0, Number(usage.completion_tokens || 0)), cost: Math.max(0, Number(usage.cost || 0)) }
    await pgQuery("UPDATE public.whatsapp_creation_events SET payload=jsonb_set(jsonb_set(payload,'{transcript}',to_jsonb($3::text)),'{transcriptionUsage}',$4::jsonb) WHERE id=$1 AND lease_token=$2 AND status='processing'", [eventId, leaseToken, transcript, JSON.stringify(transcriptionUsage)])
    return { request: interpretationRequest(context.state, effectiveMessageText(context.state, transcript), context.account.user.user_metadata.name || 'Cliente', undefined, await catalogThemesFor(context.owner_id)) }
  }
  if (operation === 'apply') return applyWithDiagnostics(body, async () => {
    const { eventId, leaseToken } = leaseSchema.parse(body)
    let context = await loadLeasedMessage(eventId, leaseToken)
    const phaseBefore = context.state.phase
    const response = body.result
    const choice = response?.choices?.[0]
    if (!choice?.message?.content) throw createError({ statusCode: 422, statusMessage: 'A mensagem precisa ser dividida ou interpretada novamente.' })
    // Resposta cortada pelo limite ainda vale se trouxer um objeto JSON completo no começo.
    const proposed = extractModelJson(choice.message.content)
    if (!proposed || typeof proposed !== 'object') throw createError({ statusCode: 422, statusMessage: choice.finish_reason === 'length' ? 'A mensagem precisa ser dividida ou interpretada novamente.' : 'Interpretação incompleta. Nenhuma criação foi autorizada.' })
    const proposal = parseProposal(proposed)
    const modelAction = proposal.action
    let routeAction: string | null = null
    const messageText = effectiveMessageText(context.state, context.payload.type === 'audio' ? context.payload.transcript || '' : context.payload.text || '')
    if (proposal.action === 'status' && hasBriefFields(proposal) &&
      !/\b(?:status|andamento|como (?:est[aá]|t[aá]) (?:o |meu )?pedido)\b/i.test(messageText)) proposal.action = 'update'
    const route = shouldConsultJev(proposal, messageText)
      ? await suggestJevRoute({ text: messageText, phase: context.state.phase, kind: context.state.draft.kind }) : null
    if (route) {
      const nextAction = route.action
      routeAction = nextAction
      if (proposal.action !== 'cancel_and_start_new') {
        const explicitCancel = /\b(?:cancela|cancele|cancelar|desistir|desisto)\b/i.test(messageText)
        const explicitNewOrder = /\b(?:novo pedido|novo encarte|novo v[ií]deo|novo cartaz|nova arte|outro pedido|come[cç]ar (?:de novo|outro)|fazer outro|criar outro)\b/i.test(messageText)
        const safeRoute = proposal.confirmationIntent !== 'reject' && proposal.confirmationIntent !== 'unclear' && (nextAction !== 'cancel' && nextAction !== 'new_order' && nextAction !== 'cancel_and_start_new' ||
          nextAction === 'cancel' && (proposal.action === 'cancel' || explicitCancel) ||
          nextAction === 'new_order' && (proposal.action === 'new_order' || explicitNewOrder || context.state.pendingOrderChoice && /\b(?:outro|outra|novo|nova)\b/i.test(messageText)) ||
          nextAction === 'cancel_and_start_new' && explicitCancel && explicitNewOrder)
        if (safeRoute) proposal.action = nextAction
        if (nextAction === 'choose_header' && !proposal.choice && context.state.phase === 'header') {
          const number = messageText.trim().match(/^(?:(?:op[çc][ãa]o|n[úu]mero)\s*)?(\d{1,2})\s*\.?$/i)
          if (number) proposal.choice = Number(number[1])
        }
      }
    }
    Object.assign(proposal, normalizeConversationIntent(proposal, messageText, context.state))
    if (proposal.action === 'cancel_and_start_new') {
      const requestedKind = proposal.kind || context.state.draft.kind
      if (requestedKind) assertCreationAccess(context.account.user, requestedKind)
      context = await beginCreationOrder(eventId, leaseToken, requestedKind, { cancelCurrent: true })
      proposal.action = 'update'
      if (requestedKind) proposal.kind = requestedKind
    }
    if (proposal.action === 'new_order' && context.state.startedByEventId === eventId) {
      proposal.action = 'update'
    } else if (proposal.action === 'new_order' && ['approved', 'delivered', 'cancelled'].includes(context.state.phase)) {
      if (proposal.kind) assertCreationAccess(context.account.user, proposal.kind)
      context = await beginCreationOrder(eventId, leaseToken, proposal.kind)
      proposal.action = 'update'
    }
    if (context.payload.type === 'image' && ['data', 'images'].includes(context.state.phase)) proposal.products = undefined
    const kind = proposal.kind || context.state.draft.kind
    if (kind) assertCreationAccess(context.account.user, kind)
    // Encartes salvos na conta exigem a mesma permissão de encartes do painel.
    if (proposal.action === 'account_project' || context.state.accountProject?.awaitingChoice) assertCreationAccess(context.account.user, 'encarte')
    const result = await advanceConversation({ state: context.state, proposal, text: messageText, accountId: context.owner_id,
      sender: context.sender_phone, orderId: context.current_order_id, name: context.account.user.user_metadata.name || context.account.businessProfile.companyName || 'cliente', uploaded: context.payload.uploaded,
      prepareHeader: (header, selectedKind) => prepareCreationHeader(header, selectedKind, context.account),
      cachedHeader: header => cachedCreationHeader(header, context.account),
      headerThumbnail: header => croppedCreationHeaderThumbnail(header, context.account),
      // Ajustes do encarte pedidos na conversa (etiquetas, contato do cadastro, edição do painel).
      labelOptions: labels => buildLabelOptions(labels),
      businessProfile: { whatsapp: context.account.businessProfile.whatsapp || context.account.businessProfile.phone, address: context.account.businessProfile.address, instagram: context.account.businessProfile.instagram },
      saveBusinessProfile: patch => updateBusinessContact(context.owner_id, patch),
      flyerProjectEdited: flyer => flyerProjectEditedInPanel(flyer, context.owner_id) })
    // Mensagem de texto/áudio nunca fica sem resposta (ex.: “sim” solto depois do encarte entregue).
    if (context.payload.type !== 'image' && !result.send.length && !result.generate && !result.accountProjectJob) {
      result.send.push({ type: 'text', text: 'Não entendi bem o que você quer agora. Pode me explicar com mais detalhes? Se for um ajuste no encarte, diga o que mudar (ex.: “troque o WhatsApp para …”).' })
    }
    result.state.retryMessage = undefined
    const usage = response.usage || {}, prior = result.state.usage, audio = context.payload.transcriptionUsage
    result.state.usage = { promptTokens: Number(prior?.promptTokens || 0) + Number(audio?.promptTokens || 0) + Math.max(0, Number(usage.prompt_tokens || 0)), completionTokens: Number(prior?.completionTokens || 0) + Number(audio?.completionTokens || 0) + Math.max(0, Number(usage.completion_tokens || 0)), cost: Number(prior?.cost || 0) + Number(audio?.cost || 0) + Math.max(0, Number(usage.cost || 0)) }
    rememberConversationTurns(result.state, [
      { role: 'user', text: messageText },
      ...result.send.filter(item => item.type === 'text').map(item => ({ role: 'assistant' as const, text: item.text }))
    ])
    let generation: { orderId: string; token: string; kind: string } | undefined
    if (result.generate) {
      const token = randomUUID()
      result.state.runtime = { token, until: new Date(Date.now() + 15 * 60_000).toISOString() }
      generation = { orderId: context.current_order_id, token, kind: result.state.draft.kind! }
    } else if (result.accountProjectJob) {
      // As páginas são geradas fora do apply (generate/encarte), que confere o dono de novo.
      generation = { orderId: context.current_order_id, token: result.accountProjectJob.token, kind: 'encarte' }
    }
    await persistConversationResult(eventId, leaseToken, result.state, result.send, true, result.missingTheme)
    // Adianta a remoção de fundo das fotos enviadas; a geração reaproveita o arquivo já salvo.
    for (const candidate of result.state.candidates) {
      const product = result.state.order?.products.find(item => item.id === candidate.itemId)
      if (product && isRawWhatsAppPhoto(candidate.key)) {
        void ensureProcessedWhatsAppPhoto({ userId: context.owner_id, product, rawKey: candidate.key, rawHash: candidate.hash.toLowerCase() })
          .catch(error => console.warn('[whatsapp-creation:photo] pré-processamento falhou', String(error?.message || error).slice(0, 200)))
      }
    }
    console.info('whatsapp_creation_decision', {
      eventId,
      orderId: context.current_order_id,
      modelAction,
      routeAction,
      action: proposal.action,
      phaseBefore,
      phaseAfter: result.state.phase,
      generate: result.generate
    })
    return { ok: true, generation: generation || null }
  })
  if (operation === 'fail') {
    const { eventId, leaseToken } = leaseSchema.parse(body)
    const context = await loadLeasedMessage(eventId, leaseToken)
    const failedText = effectiveMessageText(context.state, context.payload.type === 'audio' ? context.payload.transcript || '' : context.payload.text || '')
    // Guarda o texto para um “sim” reprocessar; a segunda falha seguida não reabre a pergunta em loop.
    const retried = Boolean(context.state.retryMessage) && failedText === context.state.retryMessage!.text
    context.state.retryMessage = failedText.trim() && !retried ? { text: failedText.slice(0, 4000), at: Date.now() } : undefined
    const text = context.state.retryMessage
      ? 'Não consegui processar essa mensagem agora. Seu pedido está salvo. Quer tentar de novo?'
      : 'Ainda não consegui processar. Seu pedido está salvo; pode me mandar o pedido de novo com outras palavras?'
    rememberConversationTurns(context.state, [
      { role: 'user', text: failedText },
      { role: 'assistant', text }
    ])
    await persistConversationResult(eventId, leaseToken, context.state, [{ type: 'text', text }], true)
    await pgQuery("UPDATE public.whatsapp_creation_events SET status='failed',last_error=coalesce(last_error,'workflow_failed') WHERE id=$1 AND owner_id=$2", [eventId, context.owner_id])
    return { ok: true }
  }
  if (operation === 'outbox-claim') return claimCreationOutbound()
  if (operation === 'poll-jobs') return pollWhatsAppJobs(event)
  if (operation === 'follow-up-themes') return followUpWhatsAppThemes()
  if (operation === 'workflow-error') {
    const log = z.object({ workflowId: z.string().max(100), executionId: z.string().max(100), node: z.string().max(100) }).strict().parse(body)
    console.error('[whatsapp-creation:workflow-error]', JSON.stringify(log))
    return { ok: true, recorded: true }
  }
  if (operation === 'outbox-ack') {
    const parsed = z.object({ id: z.string().uuid(), token: z.string().uuid(), ingress: z.boolean(), uncertain: z.boolean().optional(), result: z.unknown().optional() }).parse(body)
    return acknowledgeCreationOutbound(parsed.id, parsed.token, parsed.ingress, parsed.result, parsed.uncertain)
  }
  throw createError({ statusCode: 404, statusMessage: 'Operação indisponível.' })
})
