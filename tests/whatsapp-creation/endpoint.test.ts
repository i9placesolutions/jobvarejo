import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(), load: vi.fn(), begin: vi.fn(), persist: vi.fn(), access: vi.fn(),
  advance: vi.fn(), pgQuery: vi.fn(), headers: vi.fn()
}))

vi.mock('h3', async () => {
  const actual = await vi.importActual<any>('h3')
  return {
    ...actual,
    getRouterParam: (event: any) => event.operation,
    readBody: (event: any) => event.body,
    setHeader: vi.fn()
  }
})
vi.mock('../../server/utils/whatsapp-creation/access', () => ({ authenticateWhatsAppService: mocks.authenticate }))
vi.mock('../../server/utils/whatsapp-creation/repository', () => ({
  ingestCreationEvent: vi.fn(), claimCreationMessage: vi.fn(), loadLeasedMessage: mocks.load,
  persistConversationResult: mocks.persist, claimCreationOutbound: vi.fn(), acknowledgeCreationOutbound: vi.fn(),
  assertCreationAccess: mocks.access, beginCreationOrder: mocks.begin
}))
vi.mock('../../server/utils/whatsapp-creation/conversation', async () => {
  const actual = await vi.importActual<any>('../../server/utils/whatsapp-creation/conversation')
  return { ...actual, advanceConversation: mocks.advance }
})
vi.mock('../../server/utils/whatsapp-creation/jobs', () => ({ pollWhatsAppJobs: vi.fn(), followUpWhatsAppThemes: vi.fn() }))
vi.mock('../../server/utils/whatsapp-creation/media', () => ({ downloadProviderMedia: vi.fn() }))
vi.mock('../../server/utils/postgres', () => ({ pgQuery: mocks.pgQuery }))
vi.mock('../../server/utils/whatsapp-creation/header-preview', () => ({ prepareCreationHeader: vi.fn() }))
vi.mock('../../server/utils/whatsapp-creation/jev', () => ({ hasBriefFields: vi.fn(() => false), shouldConsultJev: vi.fn(() => false), suggestJevRoute: vi.fn() }))
vi.stubGlobal('defineEventHandler', (handler: any) => handler)

const { default: handler } = await import('../../server/api/whatsapp-creation/[operation].post')
const eventId = '55555555-5555-4555-8555-555555555555'
const leaseToken = '66666666-6666-4666-8666-666666666666'
const ownerId = '11111111-1111-4111-8111-111111111111'
const oldOrderId = '33333333-3333-4333-8333-333333333333'
const newOrderId = '77777777-7777-4777-8777-777777777777'
let context: any

function makeState(phase: string) {
  return { phase, draft: { kind: 'encarte', theme: 'Fecha Mês', formats: ['stories'], products: [], validity: 'sem validade' },
    choices: [{ id: 'header-1', name: 'Cabeçalho' }], candidates: [], artifacts: [], turns: 1 }
}
function request(proposal: Record<string, unknown>, text: string) {
  return { operation: 'apply', body: { eventId, leaseToken, result: { choices: [{ message: { content: JSON.stringify(proposal) }, finish_reason: 'stop' }], usage: {} } }, text }
}

beforeEach(() => {
  vi.clearAllMocks()
  context = { event_id: eventId, conversation_id: '44444444-4444-4444-8444-444444444444', owner_id: ownerId,
    sender_phone: '+5511999999999', current_order_id: oldOrderId, payload: { type: 'text', text: '' }, state: makeState('data'),
    account: { user: { id: ownerId, user_metadata: { name: 'Rafa' } }, businessProfile: {} } }
  mocks.load.mockImplementation(async () => context)
  mocks.begin.mockImplementation(async (_eventId, _token, kind, options) => {
    context = { ...context, current_order_id: newOrderId, state: { ...makeState('collecting'), startedByEventId: eventId,
      draft: { ...makeState('collecting').draft, ...(kind ? { kind } : {}) } } }
    return context
  })
  mocks.advance.mockImplementation(async ({ state }: any) => ({ state, send: [{ type: 'text', text: 'certo' }], generate: false }))
  mocks.persist.mockResolvedValue({ orderId: oldOrderId })
})
afterEach(() => vi.restoreAllMocks())

