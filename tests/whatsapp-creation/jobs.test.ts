import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  approveData,
  approveImage,
  createOrder,
  registerPreview,
  updateOrder
} from '../../shared/whatsapp-creation'
import { newConversationState, type ConversationState } from '../../server/utils/whatsapp-creation/conversation'

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  tx: vi.fn(),
  resolveAccount: vi.fn(),
  generate: vi.fn(),
  readBytes: vi.fn(),
  headers: vi.fn(),
  queue: vi.fn(),
  access: vi.fn(),
  prepareHeader: vi.fn(),
  advance: vi.fn()
}))

vi.mock('../../server/utils/postgres', () => ({ pgQuery: mocks.query, pgTx: mocks.tx }))
vi.mock('../../server/utils/whatsapp-creation/access', () => ({ resolveWhatsAppAccount: mocks.resolveAccount }))
vi.mock('../../server/utils/whatsapp-creation/repository', () => ({
  assertCreationAccess: mocks.access,
  queueCreationSend: mocks.queue
}))
vi.mock('../../server/utils/whatsapp-creation/render', () => ({ generateCreationArtifact: mocks.generate }))
vi.mock('../../server/utils/whatsapp-creation/media', () => ({ ownedStorageBytes: mocks.readBytes }))
vi.mock('../../server/utils/whatsapp-creation/catalog', () => ({ listCreationHeaders: mocks.headers }))
vi.mock('../../server/utils/whatsapp-creation/header-preview', () => ({ prepareCreationHeader: mocks.prepareHeader }))
vi.mock('../../server/utils/whatsapp-creation/conversation', async importOriginal => {
  const actual = await importOriginal<typeof import('../../server/utils/whatsapp-creation/conversation')>()
  return { ...actual, advanceConversation: mocks.advance }
})

const { generateWhatsAppOrder, pollWhatsAppJobs } = await import('../../server/utils/whatsapp-creation/jobs')

const ownerId = '11111111-1111-4111-8111-111111111111'
const orderId = '22222222-2222-4222-8222-222222222222'
const conversationId = '33333333-3333-4333-8333-333333333333'
const token = 'render-claim-token'

function renderingState(): ConversationState {
  let order = createOrder({
    id: orderId,
    identity: { accountId: ownerId, normalizedSender: '+5511999999999' },
    kind: 'encarte', theme: 'Fecha Mês', formats: [{ id: 'stories', width: 1080, height: 1920 }],
    division: 'single',
    products: [{ id: 'rice', name: 'Arroz', brand: 'Marca', variant: 'Tipo 1', weight: '5 kg', price: 'R$ 19,90' }],
    validity: 'sem validade'
  })
  order = updateOrder(order, ownerId, { header: { id: 'header-story', revision: 1, theme: 'Fecha Mês', formats: ['stories'] } })
  order = approveImage(order, ownerId, { itemId: 'rice', key: `whatsapp-creation/${ownerId}/inbound/rice.png`, hash: 'image-hash' })
  order = approveData(order, ownerId)
  order = registerPreview(order, ownerId, { artifactId: 'old-preview', revision: order.revision, formatIds: ['stories'] })
  return {
    ...newConversationState(),
    phase: 'rendering',
    draft: { kind: 'encarte', theme: 'Fecha Mês', formats: ['stories'], division: 'single', products: [...order.products], validity: 'sem validade' },
    header: { id: 'header-story', revision: 1, theme: 'Fecha Mês', formats: ['stories'], name: 'Modelo' },
    order,
    artifacts: [{ artifactId: 'old-preview', formatId: 'stories', key: 'old.png', hash: 'old-hash', mimeType: 'image/png', projectId: 'old-project', editUrl: '/old' }],
    runtime: { token, until: new Date(Date.now() + 60_000).toISOString(), started: new Date(Date.now() - 6 * 60_000).toISOString() }
  }
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.queue.mockResolvedValue(undefined)
})

