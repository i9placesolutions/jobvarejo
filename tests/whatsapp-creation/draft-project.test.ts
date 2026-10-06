import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createOrder, setImageCandidates, updateOrder } from '../../shared/whatsapp-creation'
import { newConversationState, type ConversationState } from '../../server/utils/whatsapp-creation/conversation'
import { draftProjectSignature } from '../../server/utils/whatsapp-creation/draft-project-state'

const mocks = vi.hoisted(() => ({ query: vi.fn(), tx: vi.fn(), resolveAccount: vi.fn(), access: vi.fn(), queue: vi.fn(), save: vi.fn(), busy: vi.fn() }))
vi.mock('../../server/utils/postgres', () => ({ pgQuery: mocks.query, pgTx: mocks.tx }))
vi.mock('../../server/utils/whatsapp-creation/access', () => ({ resolveWhatsAppAccount: mocks.resolveAccount }))
vi.mock('../../server/utils/whatsapp-creation/repository', () => ({ assertCreationAccess: mocks.access, queueCreationSend: mocks.queue }))
vi.mock('../../server/utils/whatsapp-creation/render', () => ({ saveDraftFlyerProject: mocks.save, isFlyerRendererBusy: mocks.busy, FLYER_RENDER_PREEMPTED: 'FLYER_RENDER_PREEMPTED' }))

const { syncDraftProject, syncWhatsAppDraftProjects, draftOrderFor, DRAFT_PROJECT_NOTICE, DRAFT_FORK_NOTICE } = await import('../../server/utils/whatsapp-creation/draft-project')

const ownerId = '11111111-1111-4111-8111-111111111111'
const orderId = '22222222-2222-4222-8222-222222222222'
const conversationId = '33333333-3333-4333-8333-333333333333'
const projectId = '44444444-4444-4444-8444-444444444444'
const header = { id: 'header-1', revision: 10, theme: 'Fecha Mês', formats: ['stories'], name: 'Modelo' }

function reviewState(price = 'R$ 19,90'): ConversationState {
  const products = [{ id: 'rice', name: 'Arroz', brand: '', variant: '', weight: '5 kg', price }]
  let order = createOrder({ id: orderId, identity: { accountId: ownerId, normalizedSender: '+5511999999999' }, kind: 'encarte', theme: 'Fecha Mês',
    formats: [{ id: 'stories', width: 1080, height: 1920 }], division: 'single', products, validity: '06/10 a 07/10' })
  order = updateOrder(order, ownerId, { header: { id: header.id, revision: header.revision, theme: 'Fecha Mês', formats: ['stories'] } })
  const candidates = [{ itemId: 'rice', key: `whatsapp-creation/${ownerId}/inbound/rice.png`, hash: 'a'.repeat(64) }]
  order = setImageCandidates(order, ownerId, candidates)
  const state: ConversationState = { ...newConversationState(), phase: 'data', header, order, candidates,
    draft: { kind: 'encarte', theme: 'Fecha Mês', formats: ['stories'], division: 'single', products, validity: '06/10 a 07/10' } }
  state.draftProject = { signature: draftProjectSignature(state)!, pending: true, attempts: 0 }
  return state
}

let persisted: ConversationState
let current: ConversationState | undefined
let currentOrderId = orderId

function install(state: ConversationState) {
  persisted = structuredClone(state)
  current = undefined
  currentOrderId = orderId
  mocks.query.mockImplementation(async (sql: string) => {
    const normalized = sql.replace(/\s+/g, ' ').trim()
    if (normalized.startsWith('SELECT o.*,c.sender_phone,c.current_order_id')) {
      return { rows: [{ id: orderId, owner_id: ownerId, conversation_id: conversationId, sender_phone: '5511999999999', current_order_id: currentOrderId, kind: 'encarte', state: structuredClone(persisted) }] }
    }
    if (normalized.startsWith('SELECT o.id FROM public.whatsapp_creation_orders o')) return { rows: [{ id: orderId }] }
    throw new Error(`SQL inesperado: ${normalized}`)
  })
  mocks.tx.mockImplementation(async (callback: (client: any) => unknown) => callback({
    query: async (sql: string, params: any[]) => {
      const normalized = sql.replace(/\s+/g, ' ').trim()
      if (normalized.startsWith('SELECT current_order_id')) return { rows: [{ current_order_id: currentOrderId }] }
      if (normalized.startsWith('SELECT state FROM public.whatsapp_creation_orders')) return { rows: [{ state: structuredClone(current || persisted) }] }
      if (normalized.startsWith("UPDATE public.whatsapp_creation_orders SET state=jsonb_set(state,'{draftProject}'")) {
        persisted = { ...(current || persisted), draftProject: JSON.parse(params[2]) }
        return { rows: [] }
      }
      throw new Error(`SQL transacional inesperado: ${normalized}`)
    }
  }))
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.busy.mockReturnValue(false)
  mocks.queue.mockResolvedValue(undefined)
  mocks.resolveAccount.mockResolvedValue({ ok: true, user: { id: ownerId }, businessProfile: { companyName: 'Mercado' } })
})

