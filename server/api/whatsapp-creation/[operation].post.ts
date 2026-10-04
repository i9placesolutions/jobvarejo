import { randomUUID } from 'node:crypto'
import { createError, defineEventHandler, getRouterParam, readBody, setHeader } from 'h3'
import { z } from 'zod'
import { authenticateWhatsAppService } from '~/server/utils/whatsapp-creation/access'
import { ingestCreationEvent, claimCreationMessage, loadLeasedMessage, persistConversationResult,
  claimCreationOutbound, acknowledgeCreationOutbound, assertCreationAccess, beginCreationOrder } from '~/server/utils/whatsapp-creation/repository'
import { interpretationRequest, transcriptionRequest, advanceConversation, proposalSchema } from '~/server/utils/whatsapp-creation/conversation'
import { pollWhatsAppJobs, followUpWhatsAppThemes } from '~/server/utils/whatsapp-creation/jobs'
import { downloadProviderMedia } from '~/server/utils/whatsapp-creation/media'
import { pgQuery } from '~/server/utils/postgres'
import { prepareCreationHeader } from '~/server/utils/whatsapp-creation/header-preview'
import { suggestJevRoute } from '~/server/utils/whatsapp-creation/jev'

const leaseSchema = z.object({ eventId: z.string().uuid(), leaseToken: z.string().uuid() })
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
        request: context.payload.type === 'audio' ? transcriptionRequest(content) : interpretationRequest(context.state, context.payload.text || '', context.account.user.user_metadata.name || context.account.businessProfile.companyName || 'cliente', content) }
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
    return { request: interpretationRequest(context.state, transcript, context.account.user.user_metadata.name || 'Cliente') }
  }
  if (operation === 'apply') {
    const { eventId, leaseToken } = leaseSchema.parse(body)
    let context = await loadLeasedMessage(eventId, leaseToken)
    const response = body.result
    const choice = response?.choices?.[0]
    if (!choice?.message?.content || choice.finish_reason === 'length') throw createError({ statusCode: 422, statusMessage: 'A mensagem precisa ser dividida ou interpretada novamente.' })
    let proposed: unknown
    try { proposed = JSON.parse(String(choice.message.content).replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')) } catch { throw createError({ statusCode: 422, statusMessage: 'Interpretação incompleta. Nenhuma criação foi autorizada.' }) }
    const proposal = proposalSchema.parse(proposed)
    const messageText = context.payload.type === 'audio' ? context.payload.transcript || '' : context.payload.text || ''
    const route = await suggestJevRoute({ text: messageText, phase: context.state.phase, kind: context.state.draft.kind })
    if (route) {
      const nextAction = route.action
      const explicitCancel = /\b(cancelar|cancela|cancele|desistir|desisto)\b/i.test(messageText)
      const explicitNewOrder = /\b(nov[oa]s?\s+(pedido|encarte|v[ií]deo|cartaz|arte)|outro\s+pedido|come[çc]ar\s+(de novo|outro))\b/i.test(messageText)
      if ((nextAction !== 'cancel' || explicitCancel) && (nextAction !== 'new_order' || explicitNewOrder)) {
        proposal.action = nextAction
        if (nextAction === 'choose_header' && !proposal.choice && context.state.phase === 'header') {
          const number = messageText.trim().match(/^(?:(?:op[çc][ãa]o|n[úu]mero)\s*)?(\d{1,2})\s*\.?$/i)
          if (number) proposal.choice = Number(number[1])
        }
      }
    }
    if (proposal.action === 'new_order' && ['approved', 'delivered', 'cancelled'].includes(context.state.phase)) {
      context = await beginCreationOrder(eventId, leaseToken, proposal.kind)
      proposal.action = 'update'
    }
    if (context.payload.type === 'image' && context.state.phase === 'images') proposal.products = undefined
    const kind = proposal.kind || context.state.draft.kind
    if (kind) assertCreationAccess(context.account.user, kind)
    const result = await advanceConversation({ state: context.state, proposal, text: messageText, accountId: context.owner_id,
      sender: context.sender_phone, orderId: context.current_order_id, name: context.account.user.user_metadata.name || context.account.businessProfile.companyName || 'cliente', uploaded: context.payload.uploaded,
      prepareHeader: (header, selectedKind) => prepareCreationHeader(header, selectedKind, context.account) })
    const usage = response.usage || {}, prior = result.state.usage, audio = context.payload.transcriptionUsage
    result.state.usage = { promptTokens: Number(prior?.promptTokens || 0) + Number(audio?.promptTokens || 0) + Math.max(0, Number(usage.prompt_tokens || 0)), completionTokens: Number(prior?.completionTokens || 0) + Number(audio?.completionTokens || 0) + Math.max(0, Number(usage.completion_tokens || 0)), cost: Number(prior?.cost || 0) + Number(audio?.cost || 0) + Math.max(0, Number(usage.cost || 0)) }
    let generation: { orderId: string; token: string; kind: string } | undefined
    if (result.generate) {
      const token = randomUUID()
      result.state.runtime = { token, until: new Date(Date.now() + 15 * 60_000).toISOString() }
      generation = { orderId: context.current_order_id, token, kind: result.state.draft.kind! }
    }
    await persistConversationResult(eventId, leaseToken, result.state, result.send, true, result.missingTheme)
    return { ok: true, generation: generation || null }
  }
  if (operation === 'fail') {
    const { eventId, leaseToken } = leaseSchema.parse(body)
    const context = await loadLeasedMessage(eventId, leaseToken)
    await persistConversationResult(eventId, leaseToken, context.state, [{ type: 'text', text: `${context.account.user.user_metadata.name || 'Cliente'}, não consegui processar essa mensagem. Seu pedido está salvo. Envie os dados em partes ou tente novamente em alguns instantes.` }], true)
    await pgQuery("UPDATE public.whatsapp_creation_events SET status='failed',last_error='workflow_failed' WHERE id=$1 AND owner_id=$2", [eventId, context.owner_id])
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