describe('recuperação de jobs WhatsApp', () => {
  it('marca como falha um render órfão antigo, invalida aprovações e não repete geração paga', async () => {
    const initialState = renderingState()
    const originalRevision = initialState.order!.revision
    let persistedState = structuredClone(initialState)
    let persistedStatus = ''
    const queryCalls: string[] = []
    mocks.query.mockImplementation(async (query: string) => {
      const sql = query.replace(/\s+/g, ' ').trim()
      queryCalls.push(sql)
      if (sql.startsWith("SELECT id FROM public.whatsapp_creation_orders WHERE status='rendering'")) return { rows: [{ id: orderId }] }
      if (sql.startsWith('SELECT o.*,c.sender_phone,c.current_order_id FROM public.whatsapp_creation_orders')) {
        return { rows: [{ id: orderId, owner_id: ownerId, conversation_id: conversationId, sender_phone: '+5511999999999', kind: 'encarte', state: persistedState }] }
      }
      throw new Error(`Unexpected global SQL: ${sql}`)
    })
    const client = { query: vi.fn(async (query: string, params: any[] = []) => {
      const sql = query.replace(/\s+/g, ' ').trim()
      queryCalls.push(sql)
      if (sql.startsWith('SELECT current_order_id FROM public.whatsapp_creation_conversations')) return { rows: [{ current_order_id: orderId }] }
      if (sql.startsWith('SELECT state FROM public.whatsapp_creation_orders')) return { rows: [{ state: persistedState }] }
      if (sql.startsWith('UPDATE public.whatsapp_creation_orders')) {
        persistedState = JSON.parse(params[2])
        persistedStatus = sql.includes("status='failed'") ? 'failed' : 'other'
        return { rows: [], rowCount: 1 }
      }
      throw new Error(`Unexpected transactional SQL: ${sql}`)
    }) }
    mocks.tx.mockImplementation(async (callback: (client: any) => unknown) => callback(client))

    const event = { context: {}, $fetch: vi.fn() } as any
    const result = await pollWhatsAppJobs(event)

    expect(result).toMatchObject({ ok: true, checked: 1, completed: 0 })
    expect(persistedStatus).toBe('failed')
    expect(queryCalls[0]).toContain("updated_at<now()-interval '5 minutes'")
    const conversationLock = queryCalls.findIndex(sql => sql.startsWith('SELECT current_order_id FROM public.whatsapp_creation_conversations'))
    const orderLock = queryCalls.findIndex(sql => sql.startsWith('SELECT state FROM public.whatsapp_creation_orders'))
    expect(conversationLock).toBeGreaterThan(-1)
    expect(conversationLock).toBeLessThan(orderLock)
    expect(persistedState.phase).toBe('collecting')
    expect(persistedState.runtime).toBeUndefined()
    expect(persistedState.artifacts).toEqual([])
    expect(persistedState.order!.revision).toBe(originalRevision + 1)
    expect(persistedState.order!.dataApprovedRevision).toBeNull()
    expect(persistedState.order!.images[0]?.approvedRevision).toBeNull()
    expect(persistedState.order!.previews).toEqual([])
    expect(persistedState.order!.previewApprovals).toEqual([])
    expect(mocks.generate).not.toHaveBeenCalled()
    expect(event.$fetch).not.toHaveBeenCalled()
    expect(mocks.queue).toHaveBeenCalledTimes(1)
    const [, queuedConversationId, queuedOwnerId, queuedOrderId, queuedState, queuedMessages, idempotencyKey] = mocks.queue.mock.calls[0]!
    expect([queuedConversationId, queuedOwnerId, queuedOrderId]).toEqual([conversationId, ownerId, orderId])
    expect(queuedState).toMatchObject({ phase: 'collecting' })
    expect(queuedMessages).toEqual([expect.objectContaining({ type: 'text', text: expect.stringMatching(/tentar de novo.*ajustar/i) })])
    expect(queuedState.recentTurns?.at(-1)).toMatchObject({ role: 'assistant', text: expect.stringMatching(/não consegui montar a prévia/i) })
    expect(idempotencyKey).toMatch(new RegExp(`^generation-error:${orderId}:\\d+$`))
    expect(queryCalls.some(sql => /UPDATE public\.whatsapp_creation_orders.*status='rendering'/.test(sql))).toBe(false)
  })

  const revisionError = () => Object.assign(new Error('Cabeçalho mudou'), {
    statusCode: 409,
    statusMessage: 'O cabeçalho do encarte mudou depois da escolha do cliente.',
    data: { code: 'HEADER_REVISION_CHANGED' }
  })

  function installHeaderRecoveryMocks(initialState: ConversationState, error: any, mutateDuringPreparation?: (state: ConversationState, setCurrentOrderId: (value: string) => void) => void) {
    initialState.runtime!.started = undefined
    let persistedState = structuredClone(initialState)
    let currentOrderId = orderId
    let persistedStatus = 'rendering'
    const client = { query: vi.fn(async (query: string, params: any[] = []) => {
      const sql = query.replace(/\s+/g, ' ').trim()
      if (sql.startsWith('SELECT current_order_id FROM public.whatsapp_creation_conversations')) return { rows: [{ current_order_id: currentOrderId }] }
      if (sql.startsWith('SELECT state FROM public.whatsapp_creation_orders')) return { rows: [{ state: structuredClone(persistedState) }] }
      if (sql.startsWith('UPDATE public.whatsapp_creation_orders')) {
        persistedState = JSON.parse(params[2])
        persistedStatus = sql.includes("status='collecting'") ? 'collecting' : 'other'
        return { rows: [], rowCount: 1 }
      }
      throw new Error(`Unexpected transactional SQL: ${sql}`)
    }) }
    mocks.tx.mockImplementation(async (callback: (client: any) => unknown) => callback(client))
    mocks.query.mockImplementation(async (query: string) => {
      const sql = query.replace(/\s+/g, ' ').trim()
      if (sql.startsWith('SELECT o.*,c.sender_phone,c.current_order_id FROM public.whatsapp_creation_orders')) {
        return { rows: [{ id: orderId, owner_id: ownerId, conversation_id: conversationId, sender_phone: '+5511999999999', current_order_id: currentOrderId, kind: 'encarte', state: structuredClone(persistedState) }] }
      }
      if (sql.startsWith('UPDATE public.whatsapp_creation_orders SET state=jsonb_set')) return { rows: [{ id: orderId }] }
      throw new Error(`Unexpected global SQL: ${sql}`)
    })
    mocks.resolveAccount.mockResolvedValue({ ok: true, user: { id: ownerId, user_metadata: { name: 'Rafa' } }, businessProfile: {} })
    mocks.generate.mockRejectedValue(error)
    mocks.headers.mockResolvedValue({ headers: [{ id: 'header-story', revision: 2, theme: 'Fecha Mês', formats: ['stories'], name: 'Modelo atualizado' }], hasMore: false, missingTheme: false })
    mocks.prepareHeader.mockImplementation(async (header: any) => {
      if (mutateDuringPreparation) mutateDuringPreparation(persistedState, value => { currentOrderId = value })
      return { ...header, headerKey: 'whatsapp-creation/owner/headers/fresh.png' }
    })
    return {
      client,
      get state() { return persistedState },
      get currentOrderId() { return currentOrderId },
      setCurrentOrderId(value: string) { currentOrderId = value },
      get status() { return persistedStatus }
    }
  }

  it('recupera 409 de revisão com cabeçalho atual, mantém ofertas e fotos e invalida aprovações antigas', async () => {
    const initialState = renderingState()
    const originalRevision = initialState.order!.revision
    initialState.candidates = [{ itemId: 'rice', key: `whatsapp-creation/${ownerId}/inbound/rice.png`, hash: 'image-hash' }]
    const fixture = installHeaderRecoveryMocks(initialState, revisionError())
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const result = await generateWhatsAppOrder(orderId, token, 'encarte', { context: {}, $fetch: vi.fn() } as any)

    expect(result).toEqual({ ok: true, recovered: true })
    expect(fixture.status).toBe('collecting')
    expect(fixture.client.query.mock.calls.map(call => String(call[0]).replace(/\s+/g, ' ').trim()).slice(0, 2)).toEqual([
      expect.stringContaining('FROM public.whatsapp_creation_conversations'),
      expect.stringContaining('FROM public.whatsapp_creation_orders')
    ])
    expect(fixture.state.phase).toBe('header')
    expect(fixture.state.order!.revision).toBe(originalRevision + 1)
    expect(fixture.state.order!.products[0]).toMatchObject({ name: 'Arroz', price: 'R$ 19,90' })
    expect(fixture.state.draft.validity).toBe('sem validade')
    expect(fixture.state.draft.formats).toEqual(['stories'])
    expect(fixture.state.candidates).toEqual([{ itemId: 'rice', key: `whatsapp-creation/${ownerId}/inbound/rice.png`, hash: 'image-hash' }])
    expect(fixture.state.order!.images[0]).toMatchObject({ key: `whatsapp-creation/${ownerId}/inbound/rice.png`, approvedRevision: null })
    expect(fixture.state.order!.dataApprovedRevision).toBeNull()
    expect(fixture.state.order!.previews).toEqual([])
    expect(fixture.state.order!.previewApprovals).toEqual([])
    expect(fixture.state.order!.header).toBeNull()
    expect(fixture.state.runtime).toBeUndefined()
    expect(fixture.state.artifacts).toEqual([])
    expect(fixture.state.recentTurns?.at(-1)).toMatchObject({ role: 'assistant', text: expect.stringMatching(/cabeçalho escolhido.*prefere ver outro/i) })
    expect(fixture.state.choices).toEqual([expect.objectContaining({ revision: 2, headerKey: expect.stringContaining('fresh.png') })])
    expect((fixture.state as any).headerRefreshPending).toBe(true)
    expect(mocks.generate).toHaveBeenCalledTimes(1)
    expect(mocks.headers).toHaveBeenCalledWith(ownerId, 'encarte', 'Fecha Mês', ['stories'], 0, 'header-story')
    expect(mocks.queue).toHaveBeenCalledTimes(1)
    expect(mocks.queue.mock.calls[0]![5]).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'image', key: 'whatsapp-creation/owner/headers/fresh.png' }),
      expect.objectContaining({ type: 'text', text: expect.stringMatching(/atualizado.*funciona.*prefere ver outro/i) })
    ]))
    expect(log).toHaveBeenCalledWith('[whatsapp-creation:generation-failed]', expect.stringContaining(`"orderId":"${orderId}"`))
    expect(log.mock.calls[0]![1]).toContain('"revision":')
    expect(log.mock.calls[0]![1]).toContain('"code":"HEADER_REVISION_CHANGED"')
    expect(log.mock.calls[0]![1]).toContain('"reason":"O cabeçalho do encarte mudou depois da escolha do cliente."')
    expect(log.mock.calls[0]![1]).not.toContain('stack')
    log.mockRestore()
  })

  it('entrega o encarte gerado já como final aprovado e salva a fala no contexto', async () => {
    const initialState = renderingState()
    const fixture = installHeaderRecoveryMocks(initialState, new Error('unused'))
    mocks.generate.mockResolvedValue({ artifacts: [{ artifactId: 'fresh-preview', formatId: 'stories', key: 'preview.png', hash: 'hash', mimeType: 'image/png', projectId: 'project', editUrl: '/editor' }] })

    const result = await generateWhatsAppOrder(orderId, token, 'encarte', { context: {}, $fetch: vi.fn() } as any)

    expect(result).toMatchObject({ ok: true, count: 1 })
    expect(fixture.state.phase).toBe('approved')
    expect(fixture.state.order!.previewApprovals.map(approval => approval.artifactId)).toEqual(['fresh-preview'])
    expect(fixture.client.query.mock.calls.map(call => String(call[0]).replace(/\s+/g, ' ').trim()).slice(0, 2)).toEqual([
      expect.stringContaining('FROM public.whatsapp_creation_conversations'),
      expect.stringContaining('FROM public.whatsapp_creation_orders')
    ])
    expect(mocks.queue.mock.calls[0]![5]).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'image', key: 'preview.png', artifactId: 'fresh-preview', formatId: 'stories', purpose: 'final' }),
      expect.objectContaining({ type: 'document', key: 'preview.png', artifactId: 'fresh-preview', formatId: 'stories', purpose: 'final' }),
      expect.objectContaining({ type: 'text', text: 'Seu encarte está pronto e salvo na sua conta do Job Varejo. Se quiser algum ajuste, é só me falar que eu gero uma nova versão.' })
    ]))
    expect(fixture.state.recentTurns?.at(-1)).toMatchObject({ role: 'assistant', text: 'Seu encarte está pronto e salvo na sua conta do Job Varejo. Se quiser algum ajuste, é só me falar que eu gero uma nova versão.' })
    expect(fixture.state.previewPresentedRevision).toBe(fixture.state.order!.revision)
  })

  it('avisa na entrega quando preservou a edição do painel salvando outra versão', async () => {
    const initialState = renderingState()
    const fixture = installHeaderRecoveryMocks(initialState, new Error('unused'))
    const notice = 'Vi que você mexeu nesse encarte pelo painel. Para não apagar suas alterações, salvei esta versão do WhatsApp como um novo encarte na sua conta.'
    mocks.generate.mockResolvedValue({ notice, artifacts: [{ artifactId: 'fresh-preview', formatId: 'stories', key: 'preview.png', hash: 'hash', mimeType: 'image/png', projectId: 'project-v2', editUrl: '/editor/project-v2' }] })

    await generateWhatsAppOrder(orderId, token, 'encarte', { context: {}, $fetch: vi.fn() } as any)

    const texts = mocks.queue.mock.calls[0]![5].filter((item: any) => item.type === 'text').map((item: any) => item.text)
    expect(texts).toEqual([notice, expect.stringMatching(/^Seu encarte está pronto/)])
    expect(fixture.state.phase).toBe('approved')
  })

  it.each([
    ['cancelled', (state: ConversationState) => { state.phase = 'cancelled' as any }, 'cancelled', 0, 2],
    ['token changed', (state: ConversationState) => { state.runtime!.token = 'new-token' }, 'rendering', 0, 2],
    ['revision changed', (state: ConversationState) => { state.order = updateOrder(state.order!, ownerId, {}) }, 'rendering', 1, 2],
    ['current order changed', (_state: ConversationState, setCurrentOrderId: (value: string) => void) => { setCurrentOrderId('44444444-4444-4444-8444-444444444444') }, 'rendering', 0, 1]
  ])('não envia a recuperação se %s durante a preparação', async (_label, mutate, expectedPhase, revisionDelta, expectedQueries) => {
    const initialState = renderingState()
    const fixture = installHeaderRecoveryMocks(initialState, revisionError(), mutate as any)
    const result = await generateWhatsAppOrder(orderId, token, 'encarte', { context: {}, $fetch: vi.fn() } as any)

    expect(result).toEqual({ ok: true, stale: true })
    expect(fixture.state.phase).toBe(expectedPhase)
    expect(fixture.state.order!.revision).toBe(initialState.order!.revision + revisionDelta)
    expect(mocks.queue).not.toHaveBeenCalled()
    expect(fixture.client.query).toHaveBeenCalledTimes(expectedQueries)
  })

  it('invalida o snapshot obsoleto se catálogo/prévia falhar, sem tentar render de novo', async () => {
    const initialState = renderingState()
    const fixture = installHeaderRecoveryMocks(initialState, revisionError())
    mocks.headers.mockRejectedValue(new Error('catalog unavailable'))
    const result = await generateWhatsAppOrder(orderId, token, 'encarte', { context: {}, $fetch: vi.fn() } as any)

    expect(result).toEqual({ ok: true, recovered: true })
    expect(fixture.state.phase).toBe('collecting')
    expect(fixture.state.header).toBeUndefined()
    expect(fixture.state.choices).toEqual([])
    expect(fixture.state.order!.header).toBeNull()
    expect(fixture.state.order!.revision).toBe(initialState.order!.revision + 1)
    expect(fixture.state.order!.dataApprovedRevision).toBeNull()
    expect(mocks.prepareHeader).not.toHaveBeenCalled()
    expect(mocks.generate).toHaveBeenCalledTimes(1)
    expect(mocks.queue).toHaveBeenCalledTimes(1)
    expect(mocks.queue.mock.calls[0]![5][0]!.text).toMatch(/procure outro modelo/i)
  })

  it('não trata um 409 genérico como revisão de cabeçalho', async () => {
    const initialState = renderingState()
    const fixture = installHeaderRecoveryMocks(initialState, Object.assign(new Error('conflict'), { statusCode: 409 }))
    await expect(generateWhatsAppOrder(orderId, token, 'encarte', { context: {}, $fetch: vi.fn() } as any)).rejects.toThrow('conflict')

    expect(fixture.state.phase).toBe('collecting')
    expect(mocks.headers).not.toHaveBeenCalled()
    expect(mocks.prepareHeader).not.toHaveBeenCalled()
    expect(mocks.queue).toHaveBeenCalledTimes(1)
  })
})
