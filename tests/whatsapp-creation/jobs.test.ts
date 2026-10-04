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

const { pollWhatsAppJobs } = await import('../../server/utils/whatsapp-creation/jobs')

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
    let persistedState = initialState
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
    expect(queuedMessages).toEqual([expect.objectContaining({ type: 'text', text: expect.stringMatching(/tentar novamente/i) })])
    expect(idempotencyKey).toMatch(new RegExp(`^generation-error:${orderId}:\\d+$`))
    expect(queryCalls.some(sql => /UPDATE public\.whatsapp_creation_orders.*status='rendering'/.test(sql))).toBe(false)
  })
})