describe('roteamento do pedido WhatsApp', () => {
  it('executa cancelar e iniciar outro em uma transação, mesmo se reject se refere ao pedido antigo', async () => {
    const proposal = { action: 'cancel_and_start_new', confirmationIntent: 'reject', confirmationEvidence: 'cancela esse' }
    context.state.pendingOrderChoice = true
    context.payload.text = 'Cancela esse pedido e faz outro com cabeçalho azul'
    await handler(request(proposal, context.payload.text) as any)
    expect(mocks.begin).toHaveBeenCalledWith(eventId, leaseToken, 'encarte', { cancelCurrent: true })
    expect(mocks.advance.mock.calls[0]?.[0].proposal.action).toBe('update')
    expect(mocks.persist).toHaveBeenCalledOnce()
  })

  it('não cancela o pedido quando a mensagem pede outro cabeçalho apesar da ação do modelo', async () => {
    context.state = makeState('header')
    context.payload.text = 'Quero outro cabeçalho'
    const proposal = { action: 'cancel_and_start_new', confirmationIntent: 'unclear' }
    await handler(request(proposal, context.payload.text) as any)
    expect(mocks.begin).not.toHaveBeenCalled()
    expect(mocks.advance.mock.calls[0]?.[0].proposal.action).toBe('more_headers')
    expect(mocks.advance.mock.calls[0]?.[0].state.draft.theme).toBe('Fecha Mês')
  })

  it('não troca o pedido quando a ação composta aponta apenas para cabeçalho', async () => {
    context.state = { ...makeState('header'), pendingOrderChoice: true }
    context.payload.text = 'Cancela esse cabeçalho e faz outro'
    await handler(request({ action: 'cancel_and_start_new' }, context.payload.text) as any)
    expect(mocks.begin).not.toHaveBeenCalled()
    expect(mocks.advance.mock.calls[0]?.[0].proposal.action).toBe('more_headers')
  })

  it('não cancela por pergunta hipotética e mantém a escolha de continuar', async () => {
    context.payload.text = 'Como cancelo? Vamos continuar.'
    await handler(request({ action: 'cancel' }, context.payload.text) as any)
    expect(mocks.begin).not.toHaveBeenCalled()
    expect(mocks.advance.mock.calls[0]?.[0].proposal.action).toBe('status')
  })

  it('mantém o pedido quando o cancelamento é negado', async () => {
    context.payload.text = 'Não cancela, vamos continuar'
    await handler(request({ action: 'cancel' }, context.payload.text) as any)
    expect(mocks.begin).not.toHaveBeenCalled()
    expect(mocks.advance.mock.calls[0]?.[0].proposal.action).toBe('status')
  })

  it('inicia outro quando essa foi a resposta à pergunta pendente', async () => {
    context.state.pendingOrderChoice = true
    context.payload.text = 'Vamos no novo'
    await handler(request({ action: 'new_order', confirmationIntent: 'unclear' }, context.payload.text) as any)
    expect(mocks.begin).toHaveBeenCalledWith(eventId, leaseToken, 'encarte', { cancelCurrent: true })
    expect(mocks.advance.mock.calls[0]?.[0].proposal.action).toBe('update')
  })

  it('mantém o UUID vazio ao receber tema ou controles mal classificados como novo pedido', async () => {
    context.state = {
      ...makeState('collecting'),
      pendingOrderChoice: true,
      draft: { kind: 'encarte', formats: [], products: [] },
      recentTurns: [
        { role: 'user', text: 'COMEÇAR OUTRO' },
        { role: 'assistant', text: 'Qual tema ou campanha você deseja?' },
        { role: 'user', text: 'TERÇA E QUARTA' },
        { role: 'assistant', text: 'Quer continuar esse encarte ou começar outro?' },
        { role: 'user', text: 'COMECAR' },
        { role: 'assistant', text: 'Quer continuar esse encarte ou começar outro?' }
      ]
    }
    context.payload.text = 'COMEÇAR'
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    await handler(request({ action: 'new_order', confirmationIntent: 'unclear', confirmationEvidence: '', productOperation: 'unclear', kind: 'encarte' }, context.payload.text) as any)
    expect(mocks.begin).not.toHaveBeenCalled()
    expect(mocks.advance.mock.calls[0]?.[0].proposal).toMatchObject({ action: 'update', theme: 'TERÇA E QUARTA' })
    expect(info).toHaveBeenCalledWith('whatsapp_creation_decision', expect.objectContaining({
      eventId, orderId: oldOrderId, modelAction: 'new_order', routeAction: null,
      action: 'update', phaseBefore: 'collecting', phaseAfter: 'collecting', generate: false
    }))
    const logged = JSON.stringify(info.mock.calls)
    expect(logged).not.toContain('TERÇA E QUARTA')
    expect(logged).not.toContain(context.sender_phone)
  })

  it('aplica tema literal numa proposta new_order sem trocar a ordem vazia', async () => {
    context.state = { ...makeState('collecting'), draft: { kind: 'encarte', formats: [], products: [] } }
    context.payload.text = 'TERÇA E QUARTA'
    await handler(request({ action: 'new_order', theme: 'TERÇA E QUARTA' }, context.payload.text) as any)
    expect(mocks.begin).not.toHaveBeenCalled()
    expect(mocks.advance.mock.calls[0]?.[0].proposal).toMatchObject({ action: 'update', theme: 'TERÇA E QUARTA' })
  })

  it('não revive ordem terminal vazia; inicia uma nova sem cancelCurrent', async () => {
    context.state = { ...makeState('cancelled'), draft: { kind: 'encarte', formats: [], products: [] } }
    context.payload.text = 'COMEÇAR OUTRO'
    await handler(request({ action: 'new_order' }, context.payload.text) as any)
    expect(mocks.begin).toHaveBeenCalledWith(eventId, leaseToken, undefined)
    expect(mocks.advance.mock.calls[0]?.[0].proposal.action).toBe('update')
  })

  it('verifica acesso ao novo tipo antes de cancelar o pedido atual', async () => {
    context.payload.text = 'Cancela esse e faz um vídeo'
    mocks.access.mockImplementationOnce(() => { throw new Error('Acesso indisponível') })
    await expect(handler(request({ action: 'cancel_and_start_new', kind: 'video' }, context.payload.text) as any)).rejects.toThrow('Acesso indisponível')
    expect(mocks.begin).not.toHaveBeenCalled()
    expect(mocks.persist).not.toHaveBeenCalled()
  })

  it('reutiliza o pedido já iniciado pelo mesmo evento quando o apply é repetido', async () => {
    context.state = { ...makeState('collecting'), startedByEventId: eventId }
    await handler(request({ action: 'new_order' }, 'novo pedido') as any)
    expect(mocks.begin).not.toHaveBeenCalled()
    expect(mocks.advance.mock.calls[0]?.[0].proposal.action).toBe('update')
    expect(mocks.advance.mock.calls[0]?.[0].orderId).toBe(oldOrderId)
  })
})