describe('encarte em andamento salvo no painel', () => {
  it('grava o projeto, guarda o id estável e avisa uma única vez por conversa, sem link', async () => {
    install(reviewState())
    mocks.save.mockResolvedValue({ projectId, version: 1, created: true, stale: false, forked: false })

    expect(await syncDraftProject(orderId)).toBe('synced')

    const [order, candidates, user] = mocks.save.mock.calls[0]!
    expect(order).toMatchObject({ id: orderId, accountId: ownerId, products: [expect.objectContaining({ name: 'Arroz' })] })
    expect(candidates).toEqual(persisted.candidates)
    expect(user).toEqual({ id: ownerId })
    expect(persisted.draftProject).toMatchObject({ pending: false, projectId, version: 1, syncedSignature: draftProjectSignature(persisted) })
    expect(mocks.queue).toHaveBeenCalledTimes(1)
    const [, queuedConversation, queuedOwner, queuedOrder, , messages, correlation] = mocks.queue.mock.calls[0]!
    expect([queuedConversation, queuedOwner, queuedOrder]).toEqual([conversationId, ownerId, orderId])
    expect(messages).toEqual([{ type: 'text', text: DRAFT_PROJECT_NOTICE }])
    expect(DRAFT_PROJECT_NOTICE).not.toMatch(/https?:|jobvarejo\.com/i)
    expect(correlation).toBe(`draft-notice:${conversationId}`)
    // O aviso não vira a "última pergunta" da conversa.
    expect(persisted.recentTurns).toBeUndefined()
  })

  it('não renderiza de novo quando o conteúdo já está no painel', async () => {
    const state = reviewState()
    state.draftProject = { ...state.draftProject!, pending: true, syncedSignature: state.draftProject!.signature, projectId }
    install(state)
    expect(await syncDraftProject(orderId)).toBe('cleared')
    expect(mocks.save).not.toHaveBeenCalled()
    expect(persisted.draftProject).toMatchObject({ pending: false, projectId })
  })

  it('avisa quando preservou a edição do painel criando outra versão', async () => {
    install(reviewState())
    mocks.save.mockResolvedValue({ projectId, version: 2, created: true, stale: false, forked: true })
    await syncDraftProject(orderId)
    expect(mocks.queue.mock.calls[0]![5]).toEqual([{ type: 'text', text: DRAFT_FORK_NOTICE }])
    expect(mocks.queue.mock.calls[0]![6]).toBe(`draft-fork:${orderId}:2`)
    expect(persisted.draftProject).toMatchObject({ projectId, version: 2 })
  })

  it('mantém pendente se o cliente mudou algo durante a gravação', async () => {
    install(reviewState())
    mocks.save.mockImplementation(async () => {
      current = reviewState('R$ 30,00')
      current.draftProject = persisted.draftProject
      return { projectId, version: 1, created: true, stale: false, forked: false }
    })
    await syncDraftProject(orderId)
    expect(persisted.draftProject?.pending).toBe(true)
    expect(persisted.draftProject?.signature).toBe(draftProjectSignature(reviewState('R$ 30,00')))
    expect(persisted.draftProject?.syncedSignature).toBe(draftProjectSignature(reviewState()))
  })

  it('cede a vez quando o renderizador está ocupado, sem consumir tentativa', async () => {
    install(reviewState())
    mocks.busy.mockReturnValue(true)
    expect(await syncDraftProject(orderId)).toBe('busy')
    mocks.busy.mockReturnValue(false)
    mocks.save.mockRejectedValue(Object.assign(new Error('preempted'), { statusCode: 503, data: { code: 'FLYER_RENDER_PREEMPTED' } }))
    expect(await syncDraftProject(orderId)).toBe('busy')
    expect(persisted.draftProject).toMatchObject({ pending: true, attempts: 0 })
    expect(mocks.queue).not.toHaveBeenCalled()
  })

  it('desiste do mesmo conteúdo após falhas repetidas, sem afetar a conversa', async () => {
    install(reviewState())
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    mocks.save.mockRejectedValue(Object.assign(new Error('falhou'), { statusCode: 422, statusMessage: 'Modelo inválido' }))
    for (let attempt = 0; attempt < 3; attempt++) expect(await syncDraftProject(orderId)).toBe('failed')
    expect(persisted.draftProject).toMatchObject({ pending: false, attempts: 3, failedSignature: draftProjectSignature(persisted) })
    expect(persisted.phase).toBe('data')
    expect(await syncDraftProject(orderId)).toBe('cleared')
    expect(mocks.save).toHaveBeenCalledTimes(3)
    warn.mockRestore()
  })

  it('ignora pedido que deixou de ser o atual da conversa', async () => {
    install(reviewState())
    currentOrderId = '55555555-5555-4555-8555-555555555555'
    expect(await syncDraftProject(orderId)).toBe('skipped')
    expect(mocks.save).not.toHaveBeenCalled()
  })

  it('seleciona só pedidos pendentes, parados e fora de processamento', async () => {
    install(reviewState())
    mocks.save.mockResolvedValue({ projectId, version: 1, created: true, stale: false, forked: false })
    expect(await syncWhatsAppDraftProjects()).toEqual({ checked: 1, synced: 1 })
    const selection = String(mocks.query.mock.calls[0]![0]).replace(/\s+/g, ' ')
    expect(selection).toContain("state->'draftProject'->>'pending'='true'")
    expect(selection).toContain("updated_at<now()-interval '20 seconds'")
    expect(selection).toContain('c.lease_until<now()')
  })

  it('monta o rascunho só com o cabeçalho antes dos produtos, sem vencer o pedido real', () => {
    const state: ConversationState = { ...newConversationState(), phase: 'collecting', header, draft: { kind: 'encarte', theme: 'Fecha Mês', formats: ['stories'], products: [] } }
    const order = draftOrderFor(state, orderId, ownerId, '5511999999999')!
    expect(order).toMatchObject({ id: orderId, accountId: ownerId, revision: 0, products: [], header: expect.objectContaining({ id: 'header-1', revision: 10 }) })
    expect(order.formats).toEqual([{ id: 'stories', width: 1080, height: 1920 }])
    expect(draftOrderFor({ ...state, header: undefined }, orderId, ownerId, '5511999999999')).toBeNull()
  })
})
