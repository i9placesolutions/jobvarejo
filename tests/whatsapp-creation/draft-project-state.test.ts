import { describe, expect, it } from 'vitest'
import { createOrder, setImageCandidates, updateOrder } from '../../shared/whatsapp-creation'
import { newConversationState, type ConversationState } from '../../server/utils/whatsapp-creation/conversation'
import { draftProjectSignature, reconcileDraftProjectState } from '../../server/utils/whatsapp-creation/draft-project-state'

const ownerId = '11111111-1111-4111-8111-111111111111'
const orderId = '22222222-2222-4222-8222-222222222222'
const header = { id: 'header-1', revision: 10, theme: 'Fecha Mês', formats: ['stories'], name: 'Modelo' }

function headerOnlyState(): ConversationState {
  return { ...newConversationState(), phase: 'collecting', header, draft: { kind: 'encarte', theme: 'Fecha Mês', formats: ['stories'], products: [] } }
}

function reviewState(price = 'R$ 19,90'): ConversationState {
  const products = [{ id: 'rice', name: 'Arroz', brand: '', variant: '', weight: '5 kg', price }]
  let order = createOrder({ id: orderId, identity: { accountId: ownerId, normalizedSender: '+5511999999999' }, kind: 'encarte', theme: 'Fecha Mês',
    formats: [{ id: 'stories', width: 1080, height: 1920 }], division: 'single', products, validity: '06/10 a 07/10' })
  order = updateOrder(order, ownerId, { header: { id: header.id, revision: header.revision, theme: 'Fecha Mês', formats: ['stories'] } })
  const candidates = [{ itemId: 'rice', key: `whatsapp-creation/${ownerId}/inbound/rice.png`, hash: 'a'.repeat(64) }]
  order = setImageCandidates(order, ownerId, candidates)
  return { ...newConversationState(), phase: 'data', header, order, candidates,
    draft: { kind: 'encarte', theme: 'Fecha Mês', formats: ['stories'], division: 'single', products, validity: '06/10 a 07/10' } }
}

describe('assinatura do encarte em andamento no painel', () => {
  it('só existe para encarte com cabeçalho escolhido', () => {
    const video = { ...headerOnlyState(), draft: { ...headerOnlyState().draft, kind: 'video' as const } }
    expect(draftProjectSignature(newConversationState())).toBeNull()
    expect(draftProjectSignature(video)).toBeNull()
    expect(draftProjectSignature({ ...headerOnlyState(), header: undefined })).toBeNull()
    expect(draftProjectSignature(headerOnlyState())).toMatch(/^[0-9a-f]{64}$/)
  })

  it('muda com preço/foto e não com mensagens que não alteram o encarte', () => {
    const base = reviewState()
    const sameContent = { ...reviewState(), turns: 9, recentTurns: [{ role: 'user' as const, text: 'ok?' }] }
    expect(draftProjectSignature(base)).toBe(draftProjectSignature(sameContent))
    expect(draftProjectSignature(reviewState('R$ 21,90'))).not.toBe(draftProjectSignature(base))
    const otherPhoto = { ...reviewState(), candidates: [{ itemId: 'rice', key: `whatsapp-creation/${ownerId}/inbound/rice-2.png`, hash: 'b'.repeat(64) }] }
    expect(draftProjectSignature(otherPhoto)).not.toBe(draftProjectSignature(base))
  })

  it('muda quando o cliente personaliza o encarte e não muda sem personalização', () => {
    const base = reviewState()
    const customized = { ...reviewState(), order: { ...base.order!, customization: { logoScale: 1.2 } } }
    expect(draftProjectSignature(customized)).not.toBe(draftProjectSignature(base))
    expect(draftProjectSignature({ ...customized, order: { ...base.order!, customization: { logoScale: 1.4 } } })).not.toBe(draftProjectSignature(customized))
    const headerBase = headerOnlyState()
    const headerCustomized = { ...headerOnlyState(), draft: { ...headerBase.draft, customization: { nameScale: 1.3 } } }
    expect(draftProjectSignature(headerCustomized)).not.toBe(draftProjectSignature(headerBase))
  })

  it('não grava rascunho durante a geração/entrega nem com pedido incompleto em collecting', () => {
    for (const phase of ['rendering', 'approved', 'delivered', 'cancelled', 'preview'] as const) {
      expect(draftProjectSignature({ ...reviewState(), phase })).toBeNull()
    }
    // Pedido existente voltou a collecting (falta dado): manter os produtos já gravados no painel.
    expect(draftProjectSignature({ ...reviewState(), phase: 'collecting' })).toBeNull()
  })
})

describe('reconciliação do estado do projeto em andamento', () => {
  it('marca pendente quando o conteúdo é novo', () => {
    const state = reconcileDraftProjectState(reviewState())
    expect(state.draftProject).toMatchObject({ pending: true, attempts: 0, signature: draftProjectSignature(reviewState()) })
  })

  it('preserva o projeto gravado pelo job e não regrava conteúdo igual', () => {
    const signature = draftProjectSignature(reviewState())!
    const stored = { signature, pending: false, syncedSignature: signature, projectId: 'project-1', version: 1, syncedAt: '2026-10-06T10:00:00.000Z' }
    // A mensagem processada em paralelo carregou o estado antes do job gravar.
    const stale = { ...reviewState(), draftProject: { signature, pending: true } }
    const state = reconcileDraftProjectState(stale, stored)
    expect(state.draftProject).toMatchObject({ pending: false, projectId: 'project-1', syncedSignature: signature })
  })

  it('volta a ficar pendente quando o cliente muda algo depois de sincronizar', () => {
    const synced = draftProjectSignature(reviewState())!
    const stored = { signature: synced, syncedSignature: synced, projectId: 'project-1', version: 1, syncedAt: '2026-10-06T10:00:00.000Z' }
    const state = reconcileDraftProjectState({ ...reviewState('R$ 25,00'), draftProject: stored }, stored)
    expect(state.draftProject).toMatchObject({ pending: true, projectId: 'project-1', attempts: 0 })
  })

  it('não insiste em conteúdo que falhou repetidamente', () => {
    const signature = draftProjectSignature(reviewState())!
    const stored = { signature, failedSignature: signature, attempts: 3 }
    expect(reconcileDraftProjectState({ ...reviewState(), draftProject: stored }, stored).draftProject?.pending).toBe(false)
  })

  it('não cria estado para pedidos sem projeto no painel', () => {
    const state = reconcileDraftProjectState(newConversationState())
    expect(state.draftProject).toBeUndefined()
  })
})
